#!/usr/bin/env python3
"""FintasTech — Automated research loop.

EDUCATIONAL / RESEARCH USE ONLY. NOT INVESTMENT ADVICE.

Runs the full rule-based multi-agent research pipeline on a configurable
watch-list at a fixed cadence, and applies the resulting illustrative
weights to the local paper-trading ledger. Optionally runs once for cron.

This script NEVER contacts a real brokerage, exchange, or DEX. It mutates
only the local JSON ledger at ``data/simulation.json``.

Usage
-----
    # One-shot (good for cron)
    python scripts/auto_research_loop.py --once \\
        --symbols AAPL,MSFT,GOOGL,TSLA \\
        --risk moderate

    # Daemon loop
    python scripts/auto_research_loop.py \\
        --symbols AAPL,MSFT,GOOGL,TSLA,NVDA \\
        --interval 3600

Environment overrides
---------------------
    FINTASTECH_WATCHLIST      (comma-separated, default: AAPL,MSFT,GOOGL,TSLA,NVDA)
    FINTASTECH_RISK           (conservative | moderate | aggressive)
    FINTASTECH_INTERVAL_SEC   (default 3600)
"""

from __future__ import annotations

import argparse
import os
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

# Make the project importable when running as a plain script.
_ROOT = Path(__file__).resolve().parents[1]
_SRC = _ROOT / "src"
if str(_SRC) not in sys.path:
    sys.path.insert(0, str(_SRC))

from fintastech.models.portfolio import RiskTolerance  # noqa: E402
from fintastech.simulation import get_default_portfolio  # noqa: E402


DEFAULT_WATCHLIST = os.environ.get(
    "FINTASTECH_WATCHLIST", "AAPL,MSFT,GOOGL,TSLA,NVDA"
)
DEFAULT_RISK = os.environ.get("FINTASTECH_RISK", "moderate")
DEFAULT_INTERVAL = int(os.environ.get("FINTASTECH_INTERVAL_SEC", "3600"))


def _banner() -> None:
    print("=" * 60)
    print(" FintasTech — Automated Research Loop")
    print(" EDUCATIONAL USE ONLY · NOT INVESTMENT ADVICE")
    print(" No real orders are sent. Paper trading only.")
    print("=" * 60)


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="FintasTech auto research loop")
    p.add_argument(
        "--symbols",
        default=DEFAULT_WATCHLIST,
        help="Comma-separated watch-list",
    )
    p.add_argument(
        "--risk",
        choices=[r.value for r in RiskTolerance],
        default=DEFAULT_RISK,
    )
    p.add_argument(
        "--interval",
        type=int,
        default=DEFAULT_INTERVAL,
        help="Seconds between cycles (ignored with --once)",
    )
    p.add_argument("--once", action="store_true", help="Single cycle then exit")
    return p.parse_args()


def _one_cycle(watchlist: list[str], risk: RiskTolerance) -> None:
    portfolio = get_default_portfolio()
    ts = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S UTC")
    print(f"\n[{ts}] running research cycle on {len(watchlist)} symbols…")
    snap = portfolio.rebalance(watchlist, risk_tolerance=risk)
    print(
        f"  equity = ${snap['equity']:,.2f}  "
        f"cash = ${snap['cash']:,.2f}  "
        f"return = {snap['total_return_pct']:+.2f}%  "
        f"positions = {len(snap['holdings'])}"
    )
    for h in snap["holdings"][:5]:
        mark = "•"
        if h["last_signal"] == "bullish":
            mark = "▲"
        elif h["last_signal"] == "bearish":
            mark = "▼"
        print(
            f"   {mark} {h['symbol']:<8} "
            f"{h['weight_pct']:5.1f}% "
            f"pnl {h['unrealized_pnl_pct']:+.2f}%"
        )


def main() -> int:
    args = _parse_args()
    watchlist = [s.strip().upper() for s in args.symbols.split(",") if s.strip()]
    if not watchlist:
        print("empty watch-list, nothing to do", file=sys.stderr)
        return 2
    risk = RiskTolerance(args.risk)

    _banner()
    print(f" watch-list : {', '.join(watchlist)}")
    print(f" risk       : {risk.value}")
    print(f" mode       : {'once' if args.once else f'loop every {args.interval}s'}")

    try:
        while True:
            try:
                _one_cycle(watchlist, risk)
            except KeyboardInterrupt:
                raise
            except Exception as exc:  # noqa: BLE001
                print(f"  cycle error: {exc}", file=sys.stderr)
            if args.once:
                break
            time.sleep(max(60, args.interval))
    except KeyboardInterrupt:
        print("\ninterrupted — shutting down.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
