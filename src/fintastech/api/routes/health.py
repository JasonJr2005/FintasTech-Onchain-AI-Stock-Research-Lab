from fastapi import APIRouter

from fintastech import __version__

router = APIRouter()


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "version": __version__}
