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

Create a `.env` file in the `backend` directory:

```env
ENVIRONMENT=development
DEBUG=true
API_V1_PREFIX=/api
HOST=127.0.0.1
PORT=8001
CORS_ORIGINS=http://localhost:3000,http://localhost:3001
```

## Running the Server

```bash
uvicorn app.main:app --reload --host 127.0.0.1 --port 8001
```

Or using uv:

```bash
uv run uvicorn app.main:app --reload
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
│   ├── main.py              # FastAPI application entry point
│   ├── models/              # Database and Pydantic models
│   ├── routers/             # API route handlers
│   │   ├── __init__.py
│   │   ├── health.py        # Health check endpoint
│   │   └── users.py         # User-related endpoints (placeholder)
│   └── services/            # Business logic layer
├── config/
│   ├── __init__.py
│   └── config.py            # Application configuration
├── db/                      # Database related files
├── .env                     # Environment variables (not in git)
├── .env.example             # Example environment file
├── .gitignore
├── pyproject.toml           # Project metadata and dependencies (uv)
├── requirements.txt         # Python dependencies
└── README.md
```

## API Endpoints

### Health Check
- **GET** `/api/health` - Returns API health status
  - Response: `{"status": "ok"}`

### Root
- **GET** `/` - API information
  - Response: `{"message": "HydroSim API", "version": "0.1.0", "status": "running"}`

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ENVIRONMENT` | Application environment | `development` |
| `DEBUG` | Enable debug mode | `true` |
| `API_V1_PREFIX` | API version prefix | `/api` |
| `HOST` | Server host address | `127.0.0.1` |
| `PORT` | Server port number | `8001` |
| `CORS_ORIGINS` | Comma-separated list of allowed CORS origins | `http://localhost:3000,http://localhost:3001` |

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
uvicorn app.main:app --reload --port 8002
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
uvicorn app.main:app --reload
```
