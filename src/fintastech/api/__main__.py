import uvicorn

from fintastech.config.settings import get_settings


def main() -> None:
    s = get_settings()
    uvicorn.run(
        "fintastech.api.main:app",
        host=s.api_host,
        port=s.api_port,
        reload=s.env == "development",
    )


if __name__ == "__main__":
    main()
