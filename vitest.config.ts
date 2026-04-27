import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@rn-mt/core": resolve(__dirname, "packages/core/src/index.ts"),
      "@rn-mt/shared": resolve(__dirname, "packages/shared/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts"],
  },
});
