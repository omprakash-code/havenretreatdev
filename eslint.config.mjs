import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import reactHooks from "eslint-plugin-react-hooks";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,

  //React Hooks safety (VERY IMPORTANT)
  {
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",      // stops hook order bugs
      "react-hooks/exhaustive-deps": "warn",      // deps warnings

      // Prevent custom date/time formatters - use shared helpers
      "no-restricted-syntax": [
        "error",
        {
          selector: "FunctionDeclaration[id.name=/formatTime|formatDate/]",
          message: "Use shared helpers from src/lib/formatters.ts instead of creating custom formatters"
        }
      ]
    },
  },

  // Override default ignores of eslint-config-next
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "node_modules/**",
      ".git/**",
  ]),
]);

export default eslintConfig;
