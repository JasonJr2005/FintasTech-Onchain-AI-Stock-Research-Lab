from datetime import date, datetime, timedelta
from typing import Literal

import numpy as np
import pandas as pd

from fintastech.data.base import MarketDataProvider


class MockMarketProvider(MarketDataProvider):
    """Deterministic synthetic series for tests and offline development."""

    def get_history(
        self,
        symbol: str,
        *,
        start: date | None = None,
        end: date | None = None,
        interval: Literal["1d", "1wk", "1mo"] = "1d",
    ) -> pd.DataFrame:
        end_d = end or date.today()
        start_d = start or (end_d - timedelta(days=120))

        rng = pd.date_range(start=start_d, end=end_d, freq="B")
        seed = sum(ord(c) for c in symbol) % 2**32
        gen = np.random.default_rng(seed)
        n = len(rng)
        walk = gen.normal(0, 0.01, size=n).cumsum()
        close = 100.0 * np.exp(walk)
        open_ = np.roll(close, 1)
        open_[0] = close[0]
        high = np.maximum(open_, close) * (1 + gen.uniform(0, 0.01, size=n))
        low = np.minimum(open_, close) * (1 - gen.uniform(0, 0.01, size=n))
        volume = gen.integers(1_000_000, 5_000_000, size=n).astype(float)

        df = pd.DataFrame(
            {
                "open": open_,
                "high": high,
                "low": low,
                "close": close,
                "volume": volume,
            },
            index=pd.DatetimeIndex(rng, name="timestamp"),
        )
        if interval != "1d":
            df = df.resample({"1wk": "W", "1mo": "ME"}[interval]).agg(
                {
                    "open": "first",
                    "high": "max",
                    "low": "min",
                    "close": "last",
                    "volume": "sum",
                }
            )
        return df
