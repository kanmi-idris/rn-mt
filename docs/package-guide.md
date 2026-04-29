# rn-mt Package Guide

This is the simplest detailed guide to how `rn-mt` works today.

The goal of this guide is not to sell the product. It is to help a new contributor open the repo and understand:

- what each package does
- what the main commands do
- how data moves through the system
- which files are generated
- where to look when something breaks

If you want the shortest version:

- `rn-mt` converts one existing React Native or Expo app into one multi-tenant workspace
- one JSON manifest controls the target context
- `convert` creates the shared and tenant folder structure
- `sync` resolves one exact target and generates runtime and native artifacts
- the host app should read from generated `current` and runtime files, not from tenant folders directly

## Start Here

`rn-mt` is a monorepo with five workspace packages:

```text
packages/
  cli/
  core/
  expo-plugin/
  runtime/
  shared/
```

The packages have very different jobs:

- `@_molaidrislabs/rn-mt`: the single public install, including the CLI and the public `./runtime` and `./expo-plugin` subpaths
- internal workspace packages still exist for architecture and maintenance

## The One-Sentence Model

The simplest mental model is:

1. analyze an app
2. initialize a manifest
3. convert source layout into `shared`, `tenants`, and `current`
4. set a target
5. sync generated artifacts for that target
6. run, audit, doctor, and later handoff from that stable state

## The Main Repo Shape

At the root of the repo:

```text
README.md
docs/
examples/
packages/
scripts/
```

What matters most:

- `packages/`: the actual implementation
- `docs/`: product reasoning and contributor documentation
- `examples/`: fixture apps used for integration verification
- `scripts/verify-examples.mjs`: end-to-end example verifier

## How a Converted App Looks

After conversion, a host app grows an `rn-mt` surface inside its app source:

```text
src/
  rn-mt/
    shared/
    tenants/
      northstar/
      orchid/
      volt/
    current/
    extensions/
```

Simple meaning:

- `shared/`: the default app code used by everyone
- `tenants/<id>/`: full-file overrides for one tenant
- `current/`: generated stable import surface for the active target
- `extensions/`: generated or reserved extension surface

At the app root, `rn-mt` also generates repo-level artifacts such as:

- `rn-mt.config.json`
- `rn-mt.generated.runtime.json`
- `rn-mt.generated.ownership.json`
- `rn-mt.generated.convert.ownership.json`
- `rn-mt.generated.reconstruction.json`
- `rn-mt.generated.README.md`
- `rn-mt.generated.expo.js`
- `rn-mt.generated.asset-fingerprints.json`

Not every app will use every generated file, but this is the normal family of artifacts.

## The Core Rule Set

These rules explain most of the implementation:

- one manifest owns non-secret config: `rn-mt.config.json`
- secrets do not go into generated runtime config
- shared code is the default
- tenant-specific code is the exception
- tenant overrides are full-file replacements in v1
- the app should import from `current`, not from random tenant folders
- generated files are reviewable and committed
- native integration is done through narrow generated adapters, not giant rewrites

## Package By Package

### `@_molaidrislabs/cli`

This package is the public command surface.

Its job is to:

- parse command arguments
- resolve `app-root` and `config` scope
- instantiate the core-backed modules needed for one command
- format output
- run subprocesses like `expo`, `react-native`, or package-manager commands

Important implementation seams:

- `src/index.ts`: public CLI entrypoint
- `src/application.ts`: builds the execution context and shared CLI object graph
- `src/commands/`: top-level command modules and subcommand handlers
- `src/shared/`: CLI-only modules for options, workflow, files, hooks, interaction, version checks, and audit formatting
- `src/core-adapters.ts`: the CLI-to-core adapter seam

The CLI is intentionally shallow compared to core. It should orchestrate behavior, not own the deepest rules.

### `@_molaidrislabs/core`

This package holds the main product logic.

Its top-level module map is:

```text
packages/core/src/
  workspace/
  analyze/
  manifest/
  convert/
  sync/
  tenant/
  override/
  doctor/
  audit/
  handoff/
```

Each module exists for a specific reason:

- `workspace/`: repo-relative file, path, hash, and filesystem helpers
- `analyze/`: repo classification and support reporting
- `manifest/`: manifest parsing, schema shape checks, merge rules, target resolution, and env validation
- `convert/`: move planning, wrapper generation, `current` generation, alias rewriting, package.json rewrites, and reconstruction metadata
- `sync/`: resolved runtime artifacts, env loading, native artifacts, Expo bridge output, and asset generation
- `tenant/`: tenant lifecycle and default target mutations
- `override/`: create and remove tenant overrides
- `doctor/`: release-facing health checks
- `audit/`: deterministic and heuristic repo checks
- `handoff/`: preflight, flattening, cleanup, sanitization, and tenant-isolation export logic

`@_molaidrislabs/core` is the package you read when you want to understand how the product actually behaves.

### `@_molaidrislabs/runtime`

This package is intentionally tiny.

Its job is to expose a safe runtime accessor API to the converted host app. The host app should not need to know the internal layout of generated files.

In practice, it is the safe reader layer for:

- resolved config
- active tenant
- active environment
- resolved routes, features, menus, and actions

### `@_molaidrislabs/expo-plugin`

This package is the Expo-specific bridge.

Its job is not to own all Expo behavior. Its job is to:

- read the explicit `rn-mt` target context
- apply that context to Expo config shape
- keep the Expo integration narrow and reproducible

It exists because Expo config resolution is its own surface and should not leak all Expo-specific behavior into the generic runtime package.

### `@_molaidrislabs/shared`

This package holds the small shared surface that multiple packages need.

Today that mainly means:

- stable public types
- simple shared utilities like hashing and record checks

It should stay small. If a utility starts to feel product-specific, it probably belongs back in `core`.

## How Commands Flow Through the System

The common command flow is:

```text
user command
-> @_molaidrislabs/cli entrypoint
  -> CLI application builds execution context
  -> CLI dispatcher picks a command module
  -> command module calls core-backed adapters
  -> core resolves or mutates repo state
  -> CLI writes files, prints output, or launches subprocesses
```

The user sees one command. Internally the path is deliberately layered.

## The Most Important Commands

### `rn-mt analyze`

Purpose:

- inspect the host repo
- classify it as `expo-managed`, `expo-prebuild`, or `bare-react-native`
- report support level, evidence, and remediation guidance

What analyze looks at:

- dependencies
- scripts
- app entry shape
- Expo Router indicators
- native folder presence
- package manager hints
- host language hints

Analyze does not convert anything. It tells the rest of the system what kind of repo it is dealing with.

### `rn-mt init`

Purpose:

- create the first `rn-mt.config.json`
- seed a minimal tenant and environment model from the analyzed repo
- generate the first host-facing entry files when needed

`init` is the first step that turns repo understanding into explicit repo state.

### `rn-mt convert`

Purpose:

- move chosen app files into `shared/`
- create root wrappers and bridge files
- generate `current/`
- rewrite imports so the app depends on the stable generated surface
- rewrite `package.json` scripts so common workflows still feel normal
- write reconstruction metadata for later handoff

This is the structural conversion step.

What convert is trying to achieve:

- preserve the app
- move the tenant-sensitive parts behind a stable structure
- make future target switching a data problem instead of a folder-copy problem

### `rn-mt target set`

Purpose:

- store the default tenant and environment in the manifest

This is simple but important because many later commands work from the selected default target unless you override them.

### `rn-mt sync`

Purpose:

- resolve one exact target
- merge the config layers deterministically
- generate runtime artifacts
- generate ownership metadata
- generate Expo bridge output when needed
- generate native platform artifacts when needed
- generate derived assets when needed

`sync` is the heart of the daily workflow.

If `convert` restructures the app once, `sync` keeps the generated state accurate every day after that.

### `rn-mt start`, `rn-mt run`, and `rn-mt build`

Purpose:

- keep normal mobile workflow commands usable
- route to the correct host tool for the selected repo kind
- inject the right env and target context before launching the host tool

This is why the product keeps emphasizing that `start`, `android`, and `ios` should still make sense.

### `rn-mt audit`

Purpose:

- detect tenant leakage
- detect generated drift or owned-file conflicts
- detect shared files that probably should be tenant overrides
- provide structured findings with severity and confidence

Audit exists so the repo stays trustworthy as more tenants get added.

### `rn-mt doctor`

Purpose:

- run release-facing checks for the current repo shape

Doctor is more about integration readiness than code organization.

### `rn-mt handoff`

Purpose:

- export one tenant into a normal-looking single-tenant repo
- flatten shared plus one tenant into standalone code
- strip `rn-mt`-specific infrastructure
- sanitize env and org-specific automation
- run a final tenant-isolation audit

Handoff is the later-stage delivery path for teams that need to give one tenant to a client or another owner.

## How Target Resolution Works

The manifest resolver follows a simple rule:

1. start from base config
2. apply environment overrides
3. apply tenant overrides
4. apply platform overrides
5. apply the most specific combination override last

This is intentionally deterministic.

The point is that a target like:

```text
tenant = northstar
environment = staging
platform = ios
```

always resolves the same way from the same manifest.

## What Lives In The Manifest

`rn-mt.config.json` is the central non-secret config file.

The manifest typically carries:

- source root information
- default tenant and environment
- tenant list
- environment list
- base config
- layered overrides
- identity values such as app name and native IDs
- Expo-facing values like slug and scheme
- static registries such as routes, features, menus, and actions
- env schema requirements

The manifest is not meant to hold secrets. Env inputs are validated, loaded, and used, but secrets should not be written into generated runtime output.

## What `current` Means

`current` is one of the most important ideas in the repo.

It means:

- the host app imports from a stable generated surface
- the selected tenant can change without requiring app code to chase tenant folder paths
- the import target is stable even when the implementation behind it changes

Simple rule:

- app code should prefer `current`
- tenant folders are implementation details

## What Gets Generated

Generated files exist at two different levels.

### Repo-level generated files

These include:

- runtime JSON
- ownership metadata
- reconstruction metadata
- Expo bridge output
- asset fingerprint metadata
- native include files

These files let the system prove what it generated, why it owns it, and how to rebuild or export later.

### App-source generated files

These include:

- `src/rn-mt/current/**`
- wrapper files at original app entry points
- generated runtime accessors or host-facing bridge files

These files let the host app keep using a clean import surface while the tenant-aware structure lives underneath.

## Why Ownership Metadata Exists

`rn-mt` writes ownership metadata because generated files are a safety boundary.

It needs to know:

- which files it owns
- what content it last wrote
- whether a file has drifted or been manually changed

Without this, `sync`, `convert`, and `handoff` would be much more dangerous.

## Why Reconstruction Metadata Exists

`convert` changes the repo structure. Later, `handoff` needs to understand those changes well enough to rebuild one clean tenant-only repo.

That is why reconstruction metadata records:

- where files came from
- where they moved
- which wrappers replaced original files
- how the host app was bridged

Without this graph, handoff would be guesswork.

## How Expo Integration Works

For Expo repos, `rn-mt` tries to stay narrow:

- if `app.config.ts` exists, it remains the authoritative computed layer
- if the app only has `app.json`, `rn-mt` can generate a narrow Expo bridge file
- resolved target context is exposed so Expo config can apply tenant-aware values explicitly

The goal is not to replace Expo config. The goal is to give Expo config an explicit tenant-aware input.

## How Bare React Native Integration Works

For bare React Native repos, `rn-mt` generates small native-facing artifacts instead of trying to own the whole native project:

- Android flavor and identity outputs where applicable
- iOS xcconfig or scheme-related outputs where applicable
- runtime and current-layer outputs shared with other repo kinds

For shell-style bare RN repos without root native folders, the system can still operate in a JS-surface workflow when the repo shape clearly supports React Native but not full native sync.

## How Overrides Work

In v1, overrides are full-file replacements.

This means:

- a shared file stays in `shared/`
- a tenant-specific version of that file can be created under `tenants/<id>/`
- `current/` points the host app to the right version for the active target

This is simpler and more predictable than trying to merge partial file fragments.

## How Tenant Lifecycle Works

The tenant commands own the tenant lifecycle:

- `tenant add`
- `tenant rename`
- `tenant remove`
- `target set`

These commands do more than edit the manifest. They also keep generated state, tenant directories, and metadata aligned with the repo structure.

## How Audit And Doctor Differ

This is an important distinction:

- `audit` asks: "Is this repo logically safe and tenant-clean?"
- `doctor` asks: "Is this repo integration-ready for release-facing workflows?"

They are related, but they are not the same check.

## How The Example Matrix Fits In

The `examples/` folder is not decoration. It is the main integration backbone for the repo.

There are two major example modes:

- source fixtures: apps that still need `init` and `convert`
- committed multitenant fixtures: apps that already contain committed `rn-mt` state and are verified across multiple tenants

The script `scripts/verify-examples.mjs` exercises those fixtures end to end. That script is one of the best ways to understand the intended system behavior.

## How To Read The Code

If you are new, this is the best reading order:

1. `README.md`
2. `docs/package-guide.md`
3. `docs/design-decisions-handbook.md`
4. `packages/cli/src/application.ts`
5. `packages/cli/src/commands/dispatcher.ts`
6. `packages/core/src/index.ts`
7. `packages/core/src/manifest/`
8. `packages/core/src/convert/`
9. `packages/core/src/sync/`
10. `packages/core/src/audit/`
11. `packages/core/src/handoff/`
12. `scripts/verify-examples.mjs`

That order moves from user-facing behavior to the deepest product logic.

## How To Debug A Problem

When something breaks, use this sequence:

1. identify the repo kind with `rn-mt analyze`
2. inspect `rn-mt.config.json`
3. inspect the selected default target
4. run `rn-mt sync`
5. inspect `rn-mt.generated.runtime.json`
6. inspect `src/rn-mt/current/`
7. run `rn-mt audit`
8. run `rn-mt doctor` if the problem is integration-facing
9. check the matching example fixture and its verifier flow

Simple debugging heuristic:

- if the problem is config shape or merge order, start in `manifest/`
- if the problem is moved files or imports, start in `convert/`
- if the problem is generated runtime or native artifacts, start in `sync/`
- if the problem is a command or subprocess flow, start in `cli/`
- if the problem appears only during export, start in `handoff/`

## What This Guide Is Not

This guide is not:

- the full product decision history
- the exact roadmap
- a marketing page
- a user tutorial for every command flag

For those, read:

- `docs/design-decisions-handbook.md`
- `docs/roadmap.md`
- `docs/support-policy.md`

## In One Final Paragraph

`rn-mt` is a layered conversion system. The CLI owns commands and workflow. Core owns the real rules. Runtime and Expo plugin stay intentionally narrow. Shared holds only the small common surface. The manifest is the source of non-secret truth, `convert` establishes the multi-tenant structure, `sync` keeps generated state accurate, `audit` and `doctor` keep the repo trustworthy, and `handoff` turns one tenant back into a normal standalone repo when needed.
