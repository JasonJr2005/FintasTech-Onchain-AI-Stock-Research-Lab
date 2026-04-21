from typing import Any

import pandas as pd


def summarize_ohlcv(df: pd.DataFrame) -> dict[str, Any]:
    """Compact numeric summary for agent / API responses."""
    if df.empty or "close" not in df.columns:
        return {"bars": 0}
    close = df["close"].astype(float)
    last = float(close.iloc[-1])
    first = float(close.iloc[0])
    ret = (last / first - 1.0) if first else 0.0
    vol = float(df["volume"].astype(float).iloc[-1]) if "volume" in df.columns else 0.0
    return {
        "bars": int(len(df)),
        "last_close": last,
        "period_return": ret,
        "last_volume": vol,
    }
