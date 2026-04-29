# rn-mt

`rn-mt` is an open-source multitenancy conversion platform for existing React Native CLI and Expo applications.

It is designed to convert a single-tenant mobile app into a manifest-driven multi-tenant workspace that can:

- build tenant-specific app variants from one repo
- keep generated artifacts in sync through repeatable commands
- audit tenant leakage, stale generated artifacts, and native drift
- later export a tenant-only handoff repo for client delivery

## Workspace packages

- `@_molaidrislabs/rn-mt`: the single public install, including the `rn-mt` CLI and the public `./runtime` and `./expo-plugin` subpaths
- internal workspace packages still exist for architecture and maintenance, but they are not the intended public npm surface

## Current state

This repository is actively being built issue by issue against the agreed product architecture and milestone plan.

- The full product PRD lives in `docs/issues/0001-rn-mt-prd.md`.
- The simplest detailed implementation guide lives in `docs/package-guide.md`.
- The docs entrypoint lives in `docs/README.md`.
- The deployable docs site lives in `apps/docs/README.md`.
- The docs site is configured to deploy as a GitHub Pages project site.
- The concrete package and deep-module map lives in `docs/architecture.md`.
- The beginner-friendly design decisions handbook lives in `docs/design-decisions-handbook.md`.
- The domain glossary lives in `UBIQUITOUS_LANGUAGE.md`.
- The contributor-facing support contract lives in `docs/support-policy.md`.
- The issue and milestone execution map lives in `docs/roadmap.md`.
- Integration tests are planned around committed fixture templates in `tests/fixtures/`.

## Support policy

The short version is:

- `tenant` is the canonical technical term across the product.
- `rn-mt` explicitly targets modern Expo managed, Expo prebuild, and bare React Native app roots.
- ambiguous or non-standard repo shapes are near-supported and should require an explicit human choice instead of silent guesses.
- one manifest applies to one app root, even inside a larger monorepo.

Read `docs/support-policy.md` for the full support, milestone, and EAS boundary.
Read `UBIQUITOUS_LANGUAGE.md` for the canonical domain vocabulary and ambiguity notes.

## Milestones

### Milestone 1

- workspace and package scaffolding
- manifest schema and validator
- repo analysis
- `init`, `convert`, `sync`, and `audit`
- minimal Expo and bare RN integration
- script wiring and daily developer workflow
- one manifest per app root in monorepos

### Milestone 2

- support-policy and EAS roadmap docs
- tenant lifecycle polish
- `handoff`
- advanced codemods
- override, rollback, and upgrade polish
- higher-level route and feature registry ergonomics

## Commands

The public surface is being built incrementally around commands such as:

- `rn-mt init`
- `rn-mt analyze`
- `rn-mt convert`
- `rn-mt sync`
- `rn-mt audit`
- `rn-mt doctor`
- `rn-mt upgrade`
- `rn-mt handoff --tenant <id>`

See `docs/roadmap.md` and the GitHub issues for exact issue-level implementation status.
