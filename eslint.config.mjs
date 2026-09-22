import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Abandoned 3D experiment and local photo tooling — not part of the app.
    "tea_saucer/**",
    "trail-originals/**",
    "photo-source/**",
  ]),
]);
