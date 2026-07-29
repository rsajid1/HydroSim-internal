#!/usr/bin/env node
/**
 * Render a coverage report as a Markdown table into the GitHub Actions job
 * summary, so reviewers can read coverage straight from the PR checks tab
 * without downloading an artifact.
 *
 * Usage:
 *   node scripts/ci/coverage-summary.mjs frontend coverage/coverage-summary.json
 *   node scripts/ci/coverage-summary.mjs backend  backend/coverage.json
 *
 * Two input shapes are supported:
 *   - Vitest / istanbul `coverage-summary.json`  -> { total: {...}, "<file>": {...} }
 *   - coverage.py `coverage.json` (pytest-cov)   -> { totals: {...}, files: {...} }
 *
 * This script is report-only: it always exits 0 so a missing or unreadable
 * coverage file can never turn a green build red. Test failures are what fail
 * CI, not coverage.
 */

import { readFileSync, appendFileSync, existsSync } from "node:fs"
import path from "node:path"

const [, , rawLabel, rawFile] = process.argv

if (!rawLabel || !rawFile) {
  console.error("usage: coverage-summary.mjs <label> <path-to-coverage-json>")
  process.exit(0)
}

const label = rawLabel.charAt(0).toUpperCase() + rawLabel.slice(1)
const file = path.resolve(process.cwd(), rawFile)

/** Write markdown to the job summary if running in Actions, otherwise stdout. */
function emit(markdown) {
  const target = process.env.GITHUB_STEP_SUMMARY
  if (target) {
    appendFileSync(target, markdown + "\n")
  }
  console.log(markdown)
}

/** 87.5 -> "87.50%"; null/undefined -> "n/a" */
function pct(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "n/a"
  return `${Number(value).toFixed(2)}%`
}

/** A crude at-a-glance indicator. Purely cosmetic — it gates nothing. */
function badge(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "⚪"
  if (value >= 80) return "🟢"
  if (value >= 50) return "🟡"
  return "🔴"
}

if (!existsSync(file)) {
  emit(
    `## ${label} coverage\n\n` +
      `_No coverage report was produced at \`${rawFile}\`._ ` +
      `This usually means the test run failed before coverage could be written — ` +
      `check the test step above.\n`
  )
  process.exit(0)
}

let data
try {
  data = JSON.parse(readFileSync(file, "utf8"))
} catch (err) {
  emit(`## ${label} coverage\n\n_Could not parse \`${rawFile}\`: ${err.message}_\n`)
  process.exit(0)
}

const lines = []
lines.push(`## ${label} coverage`)
lines.push("")

if (data.total) {
  // ---- Vitest / istanbul summary ----
  const t = data.total
  const overall = t.lines?.pct

  lines.push(`${badge(overall)} **${pct(overall)}** of lines covered`)
  lines.push("")
  lines.push("| Metric | Covered | Total | % |")
  lines.push("| --- | ---: | ---: | ---: |")
  for (const key of ["statements", "branches", "functions", "lines"]) {
    const m = t[key]
    if (!m) continue
    const name = key.charAt(0).toUpperCase() + key.slice(1)
    lines.push(`| ${name} | ${m.covered} | ${m.total} | ${pct(m.pct)} |`)
  }

  const files = Object.entries(data)
    .filter(([k]) => k !== "total")
    .map(([k, v]) => [path.relative(process.cwd(), k) || k, v.lines?.pct ?? null])
    .sort((a, b) => (a[1] ?? 0) - (b[1] ?? 0))

  if (files.length) {
    lines.push("")
    lines.push("<details><summary>Per-file line coverage</summary>")
    lines.push("")
    lines.push("| File | Lines |")
    lines.push("| --- | ---: |")
    for (const [name, value] of files) {
      lines.push(`| \`${name.split(path.sep).join("/")}\` | ${badge(value)} ${pct(value)} |`)
    }
    lines.push("")
    lines.push("</details>")
  }
} else if (data.totals) {
  // ---- coverage.py (pytest-cov) ----
  const t = data.totals
  const overall = t.percent_covered

  lines.push(`${badge(overall)} **${pct(overall)}** of statements covered`)
  lines.push("")
  lines.push("| Metric | Covered | Total | % |")
  lines.push("| --- | ---: | ---: | ---: |")
  lines.push(
    `| Statements | ${t.covered_lines} | ${t.num_statements} | ${pct(t.percent_covered)} |`
  )
  if (t.num_branches) {
    const branchPct = (t.covered_branches / t.num_branches) * 100
    lines.push(`| Branches | ${t.covered_branches} | ${t.num_branches} | ${pct(branchPct)} |`)
  }
  lines.push(`| Missing lines | ${t.missing_lines} | — | — |`)

  const files = Object.entries(data.files ?? {})
    .map(([name, v]) => [name, v.summary?.percent_covered ?? null])
    .sort((a, b) => (a[1] ?? 0) - (b[1] ?? 0))

  if (files.length) {
    lines.push("")
    lines.push("<details><summary>Per-file statement coverage</summary>")
    lines.push("")
    lines.push("| File | Statements |")
    lines.push("| --- | ---: |")
    for (const [name, value] of files) {
      lines.push(`| \`${name.split(path.sep).join("/")}\` | ${badge(value)} ${pct(value)} |`)
    }
    lines.push("")
    lines.push("</details>")
  }
} else {
  lines.push(`_Unrecognised coverage format in \`${rawFile}\`._`)
}

lines.push("")
lines.push(
  "> Reported only — no coverage threshold is enforced. " +
    "The full HTML report is attached to this run as a build artifact."
)
lines.push("")

emit(lines.join("\n"))
