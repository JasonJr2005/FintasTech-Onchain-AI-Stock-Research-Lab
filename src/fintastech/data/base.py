from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date, datetime
from typing import Literal

import pandas as pd


@dataclass(frozen=True)
class OHLCVBar:
    """Single candlestick / bar."""

    ts: datetime
    open: float
    high: float
    low: float
    close: float
    volume: float


class MarketDataProvider(ABC):
    """Pluggable market data source (Yahoo, broker API, local parquet, etc.)."""

    @abstractmethod
    def get_history(
        self,
        symbol: str,
        *,
        start: date | None = None,
        end: date | None = None,
        interval: Literal["1d", "1wk", "1mo"] = "1d",
    ) -> pd.DataFrame:
        """
        Return OHLCV as a DataFrame with DatetimeIndex and columns:
        open, high, low, close, volume (lowercase).
        """
