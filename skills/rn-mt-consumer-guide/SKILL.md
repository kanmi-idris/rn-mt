---
name: rn-mt-consumer-guide
description: Guide for developers and agents working inside apps that consume rn-mt after conversion. Use this skill when the task is about editing, reviewing, debugging, or validating a host React Native or Expo app that has src/rn-mt/shared, src/rn-mt/tenants, src/rn-mt/current, rn-mt.config.json, or rn-mt.generated.* files. This skill is for consumer app work, not for contributing to the rn-mt monorepo itself.
license: MIT
metadata:
  author: OpenAI
  version: "1.0.0"
---

# rn-mt Consumer Guide

Use this skill when you are working in an app that has already been converted by
`rn-mt`.

This is not the rn-mt monorepo contributor workflow. A converted app has its own
package scripts, tests, lint rules, TypeScript config, native setup, and product
behavior. Use those host-app checks plus rn-mt's consumer validation commands.

## Read these first

- Read `references/converted-app-model.md` before editing files under
  `src/rn-mt`.
- Read `references/safe-edit-workflow.md` before adding tenant-specific
  behavior or changing generated surfaces.
- Read `references/verification.md` before deciding which commands prove the
  change.
- Use the best file discovery and grep tooling available on the user's
  machine. Prefer the `fff` MCP server when it is available, but do not assume
  it exists.

## Install this skill for local use

Install it with the Skills CLI:

```bash
npx skills add https://github.com/kanmi-idris/rn-mt --skill rn-mt-consumer-guide
```

If you want to target Codex explicitly:

```bash
npx skills add https://github.com/kanmi-idris/rn-mt --skill rn-mt-consumer-guide -a codex
```

If you want a global install instead of a project install:

```bash
npx skills add https://github.com/kanmi-idris/rn-mt --skill rn-mt-consumer-guide -g -a codex
```

If your environment cannot use the Skills CLI, use the repo-local fallback:

```bash
./skills/rn-mt-consumer-guide/scripts/install.sh
```

## Converted app model

Default ownership:

- `src/rn-mt/shared`: user-owned shared source for all labels
- `src/rn-mt/tenants/<id>`: user-owned full-file overrides for one label
- `src/rn-mt/current`: generated active-label facades
- `rn-mt.generated.*`: generated runtime metadata and entry surfaces
- `rn-mt.config.json`: source of truth for labels, targets, and paths

Do not make durable edits directly in generated files. If a generated file is
wrong, fix the shared source, create or update a tenant override, change the
target, or run the appropriate rn-mt command to regenerate it.

## Common commands

Use the installed package in the host app:

```bash
npx rn-mt doctor
npx rn-mt audit
npx rn-mt sync
npx rn-mt target set <tenant-id>
npx rn-mt override create <path> --tenant <tenant-id>
```

Prefer `npx rn-mt ...` in consumer apps unless the app defines package scripts
for these commands.

## Verification loop

Use the host app's own checks, then rn-mt checks:

```bash
npm test
npm run lint
npm run typecheck
npx rn-mt audit
npx rn-mt doctor
```

Translate these to the app's actual package manager and scripts. For example,
use `pnpm test`, `yarn lint`, `bun test`, or the specific Jest/TypeScript
scripts already defined by the host app.

Do not default to rn-mt monorepo commands such as `pnpm build` or
`pnpm examples:verify` unless you are changing rn-mt package source in the
rn-mt repository itself.

## How to work safely

- Inspect `rn-mt.config.json` before deciding which labels exist.
- Inspect `rn-mt.generated.runtime.json` when you need to confirm the active
  target or generated runtime metadata.
- Search imports of `src/rn-mt/current` to understand the active app surface.
- Put shared behavior in `src/rn-mt/shared`.
- Put label-specific full-file behavior in `src/rn-mt/tenants/<id>`.
- Run `npx rn-mt sync` after target or override changes.
- Re-run the host app checks for each label that changed.

## Which reference to open next

- `references/converted-app-model.md`
  When you need to know which files are user-owned versus generated.
- `references/safe-edit-workflow.md`
  When you need to add or modify shared or label-specific behavior.
- `references/verification.md`
  When you need to select the right validation commands for a consumer app.

## Example prompts this skill should handle well

- "Add a feature only to the premium label."
- "Why did my change disappear after rn-mt sync?"
- "Switch this app to the partner label and run checks."
- "Audit whether this converted app is healthy."
- "Fix this generated current import without editing generated files."
