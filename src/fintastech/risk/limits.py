from dataclasses import dataclass


@dataclass(frozen=True)
class RiskLimits:
    max_single_position_pct: float = 0.2
    max_leverage: float = 1.0


def clip_position_suggestion(raw_pct: float, limits: RiskLimits) -> float:
    """Clamp suggested allocation to risk bounds (e.g. -0.2 .. 0.2 for long/short cap)."""
    cap = limits.max_single_position_pct * limits.max_leverage
    return max(-cap, min(cap, raw_pct))
