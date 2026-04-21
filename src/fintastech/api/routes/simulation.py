"""Paper-trading simulator endpoints.

EDUCATIONAL / RESEARCH USE ONLY. No real orders are ever sent; the underlying
``SimulatedPortfolio`` class has no broker integration whatsoever.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from fintastech.models.portfolio import RiskTolerance
from fintastech.simulation import get_default_portfolio
from fintastech.simulation.portfolio import OrderError

router = APIRouter(prefix="/simulation")


class RebalanceRequest(BaseModel):
    symbols: list[str] = Field(..., min_length=1, max_length=25)
    risk_tolerance: RiskTolerance = RiskTolerance.MODERATE


class ResetRequest(BaseModel):
    initial_capital: float = Field(100_000.0, gt=0, le=10_000_000)


class ManualOrderRequest(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=16)
    shares: float | None = Field(None, gt=0)
    notional: float | None = Field(None, gt=0, le=10_000_000)


class CloseRequest(BaseModel):
    symbol: str = Field(..., min_length=1, max_length=16)


@router.get("/state")
def get_state() -> dict:
    """Current paper-trading ledger snapshot."""
    return get_default_portfolio().snapshot()


@router.post("/refresh")
def refresh_prices() -> dict:
    """Re-poll live prices for every open position and record a new equity sample."""
    return get_default_portfolio().refresh()


@router.post("/rebalance")
def rebalance(req: RebalanceRequest) -> dict:
    """Run the research orchestrator on the given watch-list and adjust the
    simulated ledger toward the resulting illustrative weights. No real orders.
    """
    pf = get_default_portfolio()
    return pf.rebalance(req.symbols, risk_tolerance=req.risk_tolerance)


@router.post("/reset")
def reset(req: ResetRequest) -> dict:
    """Wipe the ledger and start over with a fresh paper-trading balance."""
    return get_default_portfolio().reset(initial_capital=req.initial_capital)


@router.post("/buy")
def buy(req: ManualOrderRequest) -> dict:
    """Place a simulated market BUY order (manual). Specify shares OR notional."""
    pf = get_default_portfolio()
    try:
        return pf.market_buy(req.symbol, shares=req.shares, notional=req.notional)
    except OrderError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/sell")
def sell(req: ManualOrderRequest) -> dict:
    """Place a simulated market SELL order (manual). Specify shares OR notional."""
    pf = get_default_portfolio()
    try:
        return pf.market_sell(req.symbol, shares=req.shares, notional=req.notional)
    except OrderError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.post("/close")
def close(req: CloseRequest) -> dict:
    """Close (market-sell) the entire position for one symbol."""
    pf = get_default_portfolio()
    try:
        return pf.close_position(req.symbol)
    except OrderError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
