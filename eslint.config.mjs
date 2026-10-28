import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Hand-written ES5: catch clauses need a binding even when it is unused
    files: ["src/script/script.js"],
    rules: { "@typescript-eslint/no-unused-vars": ["warn", { caughtErrors: "none" }] },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "convex/_generated/**",
    // Minified from src/script/script.js by `npm run build:script`
    "public/script.js",
    // Copied from maplibre-gl by `npm run build:map-worker`
    "public/maplibre-gl-worker.js",
  ]),
]);

export default eslintConfig;
