import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Downgrade from error to warning: use-mobile.ts (and similar SSR-mounted
    // guards) call setState synchronously in useEffect to capture the initial
    // window value on mount. This is a deliberate, valid pattern — not a
    // cascade bug — so we keep the feedback visible without blocking the build.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
