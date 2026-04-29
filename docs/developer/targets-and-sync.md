# Targets & Sync

Use `target set` when you want to choose which tenant and environment your app
should use by default.

Use `sync` when you want `rn-mt` to turn that choice into real generated files.

## Pick the default target

Run this when you want to set the default tenant and environment:

```bash
rn-mt target set --tenant northstar --environment dev
```

That updates the manifest defaults. After that, commands like `start`, `run`,
and plain `sync` use those defaults.

## What a target means

A target is one exact selection from the manifest.

Examples:

- `northstar + dev`
- `northstar + prod + ios`

## Run sync

Run this when you want `rn-mt` to resolve the current target and write the
generated output:

```bash
rn-mt sync
```

## Run platform sync when you need native output

Use these when you need platform-specific generated files too:

```bash
rn-mt sync --platform ios
rn-mt sync --platform android
```

This is usually where iOS schemes, Android flavor outputs, native identity
values, and platform asset files matter.

## What sync actually does

Sync follows the same pattern every time:

1. read the manifest
2. resolve the selected target
3. apply the config layers in order
4. write only the files that changed

## The layer order

`rn-mt` starts broad, then gets more specific:

1. shared base
2. environment override
3. tenant override
4. platform override
5. more specific combinations

The most specific valid layer wins last.

## Common generated files

The exact set depends on the repo, but sync often writes files like:

- `rn-mt.generated.runtime.json`
- `rn-mt.generated.ownership.json`
- `rn-mt.generated.expo.js`
- `rn-mt.generated.asset-fingerprints.json`
- generated `current` facade files
- generated native include files

## Read runtime state through `@_molaidrislabs/rn-mt/runtime`

Your app should use the runtime accessors instead of reading the raw generated
JSON directly.

```ts
import { createRuntimeAccessors } from "@_molaidrislabs/rn-mt/runtime";
```

That gives the app stable getters like:

- `getConfig()`
- `getTenant()`
- `getEnv()`
- `getFlags()`
- `getAssets()`

## Secrets stay out of runtime output

Sync validates env inputs, but it does not copy secret values into the runtime
artifact.

When a workflow command needs env values, `rn-mt` loads the right env files and
passes those values into the subprocess instead.

## When sync says nothing changed

That is usually good news.

It means the generated files already match the selected target, so `rn-mt`
leaves them alone.
