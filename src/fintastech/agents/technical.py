"""
Technical analyst agent.
Computes trend, momentum, mean-reversion, and volatility signals,
then blends them into a single AnalystSignal (inspired by ai-hedge-fund technicals).
"""

import numpy as np
import pandas as pd

from fintastech.models.analysis import (
    AnalystSignal,
    SignalDirection,
    TechnicalSnapshot,
)


class TechnicalAnalyst:
    name = "technical_analyst"
    display_name = "技术分析师"

    def __init__(self, short_ma: int = 10, long_ma: int = 50, rsi_period: int = 14) -> None:
        self.short_ma = short_ma
        self.long_ma = long_ma
        self.rsi_period = rsi_period

    def analyze(self, symbol: str, ohlcv: pd.DataFrame) -> tuple[AnalystSignal, TechnicalSnapshot]:
        if ohlcv.empty or len(ohlcv) < self.long_ma:
            return self._empty(symbol)

        close = ohlcv["close"].astype(float)
        ma_s = close.rolling(self.short_ma, min_periods=1).mean()
        ma_l = close.rolling(self.long_ma, min_periods=1).mean()

        rsi = self._rsi(close, self.rsi_period)
        macd_line, signal_line = self._macd(close)
        bb_upper, bb_lower = self._bollinger(close)
        returns = close.pct_change().dropna()
        vol = float(returns.std() * np.sqrt(252)) if len(returns) > 1 else 0.0

        trend_score = self._trend_score(ma_s, ma_l, close)
        momentum_score = self._momentum_score(rsi, macd_line, signal_line)
        mean_rev_score = self._mean_reversion_score(close, bb_upper, bb_lower)

        composite = 0.4 * trend_score + 0.35 * momentum_score + 0.25 * mean_rev_score
        signal, confidence = self._to_signal(composite)

        parts = []
        if trend_score > 0.2:
            parts.append("上升趋势明显")
        elif trend_score < -0.2:
            parts.append("下行趋势明显")
        if rsi.iloc[-1] > 70:
            parts.append("RSI 超买区间")
        elif rsi.iloc[-1] < 30:
            parts.append("RSI 超卖区间")
        if macd_line.iloc[-1] > signal_line.iloc[-1]:
            parts.append("MACD 金叉")
        else:
            parts.append("MACD 死叉")
        reasoning = "；".join(parts) if parts else "指标中性"

        snapshot = TechnicalSnapshot(
            ma_short=round(float(ma_s.iloc[-1]), 2),
            ma_long=round(float(ma_l.iloc[-1]), 2),
            rsi=round(float(rsi.iloc[-1]), 2),
            macd=round(float(macd_line.iloc[-1]), 4),
            macd_signal=round(float(signal_line.iloc[-1]), 4),
            bollinger_upper=round(float(bb_upper.iloc[-1]), 2),
            bollinger_lower=round(float(bb_lower.iloc[-1]), 2),
            trend="上升" if trend_score > 0.1 else ("下降" if trend_score < -0.1 else "震荡"),
            momentum="强" if momentum_score > 0.3 else ("弱" if momentum_score < -0.3 else "中性"),
            volatility_pct=round(vol * 100, 2),
        )
        analyst_signal = AnalystSignal(
            analyst=self.name,
            analyst_display=self.display_name,
            signal=signal,
            confidence=confidence,
            reasoning=reasoning,
            metrics={
                "trend_score": round(trend_score, 3),
                "momentum_score": round(momentum_score, 3),
                "mean_reversion_score": round(mean_rev_score, 3),
                "composite": round(composite, 3),
            },
        )
        return analyst_signal, snapshot

    # ---- sub-indicators ----

    @staticmethod
    def _rsi(close: pd.Series, period: int = 14) -> pd.Series:
        delta = close.diff()
        gain = delta.clip(lower=0).rolling(period, min_periods=1).mean()
        loss = (-delta.clip(upper=0)).rolling(period, min_periods=1).mean()
        rs = gain / (loss + 1e-10)
        return 100 - 100 / (1 + rs)

    @staticmethod
    def _macd(close: pd.Series, fast: int = 12, slow: int = 26, sig: int = 9):
        ema_fast = close.ewm(span=fast, adjust=False).mean()
        ema_slow = close.ewm(span=slow, adjust=False).mean()
        macd_line = ema_fast - ema_slow
        signal_line = macd_line.ewm(span=sig, adjust=False).mean()
        return macd_line, signal_line

    @staticmethod
    def _bollinger(close: pd.Series, period: int = 20, std_dev: float = 2.0):
        sma = close.rolling(period, min_periods=1).mean()
        std = close.rolling(period, min_periods=1).std()
        return sma + std_dev * std, sma - std_dev * std

    @staticmethod
    def _trend_score(ma_s: pd.Series, ma_l: pd.Series, close: pd.Series) -> float:
        score = 0.0
        if ma_s.iloc[-1] > ma_l.iloc[-1]:
            score += 0.5
        else:
            score -= 0.5
        if close.iloc[-1] > ma_s.iloc[-1]:
            score += 0.3
        else:
            score -= 0.3
        ma_l_slope = (ma_l.iloc[-1] - ma_l.iloc[-min(20, len(ma_l))]) / (ma_l.iloc[-1] + 1e-10)
        score += max(-0.2, min(0.2, ma_l_slope * 10))
        return max(-1.0, min(1.0, score))

    @staticmethod
    def _momentum_score(rsi: pd.Series, macd_line: pd.Series, signal_line: pd.Series) -> float:
        score = 0.0
        r = rsi.iloc[-1]
        if r > 70:
            score -= 0.4
        elif r < 30:
            score += 0.4
        elif r > 50:
            score += 0.1
        else:
            score -= 0.1
        if macd_line.iloc[-1] > signal_line.iloc[-1]:
            score += 0.3
        else:
            score -= 0.3
        macd_diff = macd_line.iloc[-1] - macd_line.iloc[-min(5, len(macd_line))]
        score += max(-0.3, min(0.3, macd_diff * 50))
        return max(-1.0, min(1.0, score))

    @staticmethod
    def _mean_reversion_score(close: pd.Series, bb_upper: pd.Series, bb_lower: pd.Series) -> float:
        price = close.iloc[-1]
        upper = bb_upper.iloc[-1]
        lower = bb_lower.iloc[-1]
        band_width = upper - lower
        if band_width < 1e-10:
            return 0.0
        position = (price - lower) / band_width
        return max(-1.0, min(1.0, 1.0 - 2.0 * position))

    @staticmethod
    def _to_signal(composite: float) -> tuple[SignalDirection, float]:
        if composite > 0.15:
            return SignalDirection.BULLISH, min(1.0, abs(composite))
        elif composite < -0.15:
            return SignalDirection.BEARISH, min(1.0, abs(composite))
        return SignalDirection.NEUTRAL, 0.3

    def _empty(self, symbol: str):
        return (
            AnalystSignal(
                analyst=self.name,
                analyst_display=self.display_name,
                signal=SignalDirection.NEUTRAL,
                confidence=0.0,
                reasoning="数据不足，无法进行技术分析",
            ),
            TechnicalSnapshot(),
        )
