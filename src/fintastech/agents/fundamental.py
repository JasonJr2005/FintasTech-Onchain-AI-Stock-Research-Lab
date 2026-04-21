"""
Fundamental analyst agent.
Rule-based scoring across profitability, growth, financial health, and valuation
multiples (inspired by ai-hedge-fund fundamentals + growth analysts).
"""

import numpy as np
import pandas as pd

from fintastech.models.analysis import (
    AnalystSignal,
    FundamentalSnapshot,
    SignalDirection,
)


_SECTOR_PE = {"technology": 28, "healthcare": 22, "finance": 14, "energy": 12, "default": 20}


class FundamentalAnalyst:
    name = "fundamental_analyst"
    display_name = "基本面分析师"

    def analyze(
        self,
        symbol: str,
        ohlcv: pd.DataFrame,
        *,
        pe: float | None = None,
        pb: float | None = None,
        ps: float | None = None,
        roe: float | None = None,
        roa: float | None = None,
        debt_to_equity: float | None = None,
        current_ratio: float | None = None,
        profit_margin: float | None = None,
        revenue_growth: float | None = None,
        earnings_growth: float | None = None,
        sector: str = "default",
    ) -> tuple[AnalystSignal, FundamentalSnapshot]:
        scores: list[float] = []
        parts: list[str] = []

        if pe is not None:
            benchmark = _SECTOR_PE.get(sector.lower(), _SECTOR_PE["default"])
            s = max(-1, min(1, (benchmark - pe) / benchmark))
            scores.append(s)
            parts.append(f"P/E {pe:.1f}{'（偏低✓）' if s > 0.2 else '（偏高）' if s < -0.2 else ''}")

        if roe is not None:
            s = max(-1, min(1, (roe - 0.10) / 0.15))
            scores.append(s)
            parts.append(f"ROE {roe:.1%}{'（优秀✓）' if s > 0.3 else '（偏低）' if s < -0.2 else ''}")

        if profit_margin is not None:
            s = max(-1, min(1, (profit_margin - 0.08) / 0.12))
            scores.append(s)
            parts.append(f"净利率 {profit_margin:.1%}")

        if debt_to_equity is not None:
            s = max(-1, min(1, (1.0 - debt_to_equity) / 1.0))
            scores.append(s)
            parts.append(f"资产负债率 {debt_to_equity:.2f}")

        if current_ratio is not None:
            s = max(-1, min(1, (current_ratio - 1.0) / 1.5))
            scores.append(s)
            parts.append(f"流动比率 {current_ratio:.2f}")

        if revenue_growth is not None:
            s = max(-1, min(1, revenue_growth / 0.3))
            scores.append(s)
            parts.append(f"营收增长 {revenue_growth:.1%}")

        if earnings_growth is not None:
            s = max(-1, min(1, earnings_growth / 0.3))
            scores.append(s)
            parts.append(f"利润增长 {earnings_growth:.1%}")

        if not scores:
            return self._from_price(symbol, ohlcv)

        composite = float(np.mean(scores))
        signal, confidence = self._to_signal(composite)
        reasoning = "；".join(parts)

        snapshot = FundamentalSnapshot(
            pe_ratio=pe,
            pb_ratio=pb,
            ps_ratio=ps,
            roe=roe,
            roa=roa,
            debt_to_equity=debt_to_equity,
            current_ratio=current_ratio,
            profit_margin=profit_margin,
            revenue_growth=revenue_growth,
            earnings_growth=earnings_growth,
        )
        return (
            AnalystSignal(
                analyst=self.name,
                analyst_display=self.display_name,
                signal=signal,
                confidence=confidence,
                reasoning=reasoning,
                metrics={"composite": round(composite, 3), "n_factors": len(scores)},
            ),
            snapshot,
        )

    def _from_price(self, symbol: str, ohlcv: pd.DataFrame):
        """Fallback: derive a rough fundamental proxy from price history."""
        snap = FundamentalSnapshot()
        if ohlcv.empty or len(ohlcv) < 20:
            return (
                AnalystSignal(
                    analyst=self.name,
                    analyst_display=self.display_name,
                    signal=SignalDirection.NEUTRAL,
                    confidence=0.0,
                    reasoning="无基本面数据，无法评估",
                ),
                snap,
            )
        close = ohlcv["close"].astype(float)
        ret = float(close.iloc[-1] / close.iloc[0] - 1)
        vol = float(close.pct_change().dropna().std() * np.sqrt(252))
        sharpe_proxy = ret / (vol + 1e-10)
        composite = max(-1, min(1, sharpe_proxy))
        signal, confidence = self._to_signal(composite)
        return (
            AnalystSignal(
                analyst=self.name,
                analyst_display=self.display_name,
                signal=signal,
                confidence=confidence * 0.5,
                reasoning=f"仅价格推断：区间收益 {ret:.1%}，年化波动率 {vol:.1%}（无详细财务数据）",
            ),
            snap,
        )

    @staticmethod
    def _to_signal(composite: float) -> tuple[SignalDirection, float]:
        if composite > 0.15:
            return SignalDirection.BULLISH, min(1.0, abs(composite))
        elif composite < -0.15:
            return SignalDirection.BEARISH, min(1.0, abs(composite))
        return SignalDirection.NEUTRAL, 0.3
