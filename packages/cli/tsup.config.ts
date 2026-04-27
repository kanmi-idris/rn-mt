/**
 * Implements the tsup.config module.
 */
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: false,
  banner: {
    js: "#!/usr/bin/env node",
  },
  clean: true,
});
