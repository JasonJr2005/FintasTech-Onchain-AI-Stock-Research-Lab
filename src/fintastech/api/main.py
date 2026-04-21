"""FintasTech Research API — FastAPI entrypoint.

EDUCATIONAL / RESEARCH USE ONLY. See DISCLAIMER.md at the repository root.
This API serves rule-based research signals and paper-trading simulation data.
It does NOT provide investment advice and NEVER executes real trades.
"""

import sys

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from fintastech import __version__
from fintastech.api.routes import analysis, backtest, health, presets, simulation


DISCLAIMER_BANNER = """
============================================================
FintasTech Research API — v{v}
EDUCATIONAL / RESEARCH USE ONLY. NOT INVESTMENT ADVICE.
This server serves rule-based research signals and paper-trading
simulation data only. It does not and cannot execute real trades.
============================================================
"""


def create_app() -> FastAPI:
    print(DISCLAIMER_BANNER.format(v=__version__), file=sys.stderr, flush=True)

    app = FastAPI(
        title="FintasTech Research API",
        version=__version__,
        description=(
            "Open-source educational research API — multi-agent rule-based stock "
            "analysis + paper-trading simulator. FOR EDUCATION AND RESEARCH ONLY; "
            "NOT investment advice; does NOT execute real trades. See "
            "DISCLAIMER.md in the repository root."
        ),
    )
    # CORS: permissive, but credentials disabled so the `*` origin is valid
    # per the spec. The frontend proxies through Next.js anyway (see
    # `frontend/next.config.mjs`), so credentials are never needed for this API.
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health.router, tags=["health"])
    app.include_router(analysis.router, prefix="/v1", tags=["analysis"])
    app.include_router(backtest.router, prefix="/v1", tags=["backtest"])
    app.include_router(simulation.router, prefix="/v1", tags=["simulation"])
    app.include_router(presets.router, prefix="/v1", tags=["presets"])
    return app


app = create_app()
