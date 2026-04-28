# Command Reference

This page describes the current public CLI surface.

## Project setup and structure

### `rn-mt analyze`

Inspects a repo and reports:

- app kind
- support status
- evidence
- remediation guidance

Use this first on any new app.

### `rn-mt init`

Creates the first `rn-mt.config.json`.

### `rn-mt convert`

Moves the app into the `shared` / `tenants` / `current` model and writes the
first generated metadata files.

### `rn-mt codemod current-imports`

Previews or applies a codemod for `current` import rewrites.

## Target and tenant management

### `rn-mt target set --tenant <id> --environment <env>`

Changes the manifest default target.

### `rn-mt tenant add --id <id>`

Adds a tenant to the manifest and creates its initial folder structure.

### `rn-mt tenant rename --from <old> --to <new>`

Renames a tenant and updates related generated state.

### `rn-mt tenant remove --id <id>`

Removes a tenant when allowed by the manifest and current default target.

## Overrides

### `rn-mt override create <shared-relative-path>`

Copies a shared file into the selected tenant override path and regenerates the
matching `current` facade.

### `rn-mt override remove <shared-relative-path>`

Deletes a tenant override and points `current` back to shared.

## Sync and workflow

### `rn-mt sync`

Resolves the current manifest target and writes generated artifacts.

### `rn-mt sync --platform ios`

Runs platform-specific sync for `ios`.

### `rn-mt sync --platform android`

Runs platform-specific sync for `android`.

### `rn-mt start`

Starts the host workflow for the current repo kind.

### `rn-mt build`

Runs the host build workflow for the current repo kind.

### `rn-mt run`

Has two modes:

- high-level workflow dispatch like `rn-mt run --platform android`
- low-level passthrough like `rn-mt run -- expo start --clear`

### `rn-mt hook <name>`

Runs one of the supported workflow hooks:

- `prestart`
- `preandroid`
- `preios`
- `postinstall`

## Quality and export

### `rn-mt audit`

Runs deterministic and heuristic checks against the repo.

Useful flags:

```sh
rn-mt audit --fail-on P0
rn-mt audit --ignore path:src/rn-mt/shared/legacy.ts
```

### `rn-mt doctor`

Runs release-facing integration checks without touching credentials.

### `rn-mt handoff --tenant <id>`

Creates a standalone single-tenant export after preflight passes.

### `rn-mt handoff --tenant <id> --zip`

Packages the handoff export into a zip archive.

### `rn-mt upgrade`

Runs the current upgrade workflow, including package reconciliation, metadata
migration, sync, and audit.

## Common command chain

For a normal active repo, a common path is:

```sh
rn-mt target set --tenant northstar --environment dev
rn-mt sync
rn-mt start
```
