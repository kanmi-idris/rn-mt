#!/usr/bin/env node

/**
 * CLI binary entrypoint for the single-package rn-mt distribution.
 */
import { runCli } from "@_molaidrislabs/cli";

import { isDirectCliExecution } from "./direct-execution";

export { isDirectCliExecution } from "./direct-execution";
export { runCli } from "@_molaidrislabs/cli";

if (isDirectCliExecution(import.meta.url, process.argv[1])) {
  process.exit(runCli(process.argv.slice(2)));
}
