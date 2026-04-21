"""
Sentiment analyst agent (placeholder).
In production, integrate news APIs / social media feeds and optional LLM summarisation.
Currently uses volume-price divergence as a rough proxy.
"""

import numpy as np
import pandas as pd

from fintastech.models.analysis import AnalystSignal, SignalDirection


class SentimentAnalyst:
    name = "sentiment_analyst"
    display_name = "市场情绪分析师"

    def analyze(self, symbol: str, ohlcv: pd.DataFrame) -> AnalystSignal:
        if ohlcv.empty or len(ohlcv) < 10:
            return AnalystSignal(
                analyst=self.name,
                analyst_display=self.display_name,
                signal=SignalDirection.NEUTRAL,
                confidence=0.0,
                reasoning="数据不足，无法判断市场情绪",
            )

        close = ohlcv["close"].astype(float)
        volume = ohlcv["volume"].astype(float)

        price_ret = float(close.iloc[-1] / close.iloc[-10] - 1)
        vol_avg_recent = float(volume.iloc[-5:].mean())
        vol_avg_prev = float(volume.iloc[-20:-5].mean()) if len(volume) >= 20 else vol_avg_recent
        vol_change = (vol_avg_recent / (vol_avg_prev + 1e-10)) - 1.0

        # volume-price agreement
        if price_ret > 0 and vol_change > 0.1:
            score = min(1.0, (price_ret + vol_change) * 2)
            reasoning = f"价格上涨 {price_ret:.1%} 且成交量放大 {vol_change:.1%}，多头情绪较强"
        elif price_ret < 0 and vol_change > 0.2:
            score = max(-1.0, (price_ret - vol_change) * 2)
            reasoning = f"价格下跌 {price_ret:.1%} 但成交量放大 {vol_change:.1%}，恐慌情绪增加"
        elif price_ret > 0 and vol_change < -0.1:
            score = price_ret * 0.5
            reasoning = f"价格上涨 {price_ret:.1%} 但成交量萎缩，上涨动力存疑"
        else:
            score = 0.0
            reasoning = "量价关系中性"

        if score > 0.15:
            signal = SignalDirection.BULLISH
        elif score < -0.15:
            signal = SignalDirection.BEARISH
        else:
            signal = SignalDirection.NEUTRAL

        return AnalystSignal(
            analyst=self.name,
            analyst_display=self.display_name,
            signal=signal,
            confidence=min(1.0, abs(score)) * 0.7,
            reasoning=reasoning,
            metrics={
                "price_return_10d": round(price_ret, 4),
                "volume_change": round(vol_change, 4),
                "composite": round(score, 3),
            },
        )
