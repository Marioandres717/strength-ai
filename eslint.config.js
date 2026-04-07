// eslint.config.js
import js from "@eslint/js"
import tseslint from "typescript-eslint"
import react from "eslint-plugin-react"
import reactHooks from "eslint-plugin-react-hooks"
import tanstackQuery from "@tanstack/eslint-plugin-query"
import testingLibrary from "eslint-plugin-testing-library"
import prettier from "eslint-config-prettier"

export default [
  // Base JavaScript rules
  js.configs.recommended,

  // TypeScript rules with type-checking
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // TypeScript parser options for type-aware linting
  {
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // React configuration
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      react,
      "react-hooks": reactHooks,
    },
    settings: {
      react: {
        version: "19.2",
      },
    },
    rules: {
      ...react.configs.recommended.rules,
      ...react.configs["jsx-runtime"].rules,
      ...reactHooks.configs.recommended.rules,

      // React 19 adjustments
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/jsx-uses-react": "off",
    },
  },

  // TanStack Query rules
  {
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "@tanstack/query": tanstackQuery,
    },
    rules: {
      ...tanstackQuery.configs.recommended.rules,
    },
  },

  // Testing rules
  {
    files: ["**/*.test.{ts,tsx}", "**/__tests__/**/*.{ts,tsx}", "src/test/**/*.{ts,tsx}"],
    plugins: {
      "testing-library": testingLibrary,
    },
    rules: {
      ...testingLibrary.configs.react.rules,
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // Custom project rules
  {
    rules: {
      // Prefer type imports
      "@typescript-eslint/consistent-type-imports": [
        "error",
        {
          prefer: "type-imports",
          fixStyle: "inline-type-imports",
        },
      ],

      // Warn on unused vars (allow underscore prefix)
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],

      "prefer-const": "error",
      "no-console": ["warn", { allow: ["warn", "error"] }],
    },
  },

  // Ignore patterns
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      "dist-ssr/**",
      ".vinxi/**",
      ".tanstack/**",
      ".nitro/**",
      ".output/**",
      "**/routeTree.gen.ts",
      "coverage/**",
      "*.config.js",
      "*.config.ts",
    ],
  },

  // Prettier must be last to disable conflicting rules
  prettier,
]
