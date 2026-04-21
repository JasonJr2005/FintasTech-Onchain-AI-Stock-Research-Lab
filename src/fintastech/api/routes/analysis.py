"""Research-signal endpoints — rule-based, paper-trading oriented, never an
investment recommendation. See DISCLAIMER.md."""

from fastapi import APIRouter, Query

from fintastech.agents.advisor import ResearchOrchestrator
from fintastech.agents.masters import get_master_profiles
from fintastech.data.yahoo_provider import YahooFinanceProvider
from fintastech.models.portfolio import RiskProfile, RiskTolerance

router = APIRouter()

_provider = YahooFinanceProvider()
_orchestrator = ResearchOrchestrator(_provider)


@router.get("/search")
def search_symbols(q: str = Query(..., min_length=1), limit: int = Query(10, le=20)) -> list[dict]:
    """Search tickers across US / HK / A-share markets (public data)."""
    return _provider.search_tickers(q, limit=limit)


@router.get("/masters")
def list_masters() -> list[dict]:
    """Return the roster of rule-based master-investor analyst modules."""
    return get_master_profiles()


@router.get("/analyze/{symbol}")
def analyze_symbol(
    symbol: str,
    risk_tolerance: RiskTolerance = Query(RiskTolerance.MODERATE),
) -> dict:
    """Full multi-module research signal bundle for one ticker.

    Output is descriptive (bullish/bearish/neutral + confidence + illustrative
    weight). This endpoint NEVER returns a buy/sell instruction. Errors never
    500 — instead we return a shaped object with an ``error`` field so the UI
    can render a friendly message.
    """
    profile = RiskProfile(tolerance=risk_tolerance)
    sym = symbol.upper()
    try:
        result = _orchestrator.analyze(sym, risk_profile=profile)
        return result.model_dump(mode="json")
    except Exception as exc:
        return {
            "symbol": sym,
            "name": sym,
            "current_price": 0.0,
            "currency": "USD",
            "exchange": "",
            "signals": [],
            "overall_signal": "neutral",
            "overall_confidence": 0.0,
            "summary": f"{sym}：分析失败（{exc}）。请检查代码是否正确或稍后重试。",
            "illustrative_weight_pct": 0.0,
            "risk_score": 0.5,
            "error": str(exc),
        }


@router.get("/batch-analyze")
def batch_analyze(
    symbols: str = Query("AAPL,MSFT,GOOGL,TSLA", description="逗号分隔的股票代码"),
    risk_tolerance: RiskTolerance = Query(RiskTolerance.MODERATE),
) -> list[dict]:
    """Analyze up to 20 tickers in one call. Research signals only."""
    profile = RiskProfile(tolerance=risk_tolerance)
    tickers = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    results: list[dict] = []
    for t in tickers[:20]:
        try:
            r = _orchestrator.analyze(t, risk_profile=profile)
            results.append(r.model_dump(mode="json"))
        except Exception as exc:
            results.append({"symbol": t, "error": str(exc)})
    return results
