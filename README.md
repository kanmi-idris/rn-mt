# rn-mt

`rn-mt` is an open-source multitenancy conversion platform for existing React Native CLI and Expo applications.

It is designed to convert a single-tenant mobile app into a manifest-driven multi-tenant workspace that can:

- build tenant-specific app variants from one repo
- keep generated artifacts in sync through repeatable commands
- audit tenant leakage, stale generated artifacts, and native drift
- later export a tenant-only handoff repo for client delivery

## Workspace packages

- `@rn-mt/cli`: bootstrap and project-local command runner
- `@rn-mt/core`: schema, merge engine, repo analysis, patch planning, sync, audit, handoff reconstruction contracts
- `@rn-mt/runtime`: host-app runtime helpers and React-facing accessors
- `@rn-mt/expo-plugin`: Expo config plugin adapter

## Current state

This repository is scaffolded around the agreed product architecture and milestone plan.

- The full product PRD lives in `docs/issues/0001-rn-mt-prd.md`.
- The concrete package and deep-module map lives in `docs/architecture.md`.
- The beginner-friendly design decisions handbook lives in `docs/design-decisions-handbook.md`.
- The issue and milestone execution map lives in `docs/roadmap.md`.
- Integration tests are planned around committed fixture templates in `tests/fixtures/`.

## Milestones

### Milestone 1

- workspace and package scaffolding
- manifest schema and validator
- repo analysis
- `init`, `convert`, `sync`, and `audit`
- minimal Expo and bare RN integration
- script wiring and daily developer workflow

### Milestone 2

- `handoff`
- advanced codemods
- override lifecycle polish
- rollback and upgrade polish
- higher-level route and feature registry ergonomics

## Commands

The final public surface will include commands such as:

- `rn-mt init`
- `rn-mt analyze`
- `rn-mt convert`
- `rn-mt sync`
- `rn-mt audit`
- `rn-mt doctor`
- `rn-mt upgrade`
- `rn-mt handoff --tenant <id>`

The CLI package currently contains a placeholder command surface so the workspace has a stable starting point.
