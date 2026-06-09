"""Input-validation tests for the auth routes.

These only exercise Pydantic request validation, which runs BEFORE the route handler,
so no real AWS Cognito call is ever made.
"""


def test_login_rejects_empty_body(client):
    response = client.post("/auth/login", json={})
    assert response.status_code == 422


def test_signup_rejects_missing_password(client):
    response = client.post("/auth/signup", json={"email": "user@example.com"})
    assert response.status_code == 422
