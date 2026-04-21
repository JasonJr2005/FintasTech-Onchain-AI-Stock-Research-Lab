"""Paper-trading research profile and simulated-holding models.

These are abstractions used by the research pipeline and paper-trading ledger.
They do NOT represent a real brokerage portfolio or any form of investment
advisory relationship.
"""

from datetime import UTC, datetime
from enum import Enum

from pydantic import BaseModel, Field


DEFAULT_DISCLAIMER = (
    "EDUCATIONAL / RESEARCH USE ONLY — NOT INVESTMENT ADVICE. "
    "All holdings below are simulated (paper trading)."
)


class RiskTolerance(str, Enum):
    """Simulation risk profile — controls how the research pipeline sizes
    *hypothetical* paper-trading weights. Not a suitability determination."""

    CONSERVATIVE = "conservative"
    MODERATE = "moderate"
    AGGRESSIVE = "aggressive"


class RiskProfile(BaseModel):
    tolerance: RiskTolerance = RiskTolerance.MODERATE
    research_horizon_months: int = 12
    max_single_symbol_pct: float = Field(default=0.2, ge=0.01, le=1.0)
    max_drawdown_tolerance: float = Field(default=0.15, ge=0.01, le=1.0)


class SimulatedHolding(BaseModel):
    """Entry in the paper-trading ledger. No real assets are represented."""

    symbol: str
    name: str = ""
    shares: float = 0
    avg_cost: float = 0
    current_price: float = 0
    market_value: float = 0
    weight_pct: float = 0
    unrealized_pnl: float = 0
    unrealized_pnl_pct: float = 0


class ResearchReport(BaseModel):
    """Aggregated research bundle for a watch-list — paper-trading only."""

    generated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    risk_profile: RiskProfile
    analyses: list = Field(default_factory=list)
    simulated_holdings: list[SimulatedHolding] = Field(default_factory=list)
    simulated_capital: float = 0
    illustrative_total_weight_pct: float = 0
    risk_score: float = 0.5
    narrative: str = ""
    disclaimer: str = DEFAULT_DISCLAIMER


# --- Backwards-compat aliases so older imports keep working ---------------
PortfolioHolding = SimulatedHolding
InvestmentAdvice = ResearchReport
