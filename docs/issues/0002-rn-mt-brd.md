# Business Requirements Document: rn-mt

## 1. Executive Summary

`rn-mt` is an open-source product designed to convert existing React Native CLI and Expo mobile applications into a scalable, manifest-driven multi-tenant architecture. The product addresses a common pain point for teams building white-label or multi-brand mobile products: the inability to manage many branded app variants cleanly from a single codebase without resorting to repo duplication, brittle environment switching, native file rewrites, and manual release workflows.

The product vision is to make multi-tenant mobile app development a repeatable operating model rather than a fragile set of project-specific hacks. `rn-mt` will provide a structured conversion CLI, deterministic config model, generated runtime and native integration layers, strong audit and sync workflows, and eventually a tenant-only handoff capability that produces a clean single-tenant repo for client delivery.

This BRD captures the business goals, product context, stakeholder needs, operating requirements, risk posture, packaging strategy, rollout strategy, adoption model, success metrics, and commercial-quality expectations for the product. It complements the PRD by expressing why the product exists, who it serves, how it will be adopted, what business outcomes matter, and what non-functional expectations must hold true for the product to succeed as an open-source developer tool.

## 2. Business Context

### 2.1 Current market reality

Many mobile teams eventually need to ship multiple branded app experiences from one functional platform. Common examples include:

- fintech or insurtech providers serving multiple markets or business labels
- agencies delivering branded mobile apps to multiple clients
- B2B platforms that white-label a customer-facing mobile app
- internal platform teams consolidating tenant-specific app variants into one operational model

These teams often start with one working React Native or Expo app and then accumulate one or more of the following anti-patterns:

- repo duplication per tenant
- asset duplication without clear ownership
- hardcoded tenant values scattered through UI and services
- per-tenant native project hacks that are hard to repeat
- environment switching through copied `.env` files
- ad hoc build scripts that only work in one repo
- poor tenant isolation when handing over code to a client

The result is slow delivery, high maintenance cost, release risk, inconsistent branding, weak onboarding for new engineers, and little confidence in tenant-specific packaging or client code handoff.

### 2.2 Opportunity

There is a clear opportunity to define a strong open-source opinionated standard for multi-tenant mobile app conversion and maintenance, especially one that:

- works with both Expo and bare React Native
- respects native build identity and packaging constraints
- avoids brittle repo-specific assumptions
- supports real production team workflows and not only greenfield demos
- supports eventual tenant codebase extraction for client delivery

### 2.3 Why now

The product is being created in response to a real-world codebase that already contains a useful seed of multitenancy logic, but whose implementation cannot safely scale or be reused as-is. Rather than extending that repo-specific implementation, `rn-mt` will productize the lessons learned into a reusable developer platform.

## 3. Problem Statement

Teams need a reliable way to convert existing React Native CLI and Expo applications into multi-tenant architectures without rebuilding from scratch, duplicating repositories, or manually maintaining fragile native and config logic.

The current ways teams solve this problem are painful because they:

- split configuration across code, scripts, assets, env files, and native edits
- are hard to audit and difficult to test
- do not survive native regeneration or project evolution well
- do not offer a standard tenant-specific development workflow
- make client handoff risky because other tenants, internal docs, history, and secrets remain entangled in the repo

The business problem is not just “how do we build multiple app variants” but “how do we operationalize multi-tenant mobile delivery in a repeatable, supportable, open-source way.”

## 4. Product Vision

`rn-mt` will become the standard developer workflow for converting, operating, auditing, and eventually handing off multi-tenant React Native and Expo apps.

The product vision has four pillars:

1. **Convert existing apps, not just greenfield templates**
2. **Keep multi-tenant behavior deterministic and reviewable**
3. **Make daily development safe and ergonomic**
4. **Enable tenant-only codebase delivery without leaking other tenants**

In practical terms, `rn-mt` should allow a developer to:

- define tenant and environment configuration once
- convert an existing codebase structurally
- run predictable tenant-specific development workflows
- audit tenant leakage and stale generated state
- evolve the tenant model over time
- eventually produce a clean, tenant-only standalone repo when a client requires their codebase

## 5. Product Goals

### 5.1 Primary goals

- Make multi-tenant conversion possible for existing Expo and React Native CLI apps
- Provide a single manifest-driven non-secret source of truth
- Replace repo-specific native mutation scripts with reusable generated adapters
- Ensure teams can add and maintain multiple tenants from one repo without repo duplication
- Ensure daily commands automatically maintain sync and visibility
- Build confidence in tenant isolation through auditing
- Support a future tenant-only handoff/export workflow

### 5.2 Secondary goals

- Provide a strong open-source architecture that others can understand and extend
- Reduce onboarding cost for engineers new to a multi-tenant codebase
- Make CI/CD integration straightforward and machine-readable
- Minimize host-repo dependency bloat
- Keep the product local-first and security-conscious

### 5.3 Product success definition

The product is successful when a team can adopt `rn-mt` for a real React Native or Expo codebase and say:

- “we no longer need separate repos per tenant”
- “we can add a new tenant without manually editing native projects”
- “we can trust what tenant a build is for”
- “we can identify tenant leakage before shipping”
- “we can eventually hand off a tenant-only repo safely”

## 6. Stakeholders

### 6.1 Primary stakeholders

#### React Native developers

They need a tool that can convert and maintain multi-tenant codebases without destroying their existing app structure or forcing fragile manual native work.

#### Expo developers

They need a plugin- and `app.config.ts`-based model that survives native regeneration and works naturally with Expo workflows.

#### Platform engineers

They need deterministic schema validation, stable generated artifacts, CI-ready behavior, and strong audit/reporting.

#### Product managers

They need a product that reduces time-to-market for additional tenants and keeps roadmap complexity manageable.

#### Client delivery teams

They need a future path to export a clean tenant-only repo for client handoff without exposing other tenants or internal operational infrastructure.

### 6.2 Secondary stakeholders

#### Designers

They need the architecture to support tenant-specific assets, copy, tokens, fonts, and feature presentation without codebase chaos.

#### Security and compliance stakeholders

They need confidence that secrets stay out of generated runtime config and that handoff workflows do not leak internal credentials or other tenants.

#### Open-source adopters and contributors

They need the codebase and docs to be legible, structured, and testable enough to trust and contribute to.

## 7. Target Users and Segments

### 7.1 Primary user segments

#### White-label app teams

Organizations shipping essentially the same app under different brands.

#### Agencies

Teams building branded apps for multiple clients who want a better alternative to repo-per-client maintenance.

#### Multi-market product teams

Companies maintaining one mobile product with region-specific or partner-specific app identities.

#### Existing app teams ready to consolidate

Teams that already built one single-tenant app and want to evolve into a structured multi-tenant architecture.

### 7.2 Early adopter profile

The earliest successful adopters are likely to be teams that:

- already feel pain from duplicated repos or brittle tenant scripts
- are comfortable with React Native or Expo internals
- can accept an opinionated structural conversion
- want a documented system rather than custom scripts only one engineer understands

## 8. User and Business Needs

### 8.1 Core user needs

- A way to convert an existing app rather than start over
- A clear manifest for tenant and environment configuration
- A deterministic and auditable sync model
- Safe daily commands with visible tenant and environment context
- A strong audit process for tenant leakage and drift
- Support for tenant-specific assets, fonts, copy, tokens, routes, and features
- A future path to tenant-only handoff/export

### 8.2 Business needs

- Faster onboarding of new tenants
- Reduced duplication and maintenance cost
- Lower release risk caused by wrong tenant or wrong environment builds
- Stronger consistency across branded apps
- Lower dependence on one engineer's tribal knowledge
- Safer external client delivery when code handoff is required

## 9. Product Scope

### 9.1 In scope

- Existing React Native CLI app conversion
- Existing Expo app conversion
- JSON-only manifest model
- Environment and tenant layering
- Native identity generation and synchronization
- Full structural migration into shared, tenant, and current folder surfaces
- Runtime accessors for resolved config
- Script wiring and daily developer workflow integration
- Deterministic and heuristic audit
- Tenant lifecycle commands
- Override lifecycle commands
- CLI JSON output and CI-friendly exit behavior
- Fixture-driven integration test strategy
- Future tenant handoff support as a second milestone capability

### 9.2 Out of scope

- Runtime tenant switching within a single installed binary
- Web as a first-class conversion surface in v1
- Signing credential management
- Full arbitrary UI/business logic rewriting
- Partial source overlays or patch-based tenant overrides
- Non-JSON manifest formats in v1

## 10. Solution Overview

The solution is a multi-package open-source platform centered on a conversion CLI and a deep core engine.

### 10.1 Product packaging

- `@rn-mt/cli`
- `@rn-mt/core`
- `@rn-mt/runtime`
- `@rn-mt/expo-plugin`

### 10.2 Operating model

1. User initializes or creates `rn-mt.config.json`
2. CLI analyzes the repo
3. CLI converts the repo structurally
4. Generated files and native adapters become part of the repo
5. Daily commands keep the repo synced incrementally
6. Audit surfaces deterministic and heuristic issues
7. Teams add, rename, remove, and override tenants over time
8. Later, tenant handoff creates a standalone tenant-only clone

### 10.3 Key product characteristics

- deterministic target resolution
- generated but reviewable artifacts
- explicit ownership of generated files
- security-aware secret separation
- strong audit and reporting model
- conversion-first, not template-only

## 11. Business-Level Functional Requirements

### 11.1 Conversion

The product must allow a user to convert an existing React Native CLI or Expo app into the rn-mt architecture.

Requirements:

- Must analyze the host repo before patching
- Must classify app type and native state
- Must support interactive and non-interactive modes
- Must support safe and full conversion modes
- Must support a full structural migration path
- Must leave the converted repo runnable and inspectable

### 11.2 Manifest management

The product must provide a manifest-driven model for all non-secret tenant and environment configuration.

Requirements:

- Must use a JSON-only canonical file
- Must publish a JSON Schema
- Must validate strictly
- Must support schema versioning
- Must support layered overrides across tenant, environment, and platform

### 11.3 Runtime and native integration

The product must bridge the resolved target into runtime and native layers.

Requirements:

- Must generate runtime-facing resolved config artifacts
- Must support Expo through a plugin and `app.config.ts`
- Must support bare RN through generated native include/config files and small host patches
- Must avoid requiring `react-native-config`

### 11.4 Developer workflow integration

The product must become part of normal app usage.

Requirements:

- Must wire script hooks into common workflows
- Must provide an always-visible concise banner
- Must keep daily sync incremental and fast
- Must expose unified command semantics across Expo and bare RN where possible

### 11.5 Audit and governance

The product must provide strong auditing and clear remediation paths.

Requirements:

- Must run deterministic checks
- Must run heuristic checks with evidence and confidence
- Must score findings by severity and fixability
- Must support ignores and CI failure thresholds
- Must identify when shared files should be tenant overrides

### 11.6 Tenant lifecycle management

The product must support tenant evolution after conversion.

Requirements:

- Must support tenant add
- Must support tenant remove
- Must support tenant rename
- Must support override create and remove
- Must preserve a clean shared-first architecture over time

### 11.7 Handoff

The product must support future extraction of a clean tenant-only codebase for delivery.

Requirements:

- Must clone into a separate output directory
- Must scrub other tenants and multi-tenant machinery
- Must remove secrets and org-specific automation
- Must reconstruct a normal single-tenant repo structure
- Must run tenant-isolation validation before success

## 12. Non-Functional Requirements

### 12.1 Reliability

- Commands must behave deterministically from local repo state plus installed package state
- Conversion must not rely on undocumented path assumptions
- Sync must be repeatable and safe to run frequently
- Audit results must be stable enough for CI use

### 12.2 Performance

- Daily hooks must be incremental rather than always doing full regeneration
- Asset work must be fingerprint-driven
- Normal `start`, `android`, and `ios` workflows must remain practical for teams

### 12.3 Security

- Secrets must stay out of generated runtime config
- The tool must not leak real env values into handoff repos
- Normal operations must avoid telemetry and unexpected remote fetches
- Tenant handoff must not leak other tenants or internal CI/CD and operational details

### 12.4 Portability

- CLI operations should work across macOS, Linux, and Windows where platform tools allow
- iOS build or run remains macOS-only, but the rest of the CLI should still function broadly
- Asset generation must not rely on system-specific image tools

### 12.5 Maintainability

- Core logic must live in deep modules with stable interfaces
- Generated file ownership must be explicit
- User-owned extension points must be clear
- Package boundaries must match product boundaries

### 12.6 Testability

- Deep modules must be testable in isolation
- End-to-end behavior must be covered by fixture-based integration tests
- JSON output and audit behavior must be easy to assert in automation

## 13. Product Architecture Requirements

### 13.1 Monorepo requirement

The product must live in a TypeScript monorepo with pnpm workspaces.

Reason:

- package separation is central to product maintainability
- runtime, CLI, core, and Expo adapter responsibilities are different
- versioning and testing require package-level clarity

### 13.2 Core engine requirement

The core package must own the deepest and most stable logic.

Reason:

- schema validation
- target resolution
- repo analysis
- patch planning
- audit
- reconstruction
- asset processing

These are business-critical and should not be reimplemented in the CLI layer.

### 13.3 Runtime requirement

The runtime package must keep host apps on a narrow, stable integration surface.

Reason:

- converted repos should not become tightly coupled to internal generator details
- app code should use stable config, flags, assets, tenant, and environment accessors

### 13.4 Expo adapter requirement

The Expo plugin must remain narrow and predictable.

Reason:

- Expo support must survive prebuild and native regeneration
- plugin logic should derive native config from resolved target state, not own the whole conversion process

## 14. Manifest and Configuration Business Requirements

### 14.1 Manifest simplicity

The manifest must be machine-friendly, strict, and IDE-friendly.

Requirements:

- JSON only
- `$schema` support
- `schemaVersion`
- no inline pseudo-comment hacks
- clean generated starter file

### 14.2 Layering and defaults

The manifest must support:

- shared defaults
- environments
- tenants
- platforms
- combined override scopes

The repo must also have a committed shared default tenant and environment for normal development commands.

### 14.3 Secret separation

The manifest must not store real secrets. Instead, it must describe secret requirements through an `envSchema` contract.

### 14.4 Shared vs native identity

The config model must separate human-facing shared identity from platform-native IDs.

Reason:

- app naming and native package identifiers are related but not identical concerns
- different platforms need different treatment
- environment-based ID derivation matters for coexistence of staging and production builds

## 15. Development Workflow Requirements

### 15.1 Familiar commands

The product must preserve familiar top-level commands so developers do not feel that the repo has become alien.

### 15.2 Explicit commands

The product must also expose explicit per-target commands and flags for CI and certainty.

### 15.3 Always-visible context

The product must always show developers what tenant and environment they are working in.

### 15.4 Incremental safety

The product must keep normal daily sync incremental so that always-run hooks do not become a burden.

## 16. Audit and Quality Requirements

The audit system is not optional polish. It is a core business requirement because trust in multi-tenant correctness depends on it.

Requirements:

- deterministic and heuristic passes
- severity model
- confidence model for heuristic findings
- evidence for each heuristic finding
- fixability classification
- CI-friendly thresholds
- ignore support
- override recommendations

The audit system must be good enough that a team can use it as an operational quality gate.

## 17. Handoff Requirements

Handoff is a major business differentiator because many white-label platforms eventually face client code delivery requests.

The product must support a future tenant-only export model that:

- leaves the source repo unchanged
- produces a fresh sibling clone
- strips git history by default
- initializes a new git repo
- reconstructs a normal single-tenant structure
- removes other tenants
- removes multi-tenant tooling and metadata as much as possible
- removes org-specific CI/CD and operations files by default
- removes real secrets and leaves only templates
- validates tenant isolation before success

This requirement should influence the design from day one, even if the feature is not fully built in milestone 1.

## 18. Adoption and Change Management

### 18.1 Adoption posture

The product is intentionally opinionated. Teams who choose to adopt it are expected to do so because the docs make the structural migration clear. This is not meant to be a tiny add-on that leaves the original architecture untouched.

### 18.2 Onboarding

The product must provide:

- clear starter manifest generation
- repo analysis
- generated local docs
- visible command output
- strong defaults

### 18.3 Team behavior change

Adopting `rn-mt` means teams are choosing a new operating model:

- one manifest-driven source of truth
- generated artifacts as part of the repo
- explicit generated-vs-user-owned boundaries
- tenant overrides as mirrored full-file replacements

## 19. Governance and Ownership Model

`rn-mt` must make ownership explicit.

### 19.1 CLI-owned

- generated runtime artifacts
- generated native include/config artifacts
- generated current facade
- package-level sync and analysis metadata

### 19.2 User-owned

- manifest intent
- source assets in their original locations
- extension modules
- tenant override content
- shared app code after conversion

### 19.3 Shared governance model

The boundary between generated and user-owned material must be obvious enough that teams know what they can safely edit and what they should let the CLI regenerate.

## 20. Risks

### 20.1 Structural migration complexity

The product is not doing a trivial additive setup. It is performing a structural conversion, which raises the complexity and risk of the initial implementation.

### 20.2 Host repo variability

React Native and Expo repos vary widely in script conventions, aliases, native setup, and file organization.

### 20.3 Native edge cases

Bare RN native integration is inherently riskier than Expo plugin integration because native projects differ more and can be heavily customized.

### 20.4 Audit noise

Heuristic detection can become noisy if not carefully designed and evidence-backed.

### 20.5 Handoff reconstruction fidelity

Handoff depends on the quality of reconstruction metadata captured during conversion.

### 20.6 Long-term support scope

Version support policy must remain strict enough that the open-source product does not become impossible to maintain.

## 21. Risk Mitigations

- analysis-first workflow before patching
- explicit support policy for host stacks
- AST-first patching and minimal anchored patches
- committed generated artifacts for reproducibility
- explicit ownership and extension points
- fixture-based integration testing
- local-first execution model
- milestone split that prioritizes the conversion backbone before advanced lifecycle polish

## 22. Success Metrics

### 22.1 Product adoption metrics

- number of successful conversions by repo type
- number of teams adopting for more than one tenant
- time from single-tenant app to second tenant onboarding

### 22.2 Quality metrics

- sync reliability across repeated runs
- audit precision on deterministic findings
- acceptable confidence behavior on heuristic findings
- low rate of destructive conversion regressions

### 22.3 Workflow metrics

- developers can still use familiar top-level scripts after conversion
- generated hooks do not make daily commands unreasonably slow
- CI can reliably consume JSON output and exit thresholds

### 22.4 Handoff metrics

- tenant-only export passes isolation audit
- no cross-tenant residue is found in output clones
- no real env secrets remain in handoff outputs

## 23. Release Strategy

### 23.1 Milestone 1

Focus on the core conversion platform:

- workspace and package scaffolding
- manifest schema and validator
- repo analysis
- init
- convert
- sync
- audit
- minimal Expo integration
- minimal bare RN integration
- script wiring

### 23.2 Milestone 2

Focus on advanced lifecycle and export:

- handoff
- codemods
- override lifecycle polish
- upgrade and rollback polish
- richer registry ergonomics

### 23.3 Why this release split matters

The business requirement is not “ship everything at once.” The business requirement is “ship a trustworthy core first.” Handoff and advanced lifecycle tooling depend on correct metadata and architectural discipline from milestone 1.

## 24. Operational Policies

### 24.1 Security policy

- no telemetry by default
- no remote fetches in normal flows beyond explicit package installation and upgrade actions
- secrets never move into generated runtime files
- handoff strips real env and secret-bearing material

### 24.2 Compatibility policy

- modern supported RN and Expo only in v1
- near-supported repos may continue with warning and confirmation
- unsupported repos should be blocked by default

### 24.3 Testing policy

- deep modules must be isolated enough to test as contracts
- integration testing must use committed fixtures
- CLI behavior must be assertable by output and artifacts, not hidden implementation details

## 25. Dependencies

### 25.1 External ecosystem dependencies

- React Native CLI project conventions
- Expo config plugin ecosystem
- package manager detection and invocation
- TypeScript and JSON Schema tooling

### 25.2 Internal dependencies

- The CLI depends on the core package for all meaningful decision-making
- Runtime behavior depends on generated resolved artifacts
- Expo integration depends on explicit target context being available and trustworthy
- Future handoff depends on reconstruction metadata captured during conversion

## 26. Assumptions

- Users adopting the tool have read docs and accept an opinionated structural migration
- Teams want a real multi-tenant operating model, not a temporary branding hack
- Teams are willing to commit generated artifacts where needed for reproducibility
- Teams want future tenant handoff capability even if it arrives after the initial milestone

## 27. Open-Source Product Requirements

Because `rn-mt` is open-source, it must be legible and trustworthy, not just functional.

Requirements:

- repository structure must reflect product architecture clearly
- documentation must help both adopters and contributors
- test strategy must validate the real transformation surface
- product language must stay consistent and not drift between docs and code

## 28. Documentation Requirements

The product must provide enough documentation that:

- a developer can understand adoption and daily use
- a product manager can understand what the system enables and what it defers
- a designer can understand how assets, copy, tokens, and tenant variation are expected to work
- a contributor can understand the deep modules and package responsibilities

The PRD and BRD together should enable that alignment.

## 29. Recommended Decisions Locked by This BRD

- `rn-mt` exists to operationalize multi-tenant mobile app conversion and lifecycle management
- It is intentionally opinionated and structural
- It is conversion-first, not template-only
- It prioritizes deterministic behavior over magical inference
- It treats tenant handoff as a major differentiator, not an afterthought
- It treats audit and sync as core business requirements, not engineering polish
- It treats package boundaries and deep modules as part of product quality, not just implementation style

## 30. Final Business Conclusion

`rn-mt` should be built as a serious open-source developer platform for multi-tenant mobile app operations. It is not merely a code generator and not merely a collection of tenant scripts. It is a standardized operating model for converting, running, governing, and eventually isolating multi-tenant React Native and Expo applications.

The strongest business promise of the product is this:

> A team can take one existing mobile app, convert it into a maintainable multi-tenant system, operate many tenant-specific builds from one repo with confidence, and later extract a tenant-only codebase safely when business delivery requires it.

That promise should guide all implementation and prioritization decisions.
