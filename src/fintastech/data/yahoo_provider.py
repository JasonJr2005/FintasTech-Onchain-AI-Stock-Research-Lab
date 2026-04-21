"""
Yahoo Finance provider — default real-time data source.

Supports US, HK (``.HK``), Shanghai (``.SS``), Shenzhen (``.SZ``) and any
yfinance-valid ticker.

This module is **defensive**:

* Every outbound call is wrapped so that transient Yahoo errors never crash
  the FastAPI worker — they surface as empty frames / ``None`` values and
  callers decide what to do.
* Prices are sanitized: NaN / ``inf`` / ``<= 0`` values are dropped so the
  simulator never accidentally trades on invalid data.
* A best-effort in-process cache keeps repeated ``/v1/analyze/{symbol}``
  calls from pounding Yahoo during one browser session.
"""

from __future__ import annotations

import math
import threading
import time
from datetime import date, timedelta
from typing import Any, Literal

import pandas as pd
import yfinance as yf

from fintastech.data.base import MarketDataProvider

# ---------------------------------------------------------------------------
# Currency inference (frontend uses this to pick $ / HK$ / CN¥)
# ---------------------------------------------------------------------------

_SUFFIX_CURRENCY: dict[str, str] = {
    ".HK": "HKD",
    ".SS": "CNY",
    ".SZ": "CNY",
    ".BK": "THB",
    ".T": "JPY",
    ".KS": "KRW",
    ".KQ": "KRW",
    ".L": "GBP",
    ".PA": "EUR",
    ".DE": "EUR",
    ".AS": "EUR",
    ".SI": "SGD",
    ".AX": "AUD",
    ".TO": "CAD",
    ".TW": "TWD",
}


def currency_from_symbol(symbol: str) -> str:
    """Infer the trading currency from a ticker suffix (fallback to USD)."""
    sym = (symbol or "").upper().strip()
    for suffix, cur in _SUFFIX_CURRENCY.items():
        if sym.endswith(suffix):
            return cur
    return "USD"


# ---------------------------------------------------------------------------
# Cache
# ---------------------------------------------------------------------------


class _TTLCache:
    """Tiny thread-safe TTL cache."""

    def __init__(self, ttl_seconds: float) -> None:
        self._ttl = ttl_seconds
        self._data: dict[str, tuple[float, Any]] = {}
        self._lock = threading.Lock()

    def get(self, key: str) -> Any | None:
        with self._lock:
            hit = self._data.get(key)
            if hit is None:
                return None
            ts, val = hit
            if time.time() - ts > self._ttl:
                self._data.pop(key, None)
                return None
            return val

    def set(self, key: str, value: Any) -> None:
        with self._lock:
            self._data[key] = (time.time(), value)


_HISTORY_CACHE = _TTLCache(ttl_seconds=60.0)
_INFO_CACHE = _TTLCache(ttl_seconds=600.0)
_SEARCH_CACHE = _TTLCache(ttl_seconds=300.0)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _sanitize_history(df: pd.DataFrame) -> pd.DataFrame:
    """Drop rows with NaN / non-positive close so downstream never sees junk."""
    if df is None or df.empty:
        return pd.DataFrame(columns=["open", "high", "low", "close", "volume"])
    df = df.rename(
        columns={
            "Open": "open",
            "High": "high",
            "Low": "low",
            "Close": "close",
            "Volume": "volume",
        }
    )
    needed = ["open", "high", "low", "close", "volume"]
    for col in needed:
        if col not in df.columns:
            df[col] = float("nan")
    df = df[needed].copy()
    df = df.replace([float("inf"), float("-inf")], float("nan"))
    df = df.dropna(subset=["close"])
    df = df[df["close"] > 0]
    return df


def _retry(fn, *, attempts: int = 2, base_delay: float = 0.4):
    """Run *fn* up to *attempts* times; return the first successful value."""
    last_exc: Exception | None = None
    for i in range(attempts):
        try:
            return fn()
        except Exception as exc:  # pragma: no cover — network path
            last_exc = exc
            if i + 1 < attempts:
                time.sleep(base_delay * (2**i))
    if last_exc is not None:
        raise last_exc
    return None  # unreachable


# ---------------------------------------------------------------------------
# Provider
# ---------------------------------------------------------------------------


class YahooFinanceProvider(MarketDataProvider):
    """Real-time market data via yfinance. Works for US / HK / A-shares."""

    def get_history(
        self,
        symbol: str,
        *,
        start: date | None = None,
        end: date | None = None,
        interval: Literal["1d", "1wk", "1mo"] = "1d",
        force_refresh: bool = False,
    ) -> pd.DataFrame:
        end_d = end or date.today()
        start_d = start or (end_d - timedelta(days=240))
        key = f"{symbol.upper()}|{start_d}|{end_d}|{interval}"

        if not force_refresh:
            cached = _HISTORY_CACHE.get(key)
            if cached is not None:
                return cached.copy()

        def _fetch() -> pd.DataFrame:
            ticker = yf.Ticker(symbol)
            return ticker.history(
                start=str(start_d),
                end=str(end_d + timedelta(days=1)),
                interval=interval,
                auto_adjust=False,
                timeout=10,
            )

        try:
            raw = _retry(_fetch, attempts=2)
        except Exception:
            raw = pd.DataFrame()

        clean = _sanitize_history(raw)
        _HISTORY_CACHE.set(key, clean.copy())
        return clean

    def get_last_price(
        self, symbol: str, *, force_refresh: bool = False
    ) -> float | None:
        """Return the latest close price, or ``None`` if unavailable.

        Set ``force_refresh=True`` to bypass the in-process cache and hit
        Yahoo again — useful when the UI explicitly clicks "refresh".
        """
        # Try the fastest path first: a tiny ``fast_info`` / live quote call.
        if force_refresh:
            try:
                t = yf.Ticker(symbol)
                fi = getattr(t, "fast_info", None)
                if fi is not None:
                    for key in ("last_price", "lastPrice", "regularMarketPrice"):
                        try:
                            raw_px = fi[key] if hasattr(fi, "__getitem__") else getattr(fi, key, None)
                        except Exception:
                            raw_px = None
                        if raw_px is None:
                            continue
                        try:
                            px = float(raw_px)
                        except Exception:
                            continue
                        if math.isfinite(px) and px > 0:
                            return px
            except Exception:
                pass

        df = self.get_history(symbol, force_refresh=force_refresh)
        if df.empty:
            return None
        try:
            px = float(df["close"].iloc[-1])
        except Exception:
            return None
        if not math.isfinite(px) or px <= 0:
            return None
        return px

    def get_stock_info(self, symbol: str) -> dict[str, Any]:
        """Fetch fundamental data for a ticker. Never raises."""
        key = symbol.upper()
        cached = _INFO_CACHE.get(key)
        if cached is not None:
            return cached

        info: dict[str, Any] = {}
        try:
            info = _retry(lambda: (yf.Ticker(symbol).info or {}), attempts=2) or {}
        except Exception:
            info = {}

        currency = info.get("currency") or currency_from_symbol(symbol)

        out = {
            "name": info.get("longName") or info.get("shortName") or symbol,
            "sector": info.get("sector", ""),
            "industry": info.get("industry", ""),
            "market_cap": info.get("marketCap"),
            "pe_ratio": info.get("trailingPE"),
            "forward_pe": info.get("forwardPE"),
            "pb_ratio": info.get("priceToBook"),
            "ps_ratio": info.get("priceToSalesTrailing12Months"),
            "peg_ratio": info.get("pegRatio"),
            "eps": info.get("trailingEps"),
            "forward_eps": info.get("forwardEps"),
            "roe": info.get("returnOnEquity"),
            "roa": info.get("returnOnAssets"),
            "debt_to_equity": info.get("debtToEquity"),
            "current_ratio": info.get("currentRatio"),
            "profit_margin": info.get("profitMargins"),
            "revenue_growth": info.get("revenueGrowth"),
            "earnings_growth": info.get("earningsGrowth"),
            "dividend_yield": info.get("dividendYield"),
            "beta": info.get("beta"),
            "fifty_two_week_high": info.get("fiftyTwoWeekHigh"),
            "fifty_two_week_low": info.get("fiftyTwoWeekLow"),
            "currency": currency,
            "exchange": info.get("exchange") or info.get("fullExchangeName") or "",
        }
        _INFO_CACHE.set(key, out)
        return out

    def search_tickers(self, query: str, limit: int = 10) -> list[dict]:
        """Search for tickers matching a query string.

        We always return at least one row (the raw query uppercased) so the
        front-end can fall through to an 'add as-is' affordance even when
        Yahoo's search endpoint is rate-limited or offline.
        """
        q = (query or "").strip()
        if not q:
            return []
        cache_key = f"{q.upper()}|{limit}"
        cached = _SEARCH_CACHE.get(cache_key)
        if cached is not None:
            return cached

        q_upper = q.upper()
        fallback = {
            "symbol": q_upper,
            "name": q_upper,
            "exchange": "",
            "type": "",
            "currency": currency_from_symbol(q_upper),
        }
        out: list[dict] = []
        try:
            from yfinance import Search

            results = Search(q, max_results=limit)
            quotes = results.quotes if hasattr(results, "quotes") else []
            for item in quotes[:limit]:
                sym = item.get("symbol") or ""
                if not sym:
                    continue
                out.append(
                    {
                        "symbol": sym,
                        "name": item.get("longname")
                        or item.get("shortname")
                        or sym,
                        "exchange": item.get("exchange", ""),
                        "type": item.get("quoteType", ""),
                        "currency": currency_from_symbol(sym),
                    }
                )
        except Exception:
            pass

        if not any(r["symbol"] == q_upper for r in out):
            out.insert(0, fallback)

        out = out[:limit]
        _SEARCH_CACHE.set(cache_key, out)
        return out


def validate_ticker(symbol: str) -> bool:
    """Quick check: can yfinance fetch at least 1 bar?"""
    try:
        t = yf.Ticker(symbol)
        h = t.history(period="5d", timeout=10)
        return not h.empty
    except Exception:
        return False
