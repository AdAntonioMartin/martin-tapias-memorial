import js from "@eslint/js";

export default [
  {
    ignores: ["node_modules/**"]
  },
  {
    files: ["js/**/*.js"],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        console: "readonly",
        fetch: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        DOMParser: "readonly",
        AbortController: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        CSS: "readonly"
      }
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "smart"],
      "prefer-const": "error",
      "no-var": "error"
    }
  },
  {
    files: ["tools/**/*.mjs", "tools/**/*.js", "tests/**/*.js"],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        console: "readonly",
        process: "readonly",
        URL: "readonly",
        setTimeout: "readonly",
        Buffer: "readonly",
        // Las funciones que se pasan a page.evaluate() corren en el navegador.
        document: "readonly",
        window: "readonly"
      }
    },
    rules: {
      ...js.configs.recommended.rules,
      "prefer-const": "error",
      "no-var": "error"
    }
  }
];
