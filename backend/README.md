# HydroSim Backend

Backend API for the HydroSim - Interactive Hydroponics & Greenhouse Simulator project.

## Technology Stack

- **FastAPI** - Modern, fast web framework for building APIs
- **Python 3.11+** - Programming language
- **uv** - Fast Python package installer and resolver (Astral)
- **Pydantic** - Data validation using Python type annotations

## Prerequisites

- Python 3.11 or higher
- [uv](https://docs.astral.sh/uv/) - Install from https://docs.astral.sh/uv/getting-started/installation/

## Installation

### 1. Install uv (if not already installed)

**Windows:**
```powershell
powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
```

**macOS/Linux:**
```bash
curl -LsSf https://astral.sh/uv/install.sh | sh
```

### 2. Navigate to backend directory

```bash
cd backend
```

### 3. Install dependencies

```bash
# Using uv (recommended)
uv pip install -r requirements.txt

# Or using pyproject.toml
uv pip install -e .

# Alternative: Using pip
pip install -r requirements.txt
```

### 4. Environment configuration

Create a `.env` file in the `backend` directory. These map to `Settings` in
`config/config.py`. The Cognito values are **required** — `app/routers/auth.py` validates
them at import time and the app will not start if they are missing:

```env
DEBUG=true
CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001

# AWS Cognito (required)
COGNITO_REGION=us-east-1
COGNITO_USER_POOL_ID=your-user-pool-id
COGNITO_CLIENT_ID=your-client-id
COGNITO_CLIENT_SECRET=your-client-secret

# PostgreSQL (used by the database routes)
DB_HOST=localhost
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=postgres
DB_PORT=5432
```

## Running the Server

```bash
uvicorn app.index:app --reload --host 127.0.0.1 --port 8001
```

Or using uv:

```bash
uv run uvicorn app.index:app --reload
```

The API will be available at:
- **API Base URL**: http://127.0.0.1:8001
- **API Documentation**: http://127.0.0.1:8001/docs (Swagger UI)
- **Alternative Docs**: http://127.0.0.1:8001/redoc (ReDoc)

## Project Structure

```
backend/
├── app/
│   ├── __init__.py
│   ├── index.py             # FastAPI application entry point (app.index:app)
│   ├── db.py                # PostgreSQL connection + query helpers (psycopg2)
│   ├── models/              # Pydantic / data models
│   ├── routers/             # API route handlers
│   │   ├── auth.py          # AWS Cognito signup / login / password reset
│   │   ├── database.py      # Database health + query routes
│   │   ├── health.py        # Health check endpoint
│   │   ├── sim.py           # Simulation / AI prediction (POST /api/sim/predict)
│   │   └── users.py         # User-related endpoints
│   ├── sim/
│   │   └── dataset.py       # Loads + caches the local synthetic dataset CSV
│   └── utils/
│       └── logger.py        # Structured logging setup
├── config/
│   ├── __init__.py
│   └── config.py            # Application settings (pydantic-settings)
├── tests/                   # PyTest suite (FastAPI TestClient)
├── .env                     # Environment variables (not in git)
├── .gitignore
├── pyproject.toml           # Project metadata and dependencies (uv)
├── requirements.txt         # Python dependencies
└── README.md
```

## API Endpoints

Interactive docs are available at `/docs` (Swagger) and `/redoc` once the server is running.

| Method | Path | Description |
|--------|------|-------------|
| `GET`  | `/` | API information (`{"message": "HydroSim API", "version": "1.1.0", "status": "running"}`) |
| `GET`  | `/api/health` | Health check |
| `POST` | `/auth/signup` | Register a user via AWS Cognito |
| `POST` | `/auth/login` | Authenticate and return Cognito tokens |
| `POST` | `/auth/forgot-password` | Send a Cognito password-reset code |
| `POST` | `/auth/confirm-forgot-password` | Confirm the reset code and set a new password |
| `POST` | `/api/sim/predict` | Yield / stress prediction from the local synthetic dataset |
| `GET`  | `/api/db/health` | PostgreSQL connectivity check |

Routes are registered in `app/index.py`.

## Environment Variables

These are read by `Settings` in `config/config.py`. See the `.env` example above.

| Variable | Description | Default |
|----------|-------------|---------|
| `DEBUG` | Enable FastAPI debug mode | `false` |
| `CORS_ORIGINS` | Comma-separated list of allowed CORS origins | `http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001` |
| `COGNITO_REGION` | AWS Cognito region (**required**) | _empty_ |
| `COGNITO_USER_POOL_ID` | Cognito user pool id (**required**) | _empty_ |
| `COGNITO_CLIENT_ID` | Cognito app client id (**required**) | _empty_ |
| `COGNITO_CLIENT_SECRET` | Cognito app client secret | _empty_ |
| `DB_HOST` | PostgreSQL host | _empty_ |
| `DB_USER` | PostgreSQL user | _empty_ |
| `DB_PASSWORD` | PostgreSQL password | _empty_ |
| `DB_NAME` | PostgreSQL database name | `postgres` |
| `DB_PORT` | PostgreSQL port | `5432` |

## CORS Configuration

CORS is configured to allow requests from:
- `http://localhost:3000` (Next.js default)
- `http://localhost:3001` (alternative frontend port)
- `http://127.0.0.1:3000` and `http://127.0.0.1:3001`

Additional origins can be added via the `CORS_ORIGINS` environment variable.

## Frontend Integration

**API Base URL**: `http://127.0.0.1:8001` or `http://localhost:8001`

Example API client setup:

```typescript
// lib/api.ts or utils/api.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8001';


export async function fetchHealthCheck() {
  const response = await fetch(`${API_BASE_URL}/api/health`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });
  
  if (!response.ok) {
    throw new Error('Failed to fetch health status');
  }
  
  return response.json();
}
```

**Note on uvloop**: `uvloop` provides better performance but cannot be installed on Windows. For Linux/macOS production deployments, you can add it with an environment marker.

## Troubleshooting

### Port already in use or permission denied

If you get a port permission error (WinError 10013), try:

```bash
uvicorn app.index:app --reload --port 8002
```

Or change the `PORT` value in your `.env` file.

### Dependencies not found

```bash
pip install -r requirements.txt
```

### Module import errors

Ensure you're running commands from the `backend` directory:

```bash
cd backend
uvicorn app.index:app --reload
```
