# Changelog
> Please note, PR links are not available for changes below as they are on private repository or not committed. Changes implemented after May 12, 2026 will include PR links. 
## 2026-06-09

### Added
- Synthetic hydroponics dataset added (`data/synthetic_hydroponics_dataset.csv`) with 480 simulation records across lettuce and tomato crop profiles ([PR #18](https://github.com/rsajid1/HydroSim-internal/pull/18))
- CI/CD pipeline configured via GitHub Actions — runs ESLint + Vitest (frontend) and Pylint + pytest (backend) on all PRs and pushes to main ([PR #17](https://github.com/rsajid1/HydroSim-internal/pull/17))
- Backend test suite added (`backend/tests/`) covering auth validation, health endpoint, and user validation
- Vitest configured for frontend unit testing (`vitest.config.mts`, `vitest.setup.ts`)
- Dataset plan documentation added (`docs/DATASET.md`)

### Changed
- Crop selection UI updated — planters now grouped into rows of 3; selecting a crop applies to the entire row
- EC slider changed to status-only display
- Shelf occupancy indicator updated from `x/9` to `x/3 rows`
- QA strategy document updated to reflect actual CI pipeline and synthetic dataset usage
- ESLint config updated to exclude `.d.ts` files, `eslint.config.mjs`, and `package-lock.json` from linting
- Turbopack enabled for faster frontend dev server startup
- VS Code settings added to scope ESLint to TypeScript/JavaScript files only

---

## 2026-02-27

### Added
- Database test added to dashboard 
- Added new routes to application to enable data streaming 
- General code improvements 

---

## 2026-02-06

### Added
- Postgres database connection route created 

### Removed
- Front end files deprecated 
---

## 2026-01-30

> No PR available for this release (pushed directly to GitHub)

### Changed
- New planter structure added to simulation 
- Landing page now goes directly to authentication 
- Next updated to version 16.1.6 

---

## 2026-01-22

### Added
- Dashboard added to main project structure 
- Added logout button on dashboard 
### Changed
- Began combining front and backend files 

### Fixed
- Dashboard removed from frontend files 

---

## Planned

### Upcoming
- Deprecate frontend folder 
- Integrate shadcn/ui blocks (https://ui.shadcn.com/blocks) 
