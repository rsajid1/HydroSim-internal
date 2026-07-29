# HydroSim Frontend (Next.js)

This is the frontend client for the project, built using **Next.js** with **Tailwind CSS**, **shadcn ui**.  
It interacts with the FastAPI backend through API calls.

> This is a monorepo: the Next.js frontend lives at the **repository root** and the
> FastAPI backend lives in [`backend/`](./backend/README.md). All commands below are run
> from the repo root.

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

```
.
├── app/
│   ├── auth/             ← login / signup / password reset pages
│   ├── dashboard/        ← the main simulator UI (page.tsx)
│   ├── api/dataset/      ← Next.js route that serves the local dataset CSV
│   ├── layout.js
│   ├── page.js           ← landing page (redirects to /auth/signup)
│   └── globals.css
├── components/ui/        ← shadcn/ui components
├── lib/
│   ├── api.js            ← backend API communication
│   ├── dataset.ts        ← local dataset parse/filter helpers
│   └── utils.js
├── data/                 ← synthetic_hydroponics_dataset.csv
├── docs/                 ← project documentation
├── public/
├── backend/              ← FastAPI backend (separate README)
├── .env.local            ← frontend environment variables (not in git)
└── package.json
```

---

## Requirements

- Node.js v20+
- npm or yarn package manager

---

## Setup Instructions

### 1. Install Dependencies

From the repository root:

```bash
npm install
# or
yarn install
```

### 2. Environment Configuration

Create a `.env.local` file in the repository root:

```
NEXT_PUBLIC_API_URL=http://127.0.0.1:8001
```

### 3. Run the Development Server

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
GET http://127.0.0.1:8001/api/health
```

If you see a **“Server is healthy”** message in your browser, the connection is successful.

---

## Testing

The project has automated tests on both the frontend and the backend.

### Frontend — Vitest + React Testing Library

Unit/component tests run with [Vitest](https://vitest.dev/) and
[@testing-library/react](https://testing-library.com/) in a `jsdom` environment.

```bash
npm test              # run all tests once (vitest run)
npm run test:watch    # re-run on file changes
npm run test:coverage # run once with coverage (vitest run --coverage)
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
pytest --cov --cov-report=term-missing   # same run, with a coverage table
```

- Tests live in `backend/tests/`. `conftest.py` sets stub Cognito/DB environment variables
  **before** the app is imported (the app validates Cognito config at import time) and exposes a
  shared `client` fixture, so no real AWS or PostgreSQL access is required.
- Coverage so far: health/root routes, unknown-route 404s, and request-validation (422) cases for
  the auth and users endpoints.

### Test coverage

Both suites report coverage with the same commands CI runs:

```bash
npm run test:coverage                              # frontend -> coverage/lcov-report/index.html
cd backend && pytest --cov --cov-report=term-missing   # backend
```

Coverage is **reported, not gated** — no threshold is configured, so coverage cannot fail a build
on its own. Failing tests still fail the build.

📖 **See [`docs/COVERAGE.md`](docs/COVERAGE.md)** for the full guide: setup, report formats, reading
the HTML output, where coverage appears on a PR, and troubleshooting.

### Linting

```bash
npm run lint                              # frontend: ESLint (next/core-web-vitals)
cd backend && pylint app/ config/ --fail-under=7.0   # backend: Pylint (gate at 7.0)
```

---

## Continuous Integration

GitHub Actions runs the full suite automatically on every pull request (from any branch) and on
pushes to `main`. The workflow lives at `.github/workflows/ci.yml` and has two jobs:

- **Frontend** — `npm ci` → `npm run lint` → `npm run test:coverage`
- **Backend** — install deps with `uv` → `pylint` → `pytest --cov` → app import check

Both jobs must pass before a PR is merged.

### Where to find coverage on a PR

Every pull request run reports coverage in three places:

1. **Job summary** — open the workflow run from the PR's **Checks** tab. The summary page shows a
   coverage table per job (totals plus a collapsible per-file breakdown), rendered by
   `scripts/ci/coverage-summary.mjs`.
2. **Logs** — the `Run unit tests with coverage` and `Run pytest with coverage` steps print the
   coverage table inline.
3. **Artifacts** — the run page has `frontend-coverage` and `backend-coverage` downloads containing
   the full HTML reports (plus `lcov.info` / `coverage.xml`), kept for 14 days.

The summary and artifact steps run with `if: always()`, so coverage is still published when tests
fail. They never alter the job result: only lint and test failures fail CI.

Details in [`docs/COVERAGE.md`](docs/COVERAGE.md).


