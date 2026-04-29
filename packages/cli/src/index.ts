#!/usr/bin/env node

/**
 * Public entrypoint for the @_molaidrislabs/cli package.
 */

import { RnMtCliApplication } from "./application";

import type { RnMtCliRunOptions } from "./types";

/**
 * Runs the rn-mt CLI for a single invocation.
 */
export function runCli(args: string[], options: RnMtCliRunOptions = {}) {
  return new RnMtCliApplication(options).run(args);
}

if (RnMtCliApplication.isDirectExecution(import.meta.url, process.argv[1])) {
  process.exit(runCli(process.argv.slice(2)));
}
