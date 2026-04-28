# Architecture

This page is the developer-facing architecture map for the current package.

It is intentionally shorter than the internal planning docs. The goal here is
to help contributors understand where code belongs.

## Package boundaries

```text
packages/
  cli/
  core/
  runtime/
  expo-plugin/
  shared/
```

### `@rn-mt/cli`

Owns:

- command parsing
- execution context
- prompts
- output formatting
- subprocess workflow

It should stay orchestration-heavy and product-rule-light.

### `@rn-mt/core`

Owns the deepest behavior:

- analyze
- manifest parsing and resolution
- convert planning
- sync output generation
- tenant lifecycle
- override lifecycle
- audit
- doctor
- handoff

### `@rn-mt/runtime`

Owns the stable runtime accessor API that host apps consume.

### `@rn-mt/expo-plugin`

Owns the narrow Expo config bridge.

### `@rn-mt/shared`

Owns shared types and tiny utilities that do not belong in a product-specific
core module.

## Core module boundaries

`@rn-mt/core` is split into deep modules:

```text
packages/core/src/
  analyze/
  audit/
  convert/
  doctor/
  handoff/
  manifest/
  override/
  sync/
  tenant/
  workspace/
```

Simple rule:

- if the code defines how the product behaves, it probably belongs in `core`
- if the code only decides how to present or run that behavior, it probably
  belongs in `cli`

## Data flow

The most important product flow is:

```text
manifest
  -> target resolution
  -> current source selection
  -> runtime generation
  -> native artifact generation
  -> host workflow command
```

## Generated files

Generated artifacts are a core part of the architecture, not an implementation
accident.

The system intentionally commits reviewable generated files such as:

- runtime output
- ownership metadata
- convert ownership metadata
- reconstruction metadata
- Expo bridge files
- current facades

That is why ownership tracking and audit exist alongside convert and sync.

## Design rule of thumb

When making changes, try to preserve these boundaries:

- `cli` coordinates
- `core` decides
- `runtime` exposes a tiny safe app API
- `expo-plugin` stays narrow
- `shared` stays small
