"""Query-parameter validation tests for the users routes.

``list_users`` declares ``limit: int = Query(ge=1, le=200)``. FastAPI validates query params
BEFORE the route handler runs, so out-of-range values return 422 without ever touching the
database — safe to test with no DB available.
"""


def test_list_users_rejects_limit_below_minimum(client):
    response = client.get("/api/users", params={"limit": 0})
    assert response.status_code == 422


def test_list_users_rejects_limit_above_maximum(client):
    response = client.get("/api/users", params={"limit": 500})
    assert response.status_code == 422
