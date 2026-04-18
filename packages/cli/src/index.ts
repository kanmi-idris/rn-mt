#!/usr/bin/env node

import { coreModuleContracts, milestoneOneScope } from "@rn-mt/core";

const helpText = `rn-mt

Manifest-driven multitenancy conversion platform for existing React Native and Expo applications.

Initial scaffold status:
- workspace created
- deep module boundaries recorded
- PRD written in docs/issues/0001-rn-mt-prd.md

Milestone 1 includes:
${milestoneOneScope.includes.map((item) => `- ${item}`).join("\n")}

Deferred to milestone 2:
${milestoneOneScope.defers.map((item) => `- ${item}`).join("\n")}

Core deep modules:
${coreModuleContracts.map((item) => `- ${item.name}: ${item.purpose}`).join("\n")}
`;

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h") || args.length === 0) {
  process.stdout.write(`${helpText}\n`);
  process.exit(0);
}

process.stderr.write(
  "The command surface is not implemented yet. See docs/issues/0001-rn-mt-prd.md and docs/architecture.md for the approved product definition.\n",
);
process.exit(1);
