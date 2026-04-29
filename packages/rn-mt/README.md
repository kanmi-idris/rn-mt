# rn-mt

`rn-mt` converts an existing Expo or React Native app into a manifest-driven
multi-tenant workspace.

Install it once, then use the `rn-mt` CLI to analyze the app, create the
manifest, convert the repo, add tenants, sync generated output, and run the
selected target.

## Install

```bash
pnpm add -D @_molaidrislabs/rn-mt
```

You can also use `npm` or `yarn`, but the examples below use `pnpm`.

## Before you start

Check these first:

- Node.js is installed
- your app already runs normally without `rn-mt`
- you are inside the app root

## Step 1: check the app type

Run this first so `rn-mt` can tell you what it is looking at:

```bash
rn-mt analyze
```

This tells you:

- whether the app looks like Expo managed, Expo prebuild, or bare React Native
- whether the repo is supported or near-supported
- whether you need to pass `--app-kind`

If the repo shape is ambiguous, pass the kind yourself:

```bash
rn-mt analyze --app-kind expo-prebuild
```

## Step 2: create the manifest file

Run this when you want `rn-mt` to write the first config file:

```bash
rn-mt init
```

That creates `rn-mt.config.json`. This file becomes the control center for:

- tenants
- environments
- default target
- config overrides

## Step 3: convert the app

Run this when you want to turn the app into the `rn-mt` workspace shape:

```bash
rn-mt convert
```

This creates:

```text
src/
  rn-mt/
    shared/
    tenants/
    current/
```

It also writes the generated metadata files that `rn-mt` uses later for sync,
audit, and handoff.

## Step 4: add your tenants

Run `tenant add` for each app variant you want:

```bash
rn-mt tenant add --id northstar --display-name "Northstar"
rn-mt tenant add --id orchid --display-name "Orchid"
rn-mt tenant add --id volt --display-name "Volt"
```

At this point the tenant folders exist. The app still stays mostly shared until
you start creating overrides.

## Step 5: choose the default target

Pick the tenant and environment you want the default workflow to use:

```bash
rn-mt target set --tenant northstar --environment dev
```

## Step 6: generate the active output

Run `sync` when you want `rn-mt` to resolve the current target and write the
generated files:

```bash
rn-mt sync
```

If you also need platform output, run:

```bash
rn-mt sync --platform ios
rn-mt sync --platform android
```

## Step 7: run the app

Once sync completes, run the app through the `rn-mt` workflow commands:

```bash
rn-mt start
rn-mt run --platform ios
rn-mt run --platform android
```

## Step 8: create tenant-specific overrides

When one tenant needs its own version of a shared file, run:

```bash
rn-mt override create config/theme.ts
```

That copies the shared file into the active tenant and updates the generated
`current` surface so the app keeps importing from one stable place.

## Step 9: check the repo

Run `audit` when you want to catch drift or tenant leakage:

```bash
rn-mt audit
rn-mt audit --fail-on P0
```

Run `doctor` when you want release-facing checks:

```bash
rn-mt doctor
```

## Runtime and Expo subpaths

The public package also exposes:

- `@_molaidrislabs/rn-mt/runtime`
- `@_molaidrislabs/rn-mt/expo-plugin`

Use the runtime subpath when the app needs stable accessors for generated
runtime state.

Use the Expo plugin subpath when an Expo config bridge needs target-context
resolution.

## Quick success checklist

You are in a good place if all of these are true:

- `rn-mt analyze` returns the right repo kind
- `rn-mt.config.json` exists
- `src/rn-mt/shared` exists
- `src/rn-mt/current` exists
- `rn-mt sync` completes
- `rn-mt start` launches the selected target

## Docs

Full developer docs:

- `https://kanmi-idris.github.io/rn-mt/`

Repository:

- `https://github.com/kanmi-idris/rn-mt`
