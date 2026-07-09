import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts", "bench/**/*.test.ts"],
    testTimeout: 20000,
  },
});
