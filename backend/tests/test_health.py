"""Smoke tests for routes that need neither AWS nor the database."""


def test_root_returns_running_status(client):
    response = client.get("/")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "running"
    assert body["message"] == "HydroSim API"


def test_api_health_ok(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_unknown_route_returns_404(client):
    response = client.get("/no-such-route")
    assert response.status_code == 404
