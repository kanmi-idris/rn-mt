/**
 * Defines the static help output shown by the rn-mt CLI.
 */
const coreModuleContracts = [
  {
    name: "ManifestSchemaEngine",
    purpose:
      "Validate rn-mt.config.json, enforce schemaVersion, and expose normalized typed configuration.",
  },
  {
    name: "TargetResolutionEngine",
    purpose:
      "Resolve base, environment, tenant, platform, and combined overrides into one deterministic build target.",
  },
  {
    name: "RepoAnalysisEngine",
    purpose:
      "Analyze a host repo and classify app type, native state, script topology, package manager, and migration risk areas.",
  },
  {
    name: "PatchPlanningEngine",
    purpose:
      "Produce structured patch plans for AST-first edits, generated include files, and anchored host integration points.",
  },
  {
    name: "AuditEngine",
    purpose:
      "Run deterministic and heuristic audits with severity, confidence, fixability, and remediation guidance.",
  },
  {
    name: "ReconstructionGraph",
    purpose:
      "Track how conversion changed the host app so tenant handoff can later rebuild a clean single-tenant repo.",
  },
  {
    name: "AssetPipeline",
    purpose:
      "Fingerprint source assets and generate deterministic native-ready icons, splash assets, and environment badges.",
  },
] as const;

const milestoneOneScope = {
  includes: [
    "workspace scaffolding",
    "manifest schema and validation",
    "repo analysis",
    "init",
    "convert",
    "sync",
    "audit",
    "minimal Expo integration",
    "minimal bare RN integration",
    "script wiring",
  ],
  defers: [
    "handoff implementation",
    "advanced codemods",
    "override lifecycle polish",
    "upgrade and rollback polish",
    "advanced route and feature registry helpers",
  ],
} as const;

export const helpText = `rn-mt

Manifest-driven multitenancy conversion platform for existing React Native and Expo applications.

Local-first policy:
- Normal rn-mt commands operate from the installed package set and local repo state only.
- rn-mt does not send telemetry from its own command surface.
- Workflow subprocesses are launched with telemetry opt-out env defaults where supported.
- Explicit exceptions: package installation and future upgrade checks may require network access, and host tools you explicitly ask rn-mt to run may contact local dev servers or remote services as part of that host tool's own behavior.

Initial scaffold status:
- workspace created
- deep module boundaries recorded
- PRD written in docs/issues/0001-rn-mt-prd.md

Milestone 1 includes:
${milestoneOneScope.includes.map((item) => `- ${item}`).join("\n")}

Deferred to milestone 2:
${milestoneOneScope.defers.map((item) => `- ${item}`).join("\n")}

Core deep modules:
${coreModuleContracts.map((item) => `- ${item.name}: ${item.purpose}`).join("\n")}
`;
