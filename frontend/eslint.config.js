import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";

export default [
  { ignores: ["dist", "node_modules"] },

  // Node-style config files (vite / tailwind / postcss)
  {
    files: ["*.config.js"],
    languageOptions: {
      sourceType: "module",
      globals: globals.node,
    },
    rules: {
      ...js.configs.recommended.rules,
    },
  },

  // Vitest test files (globals: true in vite.config.js)
  {
    files: ["**/*.test.{js,jsx}"],
    languageOptions: {
      sourceType: "module",
      globals: globals.vitest,
    },
  },

  // Application source
  {
    files: ["**/*.{js,jsx}"],
    ignores: ["*.config.js"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
      globals: globals.browser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },

  // Economic dashboard section registry. Each file exports a plain descriptor
  // object — id, subtitle, action, content — next to the component it points at,
  // so a section owns the header control that changes its chart. The rule reads
  // that object as a non-component export and would otherwise warn on the
  // component beside it. Scoped to this folder; the tradeoff is only dev-server
  // hot reloading inside it.
  {
    files: ["src/pages/economic/sections/*.{js,jsx}"],
    rules: {
      "react-refresh/only-export-components": "off",
    },
  },
];