# rn-mt Support Policy

This document is the short contributor-facing contract for terminology, host-stack support, milestone boundaries, and the planned EAS follow-up.

It is derived from the product decisions in `docs/design-decisions-handbook.md`, the PRD, and the active issue roadmap. If this file ever drifts from those source docs, fix the drift instead of inventing a new policy here.

For the broader domain glossary and flagged terminology ambiguities, read `UBIQUITOUS_LANGUAGE.md` at the repo root alongside this policy.

## Canonical Terminology

- `tenant` is the canonical technical term across the CLI, manifest, code, and docs.
- In prose, `tenant` may describe a brand, client, partner, market app, or white-label variant.
- Do not replace `tenant` with ad hoc terms in commands, schema fields, or contributor docs.

## Host-Stack Support Policy

`rn-mt` does not claim universal React Native compatibility. The tool is intentionally explicit about what it can and cannot support.

### Supported

These are the backbone host-stack shapes the product is intentionally targeting:

- modern Expo managed apps
- modern Expo prebuild apps
- modern bare React Native CLI apps

In practice, this means the repo root or selected app root should look like a recognized Expo or bare React Native app when `rn-mt analyze` inspects it.

### Near-Supported

These are repo shapes that are close enough to inspect, but not clean enough to convert without an explicit human decision:

- ambiguous app roots where multiple classifications remain plausible
- non-standard but analyzable repo layouts that require an explicit app kind choice
- monorepos where one app root is supported, but support applies one app root at a time instead of one manifest for the whole workspace

Near-supported does not mean “guaranteed conversion.” It means the CLI can explain the shape, surface the risks, and require an explicit next step.

### Unsupported

These are out of scope for the current contract:

- non-Expo and non-React Native mobile roots
- first-class web conversion
- legacy or unusual host-stack shapes that `analyze` cannot classify with enough confidence
- repo layouts the current analyzers mark unsupported

If the CLI says unsupported, contributors should treat that as a product boundary, not as a wording problem to hide with softer copy.

## Monorepo Boundary

- `rn-mt` supports one manifest per app root.
- In a larger workspace, commands should target an explicit app root or explicit manifest path.
- Workspace-wide “one manifest controls every app” behavior is not part of the current support contract.

## Milestone Boundary

### Milestone 1: Conversion Backbone

Milestone 1 is the first usable operating model:

- analyze host repos
- initialize and resolve the manifest
- convert repo structure
- sync generated runtime and native artifacts
- support daily workflow commands
- audit drift and leakage
- support one manifest per app root in monorepos

### Milestone 2: Handoff and Advanced Lifecycle

Milestone 2 is where the advanced lifecycle work lives:

- handoff export
- upgrade and rollback polish
- deeper override and registry ergonomics
- tenant lifecycle polish
- contributor-facing support and roadmap docs

Milestone 2 builds on the backbone. It should not rewrite the backbone contract.

## Expo and EAS Roadmap Boundary

The current Expo contract is narrower than a full EAS release platform.

### Implemented Backbone

The backbone already covers:

- explicit target context flowing into Expo computed config
- `app.config.ts` as the authoritative computed layer while preserving `app.json` layering
- doctor-level validation for release-facing integration without owning credentials

### Not Implemented As First-Class rn-mt Workflow

The current product does not yet claim:

- first-class EAS build, submit, or update orchestration
- credential management
- provisioning or signing secret management
- org-specific release automation

### Planned Follow-Up

The planned EAS follow-up is documentation and lifecycle polish on top of the explicit target-context model already in place. Future EAS guidance should build on that model rather than bypass it with ad hoc environment switching.
