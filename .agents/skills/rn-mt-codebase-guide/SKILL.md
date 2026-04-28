---
name: rn-mt-codebase-guide
description: Deep repo-specific guide for working inside the rn-mt monorepo. Use this skill whenever the task is about changing, reviewing, debugging, or understanding rn-mt itself, including packages/core, packages/cli, packages/runtime, packages/expo-plugin, packages/shared, the docs app, the example fixtures, GitHub Pages docs deployment, or examples:verify failures. This skill should also trigger when the user asks how rn-mt works, where a behavior lives, how to validate a change, or how to debug convert, sync, audit, hooks, handoff, or example regressions.
license: MIT
metadata:
  author: OpenAI
  version: "1.0.0"
---

# rn-mt Codebase Guide

Use this skill when the task is about the `rn-mt` repository itself.

This repo is not a generic React Native app. It is a monorepo for a conversion
toolchain, so the right workflow is usually:

1. identify which package owns the behavior
2. reproduce the issue with the narrowest command or fixture
3. change the owning package, not the symptom layer
4. run the right verification loop for that surface

## Read these first

- Read `docs/design-decisions-handbook.md` before making behavioral changes.
- If the task touches Expo or React Native integration, compare against the
  local upstream mirrors in `opensrc/`.
- Use the best file discovery and grep tooling available on the user's
  machine. Prefer the `fff` MCP server when it is available, but do not assume
  it exists.

## Install this skill for local use

Install it with the Skills CLI:

```bash
npx skills add https://github.com/kanmi-idris/rn-mt --skill rn-mt-codebase-guide
```

If you want to target Codex explicitly:

```bash
npx skills add https://github.com/kanmi-idris/rn-mt --skill rn-mt-codebase-guide -a codex
```

If you want a global install instead of a project install:

```bash
npx skills add https://github.com/kanmi-idris/rn-mt --skill rn-mt-codebase-guide -g -a codex
```

If your environment cannot use the Skills CLI, use the repo-local fallback:

```bash
./skills/rn-mt-codebase-guide/scripts/install.sh
```

## Repo shape

Read `references/repo-map.md` first for the package map and file ownership.

High-level split:

- `packages/cli`: command surface and subprocess workflow
- `packages/core`: conversion, resolution, sync, audit, handoff logic
- `packages/runtime`: host-app runtime accessors
- `packages/expo-plugin`: Expo bridge helpers
- `packages/shared`: tiny cross-package utilities and shared types
- `apps/docs`: deployable developer docs site
- `examples`: integration fixtures
- `scripts/verify-examples.mjs`: end-to-end fixture verifier

## Generated files and tenant model

Read `references/generated-artifacts.md` when the task touches:

- generated files
- `current`, `shared`, or `tenants`
- sync output
- handoff cleanup
- ownership or reconstruction metadata

Important domain words:

- `shared` is the default source tree
- `tenants/<id>` holds full-file overrides
- `current` is the generated app-facing surface
- `rn-mt.config.json` is the manifest

## Verification loops

Read `references/verification-loops.md` before running commands.

Default repo loop:

```bash
pnpm test
pnpm typecheck
```

If the change touches integration behavior, examples, workflow commands, alias
rewriting, or generated artifacts, also run:

```bash
pnpm build
pnpm examples:verify
```

The examples verifier requires the built CLI at
`packages/cli/dist/index.js`, so `pnpm build` is the safe default before
`pnpm examples:verify`.

## Debug routing

Read `references/debug-playbooks.md` and pick the closest playbook:

- analyze/classification bug
- manifest/target resolution bug
- convert or import rewrite bug
- sync/generated artifact/env bug
- workflow/hook/start/run bug
- audit or doctor bug
- handoff/export bug
- docs app or GitHub Pages bug
- example verifier regression

## Bug report and issue workflow

Read `references/bug-reporting.md` before you start debugging a real bug.

When the task is bug fixing, triage, or debugging in this repo:

1. create or refresh `rn-mt-bugs.md` at the repo root
2. keep that file updated while you reproduce, inspect, and fix the issue
3. try to publish the issue to `kanmi-idris/rn-mt`
4. if issue creation fails, tell the user exactly why and point them to the
   manual issue URL

Use these bundled scripts:

```bash
./.agents/skills/rn-mt-codebase-guide/scripts/init-bug-report.sh "Short bug title"
./.agents/skills/rn-mt-codebase-guide/scripts/publish-issue.sh rn-mt-bugs.md "Bug: short title"
```

Important:

- `rn-mt-bugs.md` is the source of truth for the bug summary, repro, affected
  package, inspected artifacts, fix, and verification
- do not wait until the end to write it; keep it updated as you learn more
- if the publish script cannot create the issue because `gh` is missing,
  unauthenticated, or denied access, tell the user and leave `rn-mt-bugs.md`
  ready to paste into:
  `https://github.com/kanmi-idris/rn-mt/issues/new`

## How to work efficiently in this repo

- Prefer reproducing with a single CLI command first, not the full example
  matrix.
- When the bug is package behavior, fix `packages/core` or `packages/cli`
  directly and only then rerun examples.
- Use `examples/README.md` to decide whether a fixture is a source fixture or a
  committed multitenant fixture.
- If a failure only appears in the example harness, inspect
  `scripts/verify-examples.mjs` before assuming the package logic is wrong.
- If the task is docs-only, validate with the docs app loop instead of the
  mobile fixture loop.

## Which reference to open next

- `references/repo-map.md`
  When you need to know where behavior lives.
- `references/generated-artifacts.md`
  When the task involves sync output, ownership, handoff, `current`, or
  manifest-driven files.
- `references/verification-loops.md`
  When you need the right command sequence for the affected surface.
- `references/debug-playbooks.md`
  When you are debugging a failing behavior and need a concrete reproduction
  plan.

## Example prompts this skill should handle well

- “Where should I fix this `rn-mt sync` bug?”
- “Why is `examples:verify` failing on `keep-rn-shell`?”
- “What files own the docs deployment behavior?”
- “How do I debug a bad import rewrite after convert?”
- “What generated files should I inspect before changing handoff cleanup?”
