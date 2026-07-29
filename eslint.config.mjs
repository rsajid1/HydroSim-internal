import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "**/*.d.ts",
    "eslint.config.mjs",
    "package-lock.json",
    // Node-only CI helper scripts — not part of the Next.js app bundle and not
    // subject to the browser/React rules in core-web-vitals.
    "scripts/**",
    // Generated coverage reports (HTML report ships bundled JS).
    "coverage/**",
  ]),
]);

export default eslintConfig;
