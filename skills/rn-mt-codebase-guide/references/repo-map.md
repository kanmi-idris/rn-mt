# Repo Map

Use this file when you need to locate the owning package or module quickly.

## Monorepo roots

- `packages/cli`
  Command parsing, output, prompts, process orchestration, app-root/config
  scoping, hook execution, workflow dispatch, and version compatibility checks.
- `packages/core`
  The real engine. It owns analyze, manifest logic, convert, sync, audit,
  doctor, tenant lifecycle, override lifecycle, and handoff logic.
- `packages/runtime`
  Stable runtime accessor surface for host apps.
- `packages/expo-plugin`
  Narrow Expo bridge helpers used by Expo config surfaces.
- `packages/shared`
  Small shared utilities and shared types used across packages.
- `apps/docs`
  The public developer docs site.
- `skills`
  Distributable skill bundles that follow the `skills.sh` repository pattern.
- `examples`
  Real integration fixtures used by the verifier.
- `scripts/verify-examples.mjs`
  The canonical end-to-end example verification harness.

## packages/core

`packages/core/src/index.ts` is the public package entrypoint. The real logic is
split into deep modules:

- `analyze/`
  Repo classification, support tier, package manager detection, host language.
- `manifest/`
  `rn-mt.config.json` parsing, validation, env schema, merge logic, registry
  resolution, target resolution.
- `convert/`
  Shared/current/tenant restructuring, host wrappers, alias rewriting, package
  script rewrites, reconstruction metadata.
- `sync/`
  Runtime artifact generation, ownership metadata, Expo bridge artifacts,
  native identity/config outputs, derived asset generation, env loading.
- `audit/`
  Deterministic and heuristic checks.
- `doctor/`
  Release-facing checks.
- `tenant/`
  `target set`, tenant add/rename/remove behavior.
- `override/`
  Override create/remove behavior.
- `handoff/`
  Preflight, flattening, cleanup, sanitization, isolation audit.
- `workspace/`
  Root-relative file system seam used by the other core modules.

## packages/cli

`packages/cli/src/index.ts` is only the public entrypoint. The real flow is:

- `application.ts`
  Builds execution context and shared modules for one invocation.
- `commands/dispatcher.ts`
  Top-level routing for CLI verbs.
- `commands/project-*.ts`
  `analyze`, `init`, `convert`, `codemod`, `upgrade`.
- `commands/workflow-*.ts`
  `sync`, `start`, `build`, `run`, `hook`.
- `commands/quality.ts`
  `audit`, `doctor`.
- `commands/tenancy.ts`
  `tenant add`, `tenant rename`, `tenant remove`, `target set`.
- `commands/override.ts`
  `override create`, `override remove`.
- `commands/handoff.ts`
  `handoff`.
- `shared/*.ts`
  CLI-only modules for options, workflow dispatch, execution scoping, files,
  hooks, interaction, audit formatting, version compatibility, and upgrade.
- `core-adapters.ts`
Adapter seam between CLI and `@_molaidrislabs/core`.

## packages/runtime

Small surface:

- `runtime-accessors.ts`
  Accessor factory for runtime consumers.
- `types.ts`
  Runtime-facing type surface.

## packages/expo-plugin

Small surface:

- `apply-target-context.ts`
- `bridge-contract.ts`
- `extra.ts`
- `types.ts`

Use this package when debugging Expo config integration, not when debugging
manifest resolution itself.

## packages/shared

Small cross-package seam:

- `hash.ts`
- `object.ts`
- `runtime-types.ts`
- `expo-types.ts`

If a change is mobile-product behavior rather than tiny utility behavior, it
probably belongs elsewhere.

## Docs app

`apps/docs` is a separate Next.js app:

- `app/`
  Static routes like `/introduction`, `/get-started`, `/convert-an-app`.
- `components/docs-shell.tsx`
  Docs layout and markdown render shell.
- `components/code-block.tsx`
  Rendered code blocks with copy action.
- `components/icons.tsx`
  React icon components for the docs UI.
- `lib/docs.ts`
  Route map, markdown loading, page metadata, previous/next links.
- `lib/page-route.tsx`
  Shared route rendering and metadata.
- `next.config.mjs`
  Static export + GitHub Pages basePath behavior.

## Skills

`skills/rn-mt-codebase-guide` is the distributable bundle users install with:

```bash
npx skills add https://github.com/kanmi-idris/rn-mt --skill rn-mt-codebase-guide
```

`.agents/skills/rn-mt-codebase-guide` is the repo-local development copy used
inside this workspace.

## Examples

Read `examples/README.md` before using fixtures.

Two fixture modes exist:

- source fixtures
  Copied into a sandbox, then converted during verification.
- committed multitenant fixtures
  Already converted and looped per tenant during verification.

## Tests

- `packages/core/src/index.test.ts`
  Main core regression net.
- `packages/cli/src/index.test.ts`
  Main CLI regression net.
- `packages/expo-plugin/src/index.test.ts`
  Expo bridge tests.

When the right place to add a test is unclear, follow ownership:

- package behavior -> package tests
- docs app behavior -> docs app build/typecheck
- integration or fixture regression -> `examples:verify`
