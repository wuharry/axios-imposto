// eslint.config.js
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import oxlint from "eslint-plugin-oxlint";
import prettierPlugin from "eslint-plugin-prettier";
import prettierConfig from "eslint-config-prettier";

/**
 * 說明：
 * 這是針對 TypeScript Library (非前端框架) 的 ESLint 設定
 * 採用 ESLint v9 Flat Config 格式
 */
export default tseslint.config(
  // 1. 全域忽略設定 (相當於舊版的 .eslintignore)
  {
    ignores: ["dist", "node_modules", "coverage", "*.config.js", "*.config.ts"],
  },

  // 2. 基本 JavaScript 推薦規則
  js.configs.recommended,

  // 3. TypeScript 推薦規則 (包含型別檢查)
  // 如果你覺得規則太嚴，可以改用 ...tseslint.configs.recommended
  ...tseslint.configs.recommendedTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  // 4. 專案環境與解析器設定
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      // 定義全域變數
      globals: {
        ...globals.node, // 因為是套件，通常會跑在 Node 環境
        ...globals.browser, // 因為你要用 fetch，也可能跑在瀏覽器
      },
      parserOptions: {
        // 自動尋找最近的 tsconfig.json 來做型別解析
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // 5. Prettier 整合
  // 將 Prettier 當作 ESLint 規則來跑，並關閉衝突的 ESLint 規則
  {
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      ...prettierConfig.rules, // 關閉與 Prettier 衝突的格式化規則
      "prettier/prettier": "error", // 違反 Prettier 格式視為錯誤
    },
  },

  // 6. Oxlint 整合 (關鍵步驟)
  // 必須放在主要規則之後。它會關閉那些 Oxlint 已經實作的規則，
  // 讓 ESLint 不用重複檢查，大幅提升速度。
  oxlint.configs["flat/recommended"],

  // 7. 自定義規則 (Overrides)
  // 這裡放你個人或團隊習慣的特殊規則
  {
    rules: {
      // Library 開發通常不希望留 console.log (除了 warn/error)
      "no-console": ["warn", { allow: ["warn", "error"] }],

      // 允許使用 _ 開頭的變數作為未使用的變數 (常見慣例)
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],

      // 因為你是做 fetch wrapper，有時候需要處理 any (但盡量少用)
      "@typescript-eslint/no-explicit-any": "warn",

      // 強制要求函式要有回傳型別 (對 Library 開發者很重要，確保 API 定義清晰)
      "@typescript-eslint/explicit-function-return-type": "off", // 或是 'warn' 看你習慣

      // 允許空的 interface (有時候為了擴展性預留)
      "@typescript-eslint/no-empty-interface": "off",
    },
  }
);
