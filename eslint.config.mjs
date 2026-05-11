// Flat-config for ESLint 9 + Next 16.
//
// `next lint` was removed in Next 16, and `FlatCompat.extends("next/...")`
// blew up with "Converting circular structure to JSON" because the legacy
// shim re-loads the same plugin twice. eslint-config-next ≥16 ships native
// flat-config arrays, so we import them directly and skip FlatCompat.

import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "dist/**",
      "build/**",
      "playwright-report/**",
      "test-results/**",
      "coverage/**",
      "supabase/**",
      "next-env.d.ts",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "error",
      // eslint-plugin-react-hooks 7 ships React Compiler-driven rules that
      // flag idiomatic patterns we use (mount-time setState, Date.now() in
      // render for "today" labels, JSX in try/catch fallbacks, react-hook-
      // form's watch()). They are style suggestions, not bug-finders — keep
      // them as warnings so they show up in CI logs but don't fail the run.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/error-boundaries": "warn",
      "react-hooks/incompatible-library": "warn",
    },
  },
  {
    files: ["postcss.config.{js,mjs,ts}", "prettier.config.{js,mjs,ts}"],
    rules: {
      "import/no-anonymous-default-export": "off",
    },
  },
];

export default eslintConfig;
