"""Paper-trading backtest endpoint — simulates the rule-based strategy over
historical public data. No real-money trading is involved or possible."""

from datetime import date, timedelta

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from fintastech.backtesting.engine import BacktestEngine
from fintastech.data.yahoo_provider import YahooFinanceProvider
from fintastech.models.portfolio import RiskProfile, RiskTolerance

router = APIRouter()


class BacktestRequest(BaseModel):
    symbols: list[str] = Field(..., min_length=1, max_length=10)
    start_date: str | None = Field(None, description="YYYY-MM-DD，默认一年前")
    end_date: str | None = Field(None, description="YYYY-MM-DD，默认今天")
    initial_capital: float = Field(100_000, gt=0)
    risk_tolerance: RiskTolerance = RiskTolerance.MODERATE
    rebalance_days: int = Field(20, ge=5, le=90)


@router.post("/backtest")
def run_backtest(req: BacktestRequest) -> dict:
    provider = YahooFinanceProvider()
    try:
        end = date.fromisoformat(req.end_date) if req.end_date else date.today()
        start = (
            date.fromisoformat(req.start_date)
            if req.start_date
            else end - timedelta(days=365)
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=f"日期格式错误：{exc}") from exc
    if start >= end:
        raise HTTPException(status_code=400, detail="起始日期必须早于结束日期")

    profile = RiskProfile(tolerance=req.risk_tolerance)
    engine = BacktestEngine(
        provider,
        initial_capital=req.initial_capital,
        rebalance_freq_days=req.rebalance_days,
        risk_profile=profile,
    )
    try:
        result = engine.run(
            [s.upper() for s in req.symbols],
            start=start,
            end=end,
        )
    except Exception as exc:  # pragma: no cover — defensive
        raise HTTPException(
            status_code=500,
            detail=f"回测运行失败：{exc.__class__.__name__}: {exc}",
        ) from exc
    return {
        "initial_capital": result.initial_capital,
        "final_value": result.final_value,
        "total_return_pct": result.total_return_pct,
        "annualized_return_pct": result.annualized_return_pct,
        "max_drawdown_pct": result.max_drawdown_pct,
        "sharpe_ratio": result.sharpe_ratio,
        "trades": result.trades,
        "equity_curve": result.equity_curve,
        "notes": result.notes or "",
        "loaded_symbols": result.loaded_symbols or [],
        "dropped_symbols": result.dropped_symbols or [],
    }
