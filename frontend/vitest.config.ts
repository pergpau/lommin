import { defineConfig } from "vitest/config";

// Unit tests for pure logic (crypto, parsing, categorization). Node environment —
// Web Crypto is available as the global `crypto` in modern Node, so no jsdom needed.
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
