# Contributing

This page is the practical contributor guide for working in the `rn-mt`
monorepo.

## Install the repo

From the repo root:

```sh
pnpm install
```

## Common commands

```sh
pnpm build
pnpm test
pnpm typecheck
pnpm docs:dev
pnpm examples:verify
```

Use them often. This repo is intentionally verification-heavy.

## Important folders

```text
apps/docs/        deployable docs site
docs/             markdown source docs
examples/         real fixture apps
skills/           distributable skills.sh bundles
packages/cli/     command surface
packages/core/    main product logic
packages/runtime/ runtime accessor package
packages/expo-plugin/
packages/shared/
scripts/          verification helpers
```

## Package map

The monorepo is split by job:

- `@rn-mt/cli`: commands, output, prompts, and subprocess workflow
- `@rn-mt/core`: analyze, manifest logic, convert, sync, audit, doctor, and handoff
- `@rn-mt/runtime`: the runtime accessors host apps read from
- `@rn-mt/expo-plugin`: the Expo bridge layer
- `@rn-mt/shared`: shared types and small cross-package utilities

## Where to start reading code

If you are new to the repo, start in this order:

1. `packages/cli`
2. `packages/core`
3. `packages/runtime`
4. `packages/expo-plugin`
5. `examples`

That gives you the command surface first, then the implementation engine.

## Working on package behavior

A good change loop is:

1. identify the behavior in `cli` or `core`
2. update or add tests
3. run `pnpm test`
4. run `pnpm typecheck`
5. run `pnpm examples:verify` if the change touches integration behavior

If you want an agent to follow the repo-specific debugging and verification
workflow for you, use the [Agent Skill](/agent-skill).

## Working on docs

Run:

```sh
pnpm docs:dev
```

The docs app reads markdown from the repo and renders it through `apps/docs`.

## Working on skills

The public installable skill bundles live in `skills/`.

The main one in this repo is:

```text
skills/rn-mt-codebase-guide
```

Install it the same way users do:

```sh
npx skills add https://github.com/kanmi-idris/rn-mt --skill rn-mt-codebase-guide
```

If you change the repo-local development copy under `.agents/skills`, make sure
the distributable `skills/` copy stays in sync.

## Working on examples

Examples are not throwaway demo folders. Treat them as integration fixtures.

If a package change affects:

- convert
- sync
- runtime output
- env loading
- alias rewriting
- workflow hooks

you should assume example verification matters.

## Design expectations

This repo prefers:

- explicit behavior over magic
- generated files that can be reviewed
- narrow package seams
- deterministic target resolution
- local-first workflow

If a change makes the system feel more implicit, hidden, or harder to audit, it
is probably the wrong direction.
