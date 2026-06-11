#  HydroSim QA & Testing Strategy

## A. Testing Goals

### Why Testing Matters for HydroSim

HydroSim models real-world plant growth by simulating environmental conditions (pH, EC, temperature, humidity, CO₂). Users make decisions based on the simulation's output. If the physics engine produces incorrect results, or if the application is unavailable or insecure, users lose confidence in the tool and may make poor real-world planting decisions.

### Risk Reduction Areas 

| Risk | Impact |
|---|---|
| Incorrect simulation calculations | Users receive bad yield predictions; core value of the product is undermined |
| Authentication failures (AWS Cognito) | Users cannot log in or sign up; sessions are inaccessible |
| Database connectivity issues (AWS/PostgreSQL) | Simulation data cannot be persisted or retrieved |
| API contract mismatches between frontend and backend | UI Failures and incorrect data display |
| Exposed secrets or API keys | Security breach; AWS resource compromise |
| Insecure user input handling | Injection attacks through login/signup forms |

### Most Critical Failure Types

1. **Incorrect calculations** — Our selected compute method will compute stress levels and yield predictions from pH, EC, temperature, and humidity inputs. Errors here directly mislead users.
2. **Authentication failures** — Login and signup route through AWS Cognito. A broken auth flow locks all users out.
3. **Data corruption** — Incorrect reads/writes to the PostgreSQL database could corrupt saved simulation states.
4. **Security vulnerabilities** — API key exposure.
---

## B. Planned Types of Testing

## Unit Testing

**Frontend** (`npm test` — Vitest):

| Target | What to test |
|---|---|
| `calculatePhysics()` | Correct stress/yield output for known pH, EC, temperature inputs |
| `getGrowthLabel(stage)` | Correct label at boundaries (0, 10, 40, 80) |
| `assignCrop()` | Shelf state updates; confirmation message set and cleared |
| `MetricGauge`, `ControlSlider` | Render and callback correctness |

**Backend** (`pytest` — runs from `backend/`):

| Target | What to test |
|---|---|
| `routers/auth.py` — `get_secret_hash()` | Correct HMAC-SHA256 for given inputs |
| `SignupModel`, `LoginModel` | Pydantic rejects missing fields, bad emails, weak passwords |
| `GET /api/db/health` | Returns `{"status": "connected"}` or structured error |

**Test data:** uses `data/synthetic_hydroponics_dataset.csv` for simulation input fixtures. 

Dataset fields: `ph`, `ec`, `air_temperature_c`, `humidity_percent`, `co2_ppm`, `stress_score`, `predicted_yield_score`, `risk_level`.

---

## Manual Smoke Testing

Required before any PR targeting `main`:

- **Planter UI** — click planter, select lettuce/tomato from dropdown, confirm SVG appears and toast displays
- **Simulation loop** — start, pause, reset; verify parameter drift and growth stage progression
- **Alert console** — trigger out-of-range pH/temperature; confirm alerts appear with correct colour
- **Auth flows** — signup, login, logout; confirm token storage and redirects
- **DB panel** — "Test Connection" reflects live RDS state correctly

---

## C. Pull Request Quality Rules

1. **All automated tests must pass** before a PR can be merged. This includes unit tests (PyTest, Jest) and any integration tests configured in CI.
2. **At least one peer review is required.** No PR may be merged without approval from a team member other than the author.
3. **No direct pushes to `main`.** All changes must go through a feature or bugfix branch and be merged via a Pull Request. Branch naming must follow the convention: `feature/`, `bugfix/`, `docs/`.
4. **CI checks must succeed before merging.** This includes linting (ESLint, Vitest, Pylint, pytest) before merging
5. **PRs must include a description** explaining what was changed and how it was tested (manually or automatically).
6. **No secrets or credentials** may appear in any committed file. PRs containing `.env` files or hardcoded keys will be rejected immediately.
7. **The `main` branch must remain in a deployable state** at all times. If a merge breaks the build or tests, it is the merging author's responsibility to fix or revert.
