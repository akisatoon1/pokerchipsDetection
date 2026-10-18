import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  { ignores: ["dist/", ".wrangler/", "node_modules/"] },
  eslint.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: { allowDefaultProject: ["eslint.config.js"] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      eqeqeq: "error",
      // security.md: 利用者が入れた文字を HTML として入れない (XSS を防ぐ).
      "no-restricted-properties": [
        "error",
        {
          property: "innerHTML",
          message: "textContent を使う (docs/web/security.md).",
        },
        {
          property: "outerHTML",
          message: "textContent を使う (docs/web/security.md).",
        },
        {
          object: "Math",
          property: "random",
          message:
            "暗号用の乱数 crypto.getRandomValues を使う (docs/web/security.md).",
        },
      ],
      "no-restricted-syntax": [
        "error",
        {
          selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
          message: "textContent を使う (docs/web/security.md).",
        },
      ],
    },
  },
  {
    files: ["eslint.config.js"],
    extends: [tseslint.configs.disableTypeChecked],
  },
);
