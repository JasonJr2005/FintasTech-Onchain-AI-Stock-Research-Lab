"""Lightweight single-strategy research pipeline (rule-based).

Produces a ``ResearchBrief`` — a descriptive research signal with an
illustrative paper-trading weight. Never a buy/sell instruction.
"""

from datetime import date

from fintastech.agent.models import ResearchBrief, RiskFlag
from fintastech.analysis.summary import summarize_ohlcv
from fintastech.data.base import MarketDataProvider
from fintastech.risk.limits import RiskLimits, clip_position_suggestion
from fintastech.strategies.base import StrategyContext
from fintastech.strategies.momentum_ma import MomentumMAStrategy


class ResearchPipeline:
    """
    Coordinates data → strategy → risk clipping → descriptive research brief.
    Output is for simulation and study, not for real trading.
    """

    def __init__(
        self,
        provider: MarketDataProvider,
        *,
        risk: RiskLimits | None = None,
    ) -> None:
        self.provider = provider
        self.risk = risk or RiskLimits()
        self.strategy = MomentumMAStrategy()

    def brief(self, symbol: str, *, as_of: date | None = None) -> ResearchBrief:
        end = as_of or date.today()
        df = self.provider.get_history(symbol, end=end)
        summary = summarize_ohlcv(df)
        ctx = StrategyContext(symbol=symbol, ohlcv=df)
        result = self.strategy.run(ctx)

        raw_pct = 0.1 * result.signal * result.confidence
        clipped = clip_position_suggestion(raw_pct, self.risk)

        flags: list[RiskFlag] = []
        if summary.get("bars", 0) < 20:
            flags.append(RiskFlag.DATA_STALE)
        if summary.get("last_volume", 0) < 1000:
            flags.append(RiskFlag.ILLIQUID)

        narrative = (
            f"{symbol}: rule-based signal {result.signal:.2f}, "
            f"confidence {result.confidence:.2f}. {result.notes}. "
            f"Period return ~ {summary.get('period_return', 0):.2%}. "
            f"Paper-trading simulation only — not an instruction to trade."
        )
        return ResearchBrief(
            symbol=symbol,
            summary=summary,
            signal=result.signal,
            illustrative_position_pct=clipped,
            narrative=narrative,
            risk_flags=flags,
        )


# Backwards-compat alias for older tests / docs.
AdvisoryOrchestrator = ResearchPipeline
