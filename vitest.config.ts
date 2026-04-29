import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@_molaidrislabs/core": resolve(__dirname, "packages/core/src/index.ts"),
      "@_molaidrislabs/shared": resolve(__dirname, "packages/shared/src/index.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts"],
  },
});
