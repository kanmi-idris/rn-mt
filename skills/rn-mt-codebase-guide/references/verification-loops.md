# Verification Loops

Use this file to pick the smallest useful verification loop for the task.

## Baseline repo loop

Run this after most package changes:

```bash
pnpm test
pnpm typecheck
```

## Safe integration loop

Run this when the change touches CLI behavior, convert, sync, alias rewriting,
hooks, env handling, or generated artifacts:

```bash
pnpm build
pnpm examples:verify
```

Why `pnpm build` first:

- `scripts/verify-examples.mjs` requires the built CLI entrypoint at
  `packages/cli/dist/index.js`
- it will fail early if the CLI has not been built

## Docs loop

For docs app changes:

```bash
pnpm --filter @molaidrislabs/docs typecheck
pnpm --filter @molaidrislabs/docs build
```

For live local preview:

```bash
pnpm docs:dev
```

If Next behaves strangely after dependency or route changes, clear:

```bash
rm -rf apps/docs/.next apps/docs/out
```

then rerun the docs build or dev server.

## Focused CLI reproduction

For a single CLI behavior, reproduce with the smallest command first:

```bash
node packages/cli/dist/index.js analyze --app-root .
node packages/cli/dist/index.js sync --app-root .
node packages/cli/dist/index.js audit --app-root . --json
```

Prefer this before running the full example matrix.

## Example verifier behavior

The verifier copies fixtures into:

```text
tests/tmp/examples/*
```

Then it:

- installs dependencies in the sandbox
- runs `rn-mt` commands against the sandbox copy
- typechecks where configured
- runs static config smoke checks
- runs `rn-mt start` smoke checks
- runs `audit --fail-on P0`

Read `scripts/verify-examples.mjs` when the failure only appears in the
integration harness.

## Fixture modes

Source fixtures:

- copied
- converted in sandbox
- then synced and checked

Committed multitenant fixtures:

- copied
- manifest root rewritten to the sandbox path
- local `@molaidrislabs/*` package links rewritten
- looped across committed tenants with `target set`, `sync`, smoke, and audit

## Useful one-package loops

Core-only changes:

```bash
pnpm --filter @molaidrislabs/core build
pnpm exec vitest run packages/core/src/index.test.ts
```

CLI-only changes:

```bash
pnpm --filter @molaidrislabs/cli build
pnpm exec vitest run packages/cli/src/index.test.ts
```

Expo plugin changes:

```bash
pnpm --filter @molaidrislabs/expo-plugin build
pnpm exec vitest run packages/expo-plugin/src/index.test.ts
```

