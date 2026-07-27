# Learning Modules Page

**Feature:** Add a static-content "Learning Modules" section covering hydroponics topics (NFT, DWC, healthy plant growth, and others), reachable from the left nav.

## Important — half the work already exists

A "Learning Modules" nav button is **already in the sidebar** at `app/dashboard/page.tsx:254`, using the `BookOpen` icon (lucide-react). It's currently a dead end: `onClick` just sets local state (`activeNav === 'learning'`), but no content branch renders for that state — clicking it silently falls through to the regular dashboard view. This needs to be rewired, not built from scratch.

## Routing decision

The app is Next.js App Router. Two inconsistent patterns already exist for nav sections:

- `Simulation` → real route (`app/dashboard/simulation/page.tsx`)
- `Database` → inline conditional panel in `page.tsx`, no route

**Follow the `Simulation` pattern.** Create `app/dashboard/learning/page.tsx` as a real route, and change the nav button's `onClick` from `setActiveNav('learning')` to `router.push('/dashboard/learning')` (see `simulation/page.tsx` for the `Link`/back-navigation pattern to copy). A real route is bookmarkable, gets its own back button, and doesn't bloat the already-large dashboard page component.

## Page template to copy

Use `app/dashboard/simulation/page.tsx` as the structural template:

- `'use client'` at top if any interactivity is needed (e.g. topic switching, search)
- Default export function component
- Wrapper: `<div className="min-h-screen bg-slate-950 text-slate-200 font-sans p-6">`
- Back link: `<Link href="/dashboard" className="flex items-center gap-2 text-sm text-slate-400 hover:text-slate-200"><ArrowLeft size={16}/> Back to Dashboard</Link>`
- It sits under `app/dashboard/layout.tsx`, which wraps everything in `<SimulationProvider>` — the learning page will inherit this automatically and can just ignore it.

## Styling

- Tailwind v4, utility classes directly (no CSS modules). Match the dashboard's dark palette: `bg-slate-950` page background, `bg-slate-900`/`border-slate-800` for cards, `text-slate-200`/`text-slate-400` for text, blue-600/blue-400 for accents/links.
- shadcn/ui is installed (`components.json`, `new-york` style) with `Button`, `Card`, `Input`, `Label` already generated (`components/ui/`). Use the shadcn `Card` (`components/ui/card.tsx` — `Card`, `CardHeader`, `CardTitle`, `CardDescription`, `CardContent`) for each topic tile rather than hand-rolling a new one, since this page is a good candidate to start actually using the installed primitives.
- Icon: reuse `BookOpen` from `lucide-react` (already used for this nav item) for visual consistency, or swap to `GraduationCap` if a distinct icon is preferred.

## Content structure — hardcoded JSX/TSX (decided)

No markdown pipeline exists in the app and none is being added for this — content is plain TSX components, colocated with the route:

```
app/dashboard/learning/
  page.tsx                 // topic list / index, links or expands into each topic
  topics/
    Nft.tsx                // NFT (Nutrient Film Technique)
    Dwc.tsx                // DWC (Deep Water Culture)
    PlantHealth.tsx         // healthy plant growth indicators
    ...                      // one file per additional topic
```

Each topic file exports a component rendering its content as JSX (headings, paragraphs, lists — plain Tailwind-styled markup, same as any other page in this app). `page.tsx` imports and renders them, either as a simple stacked list or with basic client-side tab/accordion state to switch between topics — either is fine given this is plain React state, no routing per topic is required unless the team wants deep-linkable topic URLs (in which case make each topic its own nested route, e.g. `app/dashboard/learning/nft/page.tsx`, following the same top-level pattern). Default to the single-page-with-sections approach unless there's a reason to want shareable per-topic links.

## Content requirements

- Topics: NFT (Nutrient Film Technique), DWC (Deep Water Culture), healthy plant growth indicators, and any others deemed useful.
- **Every factual claim must be cited** — include a References/Sources list at the bottom of each topic component (or a shared references section on the index page), similar in spirit to `docs/HydroSim_Security_Plan.md`'s References section. Prefer primary/authoritative sources (university ag extension programs, peer-reviewed papers, USDA/NASA hydroponics research) over blog posts.
- Suggested per-topic shape: short intro → key mechanics/how it works → pros/cons or common pitfalls → sources.

## Files to touch

| File | Change |
|---|---|
| `app/dashboard/page.tsx` | Rewire the "Learning Modules" `NavItem` (~line 254) to navigate to `/dashboard/learning` instead of setting local state |
| `app/dashboard/learning/page.tsx` (new) | New route, index/container for topics, following `simulation/page.tsx` structure |
| `app/dashboard/learning/topics/*.tsx` (new) | One TSX file per topic, plain JSX content + citations |

## Not in scope / flag if touched

- Don't fix the `Database` nav item's inline-panel-vs-route inconsistency as part of this work — separate cleanup, out of scope here unless asked.
- There's a stray duplicate `components/ui/lettuce.svg`/`tomato.svg` unrelated to this feature — ignore it.
