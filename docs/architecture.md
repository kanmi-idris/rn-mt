# rn-mt Architecture Map

This document records the initial package and module boundaries for the `rn-mt` monorepo.

## Package boundaries

### `@rn-mt/core`

The core package owns the deepest and most stable modules in the system. It should eventually encapsulate most of the difficult product behavior behind small interfaces.

Planned deep modules:

- manifest schema and validation engine
- deterministic layered override resolver
- repo analyzer and capability classifier
- patch planner and owned-artifact registry
- sync engine for generated artifacts
- audit engine for deterministic and heuristic findings
- reconstruction graph for later tenant handoff
- tenant handoff exporter and isolation validator
- static registry resolver for routes, features, and menus
- asset pipeline and fingerprinting engine

### `@rn-mt/cli`

The CLI package is a thin orchestration layer. It should remain relatively shallow and route most complex logic into `@rn-mt/core`.

Responsibilities:

- command parsing
- user interaction and non-interactive mode handling
- structured output formatting
- package manager orchestration
- mapping CLI commands to core services

### `@rn-mt/runtime`

The runtime package exposes a stable host-app integration surface.

Responsibilities:

- consuming resolved config
- exposing React helpers and stable selectors
- keeping host apps off internal implementation details

### `@rn-mt/expo-plugin`

The Expo package is intentionally narrow.

Responsibilities:

- reading resolved target context
- deriving Expo-compatible native configuration
- staying reproducible across prebuild and native folder regeneration

## Testing strategy

The main testing backbone for this repo should be fixture-driven integration tests.

Fixture matrix:

- bare React Native CLI app
- Expo managed app
- Expo prebuild app
- intentionally messy existing app fixture with custom scripts and config

Deep modules in `@rn-mt/core` should additionally have isolated contract tests, especially for:

- manifest validation
- override resolution
- analysis classification
- patch planning
- audit scoring
- reconstruction graphs

## PRD

The issue-ready PRD for the product is stored in `docs/issues/0001-rn-mt-prd.md`.

The beginner-friendly design decisions handbook is stored in `docs/design-decisions-handbook.md`.

The issue and milestone execution map is stored in `docs/roadmap.md`.
