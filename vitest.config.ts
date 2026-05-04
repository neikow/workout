import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: false,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["src/components/editor/**/*.{ts,tsx}", "src/lib/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.{test,spec}.{ts,tsx}",
        "src/**/test-utils.ts",
        "src/components/editor/day-card.ts",
        "src/components/editor/workout-paragraph.ts",
        "src/components/editor/workout-parser.ts",
        "src/components/editor/autocomplete/SuggestionMenu.tsx",
        "src/components/editor/autocomplete/use-autocomplete.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(
        new URL(
          "./src/lib/server/__test__/server-only-stub.ts",
          import.meta.url,
        ),
      ),
    },
  },
});
