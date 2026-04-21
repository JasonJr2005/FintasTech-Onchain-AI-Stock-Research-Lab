"""
Valuation analyst agent.
Simple DCF and relative-value estimation (inspired by ai-hedge-fund valuation agent).
"""

import numpy as np
import pandas as pd

from fintastech.models.analysis import (
    AnalystSignal,
    SignalDirection,
    ValuationSnapshot,
)


class ValuationAnalyst:
    name = "valuation_analyst"
    display_name = "估值分析师"

    def analyze(
        self,
        symbol: str,
        ohlcv: pd.DataFrame,
        *,
        eps: float | None = None,
        growth_rate: float | None = None,
        discount_rate: float = 0.10,
        terminal_growth: float = 0.03,
        pe_sector_avg: float = 20.0,
    ) -> tuple[AnalystSignal, ValuationSnapshot]:
        if ohlcv.empty:
            return self._empty(symbol)

        current_price = float(ohlcv["close"].astype(float).iloc[-1])

        dcf_val = self._simple_dcf(eps, growth_rate, discount_rate, terminal_growth)
        relative_val = (eps * pe_sector_avg) if eps else None

        values = [v for v in (dcf_val, relative_val) if v is not None]
        if not values:
            return self._price_only(symbol, current_price, ohlcv)

        blended = float(np.mean(values))
        upside = (blended / current_price - 1.0) if current_price > 0 else 0.0

        if upside > 0.15:
            signal = SignalDirection.BULLISH
        elif upside < -0.15:
            signal = SignalDirection.BEARISH
        else:
            signal = SignalDirection.NEUTRAL
        confidence = min(1.0, abs(upside) * 2)

        parts = []
        if dcf_val:
            parts.append(f"DCF 估值 ${dcf_val:.2f}")
        if relative_val:
            parts.append(f"相对估值 ${relative_val:.2f}")
        parts.append(f"当前价 ${current_price:.2f}，潜在空间 {upside:+.1%}")

        method = "DCF + 相对估值" if dcf_val and relative_val else ("DCF" if dcf_val else "相对估值")

        snapshot = ValuationSnapshot(
            dcf_value=round(dcf_val, 2) if dcf_val else None,
            relative_value=round(relative_val, 2) if relative_val else None,
            current_price=round(current_price, 2),
            upside_pct=round(upside * 100, 2),
            method=method,
        )
        return (
            AnalystSignal(
                analyst=self.name,
                analyst_display=self.display_name,
                signal=signal,
                confidence=confidence,
                reasoning="；".join(parts),
                metrics={"blended_value": round(blended, 2), "upside_pct": round(upside * 100, 2)},
            ),
            snapshot,
        )

    @staticmethod
    def _simple_dcf(
        eps: float | None,
        growth: float | None,
        discount: float,
        terminal_growth: float,
        years: int = 5,
    ) -> float | None:
        if eps is None or growth is None or eps <= 0:
            return None
        cashflows = [eps * (1 + growth) ** (i + 1) for i in range(years)]
        terminal = cashflows[-1] * (1 + terminal_growth) / (discount - terminal_growth + 1e-10)
        pv = sum(cf / (1 + discount) ** (i + 1) for i, cf in enumerate(cashflows))
        pv += terminal / (1 + discount) ** years
        return pv

    def _price_only(self, symbol: str, price: float, ohlcv: pd.DataFrame):
        snap = ValuationSnapshot(current_price=round(price, 2))
        return (
            AnalystSignal(
                analyst=self.name,
                analyst_display=self.display_name,
                signal=SignalDirection.NEUTRAL,
                confidence=0.1,
                reasoning=f"EPS 数据缺失，仅记录当前价 ${price:.2f}",
            ),
            snap,
        )

    def _empty(self, symbol: str):
        return (
            AnalystSignal(
                analyst=self.name,
                analyst_display=self.display_name,
                signal=SignalDirection.NEUTRAL,
                confidence=0.0,
                reasoning="数据不足",
            ),
            ValuationSnapshot(),
        )
