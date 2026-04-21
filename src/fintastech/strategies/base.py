from dataclasses import dataclass
from typing import Protocol

import pandas as pd


@dataclass(frozen=True)
class StrategyContext:
    symbol: str
    ohlcv: pd.DataFrame


@dataclass(frozen=True)
class StrategyResult:
    """Normalized strategy output for backtest / execution layers."""

    symbol: str
    signal: float  # -1 .. 1 directional hint
    confidence: float  # 0 .. 1
    notes: str


class Strategy(Protocol):
    def run(self, ctx: StrategyContext) -> StrategyResult: ...
