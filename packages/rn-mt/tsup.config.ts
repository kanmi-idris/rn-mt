import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    runtime: "src/runtime.ts",
    "expo-plugin": "src/expo-plugin.ts",
    cli: "src/cli.ts",
  },
  format: ["esm"],
  dts: true,
  tsconfig: "tsconfig.build.json",
  clean: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
