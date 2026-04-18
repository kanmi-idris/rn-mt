export type RnMtMilestone = "milestone-1" | "milestone-2";

export interface RnMtModuleContract {
  name: string;
  purpose: string;
  whyDeep: string;
  testFocus: string[];
}

export const coreModuleContracts: RnMtModuleContract[] = [
  {
    name: "ManifestSchemaEngine",
    purpose:
      "Validate rn-mt.config.json, enforce schemaVersion, and expose normalized typed configuration.",
    whyDeep:
      "Concentrates schema validation, normalization, and config diagnostics behind a small stable interface used by every other subsystem.",
    testFocus: [
      "invalid schema rejection",
      "strict top-level key behavior",
      "extension namespace preservation",
      "schemaVersion compatibility gates",
    ],
  },
  {
    name: "TargetResolutionEngine",
    purpose:
      "Resolve base, environment, tenant, platform, and combined overrides into one deterministic build target.",
    whyDeep:
      "Hides layered override logic and keeps build-time tenant resolution deterministic across CLI, runtime, and Expo plugin boundaries.",
    testFocus: [
      "merge precedence",
      "deep object merge semantics",
      "array replacement behavior",
      "derived non-production identity rules",
    ],
  },
  {
    name: "RepoAnalysisEngine",
    purpose:
      "Analyze a host repo and classify app type, native state, script topology, package manager, and migration risk areas.",
    whyDeep:
      "Encapsulates repo-shape inference so conversion commands do not rely on brittle assumptions or hardcoded paths.",
    testFocus: [
      "Expo managed detection",
      "Expo prebuild detection",
      "bare RN detection",
      "ambiguous repo classification",
    ],
  },
  {
    name: "PatchPlanningEngine",
    purpose:
      "Produce structured patch plans for AST-first edits, generated include files, and anchored host integration points.",
    whyDeep:
      "Keeps file ownership, drift detection, and repeatable sync behavior in one place instead of scattering patch logic across commands.",
    testFocus: [
      "owned artifact registry generation",
      "minimal patch set calculation",
      "anchor conflict detection",
      "rollback metadata generation",
    ],
  },
  {
    name: "AuditEngine",
    purpose:
      "Run deterministic and heuristic audits with severity, confidence, fixability, and remediation guidance.",
    whyDeep:
      "Encapsulates the product's most nuanced reasoning in a stable behavioral interface used by local workflows, CI, and handoff.",
    testFocus: [
      "P0-P3 scoring",
      "heuristic confidence reporting",
      "override candidate recommendations",
      "tenant isolation residue detection",
    ],
  },
  {
    name: "ReconstructionGraph",
    purpose:
      "Track how conversion changed the host app so tenant handoff can later rebuild a clean single-tenant repo.",
    whyDeep:
      "This module carries the long-lived contract between conversion and handoff without requiring the CLI to guess original structure later.",
    testFocus: [
      "original to converted path mapping",
      "bridge metadata persistence",
      "handoff reconstruction completeness",
      "unsupported handoff state detection",
    ],
  },
  {
    name: "AssetPipeline",
    purpose:
      "Fingerprint source assets and generate deterministic native-ready icons, splash assets, and environment badges.",
    whyDeep:
      "Provides cross-platform asset generation without relying on external system tools, while keeping daily sync incremental.",
    testFocus: [
      "source asset hashing",
      "incremental regeneration triggers",
      "non-production badging defaults",
      "tenant-only asset selection",
    ],
  },
];

export const milestoneOneScope = {
  milestone: "milestone-1" as RnMtMilestone,
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
};
