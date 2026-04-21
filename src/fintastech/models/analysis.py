"""Structured research-signal models.

All fields below are **descriptive research signals**, not buy/sell recommendations
and not investment advice. Weights are illustrative paper-trading allocations
produced by a rule-based multi-agent pipeline, to be used for simulation and
study only.
"""

from datetime import UTC, datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


DEFAULT_DISCLAIMER = (
    "EDUCATIONAL / RESEARCH USE ONLY — NOT INVESTMENT ADVICE. "
    "Outputs are hypothetical signals from a rule-based simulation and must not "
    "be used to make real-money trading decisions."
)


class SignalDirection(str, Enum):
    BULLISH = "bullish"
    BEARISH = "bearish"
    NEUTRAL = "neutral"


class AnalystSignal(BaseModel):
    analyst: str
    analyst_display: str = ""
    signal: SignalDirection
    confidence: float = Field(ge=0, le=1)
    reasoning: str
    metrics: dict[str, Any] = Field(default_factory=dict)


class TechnicalSnapshot(BaseModel):
    ma_short: float | None = None
    ma_long: float | None = None
    rsi: float | None = None
    macd: float | None = None
    macd_signal: float | None = None
    bollinger_upper: float | None = None
    bollinger_lower: float | None = None
    trend: str = ""
    momentum: str = ""
    volatility_pct: float | None = None


class FundamentalSnapshot(BaseModel):
    pe_ratio: float | None = None
    pb_ratio: float | None = None
    ps_ratio: float | None = None
    roe: float | None = None
    roa: float | None = None
    debt_to_equity: float | None = None
    current_ratio: float | None = None
    profit_margin: float | None = None
    revenue_growth: float | None = None
    earnings_growth: float | None = None


class ValuationSnapshot(BaseModel):
    dcf_value: float | None = None
    relative_value: float | None = None
    current_price: float | None = None
    upside_pct: float | None = None
    method: str = ""


class ComprehensiveAnalysis(BaseModel):
    """A research bundle for one symbol, produced by the rule-based analyst pipeline."""

    symbol: str
    name: str = ""
    current_price: float
    currency: str = "USD"
    exchange: str = ""
    generated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    signals: list[AnalystSignal] = Field(default_factory=list)
    technical: TechnicalSnapshot = Field(default_factory=TechnicalSnapshot)
    fundamental: FundamentalSnapshot = Field(default_factory=FundamentalSnapshot)
    valuation: ValuationSnapshot = Field(default_factory=ValuationSnapshot)

    overall_signal: SignalDirection = SignalDirection.NEUTRAL
    overall_confidence: float = 0.0
    summary: str = ""

    illustrative_weight_pct: float = Field(
        default=0.0,
        description=(
            "Hypothetical paper-trading weight (%) derived from model confidence — "
            "for simulation only, never an instruction to trade."
        ),
    )
    risk_score: float = Field(default=0.5, ge=0, le=1)
    disclaimer: str = DEFAULT_DISCLAIMER
