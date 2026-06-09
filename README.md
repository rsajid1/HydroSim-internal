# Frontend (Next.js)

This is the frontend client for the project, built using **Next.js** with **Tailwind CSS**, **shadcn ui**.  
It interacts with the FastAPI backend through API calls.

---

## Project Overview

- **Framework:** Next.js 14+  
- **Language:** TypeScript  
- **UI Library:** shadcn/ui  
- **Styling:** Tailwind CSS  
- **Server Port:** `3000`  
- **Environment File:** `.env.local`

---

## Folder Structure

````
frontend/
├── app/
│   ├── auth/
│   │   ├── login/
│   │   └── signup/
│   ├── layout.js
│   ├── page.js       ← Health check integrated here
│   └── globals.css
├── lib/
│   ├── api.js        ← API communication lives here
│   └── utils.js
├── public/
├── .env
├── package.json
└── README.md

````

---

## Requirements

- Node.js v20+
- npm or yarn package manager

---

## Setup Instructions

### 1. Navigate to the Frontend Directory
```bash
cd frontend
````

### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

### 3. Environment Configuration

Create a `.env` file in the root of `/frontend`:

```
NEXT_PUBLIC_API_URL=http://127.0.0.1:8000
```

### 4. Run the Development Server

```bash
npm run dev
```

App will run on:

```
http://localhost:3000
```

---

## Connecting to Backend

Ensure your backend FastAPI server is running.
The frontend communicates with it through:

```
GET http://127.0.0.1:8000/api/health
```

If you see a **“Server is healthy”** message in your browser, the connection is successful.

---

## Testing

The project has automated tests on both the frontend and the backend.

### Frontend — Vitest + React Testing Library

Unit/component tests run with [Vitest](https://vitest.dev/) and
[@testing-library/react](https://testing-library.com/) in a `jsdom` environment.

```bash
npm test          # run all tests once (vitest run)
npm run test:watch  # re-run on file changes
```

- Config: `vitest.config.mts` (sets the `jsdom` environment and the `@/*` → repo-root alias to
  match `tsconfig.json`); global matchers are registered in `vitest.setup.ts`.
- Test files live next to the code they cover, named `*.test.ts(x)` — e.g. `lib/utils.test.ts`,
  `components/ui/button.test.tsx`, `components/ui/input.test.tsx`.

### Backend — PyTest + FastAPI TestClient

API tests use [PyTest](https://docs.pytest.org/) with FastAPI's `TestClient`.

```bash
cd backend
pytest                     # discovers tests in backend/tests/
```

- Tests live in `backend/tests/`. `conftest.py` sets stub Cognito/DB environment variables
  **before** the app is imported (the app validates Cognito config at import time) and exposes a
  shared `client` fixture, so no real AWS or PostgreSQL access is required.
- Coverage so far: health/root routes, unknown-route 404s, and request-validation (422) cases for
  the auth and users endpoints.

### Linting

```bash
npm run lint                              # frontend: ESLint (next/core-web-vitals)
cd backend && pylint app/ config/ --fail-under=7.0   # backend: Pylint (gate at 7.0)
```

---

## Continuous Integration

GitHub Actions runs the full suite automatically on every pull request (from any branch) and on
pushes to `main`. The workflow lives at `.github/workflows/ci.yml` and has two jobs:

- **Frontend** — `npm ci` → `npm run lint` → `npm test`
- **Backend** — install deps with `uv` → `pylint` → `pytest` → app import check

Both jobs must pass before a PR is merged.


