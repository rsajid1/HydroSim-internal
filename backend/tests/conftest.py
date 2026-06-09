"""Shared PyTest fixtures and stub configuration.

The application imports AWS Cognito settings at module load time (``app.routers.auth``
raises if Cognito config is missing), so stub environment variables MUST be set before
``app.index`` is imported. We do that at import time of this conftest, which PyTest loads
before collecting any test modules.
"""
import os

# Stub credentials so the app can be imported without real AWS / PostgreSQL access.
# ``setdefault`` means real values (e.g. in CI) are not overwritten.
os.environ.setdefault("DEBUG", "true")
os.environ.setdefault("COGNITO_REGION", "us-east-1")
os.environ.setdefault("COGNITO_USER_POOL_ID", "us-east-1_TESTPOOL")
os.environ.setdefault("COGNITO_CLIENT_ID", "test-client-id")
os.environ.setdefault("COGNITO_CLIENT_SECRET", "test-client-secret")
os.environ.setdefault("DB_HOST", "localhost")
os.environ.setdefault("DB_USER", "postgres")
os.environ.setdefault("DB_PASSWORD", "postgres")
os.environ.setdefault("DB_NAME", "hydrosim_test")
os.environ.setdefault("DB_PORT", "5432")

import pytest
from fastapi.testclient import TestClient

from app.index import app


@pytest.fixture(scope="session")
def client():
    """A synchronous TestClient bound to the FastAPI app."""
    with TestClient(app) as test_client:
        yield test_client
