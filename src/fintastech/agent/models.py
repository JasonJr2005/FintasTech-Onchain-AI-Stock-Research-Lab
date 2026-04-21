from datetime import UTC, datetime
from enum import Enum

from pydantic import BaseModel, Field


class RiskFlag(str, Enum):
    HIGH_VOLATILITY = "high_volatility"
    ILLIQUID = "illiquid"
    DATA_STALE = "data_stale"


class ResearchBrief(BaseModel):
    """Structured output of a single rule-based strategy evaluation.

    This is a research signal, not a trading instruction. Weights below are
    illustrative paper-trading allocations for simulation only.
    """

    symbol: str
    generated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    summary: dict = Field(default_factory=dict)
    signal: float = Field(description="Strategy signal in [-1, 1] (descriptive).")
    illustrative_position_pct: float = Field(
        description="After risk clipping; a hypothetical paper-trading weight, never advice.",
    )
    narrative: str = Field(default="", description="Human-readable rationale")
    risk_flags: list[RiskFlag] = Field(default_factory=list)
    disclaimer: str = Field(
        default=(
            "EDUCATIONAL / RESEARCH USE ONLY — NOT INVESTMENT ADVICE. "
            "This output is a rule-based research signal for simulation."
        ),
        description="Compliance reminder",
    )


# Backwards-compat alias — older callers / tests used the advisory terminology.
AdvisoryBrief = ResearchBrief
