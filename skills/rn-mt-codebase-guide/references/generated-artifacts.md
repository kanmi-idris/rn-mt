# Generated Artifacts and Tenant Model

Use this file when a task touches `shared`, `tenants`, `current`, sync output,
handoff cleanup, or generated ownership.

## Core source model

Converted repos revolve around:

```text
src/rn-mt/
  shared/
  tenants/<tenant-id>/
  current/
```

- `shared/`
  Default source of truth.
- `tenants/<id>/`
  Full-file overrides.
- `current/`
  Generated, stable import surface that the app should read from.

If app code is importing directly from `shared` or `tenants`, that is usually
the bug.

## Manifest

The manifest is always:

```text
rn-mt.config.json
```

It controls:

- defaults
- tenants
- environments
- config/flags/assets
- registry data: routes, features, menus, actions
- env schema

Core ownership lives in `packages/core/src/manifest/*`.

## Generated artifact kinds

The sync module recognizes these kinds:

- `runtime-artifact`
- `ownership-metadata`
- `reconstruction-metadata`
- `repo-readme`
- `root-wrapper`
- `current-facade`
- `expo-config-bridge`
- `host-config-bridge`
- `derived-asset`
- `asset-fingerprint-metadata`
- `expo-target-context`
- `android-flavor-config`
- `android-native-identity`
- `ios-scheme`
- `ios-xcconfig`

See `packages/core/src/sync/types.ts`.

## Important generated files to inspect

These are the first files to inspect when debugging sync/convert/handoff:

- `rn-mt.generated.runtime.json`
- `rn-mt.generated.ownership.json`
- `rn-mt.generated.reconstruction.json`
- `rn-mt.generated.README.md`
- `rn-mt.generated.asset-fingerprints.json`
- `rn-mt.generated.expo.js`
- `.rn-mt/hook-state.json`

## Ownership rules

If `convert` or `sync` complains about ownership:

1. inspect `rn-mt.generated.ownership.json`
2. identify whether the path is supposed to stay generated
3. decide whether the file should remain generated or become user-owned

Do not “fix” ownership errors by blindly deleting files.

## Reconstruction rules

Handoff depends on reconstruction metadata generated during convert.

If handoff flattening or cleanup looks wrong, inspect:

- `rn-mt.generated.reconstruction.json`
- convert output in `packages/core/src/convert/*`
- cleanup logic in `packages/core/src/handoff/handoff-module.ts`

## Env handling

Runtime artifacts must stay secret-free.

Env schema validation lives in:

- `packages/core/src/manifest/env.ts`
- `packages/core/src/sync/subprocess-env.ts`

If a workflow command fails because env values are missing, debug the env schema
and selected target, not the runtime JSON.

