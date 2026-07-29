# Test Coverage

How to generate, read, and interpret test coverage for HydroSim — locally and on pull requests.

**The one-line policy:** coverage is **reported, not gated**. No threshold is configured, so coverage can never fail a build on its own. Failing tests still fail CI.

---

## Contents

- [Quick reference](#quick-reference)
- [One-time setup](#one-time-setup)
- [Frontend coverage (Vitest + V8)](#frontend-coverage-vitest--v8)
- [Backend coverage (pytest-cov)](#backend-coverage-pytest-cov)
- [Reading the HTML reports](#reading-the-html-reports)
- [Coverage on a pull request](#coverage-on-a-pull-request)
- [How the job summary is built](#how-the-job-summary-is-built)
- [Why there is no threshold](#why-there-is-no-threshold)
- [Configuration reference](#configuration-reference)
- [Troubleshooting](#troubleshooting)

---

## Quick reference

Run everything from the **repository root** (`HydroSim-internal/`) unless a command says otherwise.

| Goal | Command |
|---|---|
| Frontend coverage | `npm run test:coverage` |
| Frontend HTML report | `npm run test:coverage` → open `coverage/lcov-report/index.html` |
| Backend coverage | `cd backend && pytest --cov --cov-report=term-missing` |
| Backend HTML report | `cd backend && pytest --cov --cov-report=html` → open `backend/htmlcov/index.html` |
| Preview the PR summary table | `node scripts/ci/coverage-summary.mjs frontend coverage/coverage-summary.json` |
| Tests only, no coverage (fast loop) | `npm test` / `pytest` |

Current baseline, for reference: **frontend ~55% lines**, **backend ~72% statements**.

---

## One-time setup

### Frontend

```bash
npm install
```

This pulls in `@vitest/coverage-v8`, the coverage provider. Without it, `npm run test:coverage` fails with a missing-provider error.

### Backend

```bash
pip install -r backend/requirements.txt
```

This installs `pytest`, `pytest-asyncio`, `pytest-cov`, and `httpx` alongside the runtime dependencies. `httpx` is required by FastAPI's `TestClient` — without it every test errors during collection.

> **Check your environment is actually active.** A `(.venv)` prefix in your prompt does not guarantee the venv is on `PATH`. Confirm before installing:
>
> ```bash
> python -c "import sys; print(sys.prefix)"
> ```
>
> If that prints a system Python path rather than your `.venv`, the venv isn't active and packages will install globally. Recreate it with `python -m venv .venv --clear` and re-activate.

No AWS or PostgreSQL access is needed. `backend/tests/conftest.py` sets stub Cognito and DB environment variables **before** the app is imported, since the app validates its Cognito config at import time.

---

## Frontend coverage (Vitest + V8)

```bash
npm run test:coverage        # = vitest run --coverage
```

This runs the exact same test suite as `npm test`, with V8 instrumentation added.

### What it produces

Everything lands in `coverage/` (git-ignored):

| File | Purpose |
|---|---|
| `lcov-report/index.html` | Clickable line-by-line HTML report — **start here** |
| `coverage-summary.json` | Totals per file; consumed by the CI job summary script |
| `coverage-final.json` | Full raw coverage map |
| `lcov.info` | Standard LCOV format, for editor plugins or future tooling |

The terminal also prints a per-file table with uncovered line numbers, plus a totals block.

### Narrowing the run

While working on one area, scope the run to keep it fast:

```bash
npx vitest run --coverage lib/ components/
```

Note that totals will be misleadingly low — `all: true` still counts every source file, but only the tests you selected actually ran.

---

## Backend coverage (pytest-cov)

```bash
cd backend
pytest --cov --cov-report=term-missing
```

`--cov` with **no argument** is deliberate: it picks up `source = ["app", "config"]` from `[tool.coverage.run]` in `backend/pyproject.toml`, so the measured scope stays defined in one place.

### Report formats

Combine as many `--cov-report` flags as you need:

```bash
pytest --cov --cov-report=term-missing              # terminal table + uncovered line numbers
pytest --cov --cov-report=html                      # backend/htmlcov/index.html
pytest --cov --cov-report=xml                       # backend/coverage.xml (for tooling)
pytest --cov --cov-report=json:coverage.json        # backend/coverage.json (for the PR summary)
```

A plain `pytest` still runs with no coverage overhead, so the normal edit/test loop stays fast.

### Branch coverage

Branch coverage is enabled (`branch = true`). The terminal table has extra columns:

- **Branch** — total branch outcomes in the file
- **BrPart** — branches only partially exercised (the `if` was taken but never the `else`, or vice versa)

A file can sit at 100% statements and still have partial branches. Those are usually the most valuable gaps to close.

---

## Reading the HTML reports

Open `coverage/lcov-report/index.html` (frontend) or `backend/htmlcov/index.html` (backend) in a browser. Click any file for a line-by-line view:

- **Green** — executed
- **Red** — never executed
- **Yellow / `I`, `E` markers** — branch partially taken (`I` = if path missed, `E` = else path missed)

Colour is the fastest way to spot untested error handling, which tends to be where real bugs hide.

---

## Coverage on a pull request

CI runs coverage on every pull request from any branch, and on pushes to `main`. Results appear in **three** places:

### 1. Job summary (easiest to read)

PR → **Checks** tab → the workflow run → the **Summary** page.

You'll see a `Frontend coverage` and a `Backend coverage` section, each with a totals table and a collapsible per-file breakdown sorted worst-first:

```
## Backend coverage

🟡 72.22% of statements covered

| Metric     | Covered | Total | %      |
| ---------- | ------: | ----: | -----: |
| Statements |     286 |   394 | 72.22% |
| Branches   |      39 |    56 | 69.64% |
```

The 🟢/🟡/🔴 badges are cosmetic only (≥80 / ≥50 / below). They gate nothing.

### 2. Step logs

The `Run unit tests with coverage` and `Run pytest with coverage` steps print the full coverage table inline. Useful when you want the uncovered line numbers without downloading anything.

### 3. Artifacts

At the bottom of the run page: `frontend-coverage` and `backend-coverage`. These contain the complete HTML reports plus `lcov.info` / `coverage.xml`, retained for **14 days**. Download, unzip, open `index.html`.

### Behaviour on failure

The summary and artifact steps use `if: always()`, so **coverage is still published when tests fail**. These steps never change the job result — only lint and test failures fail CI.

---

## How the job summary is built

`scripts/ci/coverage-summary.mjs` converts a coverage JSON file into a Markdown table and appends it to GitHub's `$GITHUB_STEP_SUMMARY`.

```bash
node scripts/ci/coverage-summary.mjs <label> <path-to-coverage-json>
```

It auto-detects both formats:

| Input | Shape |
|---|---|
| `coverage/coverage-summary.json` (Vitest/istanbul) | `{ total: {...}, "<file>": {...} }` |
| `backend/coverage.json` (coverage.py) | `{ totals: {...}, files: {...} }` |

Run it locally to preview exactly what reviewers will see — with `GITHUB_STEP_SUMMARY` unset it prints to stdout:

```bash
node scripts/ci/coverage-summary.mjs frontend coverage/coverage-summary.json
node scripts/ci/coverage-summary.mjs backend backend/coverage.json
```

**The script always exits 0.** A missing, unreadable, or unrecognised coverage file produces an explanatory note in the summary instead of an error. Reporting infrastructure must never be able to turn a green build red.

---

## Why there is no threshold

A threshold set above current coverage blocks every PR until someone backfills tests, which in practice means it gets disabled a week later. A threshold set below current coverage does nothing. Neither helps reviewers.

Instead, coverage is published where reviewers will actually see it, and the judgement stays human: **a change that adds logic without adding tests should be questioned in review**, regardless of what the percentage says.

### If the team later agrees on a floor

Both hooks are already commented in place:

**Frontend** — `vitest.config.mts`, under `test.coverage`:

```ts
thresholds: { lines: 50, functions: 50, branches: 50, statements: 50 }
```

**Backend** — `backend/pyproject.toml`, under `[tool.coverage.report]`:

```toml
fail_under = 50
```

Agree the number as a team first, and set it at or just below the current baseline so it ratchets upward rather than blocking work on day one.

---

## Configuration reference

| File | Role |
|---|---|
| `vitest.config.mts` | Frontend coverage config (`test.coverage`) |
| `package.json` | `test:coverage` script; `@vitest/coverage-v8` dev dependency |
| `backend/pyproject.toml` | `[tool.coverage.run]`, `[tool.coverage.report]`, `[tool.coverage.html]`, `[tool.coverage.xml]` |
| `backend/requirements.txt` | `pytest-cov` and test dependencies |
| `.github/workflows/ci.yml` | Runs coverage on PRs; publishes summary + artifacts |
| `scripts/ci/coverage-summary.mjs` | Renders coverage JSON into the job summary |
| `.gitignore` | Ignores `coverage/`, `backend/htmlcov/`, `.coverage`, `coverage.xml`, `coverage.json` |

### Two decisions worth knowing about

**`all: true` (frontend).** Files with no tests appear in the report at 0% rather than being omitted. Without this, a component nobody tested is simply absent, and the headline percentage only describes files that already had tests — which flatters the number badly. Coverage is measured across `app/`, `components/`, and `lib/`.

**Excluded from measurement.** Test files themselves, `*.d.ts`, config files, `node_modules/`, `.next/` (frontend); `tests/` and `__init__.py` (backend). `[tool.coverage.report] exclude_lines` also skips `pragma: no cover`, `if __name__ == "__main__":`, `if TYPE_CHECKING:`, and bare `...` stubs.

---

## Troubleshooting

**`Cannot find module '...\scripts\ci\coverage-summary.mjs'`**
You're in the wrong directory. Run from the repo root (`HydroSim-internal/`), not its parent. After `cd backend`, remember to `cd ..` before invoking the script.

**`RuntimeError: The starlette.testclient module requires the httpx package`**
Backend test dependencies aren't installed: `pip install -r backend/requirements.txt`.

**`pytest : The term 'pytest' is not recognized`**
Your virtual environment isn't active, or `pytest` was installed into a different interpreter. See [One-time setup](#one-time-setup).

**`RolldownError: Parse failed ... Unexpected JSX expression` / `Excluding it from coverage`**
A `.js` file contains JSX. The parser the V8 provider uses for uncovered files only enables JSX for `.jsx` and `.tsx`. Rename the file to `.jsx` — Next.js App Router resolves `page`/`layout` files by convention, so no imports need updating. (This is why `app/page.jsx` and `app/layout.jsx` carry that extension.)

**Coverage suddenly dropped a few percent**
Check whether files were newly *included* rather than newly untested — adding a file to the `include` globs, or fixing a parse error that was silently excluding it, both lower the headline number while improving its accuracy.

**`The width(0) and height(0) of chart should be greater than 0`**
Harmless. Recharts warns because jsdom reports zero-size containers. Unrelated to coverage; tests still pass.

---

## Related

- [`README.md`](../README.md) — project setup and CI overview
- [`docs/QA.md`](./QA.md) — overall testing strategy and PR quality rules
- [Vitest coverage docs](https://vitest.dev/guide/coverage) · [pytest-cov docs](https://pytest-cov.readthedocs.io/) · [coverage.py config](https://coverage.readthedocs.io/en/latest/config.html)
