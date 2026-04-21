from fintastech.analysis.indicators import simple_momentum_signal
from fintastech.strategies.base import StrategyContext, StrategyResult


class MomentumMAStrategy:
    """Example strategy using MA crossover from the analysis module."""

    def __init__(self, short: int = 10, long: int = 30) -> None:
        self.short = short
        self.long = long

    def run(self, ctx: StrategyContext) -> StrategyResult:
        df = ctx.ohlcv
        if df.empty:
            return StrategyResult(
                symbol=ctx.symbol, signal=0.0, confidence=0.0, notes="no data"
            )
        sig = simple_momentum_signal(df, short=self.short, long=self.long)
        last = float(sig.iloc[-1])
        # crude confidence from how separated the MAs are (placeholder)
        close = df["close"].astype(float)
        ma_s = close.rolling(self.short, min_periods=1).mean()
        ma_l = close.rolling(self.long, min_periods=1).mean()
        spread = abs(ma_s.iloc[-1] - ma_l.iloc[-1]) / (close.iloc[-1] + 1e-9)
        conf = float(min(1.0, spread * 50))
        notes = "long bias" if last > 0 else "short/cash bias"
        return StrategyResult(symbol=ctx.symbol, signal=last, confidence=conf, notes=notes)
