#!/usr/bin/env node

/**
 * CLI binary entrypoint for the single-package rn-mt distribution.
 */
import { pathToFileURL } from "node:url";

import { runCli } from "@_molaidrislabs/cli";

export { runCli } from "@_molaidrislabs/cli";

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(runCli(process.argv.slice(2)));
}
