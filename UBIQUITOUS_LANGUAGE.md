# Ubiquitous Language

## Core configuration model

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **rn-mt** | A conversion platform that turns one existing React Native or Expo app into a manifest-driven multi-tenant workspace. | Tooling layer, framework |
| **Tenant** | One branded variant of the app within the shared workspace. | Brand, client, market app, white-label |
| **Environment** | A deployment stage such as `dev`, `staging`, or `prod`. | Mode, stage |
| **Platform** | A mobile operating-system target such as `ios` or `android`. | Device type, native side |
| **Target** | One exact `tenant + environment + platform` selection. | Variant, combo |
| **Manifest** | The single JSON source of truth for non-secret rn-mt configuration, stored in `rn-mt.config.json`. | Config file, settings blob |
| **envSchema** | The manifest contract that declares required environment variables without storing secret values. | Secrets config, env file |
| **App Root** | The specific React Native or Expo application root that one manifest controls. | Workspace root, project root |

## Source structure

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Shared** | Source, config, assets, and tests that every tenant uses by default. | Common, base app |
| **Override** | A full-file tenant-specific replacement for a shared file. | Patch, partial overlay |
| **Current** | The generated facade that exposes the resolved tenant-first, shared-fallback view for the selected target. | Active folder, runtime folder |
| **Wrapper** | A thin root file kept in place so host toolchains still load the converted app correctly. | Shim, legacy file |
| **Registry** | A static, stable-ID composition surface for routes, features, menus, or actions. | Plugin system, dynamic module loader |
| **Generated Artifact** | A deterministic CLI-owned file produced by sync, convert, or handoff support flows. | Temporary file, cache |

## Workflow and governance

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Analyze** | The repo classification phase that determines host-stack shape, support state, and conversion risk before patching anything. | Detect, inspect pass |
| **Convert** | The structural migration that moves an app into the rn-mt folder model and generates the initial wrappers and metadata. | Setup, bootstrap |
| **Sync** | The deterministic generation pass that resolves one target and writes runtime, native, and other generated artifacts. | Build prep, regenerate everything |
| **Audit** | The safety check that reports deterministic and heuristic findings about drift, leakage, and override opportunities. | Lint, scan |
| **Doctor** | The release-facing validation pass for host integration health. | Health check, verifier |
| **Upgrade** | The guided repo reconciliation flow that updates rn-mt packages, metadata, sync outputs, and audit state together. | Bump, reinstall |
| **Handoff** | The export flow that reconstructs one tenant into a clean standalone repo. | Publish, deliver, eject |
| **Support Policy** | The explicit contract that states what host-stack shapes are supported, near-supported, or unsupported. | Compatibility guess, best-effort support |

## Support boundary

| Term | Definition | Aliases to avoid |
| --- | --- | --- |
| **Supported** | A recognized host-stack shape that rn-mt intentionally targets for normal conversion and workflow use. | Fully generic, universal support |
| **Near-Supported** | A repo shape close enough to analyze but still requiring an explicit human decision before conversion. | Basically supported, soft-supported |
| **Unsupported** | A repo shape outside the current product contract that the CLI should reject clearly. | Maybe works, not recommended |
| **Expo Managed App** | An Expo app shape without committed native folders as the primary operating model. | Generic Expo app |
| **Expo Prebuild App** | An Expo app shape where native folders exist and are regenerated through Expo’s prebuild model. | Bare Expo |
| **Bare React Native App** | A React Native CLI app shape with direct native project ownership. | Plain RN, non-Expo app |

## Relationships

- A **Manifest** belongs to exactly one **App Root**.
- A **Manifest** defines one or more **Tenants**, **Environments**, and **Platforms**.
- A **Target** combines exactly one **Tenant**, one **Environment**, and one **Platform**.
- **Shared** content is the default source for every **Tenant**.
- An **Override** replaces exactly one **Shared** file for exactly one **Tenant**.
- **Current** is generated from **Shared**, **Override** files, and the selected **Target**.
- **Analyze** determines the **Support Policy** state before **Convert** runs.
- **Convert** creates the rn-mt structure that later **Sync**, **Audit**, and **Handoff** depend on.
- **Sync** writes **Generated Artifacts** for one resolved **Target**.
- **Handoff** exports exactly one **Tenant** and must remove cross-tenant residue.

## Example dialogue

> **Dev:** "For this repo, is `acme` a **brand** or a **tenant**?"
>
> **Domain expert:** "In rn-mt it is always a **Tenant**. `Brand` may describe the business idea, but the technical model uses **Tenant** everywhere."
>
> **Dev:** "If I pick `acme + staging + ios`, is that a **variant**?"
>
> **Domain expert:** "Call that a **Target**. A **Target** is one exact **Tenant**, **Environment**, and **Platform** tuple."
>
> **Dev:** "Should app code import from `shared` when nothing is tenant-specific yet?"
>
> **Domain expert:** "No. App code should import from **Current**. **Current** gives the stable resolved surface even when it currently falls back to **Shared**."
>
> **Dev:** "And if I later deliver only `acme` to a client?"
>
> **Domain expert:** "That is **Handoff**. It exports one **Tenant** into a normal standalone repo and strips rn-mt-only machinery."

## Flagged ambiguities

- "brand", "client", "market app", and "white-label" were all used for the same core concept. The canonical term is **Tenant**.
- "repo root", "workspace root", and "app root" can diverge in monorepos. The canonical scoped term is **App Root** for the application controlled by one manifest.
- "active target", "selected target", and "default target" refer to related but different ideas. Use **Target** for the tuple itself, and qualify it as "selected" or "default" only when the distinction matters.
- "publish", "export", and "handoff" were all used around client delivery. The canonical lifecycle term is **Handoff**.
- "support" can sound binary, but rn-mt uses three distinct states. Use **Supported**, **Near-Supported**, and **Unsupported** explicitly instead of saying something is merely "supported-ish."
