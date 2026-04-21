from fastapi.testclient import TestClient

from fintastech.api.main import create_app

client = TestClient(create_app())


def test_health() -> None:
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_masters_list() -> None:
    r = client.get("/v1/masters")
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 14
    assert data[0]["key"] == "warren_buffett"


def test_search() -> None:
    r = client.get("/v1/search?q=AAPL")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 1
