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
        },
        // Timezone guardrails: BOOKING_TIME_ZONE (src/lib/booking-policy.ts)
        // is the single source of truth; display goes through src/lib/formatters.ts.
        {
          selector: "Literal[value='Asia/Kolkata']",
          message: "IST is not a Haven Retreat timezone. Use BOOKING_TIME_ZONE from @/lib/booking-policy and the venue formatters in @/lib/formatters."
        },
        {
          selector: "Literal[value='America/New_York']",
          message: "Do not hardcode the venue timezone. Import BOOKING_TIME_ZONE from @/lib/booking-policy."
        },
        {
          selector: "CallExpression[callee.property.name='toLocaleDateString']",
          message: "Browser-local date formatting is not allowed for business data. Use formatVenueDate/formatCalendarDate/formatWallDate from @/lib/formatters."
        },
        {
          selector: "CallExpression[callee.property.name='toLocaleTimeString']",
          message: "Browser-local time formatting is not allowed for business data. Use formatVenueTime/formatVenueDateTime from @/lib/formatters."
        }
      ]
    },
  },

  // The formatter layer and the timezone constant are the one place these
  // primitives are allowed to live.
  {
    files: ["src/lib/formatters.ts", "src/lib/booking-policy.ts"],
    rules: {
      "no-restricted-syntax": "off",
    },
  },

  // Tests may pin fixtures to concrete timezones.
  {
    files: ["src/__tests__/**"],
    rules: {
      "no-restricted-syntax": "off",
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
