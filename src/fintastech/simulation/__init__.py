"""Paper-trading simulator — persistent ledger that turns the rule-based
research signals into a hypothetical portfolio.

EDUCATIONAL / RESEARCH USE ONLY. No real assets are held, bought, or sold.
No broker, exchange, or DEX is ever contacted by this module.
"""

from fintastech.simulation.portfolio import (
    SimulatedPortfolio,
    get_default_portfolio,
)

__all__ = ["SimulatedPortfolio", "get_default_portfolio"]
