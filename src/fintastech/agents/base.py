"""Base analyst protocol — each analyst produces an AnalystSignal for a given symbol."""

from typing import Protocol

import pandas as pd

from fintastech.models.analysis import AnalystSignal


class Analyst(Protocol):
    name: str
    display_name: str

    def analyze(self, symbol: str, ohlcv: pd.DataFrame) -> AnalystSignal: ...
