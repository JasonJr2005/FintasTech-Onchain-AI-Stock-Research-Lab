import pandas as pd


def simple_momentum_signal(df: pd.DataFrame, short: int = 10, long: int = 30) -> pd.Series:
    """
    Naive dual moving-average crossover signal: 1 when short MA > long MA, else -1.
    Not a production strategy — placeholder for pipeline wiring.
    """
    if df.empty or "close" not in df.columns:
        return pd.Series(dtype=float)
    close = df["close"].astype(float)
    ma_s = close.rolling(short, min_periods=1).mean()
    ma_l = close.rolling(long, min_periods=1).mean()
    return (ma_s > ma_l).astype(int) * 2 - 1
