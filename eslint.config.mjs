import js from "@eslint/js";
import html from "eslint-plugin-html";
import globals from "globals";

/**
 * ESLint config for the static site.
 *
 * The pages use inline <script> blocks and inline event handlers
 * (`onclick="..."`). Those handlers are invisible to ESLint, so a function
 * referenced only from HTML looks unused; `no-unused-vars` is therefore off
 * for HTML files. The rules that remain catch real defects such as duplicate
 * declarations and undefined identifiers.
 */
export default [
  {
    ignores: [
      "node_modules/**",
      "playwright-report/**",
      "test-results/**",
      "blob-report/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.html"],
    plugins: { html },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.browser,
        // Loaded from CDNs in the HTML.
        Chart: "readonly",
        jspdf: "readonly",
        html2pdf: "readonly",
        supabase: "readonly",
        // Defined in public/config.js and consumed by other pages.
        supabaseClient: "readonly",
      },
    },
    rules: {
      "no-unused-vars": "off",
      "no-redeclare": "error",
    },
  },
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.browser,
        supabase: "readonly",
      },
    },
    rules: {
      // config.js intentionally declares globals used by other pages.
      "no-unused-vars": "off",
    },
  },
];
