import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "node:path"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    // Don't pick up Next build output or deps as test files.
    exclude: ["**/node_modules/**", "**/.next/**"],
    coverage: {
      provider: "v8",
      // text     -> human-readable table in the CI log
      // json-summary / json -> machine-readable totals used to build the PR job summary
      // lcov     -> HTML report (coverage/lcov-report) + lcov.info for any future tooling
      reporter: ["text", "text-summary", "json-summary", "json", "lcov"],
      reportsDirectory: "./coverage",
      // Report on all source files, not just the ones a test happened to import.
      // Without this, untested files are silently absent and coverage looks better than it is.
      all: true,
      include: [
        "app/**/*.{js,jsx,ts,tsx}",
        "components/**/*.{js,jsx,ts,tsx}",
        "lib/**/*.{js,jsx,ts,tsx}",
      ],
      exclude: [
        "**/node_modules/**",
        "**/.next/**",
        "**/*.test.{ts,tsx,js,jsx}",
        "**/*.spec.{ts,tsx,js,jsx}",
        "**/*.d.ts",
        "**/*.config.*",
      ],
      // No thresholds on purpose — coverage is reported, not gated.
      // If the team later agrees on a floor, add e.g.:
      //   thresholds: { lines: 50, functions: 50, branches: 50, statements: 50 }
    },
  },
  resolve: {
    // Mirror the tsconfig path alias "@/*": ["./*"].
    alias: { "@": path.resolve(__dirname, "./") },
  },
})
