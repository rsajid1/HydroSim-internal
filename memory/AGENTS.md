# HydroSim Agent Reference

> AI agents must read this file before making any code changes to this project.

## Package Management
- **Always use `uv` instead of `pip`** for Python package installs in the backend
  - Install: `uv pip install <package>`
  - Add to project: `uv add <package>`

## Project Structure
- Monorepo - no separate frontend/backend folder split at root level
- Next.js frontend lives in root `app/` directory
- FastAPI backend lives in `backend/`

## Key Files
- Frontend entry: `app/dashboard/page.tsx` (hydroponics simulator)
- Auth flow: `app/auth/login/page.js` → `/dashboard` on success
- Backend app: `backend/app/index.py`
- Backend config: `backend/config/config.py`
- Environment vars: `backend/.env`
