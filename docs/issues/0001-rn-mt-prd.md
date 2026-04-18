## Problem Statement

Teams building multiple branded React Native applications from one codebase usually start with a single-tenant app and then accumulate brittle scripts, copied repos, duplicated assets, and ad hoc native configuration changes. They need a reliable way to convert an existing React Native CLI or Expo app into a true multi-tenant workspace without maintaining several near-identical repositories. They also need a safe path to later hand over a single tenant's isolated codebase to a client without leaking other tenants, internal tooling, or secrets.

The existing repo that inspired this work demonstrates the problem clearly. It contains a useful runtime tenant config pattern, but the implementation is tightly coupled to one project. It rewrites native files directly, assumes hardcoded paths, splits truth between tenant config and env files, and leaves hardcoded tenant copy in shared screens. That approach is difficult to reuse, difficult to test, and unsafe to package as a general-purpose open-source CLI.

The user wants an open-source npm-distributed CLI that developers can install globally and run against existing React Native CLI and Expo applications. The CLI must perform a real structural conversion, create a maintainable multi-tenant architecture, keep generated artifacts in sync through daily development commands, expose a strong audit system, and later support exporting a tenant-only handoff repo that can be delivered as that tenant's standalone codebase.

## Solution

`rn-mt` will be an open-source multitenancy conversion platform for existing React Native and Expo apps. It will live in a new monorepo at `/Users/olaidris/Desktop/Code/rn-mt` and publish a family of scoped packages: `@rn-mt/cli`, `@rn-mt/core`, `@rn-mt/runtime`, and `@rn-mt/expo-plugin`. Developers can bootstrap with the global `rn-mt` command, but converted repos will also install a pinned local CLI devDependency so hooks, CI, and team workflows remain reproducible.

The system will use `rn-mt.config.json` as the single JSON-only manifest for all non-secret product configuration. It will support deterministic layered overrides across base, environment, tenant, platform, and their combinations. Secrets stay outside generated runtime config and are described through an `envSchema` contract. The core architecture will resolve one explicit target tuple of tenant, environment, and platform, generate deterministic runtime and native artifacts, and wire hooks into `start`, `android`, `ios`, and `postinstall` so sync and visibility happen automatically during normal development.

Conversion will be structural, not merely additive. Existing app code will move into `src/rn-mt/shared/...` by default. Tenant-specific overrides will live under `src/rn-mt/tenants/<tenant>/...`, mirroring the shared folder structure. A generated `src/rn-mt/current/...` facade will provide the stable current target view with tenant-first then shared fallback. Root entry files such as `App.tsx`, `index.js`, and Expo config entry points will remain in place as thin wrappers. Tests will migrate as shared by default. Existing config, theme, and asset modules will move into the new shared structure as part of the conversion.

The product will include a rich audit system, override lifecycle commands, tenant lifecycle commands, script wiring, CI-aware JSON output, fixture-based testing, Expo plugin integration, bare RN native include generation, and a later handoff command. `rn-mt handoff --tenant <id>` will create a fresh sibling clone, strip git history, reconstruct the selected tenant into a normal single-tenant repo structure, remove rn-mt and multi-tenant machinery as much as possible, strip secrets and org-specific automation, run a final tenant-isolation audit, and optionally zip the output.

## User Stories

1. As a React Native platform engineer, I want to convert an existing single-tenant mobile app into a multi-tenant workspace, so that I can support many branded app variants from one repo.
2. As an Expo engineer, I want the multitenancy system to integrate through an Expo config plugin and `app.config.ts`, so that prebuild regeneration remains deterministic.
3. As a bare React Native engineer, I want native integration to rely on generated include files and tiny anchored patches instead of giant rewrites, so that future sync stays maintainable.
4. As a mobile team lead, I want one manifest to own all non-secret tenant configuration, so that the system has a single source of truth.
5. As a developer, I want the manifest to support base plus layered overrides for environments, tenants, and platforms, so that real-world white-label complexity is modeled cleanly.
6. As a developer, I want the manifest to stay JSON-only, so that the CLI can validate it strictly and tooling remains deterministic.
7. As a developer, I want a published JSON Schema and `$schema` support, so that editors can autocomplete and validate the config as I type.
8. As a product engineer, I want `schemaVersion` in the manifest, so that future upgrades can migrate config safely.
9. As a team member, I want a committed shared default tenant and environment in the manifest, so that plain `start`, `android`, and `ios` commands remain ergonomic.
10. As a developer, I want `rn-mt target set` to update the shared default in the manifest, so that the repo's common dev target is explicit and reviewable.
11. As a developer, I want object-keyed collections for tenants and environments, so that add, remove, rename, and lookup operations stay deterministic.
12. As a maintainer, I want override semantics to be deep-merge for objects and replace for primitives and arrays, so that target resolution is predictable.
13. As a team, I want a strict schema with a dedicated extension namespace, so that app-specific metadata is possible without weakening validation everywhere.
14. As a JavaScript app team, I want generated host-facing files in JavaScript when my repo is JavaScript, so that conversion does not force TypeScript adoption.
15. As a TypeScript app team, I want generated host-facing files in TypeScript when my repo is TypeScript, so that type safety and editor support remain strong.
16. As a developer, I want `rn-mt init` to infer the current app and seed the first tenant automatically, so that onboarding starts from the real repo state.
17. As a developer, I want `rn-mt analyze` to classify Expo managed, Expo prebuild, and bare RN repos before patching anything, so that conversion does not rely on guesses.
18. As a developer, I want analysis to detect whether native folders actually exist and whether they match the declared app type, so that conversion can stop safely when repo state is inconsistent.
19. As a developer in an ambiguous repo, I want interactive confirmation when multiple valid interpretations exist, so that the tool does not choose a destructive path automatically.
20. As a CI pipeline author, I want non-interactive mode to fail with structured remediation steps when ambiguity exists, so that automation remains deterministic.
21. As a developer, I want `rn-mt convert` to support safe and full modes, so that teams can choose a conservative or aggressive migration path.
22. As a developer, I want the product's initial implementation milestone to focus on conversion, sync, and audit before handoff, so that the core engine is solid first.
23. As a platform architect, I want the monorepo to separate CLI, core, runtime, and Expo plugin concerns, so that deep modules remain stable and testable.
24. As a maintainer, I want most hard logic to live in `@rn-mt/core`, so that the CLI layer can stay thin and easier to evolve.
25. As a maintainer, I want the deepest modules to include manifest validation, target resolution, repo analysis, patch planning, audit, reconstruction, and asset processing, so that the hardest logic has stable boundaries.
26. As a developer, I want full structural migration on first conversion, so that the repo is immediately in the new architecture instead of half-old and half-new.
27. As a developer, I want general app code moved into `src/rn-mt/shared/...` by default, so that future tenants start from shared behavior rather than duplication.
28. As a developer, I want tenant overrides stored in `src/rn-mt/tenants/<tenant>/...`, so that tenant-specific code, assets, and fonts have a clear ownership model.
29. As a developer, I want the existing `src` subtree shape preserved inside the new shared and tenant folders, so that the app's original architecture remains understandable.
30. As a developer, I want root files like `App.tsx` and `index.js` to stay in place as wrappers, so that React Native and Expo toolchains continue to work.
31. As a developer, I want config, theme, and asset modules migrated into the new shared structure, so that the converted repo is internally consistent.
32. As a tester, I want tests moved during conversion too, so that the converted repo remains verifiable instead of partially broken.
33. As a developer, I want import rewriting to target the new canonical rn-mt structure directly, so that the converted repo does not depend on legacy shim files forever.
34. As a developer, I want the conversion to preserve my repo's existing alias conventions when they already exist, so that the result still feels native to the codebase.
35. As a developer in a repo without aliases, I want conversion to avoid inventing alias infrastructure, so that the tool does not add unnecessary config churn.
36. As a developer, I want a generated `src/rn-mt/current/...` facade that exposes the selected tenant and shared fallback, so that app code has one stable surface.
37. As a developer, I want tenant-specific folders for components, features, assets, and fonts, so that each tenant can own app differences cleanly.
38. As a developer, I want tenant overrides to mirror the shared relative path structure, so that creating and reasoning about overrides is simple.
39. As a developer, I want app-level tenant-aware imports to go through the `current` facade rather than raw tenant folder paths, so that the build surface stays deterministic.
40. As a developer, I want tenant overrides to be full-file replacements in v1, so that override behavior is simple and auditable.
41. As a developer, I want a first-class `rn-mt override create` command, so that copying a shared file into a tenant override is intentional and tracked.
42. As a developer, I want a matching `rn-mt override remove` command, so that I can fall back to shared behavior cleanly when an override is no longer needed.
43. As a developer, I want audit findings to tell me when a shared file should probably become a tenant override, so that migration work is actionable.
44. As a product engineer, I want static tenant-aware registries for routes, features, menus, and actions, so that tenant-specific feature composition does not require scattered runtime conditionals.
45. As a platform engineer, I want route and feature registries to support add, replace, and disable by stable ID, so that tenant customization does not require full registry forks.
46. As a product engineer, I want registry gating to resolve statically from manifest-driven flags, so that only the correct feature surface is materialized for a target.
47. As a developer, I want a small runtime access API for config, tenant, env, flags, and assets, so that host apps stay off internal implementation details.
48. As a design-conscious team, I want a limited token namespace beyond colors, so that spacing, layout, radius, and font references can vary by tenant.
49. As a branding engineer, I want manifest-level font declarations and asset wiring, so that brand fonts can participate without a full typography rewrite.
50. As a content owner, I want a limited `copy` namespace plus a `custom` bucket, so that key brand-facing strings can vary per tenant without inventing a full CMS.
51. As a security-conscious developer, I want real secrets excluded from generated runtime config, so that sensitive keys stay in env inputs only.
52. As a developer, I want `envSchema` to declare required secret keys and their scope, so that validation is deterministic even when values are omitted from git.
53. As a developer, I want canonical env naming to use `.env.<environment>` and `.env.<tenant>.<environment>`, so that multi-environment tenant config stays unambiguous.
54. As a maintainer, I want `rn-mt` to own env file loading and secret injection instead of requiring `react-native-config`, so that the product does not depend on a brittle third-party env strategy.
55. As a team, I want `react-native-config` to remain optional and bridge-only, so that conversion can work in both Expo and bare RN without forcing one env library.
56. As an Android developer, I want bare RN apps to use separate `tenant` and `environment` flavor dimensions, so that app identity and resources can vary cleanly by both axes.
57. As an iOS developer, I want bare RN iOS support to use one shared target with generated `tenant-environment` schemes and xcconfig includes, so that Xcode target sprawl is avoided.
58. As an Expo developer, I want `app.config.ts` to become the authoritative computed layer while still being able to layer on top of `app.json`, so that existing Expo configuration remains compatible.
59. As an Expo developer, I want the Expo plugin to read explicit target context rather than infer tenant and environment ad hoc, so that prebuild results stay deterministic.
60. As a mobile developer, I want non-production bundle IDs and display names to derive automatically unless overridden, so that dev and staging installs can coexist with production.
61. As a mobile developer, I want non-production icon badging enabled by default, so that I can visually distinguish staging and development apps.
62. As a mobile developer, I want non-production display name suffixing enabled by default, so that logs, switchers, and install lists remain clear.
63. As a developer, I want source assets to remain in place wherever my repo already stores them, so that conversion does not force mass asset relocation.
64. As a developer, I want rn-mt to own only derived platform assets, so that source assets remain user-owned while generated outputs stay deterministic.
65. As a developer, I want source asset fingerprinting, so that always-run sync hooks can regenerate only what changed.
66. As a cross-platform team, I want asset generation implemented in Node without relying on tools like `sips` or ImageMagick, so that Windows, Linux, and CI usage stay portable.
67. As a developer, I want top-level `start`, `android`, and `ios` scripts to remain familiar, so that daily workflows are not replaced by a wall of generated commands.
68. As a developer, I want per-target helper scripts namespaced under `rn-mt:*`, so that the script surface is explicit without polluting top-level names.
69. As a developer, I want plain top-level scripts to use the shared default target from the manifest, so that the common case stays ergonomic.
70. As a developer, I want generated hooks in `prestart`, `preandroid`, `preios`, and `postinstall`, so that sync, doctor checks, and banner output happen automatically.
71. As a developer, I want always-run hooks to be incremental and hash-aware rather than fully regenerating every time, so that daily workflows stay fast.
72. As a developer, I want an always-visible concise banner, so that I can see the active tenant, environment, platform, identity, config file, and sync status every time I run the app.
73. As a developer, I want `rn-mt start`, `rn-mt run`, and `rn-mt build` to expose a unified command surface across Expo and bare RN, so that the product feels coherent.
74. As a maintainer, I want converted repos to install pinned local `@rn-mt/*` dependencies, so that project behavior does not depend on a developer's global CLI version.
75. As a maintainer, I want explicit version compatibility checks and an `rn-mt upgrade` workflow, so that global and local package versions cannot silently drift.
76. As a maintainer, I want `rn-mt upgrade` to include package upgrades, metadata migrations, and a final sync plus audit, so that repo state is reconciled in one flow.
77. As a developer, I want script and runtime behavior to work in single-app repos first, so that milestone 1 stays realistic.
78. As a monorepo user, I want explicit app-root support via config path or app root targeting, so that I can still opt into rn-mt in a workspace later.
79. As a developer, I want exactly one manifest per converted app root, so that multi-app workspaces stay clearly scoped.
80. As a team, I want `tenant` to remain the canonical product term even if docs explain it as brand or client, so that the technical API stays precise.
81. As a maintainer, I want `rn-mt.config.json`, generated runtime artifacts, and generated native include files committed, so that builds are reproducible and reviewable.
82. As a maintainer, I want generated files to be treated as CLI-owned and non-editable, so that sync can safely overwrite or conflict-check them.
83. As a developer, I want explicit user-owned extension files alongside generated files, so that I can add custom helpers without editing generated artifacts.
84. As a developer, I want bridge mode into existing host config modules, so that conversion can integrate with mature apps realistically.
85. As a maintainer, I want bridge mode to stay narrow and not mass-rewrite app semantics by default, so that conversion risk stays manageable.
86. As an advanced team, I want optional codemods that are narrow, preview-first, and opt-in with `--write`, so that deeper cleanup remains possible without making conversion unsafe.
87. As a CI engineer, I want `--json` output for key commands, so that pipelines and future editor integrations can consume structured results.
88. As a CI engineer, I want configurable exit thresholds such as `--fail-on P1`, so that enforcement can match team quality policies.
89. As a maintainer, I want a repo-local rn-mt handoff README generated after conversion, so that future engineers understand what the system owns.
90. As a developer, I want `rn-mt tenant add`, `tenant remove`, and `tenant rename`, so that tenant lifecycle management is first-class and not manual JSON surgery.
91. As a developer, I want a strict support policy that distinguishes supported, near-supported, and unsupported host stacks, so that the tool does not pretend to support everything.
92. As an OSS user, I want the CLI to avoid telemetry and remote fetches during normal operations, so that enterprise trust and reproducibility stay high.
93. As a maintainer, I want first-class fixture applications as the main integration test strategy, so that repo transformation behavior is tested realistically.
94. As a maintainer, I want fixture templates committed in the repo and copied to temp directories per test, so that integration tests remain deterministic and debuggable.
95. As a maintainer, I want modern current RN and Expo versions only in v1, so that the implementation can stay robust instead of supporting ancient project shapes.
96. As a developer, I want the CLI to auto-detect and use the host repo's package manager by default, so that conversion leaves the repo runnable immediately.
97. As a maintainer, I want added host dependencies kept to the minimum needed at runtime and build time, so that converted apps do not accumulate unnecessary packages.
98. As a release engineer, I want rn-mt to validate signing and distribution integration but not manage credentials or provisioning, so that org-specific release concerns remain separate.
99. As an Expo team, I want first-class EAS integration planned, so that Expo production workflows are not left behind.
100. As a platform engineer, I want `rn-mt handoff` to create a tenant-only standalone repo clone for client delivery, so that a tenant can receive only their codebase.
101. As a client delivery team, I want handoff to use a new sibling directory and refuse overwrites without `--force`, so that exports are safe and predictable.
102. As a client delivery team, I want handoff to strip the original git history by default and initialize a new fresh git repo, so that the output is clean and safe to transfer.
103. As a delivery team, I want handoff to rewrite the clone into a first-class single-tenant app identity everywhere, so that it no longer looks like an extracted slice of a multi-tenant workspace.
104. As a delivery team, I want handoff to flatten selected tenant and shared code back into the app's normal structure, so that the receiving team gets a plain app repo.
105. As a delivery team, I want handoff to reconstruct the host app's original structure as much as possible, so that the output feels native to the codebase rather than framework-shaped.
106. As a maintainer, I want conversion to persist reconstruction metadata, so that handoff can later rebuild a correct tenant-only repo without guesswork.
107. As a delivery team, I want handoff to generate single-tenant docs and remove multi-tenant operational docs, so that the result is understandable to the receiving team.
108. As a delivery team, I want handoff to strip org-specific CI/CD, release automation, and operational glue by default, so that internal tooling is not leaked.
109. As a security-conscious team, I want handoff to remove real env files and replace them with sanitized example templates only, so that secrets are not transferred.
110. As a delivery team, I want handoff to run a final tenant-isolation audit and fail if other tenants remain detectable, so that the output is trustworthy.
111. As a delivery team, I want failed handoff attempts to keep the output folder for inspection, so that manual diagnosis is possible.
112. As a maintainer, I want handoff to require a healthy converted rn-mt repo with doctor-clean state and reconstruction metadata, so that client exports never run on broken inputs.
113. As a delivery team, I want handoff to support optional zip packaging, so that the final repo can be transferred conveniently.
114. As a product manager, I want the PRD and implementation docs to be detailed enough for product, design, and engineering to align deeply, so that all design branches are understood before implementation.

## Implementation Decisions

- The project will be built as a TypeScript pnpm-workspace monorepo.
- The product will publish four packages: a bootstrap and project-local CLI, a deep core engine, a host runtime package, and a narrow Expo plugin package.
- The command brand will be `rn-mt`, while packages remain under the `@rn-mt/*` namespace.
- The canonical manifest will be `rn-mt.config.json` and only JSON will be supported in v1.
- The manifest will be versioned and validated through a published JSON Schema.
- The manifest will use keyed object maps rather than arrays for tenants and environments.
- The manifest will support deterministic layered overrides across base, environment, tenant, platform, and combinations of those scopes.
- The merge contract will be deep-merge for objects, replace for primitives, and replace for arrays.
- The manifest will remain strict except for a dedicated `extensions` namespace for arbitrary app-specific metadata.
- The default plain-development target will be a committed shared setting in the manifest rather than developer-local mutable state.
- The manifest will separate shared identity from native platform identity by using shared naming fields plus dedicated Android and iOS native identifiers.
- The manifest will include namespaces for identity, assets, flags, tokens, copy, support, native, and extensions.
- A dedicated structured endpoints namespace was explicitly rejected for v1.
- The manifest will support limited copy and design token surfaces beyond colors, including spacing, layout, radius, and font references.
- The runtime package will expose a small stable access surface for config, tenant, env, flags, and assets.
- Secrets will not be stored in generated runtime config and will instead be modeled through an `envSchema` contract plus env file resolution.
- The CLI will own env loading, merging, validation, and subprocess injection as the default behavior.
- `react-native-config` will be optional and treated as a migration or bridge integration only.
- Conversion will always begin with a formal repo analysis phase that classifies app type, native presence, package manager, config style, and migration risks.
- The CLI will distinguish between supported, near-supported, and unsupported host stacks and gate behavior accordingly.
- Interactive mode will be the default locally, while full non-interactive automation will be supported for CI and scripted workflows.
- `convert` will support both safe and full modes, with safe as the recommended default for users but full available for opinionated structural migration.
- The approved product direction requires full structural migration during conversion rather than a lightly additive setup.
- Conversion will move general app code into a shared rn-mt structure and tenant-specific code into mirrored tenant folders.
- The existing `src` subtree shape will be preserved inside the shared and tenant folder model.
- Root entry files such as the app entry and registration files will remain in place as wrappers rather than being fully relocated.
- Existing config, theme, asset, and test modules will migrate into the rn-mt shared structure as part of full conversion.
- Import rewriting will target the canonical rn-mt structure directly rather than preserving legacy compatibility shims long term.
- Existing alias conventions will be preserved when present, but conversion will not introduce new alias systems into repos that do not already use them.
- Tenant-specific source will be first-class, with mirrored folders for components, features, assets, and fonts.
- A generated `current` facade will provide the stable tenant-aware public surface for app code.
- Tenant source resolution will always prefer tenant-specific files first and fall back to shared files second.
- Full-file overrides were chosen over partial or patch-based source overlays.
- Override lifecycle commands are part of the product, including creation and removal flows.
- Audit must be able to recommend when shared files should become tenant overrides.
- Static route and feature registries are first-class composition surfaces, not a runtime plugin system.
- Registries will support add, replace, disable, and static flag-gated resolution by stable item IDs.
- Bare RN Android will model tenant and environment as separate flavor dimensions while leaving build types as debug and release.
- Bare RN iOS will use a single shared target with generated tenant-environment schemes and xcconfig includes rather than many native targets.
- Expo integration will normalize apps to `app.config.ts` as the authoritative computed layer while preserving `app.json` layering when present.
- The Expo plugin will be narrow and focused on deriving native configuration from explicit target context produced by the CLI.
- Script wiring is mandatory in converted repos and will use incremental hooks instead of full regeneration every time.
- Top-level developer scripts will remain familiar, while generated matrix scripts live under an `rn-mt:*` namespace.
- Converted repos will receive a pinned local CLI devDependency so project scripts never depend on a global installation being present.
- Version compatibility between the global bootstrap CLI and local repo packages will be enforced explicitly, and upgrades will be modeled as a coordinated package plus metadata plus sync plus audit operation.
- The system will support rollback metadata, though rollback polishing is deferred beyond the first milestone.
- Audit will have deterministic and heuristic passes, each with severity, fixability, evidence, and confidence information where appropriate.
- Audit will support ignore rules and CI-oriented failure thresholds.
- JSON output is a first-class concern for analyze, convert, sync, audit, doctor, and upgrade commands.
- The CLI will avoid telemetry and remote fetches during normal operations and remain local-first except where package installation or explicit upgrade checks require network access.
- Stable generated runtime artifacts and generated native include or config files are intended to be committed so that builds stay reproducible and reviewable.
- Generated files are CLI-owned and are not intended to be hand-edited.
- Explicit user-owned extension files will exist so teams have a sanctioned place to add custom logic.
- Bridge adapters into host config modules are supported, but bridge mode stays narrow and is not a substitute for full migration.
- Optional codemods are part of the advanced toolset and will remain narrow, preview-first, and explicitly applied.
- The long-term client-delivery export command is `rn-mt handoff`, which replaces the earlier publish-oriented naming idea.
- Handoff will create a new sibling clone, not mutate the source repo.
- Handoff will strip git history by default, initialize a new git repo, and optionally package the result as a zip.
- Handoff will reconstruct a normal tenant-only repo structure rather than preserving the multi-tenant workspace model.
- Handoff will remove multi-tenant tooling, secrets, org-specific automation, and cross-tenant residue as much as possible.
- Handoff will require a healthy converted rn-mt repo and run a final tenant-isolation audit before reporting success.
- Fixture-based integration testing using committed sample apps copied into temporary directories is the main verification strategy for the tool.
- Cross-platform Node-based asset generation replaces system-tool-dependent asset scripts.
- Web is explicitly out of scope as a first-class conversion target in v1.
- Signing and provisioning management are out of scope, but signing-aware validation remains in scope.
- Milestone 1 focuses on the conversion backbone, while handoff and several advanced lifecycle features are deferred to milestone 2.

## Testing Decisions

- Good tests will validate external behavior and user-visible outcomes rather than internal implementation details. The product is a repo transformation and orchestration system, so tests should focus on what files are generated, what commands report, what validation fails, how targets resolve, and whether converted repos remain structurally correct.
- The deepest modules will receive isolated contract tests because they encapsulate the most important logic behind stable interfaces. These include manifest validation, layered target resolution, repo analysis classification, patch planning, audit scoring, reconstruction metadata generation, and asset fingerprinting.
- Integration tests will be the main confidence backbone. They will run against committed fixture app templates copied into temporary workspaces. These fixtures should include a bare RN app, an Expo managed app, an Expo prebuild app, and at least one intentionally messy app fixture with custom scripts and config.
- CLI tests should assert human-readable behavior and structured JSON output without coupling to implementation internals.
- Audit tests should verify deterministic findings, heuristic findings with evidence and confidence, override recommendations, ignore behavior, and CI failure thresholds.
- Conversion tests should verify structural migration, generated artifact ownership, script wiring, import rewriting, and alias-preserving behavior.
- Runtime package tests should focus on the stable external accessor surface rather than internal implementation details.
- Expo plugin tests should verify deterministic config derivation from explicit target context and compatibility with the `app.config.ts` plus `app.json` layering model.
- Handoff tests, when they arrive in the second milestone, should validate tenant-only isolation, secret stripping, CI removal, reconstruction fidelity, and failure behavior that preserves the output folder.
- Prior art from the inspiration repo is limited because the existing codebase is not already an rn-mt project and does not include this class of repo-transformation tests. The proper prior art for rn-mt will therefore be the fixture-based integration matrix created in this monorepo itself.

## Out of Scope

- Runtime tenant switching inside one installed app binary.
- Full automatic rewrite of arbitrary business logic and all UI semantics in existing apps.
- First-class web conversion and web deployment support.
- Management of signing credentials, provisioning profiles, keystores, or store-upload secrets.
- A general-purpose runtime plugin system for tenant modules.
- Partial source patch overlays for tenant overrides.
- YAML, TypeScript, or other manifest formats besides JSON in v1.
- Broad “fix the whole repo” codemods that are not narrow and explicitly invoked.
- Automatic support for legacy React Native or Expo versions outside the modern supported range.
- Direct dependence on `react-native-config` as a required architectural foundation.

## Further Notes

- This PRD intentionally includes the full product design, not just milestone 1, because later handoff and override features materially influence how the conversion engine and metadata contracts must be designed from the beginning.
- The first milestone should still be implemented as the conversion backbone first: monorepo scaffolding, manifest schema, analysis, init, convert, sync, audit, minimal Expo integration, minimal bare RN integration, and script wiring.
- Handoff, advanced codemods, override polish, rollback polish, upgrade polish, and richer registry ergonomics are intentionally deferred to the second milestone, but their metadata and architectural prerequisites must be respected during milestone 1 implementation.
- The system should remain local-first and deterministic. If a behavior cannot be reproduced from the installed package and the local repo state, it should not become part of the normal conversion flow.
- The final deliverable must be understandable by product, design, and engineering stakeholders. The package and deep-module boundaries therefore matter not only for code but also for documentation, planning, and future issue decomposition.
