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
  },
  resolve: {
    // Mirror the tsconfig path alias "@/*": ["./*"].
    alias: { "@": path.resolve(__dirname, "./") },
  },
})
