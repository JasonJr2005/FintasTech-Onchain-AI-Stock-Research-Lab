"""Persistent paper-trading ledger.

Two modes of interaction:

* **Manual orders** — :meth:`market_buy`, :meth:`market_sell`, :meth:`close_position`.
  These behave like a classic broker paper account: you specify a symbol and
  either a share count or a dollar-equivalent notional, and the ledger books a
  simulated trade at the latest public close price.

* **Auto research loop** — :meth:`rebalance` runs the rule-based multi-agent
  research pipeline against a watch-list and sizes positions to match the
  model's illustrative weights.

SECURITY / LEGAL: This module never touches, requests, or authenticates to a
real brokerage. It implements paper trading only. See DISCLAIMER.md.
"""

from __future__ import annotations

import json
import math
import threading
import uuid
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Iterable

from fintastech.agents.advisor import ResearchOrchestrator
from fintastech.data.yahoo_provider import YahooFinanceProvider, currency_from_symbol
from fintastech.models.portfolio import RiskProfile, RiskTolerance

# ---------------------------------------------------------------------------
# Persistent state shape
# ---------------------------------------------------------------------------


@dataclass
class _Holding:
    shares: float = 0.0
    avg_cost: float = 0.0
    last_price: float = 0.0
    currency: str = "USD"
    last_signal: str | None = None
    last_confidence: float | None = None


@dataclass
class _Trade:
    timestamp: str
    symbol: str
    side: str  # "buy" / "sell"
    shares: float
    price: float
    notional: float
    reason: str
    id: str = ""
    currency: str = "USD"


@dataclass
class _State:
    initial_capital: float = 100_000.0
    cash: float = 100_000.0
    holdings: dict[str, _Holding] = field(default_factory=dict)
    trades: list[_Trade] = field(default_factory=list)
    equity_curve: list[dict[str, Any]] = field(default_factory=list)
    last_rebalance_at: str | None = None

    def to_json(self) -> dict[str, Any]:
        return {
            "initial_capital": self.initial_capital,
            "cash": self.cash,
            "holdings": {k: asdict(v) for k, v in self.holdings.items()},
            "trades": [asdict(t) for t in self.trades],
            "equity_curve": self.equity_curve,
            "last_rebalance_at": self.last_rebalance_at,
        }

    @classmethod
    def from_json(cls, raw: dict[str, Any]) -> "_State":
        holdings_raw = raw.get("holdings") or {}
        trades_raw = raw.get("trades") or []
        holdings: dict[str, _Holding] = {}
        for sym, payload in holdings_raw.items():
            # tolerate extra / missing keys from older JSON versions
            holdings[sym] = _Holding(
                shares=float(payload.get("shares", 0) or 0),
                avg_cost=float(payload.get("avg_cost", 0) or 0),
                last_price=float(payload.get("last_price", 0) or 0),
                currency=str(payload.get("currency", "USD") or "USD"),
                last_signal=payload.get("last_signal"),
                last_confidence=payload.get("last_confidence"),
            )
        trades: list[_Trade] = []
        for t in trades_raw:
            trades.append(
                _Trade(
                    timestamp=str(t.get("timestamp", "")),
                    symbol=str(t.get("symbol", "")),
                    side=str(t.get("side", "")),
                    shares=float(t.get("shares", 0) or 0),
                    price=float(t.get("price", 0) or 0),
                    notional=float(t.get("notional", 0) or 0),
                    reason=str(t.get("reason", "")),
                    id=str(t.get("id", "") or ""),
                    currency=str(t.get("currency", "USD") or "USD"),
                )
            )
        return cls(
            initial_capital=float(raw.get("initial_capital", 100_000.0)),
            cash=float(raw.get("cash", 100_000.0)),
            holdings=holdings,
            trades=trades,
            equity_curve=list(raw.get("equity_curve") or []),
            last_rebalance_at=raw.get("last_rebalance_at"),
        )


# ---------------------------------------------------------------------------
# Simulated portfolio
# ---------------------------------------------------------------------------


_DISCLAIMER = (
    "EDUCATIONAL / RESEARCH USE ONLY — NOT INVESTMENT ADVICE. "
    "All holdings and trades below are simulated; no real assets are held "
    "and no broker is contacted."
)

# Keep churn out of the auto-rebalance ledger: ignore reallocations smaller
# than $25 notional. Manual orders are NOT subject to this floor.
_MIN_AUTO_TRADE_NOTIONAL = 25.0

# Cap concentration from the auto-rebalance path: no more than this fraction
# of the simulated book in any single name. Manual orders can override this
# (the user is in control) but we still protect cash.
_ABSOLUTE_MAX_WEIGHT = 0.35


class OrderError(ValueError):
    """Raised when a paper-trading order cannot be executed."""


class SimulatedPortfolio:
    """Append-only paper-trading ledger."""

    def __init__(
        self,
        *,
        storage_path: Path,
        provider: YahooFinanceProvider | None = None,
        orchestrator: ResearchOrchestrator | None = None,
    ) -> None:
        self.storage_path = storage_path
        self.provider = provider or YahooFinanceProvider()
        self.orchestrator = orchestrator or ResearchOrchestrator(self.provider)
        self._lock = threading.Lock()
        self._state = self._load()

    # ---- persistence ----------------------------------------------------

    def _load(self) -> _State:
        if not self.storage_path.exists():
            s = _State()
            self._seed_equity_curve(s)
            return s
        try:
            with self.storage_path.open("r", encoding="utf-8") as fh:
                raw = json.load(fh)
            return _State.from_json(raw)
        except Exception:
            s = _State()
            self._seed_equity_curve(s)
            return s

    def _save(self) -> None:
        self.storage_path.parent.mkdir(parents=True, exist_ok=True)
        with self.storage_path.open("w", encoding="utf-8") as fh:
            json.dump(self._state.to_json(), fh, ensure_ascii=False, indent=2)

    @staticmethod
    def _seed_equity_curve(state: _State) -> None:
        state.equity_curve.append(
            {"ts": datetime.now(UTC).isoformat(), "value": state.cash}
        )

    # ---- public API -----------------------------------------------------

    def reset(self, initial_capital: float = 100_000.0) -> dict[str, Any]:
        with self._lock:
            self._state = _State(
                initial_capital=initial_capital,
                cash=initial_capital,
            )
            self._seed_equity_curve(self._state)
            self._save()
            return self._snapshot_unlocked()

    def snapshot(self) -> dict[str, Any]:
        with self._lock:
            return self._snapshot_unlocked()

    def _snapshot_unlocked(
        self, *, refresh_prices: bool = False, force_refresh: bool = False
    ) -> dict[str, Any]:
        state = self._state
        if refresh_prices and state.holdings:
            for sym, h in state.holdings.items():
                try:
                    px = self.provider.get_last_price(
                        sym, force_refresh=force_refresh
                    )
                except Exception:
                    px = None
                if px is not None:
                    h.last_price = px

        equity = state.cash
        holdings_out: list[dict[str, Any]] = []
        for sym, h in state.holdings.items():
            mv = h.shares * h.last_price
            equity += mv
            pnl = (h.last_price - h.avg_cost) * h.shares
            pnl_pct = (
                (h.last_price / h.avg_cost - 1.0) * 100 if h.avg_cost > 0 else 0.0
            )
            holdings_out.append(
                {
                    "symbol": sym,
                    "shares": round(h.shares, 4),
                    "avg_cost": round(h.avg_cost, 4),
                    "last_price": round(h.last_price, 4),
                    "market_value": round(mv, 2),
                    "weight_pct": 0.0,
                    "unrealized_pnl": round(pnl, 2),
                    "unrealized_pnl_pct": round(pnl_pct, 4),
                    "currency": h.currency,
                    "last_signal": h.last_signal,
                    "last_confidence": h.last_confidence,
                }
            )
        for h_out in holdings_out:
            h_out["weight_pct"] = round(
                (h_out["market_value"] / equity * 100) if equity > 0 else 0.0, 4
            )
        holdings_out.sort(key=lambda x: x["market_value"], reverse=True)

        total_return_pct = (
            (equity / state.initial_capital - 1.0) * 100
            if state.initial_capital > 0
            else 0.0
        )

        invested_value = sum(h["market_value"] for h in holdings_out)
        cash_pct = (state.cash / equity * 100) if equity > 0 else 100.0
        invested_pct = (invested_value / equity * 100) if equity > 0 else 0.0

        return {
            "initial_capital": state.initial_capital,
            "cash": round(state.cash, 2),
            "equity": round(equity, 2),
            "invested_value": round(invested_value, 2),
            "cash_pct": round(cash_pct, 4),
            "invested_pct": round(invested_pct, 4),
            "total_return_pct": round(total_return_pct, 4),
            "holdings": holdings_out,
            "recent_trades": [asdict(t) for t in state.trades[-100:]][::-1],
            "trade_count": len(state.trades),
            "equity_curve": state.equity_curve[-500:],
            "last_rebalance_at": state.last_rebalance_at,
            "disclaimer": _DISCLAIMER,
        }

    def refresh(self) -> dict[str, Any]:
        """Poll the data provider for the latest prices and resnapshot.

        Every click on 刷新行情 forces a cache-bypassing fetch so the user
        always sees a freshly-pulled price (not a stale 60s TTL copy).
        """
        with self._lock:
            snap = self._snapshot_unlocked(
                refresh_prices=True, force_refresh=True
            )
            now_iso = datetime.now(UTC).isoformat()
            self._state.equity_curve.append(
                {"ts": now_iso, "value": round(snap["equity"], 2)}
            )
            self._save()
            snap = self._snapshot_unlocked()
            return snap

    # ---- manual orders --------------------------------------------------

    def _current_price(self, symbol: str) -> float:
        px = self.provider.get_last_price(symbol)
        if px is None:
            raise OrderError(
                f"无法获取 {symbol} 的实时价格（行情源离线或代码不正确）。"
            )
        return px

    def market_buy(
        self,
        symbol: str,
        *,
        shares: float | None = None,
        notional: float | None = None,
        reason: str = "manual_buy",
    ) -> dict[str, Any]:
        """Place a simulated market BUY order.

        Specify either ``shares`` or ``notional``. ``notional`` wins when both
        are given (matches how most mobile brokers behave today).
        """
        sym = symbol.strip().upper()
        if not sym:
            raise OrderError("未提供股票代码")

        price = self._current_price(sym)
        if notional is None and shares is None:
            raise OrderError("必须提供 shares 或 notional 其中之一")
        if notional is not None:
            if not math.isfinite(notional) or notional <= 0:
                raise OrderError("下单金额必须为正数")
            qty = notional / price
        else:
            assert shares is not None
            if not math.isfinite(shares) or shares <= 0:
                raise OrderError("下单股数必须为正数")
            qty = shares

        cost = qty * price

        with self._lock:
            state = self._state
            if cost > state.cash + 1e-6:
                raise OrderError(
                    f"现金不足：买入需要 ${cost:,.2f}，可用 ${state.cash:,.2f}"
                )

            currency = currency_from_symbol(sym)
            holding = state.holdings.get(sym) or _Holding(currency=currency)
            new_shares = holding.shares + qty
            new_cost = (
                (holding.shares * holding.avg_cost + qty * price) / new_shares
                if new_shares > 0
                else price
            )
            holding.shares = new_shares
            holding.avg_cost = new_cost
            holding.last_price = price
            holding.currency = currency or holding.currency
            state.holdings[sym] = holding
            state.cash -= cost

            trade = _Trade(
                timestamp=datetime.now(UTC).isoformat(),
                symbol=sym,
                side="buy",
                shares=round(qty, 6),
                price=round(price, 4),
                notional=round(cost, 2),
                reason=reason,
                id=uuid.uuid4().hex[:10],
                currency=currency,
            )
            state.trades.append(trade)
            self._append_equity_point()
            self._save()
            return {
                "ok": True,
                "trade": asdict(trade),
                "state": self._snapshot_unlocked(),
            }

    def market_sell(
        self,
        symbol: str,
        *,
        shares: float | None = None,
        notional: float | None = None,
        reason: str = "manual_sell",
    ) -> dict[str, Any]:
        """Place a simulated market SELL order."""
        sym = symbol.strip().upper()
        if not sym:
            raise OrderError("未提供股票代码")

        price = self._current_price(sym)

        with self._lock:
            state = self._state
            holding = state.holdings.get(sym)
            if holding is None or holding.shares <= 0:
                raise OrderError(f"{sym} 无持仓可卖出")

            if notional is None and shares is None:
                raise OrderError("必须提供 shares 或 notional 其中之一")
            if notional is not None:
                if not math.isfinite(notional) or notional <= 0:
                    raise OrderError("卖出金额必须为正数")
                qty = min(holding.shares, notional / price)
            else:
                assert shares is not None
                if not math.isfinite(shares) or shares <= 0:
                    raise OrderError("卖出股数必须为正数")
                qty = min(holding.shares, shares)

            proceeds = qty * price
            holding.shares -= qty
            holding.last_price = price
            state.cash += proceeds

            trade = _Trade(
                timestamp=datetime.now(UTC).isoformat(),
                symbol=sym,
                side="sell",
                shares=round(qty, 6),
                price=round(price, 4),
                notional=round(proceeds, 2),
                reason=reason,
                id=uuid.uuid4().hex[:10],
                currency=holding.currency,
            )
            state.trades.append(trade)
            if holding.shares < 1e-8:
                state.holdings.pop(sym, None)

            self._append_equity_point()
            self._save()
            return {
                "ok": True,
                "trade": asdict(trade),
                "state": self._snapshot_unlocked(),
            }

    def close_position(self, symbol: str) -> dict[str, Any]:
        """Sell the entire position in *symbol* at market."""
        sym = symbol.strip().upper()
        with self._lock:
            holding = self._state.holdings.get(sym)
            if holding is None or holding.shares <= 0:
                raise OrderError(f"{sym} 无持仓可平仓")
            qty = holding.shares
        return self.market_sell(sym, shares=qty, reason="manual_close")

    # ---- equity-curve helper (callers must already hold the lock) ------

    def _append_equity_point(self) -> None:
        state = self._state
        equity = state.cash + sum(
            h.shares * h.last_price for h in state.holdings.values()
        )
        state.equity_curve.append(
            {"ts": datetime.now(UTC).isoformat(), "value": round(equity, 2)}
        )

    # ---- auto-rebalance (research loop) --------------------------------

    def rebalance(
        self,
        symbols: Iterable[str],
        *,
        risk_tolerance: RiskTolerance = RiskTolerance.MODERATE,
    ) -> dict[str, Any]:
        """Run the research orchestrator and simulate trades to match the
        resulting illustrative weights. No real orders are ever sent.
        """
        tickers = [s.strip().upper() for s in symbols if s and s.strip()]
        if not tickers:
            snap = self.snapshot()
            snap["research_signals"] = []
            return snap

        profile = RiskProfile(tolerance=risk_tolerance)
        signals: dict[str, dict[str, Any]] = {}
        research_log: list[dict[str, Any]] = []

        for sym in tickers[:25]:
            try:
                r = self.orchestrator.analyze(sym, risk_profile=profile)
            except Exception as exc:
                research_log.append(
                    {
                        "symbol": sym,
                        "direction": "neutral",
                        "confidence": 0.0,
                        "weight_pct": 0.0,
                        "price": 0.0,
                        "currency": currency_from_symbol(sym),
                        "summary": f"研究失败：{exc}",
                    }
                )
                continue

            if not math.isfinite(r.current_price) or r.current_price <= 0:
                research_log.append(
                    {
                        "symbol": sym,
                        "direction": "neutral",
                        "confidence": 0.0,
                        "weight_pct": 0.0,
                        "price": 0.0,
                        "currency": r.currency or currency_from_symbol(sym),
                        "summary": r.summary or "未能获取该代码的有效价格。",
                    }
                )
                continue

            raw_w = (r.illustrative_weight_pct or 0.0) / 100.0
            weight = max(0.0, min(raw_w, _ABSOLUTE_MAX_WEIGHT))
            signals[sym] = {
                "price": r.current_price,
                "weight": weight,
                "direction": r.overall_signal.value,
                "confidence": r.overall_confidence,
                "summary": (r.summary or "")[:200],
                "currency": r.currency or currency_from_symbol(sym),
            }
            research_log.append(
                {
                    "symbol": sym,
                    "direction": r.overall_signal.value,
                    "confidence": round(float(r.overall_confidence or 0.0), 4),
                    "weight_pct": round(weight * 100, 2),
                    "price": round(float(r.current_price), 4),
                    "currency": r.currency or currency_from_symbol(sym),
                    "summary": (r.summary or "")[:200],
                }
            )

        if not signals:
            snap = self.snapshot()
            snap["research_signals"] = research_log
            return snap

        with self._lock:
            state = self._state
            # Refresh last prices for any holdings not in the current watch-list
            for sym, h in list(state.holdings.items()):
                if sym not in signals:
                    px = self.provider.get_last_price(sym)
                    if px is not None:
                        h.last_price = px

            equity_before = state.cash + sum(
                h.shares * h.last_price for h in state.holdings.values()
            )

            total_w = sum(s["weight"] for s in signals.values())
            if total_w > 1.0:
                for s in signals.values():
                    s["weight"] /= total_w

            # Step 1 — SELLs first (so cash is available for BUYs).
            for sym, sig in list(signals.items()):
                h = state.holdings.get(sym)
                if h is None:
                    continue
                target_value = equity_before * sig["weight"]
                current_value = h.shares * sig["price"]
                delta_val = target_value - current_value
                if delta_val < -_MIN_AUTO_TRADE_NOTIONAL:
                    self._execute_sell(
                        sym=sym,
                        sig=sig,
                        holding=h,
                        notional=-delta_val,
                        reason=f"auto_{sig['direction']}_downsize",
                    )

            # Also sell any holding not in the current watch-list.
            for sym in list(state.holdings.keys()):
                if sym not in signals:
                    h = state.holdings[sym]
                    if h.shares > 0 and h.last_price > 0:
                        self._execute_sell(
                            sym=sym,
                            sig={
                                "price": h.last_price,
                                "direction": "neutral",
                                "confidence": 0.0,
                                "currency": h.currency,
                            },
                            holding=h,
                            notional=h.shares * h.last_price,
                            reason="auto_removed_from_watchlist",
                        )

            # Step 2 — BUYs.
            for sym, sig in signals.items():
                target_value = equity_before * sig["weight"]
                h = state.holdings.get(sym) or _Holding(
                    currency=sig.get("currency", "USD")
                )
                current_value = h.shares * sig["price"]
                delta_val = target_value - current_value
                if delta_val > _MIN_AUTO_TRADE_NOTIONAL and state.cash > 0:
                    spend = min(delta_val, state.cash)
                    if spend > _MIN_AUTO_TRADE_NOTIONAL:
                        self._execute_buy(
                            sym=sym,
                            sig=sig,
                            holding=h,
                            notional=spend,
                            reason=f"auto_{sig['direction']}_scale_up",
                        )
                        state.holdings[sym] = h

            # Update metadata for every tracked symbol.
            for sym, sig in signals.items():
                h = state.holdings.get(sym)
                if h is None:
                    continue
                h.last_price = sig["price"]
                h.last_signal = sig["direction"]
                h.last_confidence = sig["confidence"]
                h.currency = sig.get("currency", h.currency)

            now_iso = datetime.now(UTC).isoformat()
            equity_after = state.cash + sum(
                h.shares * h.last_price for h in state.holdings.values()
            )
            state.equity_curve.append(
                {"ts": now_iso, "value": round(equity_after, 2)}
            )
            state.last_rebalance_at = now_iso
            self._save()

            snap = self._snapshot_unlocked()
            snap["research_signals"] = research_log
            return snap

    # ---- internal auto-trade helpers (caller holds the lock) -----------

    def _execute_buy(
        self,
        *,
        sym: str,
        sig: dict[str, Any],
        holding: _Holding,
        notional: float,
        reason: str,
    ) -> None:
        price = sig["price"]
        if price <= 0 or notional <= 0:
            return
        shares = notional / price
        if shares <= 0:
            return
        new_shares = holding.shares + shares
        new_cost = (
            (holding.shares * holding.avg_cost + shares * price) / new_shares
            if new_shares > 0
            else price
        )
        holding.shares = new_shares
        holding.avg_cost = new_cost
        holding.last_price = price
        holding.last_signal = sig.get("direction")
        holding.last_confidence = sig.get("confidence")
        holding.currency = sig.get("currency", holding.currency)
        self._state.cash -= shares * price
        self._state.trades.append(
            _Trade(
                timestamp=datetime.now(UTC).isoformat(),
                symbol=sym,
                side="buy",
                shares=round(shares, 6),
                price=round(price, 4),
                notional=round(shares * price, 2),
                reason=reason,
                id=uuid.uuid4().hex[:10],
                currency=holding.currency,
            )
        )

    def _execute_sell(
        self,
        *,
        sym: str,
        sig: dict[str, Any],
        holding: _Holding,
        notional: float,
        reason: str,
    ) -> None:
        price = sig["price"]
        if price <= 0 or holding.shares <= 0:
            return
        shares = min(holding.shares, notional / price)
        if shares <= 0:
            return
        holding.shares -= shares
        holding.last_price = price
        self._state.cash += shares * price
        self._state.trades.append(
            _Trade(
                timestamp=datetime.now(UTC).isoformat(),
                symbol=sym,
                side="sell",
                shares=round(shares, 6),
                price=round(price, 4),
                notional=round(shares * price, 2),
                reason=reason,
                id=uuid.uuid4().hex[:10],
                currency=sig.get("currency", holding.currency),
            )
        )
        if holding.shares < 1e-8:
            self._state.holdings.pop(sym, None)


# ---------------------------------------------------------------------------
# Module-level default instance
# ---------------------------------------------------------------------------


_DEFAULT_PATH = Path(__file__).resolve().parents[3] / "data" / "simulation.json"
_DEFAULT: SimulatedPortfolio | None = None
_DEFAULT_LOCK = threading.Lock()


def get_default_portfolio() -> SimulatedPortfolio:
    global _DEFAULT
    with _DEFAULT_LOCK:
        if _DEFAULT is None:
            _DEFAULT = SimulatedPortfolio(storage_path=_DEFAULT_PATH)
        return _DEFAULT
