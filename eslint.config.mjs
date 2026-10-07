/* ESLint: npm run lint. Только явные ошибки (необъявленные имена, недостижимый код и т. п.), стиль — за Prettier */
import js from "@eslint/js";
import globals from "globals";

export default [
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "top100/**",
      "top100-data.js",
      "info-data.js",
      "tasks-data.js",
      "changelog.js"
    ]
  },
  js.configs.recommended,
  {
    files: ["**/*.js", "**/*.mjs"],
    languageOptions: { ecmaVersion: 2022, sourceType: "script", globals: { ...globals.browser } },
    rules: {
      "no-unused-vars": ["warn", { args: "none", caughtErrors: "none" }],
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-control-regex": "off",
      "no-redeclare": ["error", { builtinGlobals: false }]
    }
  },
  /* ES-модули: калькулятор, 3D главной, тесты */
  {
    files: ["app.js", "polish.js", "talents.js", "src/**/*.js", "**/*.mjs"],
    languageOptions: { sourceType: "module" }
  },
  /* обычные скрипты страниц делят имена через window: данные info-data.js, функции top100.js */
  {
    files: ["info.js"],
    languageOptions: {
      globals: {
        CHAR_LEVELS: "readonly",
        TALENT_LEVELS: "readonly",
        PDA_LEVELS: "readonly",
        PDA_LEVEL_NOTES: "readonly"
      }
    }
  },
  {
    files: ["player-card.js"],
    languageOptions: {
      globals: {
        TOP100_TABS: "readonly",
        esc: "readonly",
        escAttr: "readonly",
        norm: "readonly",
        fmt: "readonly",
        top100Period: "readonly",
        currentTop100Tab: "readonly"
      }
    }
  },
  /* скрипты сборки и выгрузки — Node.js */
  {
    files: ["build*.js", "fetch-players.js", "yandex/**/*.js", "guide-md.js", "test/**"],
    languageOptions: { globals: { ...globals.node } }
  }
];
