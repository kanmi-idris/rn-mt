import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export type RnMtMilestone = "milestone-1" | "milestone-2";

export type RnMtPackageManagerName =
  | "pnpm"
  | "npm"
  | "yarn"
  | "bun"
  | "unknown";

export type RnMtPackageManagerSource =
  | "packageManager-field"
  | "pnpm-lock"
  | "package-lock"
  | "yarn-lock"
  | "bun-lock"
  | "none";

export type RnMtRepoAppKind =
  | "expo-managed"
  | "expo-prebuild"
  | "bare-react-native"
  | "unknown";

export type RnMtAnalyzeStatus = "ok" | "ambiguous";

export type RnMtSupportTier = "supported" | "near-supported" | "unsupported";

export type RnMtSupportReasonCode =
  | "modern-expo-managed"
  | "modern-expo-prebuild"
  | "modern-bare-react-native"
  | "ambiguous-repo-shape"
  | "unrecognized-app-shape";

export type RnMtHostLanguage = "javascript" | "typescript";

export type RnMtTargetPlatform = "ios" | "android";

interface RnMtManifestLayer {
  config?: Record<string, unknown>;
  flags?: Record<string, unknown>;
  assets?: Record<string, string>;
  routes?: RnMtStaticRegistryLayer<RnMtRouteDefinition>;
  features?: RnMtStaticRegistryLayer<RnMtFeatureDefinition>;
  menus?: RnMtStaticRegistryLayer<RnMtMenuDefinition>;
  actions?: RnMtStaticRegistryLayer<RnMtActionDefinition>;
}

interface RnMtStaticRegistryItem {
  id: string;
  enabledByFlag?: string;
}

export interface RnMtRouteDefinition extends RnMtStaticRegistryItem {
  id: string;
  path: string;
  screen: string;
}

export interface RnMtFeatureDefinition extends RnMtStaticRegistryItem {
  id: string;
  module: string;
}

export interface RnMtMenuDefinition extends RnMtStaticRegistryItem {
  id: string;
  label: string;
  actionId: string;
}

export interface RnMtActionDefinition extends RnMtStaticRegistryItem {
  id: string;
  label: string;
  handler: string;
}

export interface RnMtStaticRegistryLayer<T extends RnMtStaticRegistryItem> {
  add?: T[];
  replace?: T[];
  disable?: string[];
}

export interface RnMtEnvSchemaEntry {
  source?: string;
  required?: boolean;
  secret?: boolean;
}

export type RnMtEnvSource = Record<string, string | undefined>;

interface RnMtResolvedIdentity {
  displayName: string;
  nativeId: string;
}

interface RnMtResolvedTarget {
  tenant: string;
  environment: string;
  platform?: RnMtTargetPlatform;
}

export interface RnMtManifest {
  schemaVersion: 1;
  source: {
    rootDir: string;
  };
  envSchema?: Record<string, RnMtEnvSchemaEntry>;
  config?: Record<string, unknown>;
  flags?: Record<string, unknown>;
  assets?: Record<string, string>;
  routes?: RnMtRouteDefinition[];
  features?: RnMtFeatureDefinition[];
  menus?: RnMtMenuDefinition[];
  actions?: RnMtActionDefinition[];
  defaults: {
    tenant: string;
    environment: string;
  };
  tenants: Record<string, RnMtManifestLayer & { displayName: string }>;
  environments: Record<string, RnMtManifestLayer & { displayName: string }>;
  platforms?: Partial<Record<RnMtTargetPlatform, RnMtManifestLayer>>;
  combinations?: Record<string, RnMtManifestLayer>;
}

export interface RnMtInitResult {
  manifestPath: string;
  manifest: RnMtManifest;
  generatedHostFiles: Array<{
    path: string;
    contents: string;
    language: RnMtHostLanguage;
  }>;
}

export interface RnMtTargetSetResult {
  manifestPath: string;
  manifest: RnMtManifest;
}

export interface RnMtTenantAddResult {
  manifestPath: string;
  manifest: RnMtManifest;
  tenant: {
    id: string;
    displayName: string;
  };
  createdFiles: Array<{
    path: string;
    contents: string;
  }>;
}

export interface RnMtTenantRenameResult {
  manifestPath: string;
  manifest: RnMtManifest;
  tenant: {
    previousId: string;
    id: string;
    displayName: string;
  };
  renamedPaths: Array<{
    fromPath: string;
    toPath: string;
  }>;
  generatedFiles: RnMtSyncGeneratedFile[];
}

export interface RnMtTenantRemoveResult {
  manifestPath: string;
  manifest: RnMtManifest;
  tenant: {
    id: string;
    displayName: string;
  };
  removedPaths: string[];
}

export type RnMtDoctorCheckStatus = "ok" | "warning";

export interface RnMtDoctorCheck {
  code:
    | "expo-distribution-config"
    | "android-release-integration"
    | "ios-release-integration";
  status: RnMtDoctorCheckStatus;
  summary: string;
  details: string[];
}

export interface RnMtDoctorResult {
  rootDir: string;
  checks: RnMtDoctorCheck[];
}

export type RnMtHandoffPreflightCheckStatus = "ok" | "blocked";

export interface RnMtHandoffPreflightCheck {
  code:
    | "target-tenant"
    | "converted-repo"
    | "reconstruction-metadata"
    | "doctor-clean";
  status: RnMtHandoffPreflightCheckStatus;
  summary: string;
  details: string[];
}

export interface RnMtHandoffPreflightResult {
  rootDir: string;
  tenant: {
    id: string;
    displayName: string;
  };
  status: "ready" | "blocked";
  checks: RnMtHandoffPreflightCheck[];
}

export interface RnMtHandoffFlattenedFile {
  sourcePath: string;
  destinationPath: string;
  contents: string;
}

export interface RnMtHandoffFlattenResult {
  rootDir: string;
  tenant: {
    id: string;
    displayName: string;
  };
  restoredFiles: RnMtHandoffFlattenedFile[];
}

export interface RnMtHandoffCleanupFile {
  path: string;
  contents: string;
}

export interface RnMtHandoffCleanupResult {
  rootDir: string;
  rewrittenFiles: RnMtHandoffCleanupFile[];
  removedPaths: string[];
}

export interface RnMtHandoffSanitizedFile {
  path: string;
  contents: string;
}

export interface RnMtHandoffSanitizationResult {
  rootDir: string;
  generatedFiles: RnMtHandoffSanitizedFile[];
  removedPaths: string[];
  reviewRequired: true;
  reviewChecklist: string[];
}

export interface RnMtCodemodPlannedChange {
  path: string;
  before: string;
  after: string;
}

export interface RnMtCodemodResult {
  rootDir: string;
  codemod: "current-imports";
  changes: RnMtCodemodPlannedChange[];
}

export interface RnMtConvertMovedFile {
  sourcePath: string;
  destinationPath: string;
  contents: string;
  removeSourcePath?: boolean;
}

export interface RnMtConvertResult {
  rootDir: string;
  movedFiles: RnMtConvertMovedFile[];
  generatedFiles: RnMtSyncGeneratedFile[];
  userOwnedFiles: Array<{
    path: string;
    contents: string;
  }>;
  packageManager: RnMtBaselineAnalyzeReport["repo"]["packageManager"];
  localPackages: Array<{
    name: string;
    version: string;
    section: "dependencies" | "devDependencies";
  }>;
  installCommand: string | null;
}

export interface RnMtOverrideCreatedFile {
  sourcePath: string;
  destinationPath: string;
  contents: string;
}

export interface RnMtOverrideCreateResult {
  rootDir: string;
  copiedFile: RnMtOverrideCreatedFile;
  generatedFiles: RnMtSyncGeneratedFile[];
}

export interface RnMtOverrideRemoveResult {
  rootDir: string;
  removedFilePath: string;
  generatedFiles: RnMtSyncGeneratedFile[];
}

export type RnMtAuditSeverity = "P0" | "P1" | "P2" | "P3";

export type RnMtAuditConfidence = "low" | "medium" | "high";

export interface RnMtAuditFinding {
  code: "override-candidate" | "other-tenant-residue";
  path: string;
  severity: RnMtAuditSeverity;
  confidence: RnMtAuditConfidence;
  evidence: string[];
  summary: string;
}

export interface RnMtAuditResult {
  rootDir: string;
  findings: RnMtAuditFinding[];
}

export type RnMtGeneratedArtifactKind =
  | "runtime-artifact"
  | "ownership-metadata"
  | "reconstruction-metadata"
  | "repo-readme"
  | "root-wrapper"
  | "current-facade"
  | "host-config-bridge"
  | "derived-asset"
  | "asset-fingerprint-metadata"
  | "expo-target-context"
  | "android-flavor-config"
  | "android-native-identity"
  | "ios-scheme"
  | "ios-xcconfig";

export interface RnMtResolvedRuntimeArtifact {
  config: Record<string, unknown>;
  identity: RnMtResolvedIdentity;
  tenant: {
    id: string;
    displayName: string;
  };
  env: {
    id: string;
  };
  flags: Record<string, unknown>;
  assets: Record<string, string>;
  routes: RnMtRouteDefinition[];
  features: RnMtFeatureDefinition[];
  menus: RnMtMenuDefinition[];
  actions: RnMtActionDefinition[];
}

export interface RnMtSyncGeneratedFile {
  path: string;
  contents: string;
  kind: RnMtGeneratedArtifactKind;
}

interface RnMtDerivedAssetFingerprintRecord {
  outputPath: string;
  platform: RnMtTargetPlatform;
  environment: string;
  sourcePath: string;
  sourceFingerprint: string;
}

interface RnMtDerivedAssetFingerprintMetadata {
  schemaVersion: 1;
  tool: "rn-mt";
  derivedAssets: RnMtDerivedAssetFingerprintRecord[];
}

export type RnMtReconstructionOriginalPathBehavior =
  | "removed"
  | "replaced-with-root-wrapper"
  | "replaced-with-host-config-bridge";

export interface RnMtReconstructionMetadataEntry {
  originalPath: string;
  sharedPath: string;
  currentPath?: string;
  originalPathBehavior: RnMtReconstructionOriginalPathBehavior;
}

export interface RnMtReconstructionMetadataFile {
  schemaVersion: 1;
  tool: "rn-mt";
  defaultTenant: string;
  sharedRootPath: string;
  currentRootPath: string;
  entries: RnMtReconstructionMetadataEntry[];
}

export interface RnMtExpoTargetContextArtifact {
  schemaVersion: 1;
  target: {
    tenant: string;
    environment: string;
    platform?: RnMtTargetPlatform;
  };
  identity: RnMtResolvedIdentity;
  runtimeConfigPath: string;
  iconPath?: string;
}

interface RnMtCliOwnershipMetadataFileRecord {
  path: string;
  kind: string;
  hash?: string;
}

interface RnMtCliOwnershipMetadataFileLike {
  schemaVersion: 1;
  tool: "rn-mt";
  owner: "cli";
  artifacts: RnMtCliOwnershipMetadataFileRecord[];
}

export interface RnMtSyncResult {
  rootDir: string;
  target: {
    tenant: string;
    environment: string;
    platform?: RnMtTargetPlatform;
  };
  resolution: {
    appliedLayers: string[];
  };
  runtime: RnMtResolvedRuntimeArtifact;
  generatedFiles: RnMtSyncGeneratedFile[];
}

export interface RnMtLoadedEnvFile {
  path: string;
  scope: "environment" | "tenant-environment";
}

export interface RnMtSubprocessEnvResult {
  env: RnMtEnvSource;
  loadedFiles: RnMtLoadedEnvFile[];
}

export interface RnMtBaselineAnalyzeReport {
  schemaVersion: 1;
  command: "analyze";
  status: RnMtAnalyzeStatus;
  repo: {
    rootDir: string;
    packageJsonPresent: boolean;
    gitPresent: boolean;
    packageManager: {
      name: RnMtPackageManagerName;
      source: RnMtPackageManagerSource;
      raw: string | null;
    };
    app: {
      kind: RnMtRepoAppKind;
      candidates: RnMtRepoAppKind[];
      evidence: string[];
      remediation: string[];
    };
    support: {
      tier: RnMtSupportTier;
      reasonCodes: RnMtSupportReasonCode[];
    };
    host: {
      language: RnMtHostLanguage;
      evidence: string[];
    };
  };
}

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

function hashText(contents: string) {
  return createHash("sha256").update(contents).digest("hex");
}

function parsePackageManagerName(
  packageManagerField: string | undefined,
): RnMtPackageManagerName {
  const rawName = packageManagerField?.split("@")[0];

  if (
    rawName === "pnpm" ||
    rawName === "npm" ||
    rawName === "yarn" ||
    rawName === "bun"
  ) {
    return rawName;
  }

  return "unknown";
}

function detectPackageManager(rootDir: string): RnMtBaselineAnalyzeReport["repo"]["packageManager"] {
  const packageJsonPath = join(rootDir, "package.json");

  if (existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      packageManager?: string;
    };

    if (packageJson.packageManager) {
      return {
        name: parsePackageManagerName(packageJson.packageManager),
        source: "packageManager-field",
        raw: packageJson.packageManager,
      };
    }
  }

  const lockfileDetectors: Array<{
    fileName: string;
    name: RnMtPackageManagerName;
    source: RnMtPackageManagerSource;
  }> = [
    { fileName: "pnpm-lock.yaml", name: "pnpm", source: "pnpm-lock" },
    { fileName: "package-lock.json", name: "npm", source: "package-lock" },
    { fileName: "yarn.lock", name: "yarn", source: "yarn-lock" },
    { fileName: "bun.lockb", name: "bun", source: "bun-lock" },
  ];

  for (const lockfile of lockfileDetectors) {
    if (existsSync(join(rootDir, lockfile.fileName))) {
      return {
        name: lockfile.name,
        source: lockfile.source,
        raw: lockfile.fileName,
      };
    }
  }

  return {
    name: "unknown",
    source: "none",
    raw: null,
  };
}

function detectAppKind(rootDir: string): RnMtBaselineAnalyzeReport["repo"]["app"] {
  const evidence: string[] = [];
  const packageJsonPath = join(rootDir, "package.json");
  const appJsonPath = join(rootDir, "app.json");
  const appConfigJsPath = join(rootDir, "app.config.js");
  const appConfigTsPath = join(rootDir, "app.config.ts");
  const iosPath = join(rootDir, "ios");
  const androidPath = join(rootDir, "android");
  let hasReactNativeDependency = false;

  if (existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    if (packageJson.dependencies?.expo || packageJson.devDependencies?.expo) {
      evidence.push("package.json includes expo dependency");
    }

    if (
      packageJson.dependencies?.["react-native"] ||
      packageJson.devDependencies?.["react-native"]
    ) {
      hasReactNativeDependency = true;
    }
  }

  if (existsSync(appJsonPath)) {
    evidence.push("app.json present");
  }

  if (existsSync(appConfigJsPath)) {
    evidence.push("app.config.js present");
  }

  if (existsSync(appConfigTsPath)) {
    evidence.push("app.config.ts present");
  }

  const hasExpoSignals = evidence.length > 0;
  const hasNativeFolders = existsSync(iosPath) || existsSync(androidPath);
  const expoCandidates: RnMtRepoAppKind[] = [];

  if (hasExpoSignals && !hasNativeFolders) {
    expoCandidates.push("expo-managed");
  }

  if (hasExpoSignals && hasNativeFolders) {
    expoCandidates.push("expo-prebuild");
  }

  if (hasExpoSignals && !existsSync(appJsonPath)) {
    expoCandidates.push("expo-managed");
    expoCandidates.push("expo-prebuild");
  }

  const uniqueExpoCandidates = [...new Set(expoCandidates)];

  if (uniqueExpoCandidates.length > 1) {
    return {
      kind: "unknown",
      candidates: uniqueExpoCandidates,
      evidence,
      remediation: [
        "Run analyze interactively and choose the intended Expo repo shape.",
        "Add or remove ios/android folders so the repo shape is unambiguous.",
        "Add app.json when this repo should be treated as Expo managed.",
      ],
    };
  }

  if (uniqueExpoCandidates[0] === "expo-managed") {
    return {
      kind: "expo-managed",
      candidates: ["expo-managed"],
      evidence,
      remediation: [],
    };
  }

  if (uniqueExpoCandidates[0] === "expo-prebuild") {
    if (existsSync(iosPath)) {
      evidence.push("ios directory present");
    }

    if (existsSync(androidPath)) {
      evidence.push("android directory present");
    }

    return {
      kind: "expo-prebuild",
      candidates: ["expo-prebuild"],
      evidence,
      remediation: [],
    };
  }

  if (hasReactNativeDependency && hasNativeFolders) {
    evidence.push("package.json includes react-native dependency");

    if (existsSync(iosPath)) {
      evidence.push("ios directory present");
    }

    if (existsSync(androidPath)) {
      evidence.push("android directory present");
    }

    return {
      kind: "bare-react-native",
      candidates: ["bare-react-native"],
      evidence,
      remediation: [],
    };
  }

  if (hasReactNativeDependency) {
    evidence.push("package.json includes react-native dependency");
  }

  return {
    kind: "unknown",
    candidates: ["unknown"],
    evidence,
    remediation: [],
  };
}

function resolveAnalyzeRootDir(
  startDir: string,
  options: {
    scopeToProvidedRoot?: boolean;
  } = {},
) {
  if (options.scopeToProvidedRoot) {
    return startDir;
  }

  let currentDir = startDir;
  let gitRoot: string | null = null;

  while (true) {
    if (existsSync(join(currentDir, ".git"))) {
      gitRoot = currentDir;
    }

    const parentDir = dirname(currentDir);

    if (parentDir === currentDir) {
      break;
    }

    currentDir = parentDir;
  }

  return gitRoot ?? startDir;
}

function detectSupportTier(
  app: RnMtBaselineAnalyzeReport["repo"]["app"],
): RnMtBaselineAnalyzeReport["repo"]["support"] {
  if (app.kind === "expo-managed") {
    return {
      tier: "supported",
      reasonCodes: ["modern-expo-managed"],
    };
  }

  if (app.kind === "expo-prebuild") {
    return {
      tier: "supported",
      reasonCodes: ["modern-expo-prebuild"],
    };
  }

  if (app.kind === "bare-react-native") {
    return {
      tier: "supported",
      reasonCodes: ["modern-bare-react-native"],
    };
  }

  if (app.candidates.length > 1) {
    return {
      tier: "near-supported",
      reasonCodes: ["ambiguous-repo-shape"],
    };
  }

  return {
    tier: "unsupported",
    reasonCodes: ["unrecognized-app-shape"],
  };
}

function detectHostLanguage(
  rootDir: string,
): RnMtBaselineAnalyzeReport["repo"]["host"] {
  const candidateFiles = [
    { path: join(rootDir, "tsconfig.json"), language: "typescript" as const, evidence: "tsconfig.json present" },
    { path: join(rootDir, "App.tsx"), language: "typescript" as const, evidence: "App.tsx present" },
    { path: join(rootDir, "index.ts"), language: "typescript" as const, evidence: "index.ts present" },
    { path: join(rootDir, "index.tsx"), language: "typescript" as const, evidence: "index.tsx present" },
  ];

  for (const candidate of candidateFiles) {
    if (existsSync(candidate.path)) {
      return {
        language: candidate.language,
        evidence: [candidate.evidence],
      };
    }
  }

  return {
    language: "javascript",
    evidence: ["defaulted to javascript host files"],
  };
}

function createJavaScriptHostFile(rootDir: string) {
  return {
    path: join(rootDir, "rn-mt.generated.js"),
    language: "javascript" as const,
    contents: [
      "// Generated by rn-mt. Do not edit directly.",
      "// This file gives JavaScript repos a stable host-facing entry point.",
      "",
      "export const rnMtHostLanguage = 'javascript'",
      "",
    ].join("\n"),
  };
}

function createTypeScriptHostFile(rootDir: string) {
  return {
    path: join(rootDir, "rn-mt.generated.ts"),
    language: "typescript" as const,
    contents: [
      "// Generated by rn-mt. Do not edit directly.",
      "// This file gives TypeScript repos a stable host-facing entry point.",
      "",
      "export const rnMtHostLanguage = 'typescript' as const",
      "",
    ].join("\n"),
  };
}

const convertibleRootEntryFiles = [
  "App.tsx",
  "App.ts",
  "App.jsx",
  "App.js",
  "index.tsx",
  "index.ts",
  "index.jsx",
  "index.js",
] as const;

const rootWrapperBanner =
  "// Generated by rn-mt. CLI-owned wrapper. Do not edit directly.";
const convertCategoryDirNames = ["config", "theme", "assets", "__tests__", "tests"] as const;

interface RnMtAliasRule {
  specifierPrefix: string;
  targetBasePath: string;
}

function isTestModuleFileName(fileName: string) {
  return /\.(test|spec)\.[^.]+$/u.test(fileName);
}

function walkDirectoryFiles(directoryPath: string): string[] {
  const entries = readdirSync(directoryPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkDirectoryFiles(entryPath));
      continue;
    }

    if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

function isAuditableTextFile(path: string) {
  return /\.(ts|tsx|js|jsx|json|md|txt)$/u.test(path);
}

function getConvertCategoryFilePaths(rootDir: string) {
  const categoryFilePaths = new Set<string>();
  const candidateBases = [rootDir, join(rootDir, "src")];

  for (const basePath of candidateBases) {
    if (!existsSync(basePath) || !statSync(basePath).isDirectory()) {
      continue;
    }

    for (const entry of readdirSync(basePath, { withFileTypes: true })) {
      if (basePath.endsWith("/src") && entry.name === "rn-mt") {
        continue;
      }

      const entryPath = join(basePath, entry.name);

      if (entry.isDirectory() && convertCategoryDirNames.includes(entry.name as typeof convertCategoryDirNames[number])) {
        for (const filePath of walkDirectoryFiles(entryPath)) {
          categoryFilePaths.add(filePath);
        }
      }

      if (
        entry.isFile() &&
        (convertCategoryDirNames.some((name) => entry.name === `${name}.ts` || entry.name === `${name}.tsx` || entry.name === `${name}.js` || entry.name === `${name}.jsx` || entry.name === `${name}.json`) ||
          isTestModuleFileName(entry.name))
      ) {
        categoryFilePaths.add(entryPath);
      }
    }
  }

  return [...categoryFilePaths].sort((left, right) => left.localeCompare(right));
}

function getAliasRules(rootDir: string): RnMtAliasRule[] {
  const tsconfigPath = join(rootDir, "tsconfig.json");

  if (!existsSync(tsconfigPath)) {
    return [];
  }

  const tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf8")) as {
    compilerOptions?: {
      baseUrl?: string;
      paths?: Record<string, string[]>;
    };
  };
  const baseUrl = tsconfig.compilerOptions?.baseUrl ?? ".";
  const paths = tsconfig.compilerOptions?.paths ?? {};

  return Object.entries(paths)
    .flatMap(([key, targets]) => {
      const firstTarget = targets[0];

      if (!firstTarget || !key.endsWith("/*") || !firstTarget.endsWith("/*")) {
        return [];
      }

      return [
        {
          specifierPrefix: key.slice(0, -1),
          targetBasePath: join(rootDir, baseUrl, firstTarget.slice(0, -1)),
        },
      ];
    })
    .sort((left, right) => right.specifierPrefix.length - left.specifierPrefix.length);
}

function getConvertibleRootEntryFiles(
  rootDir: string,
  options: {
    fileExists?: (path: string) => boolean;
    readFile?: (path: string) => string;
  } = {},
) {
  const fileExists = options.fileExists ?? existsSync;
  const readFile = options.readFile ?? ((path: string) => readFileSync(path, "utf8"));

  return convertibleRootEntryFiles
    .map((fileName) => {
      const path = join(rootDir, fileName);

      if (!fileExists(path)) {
        return null;
      }

      return {
        fileName,
        path,
        contents: readFile(path),
      };
    })
    .filter((entry): entry is {
      fileName: typeof convertibleRootEntryFiles[number];
      path: string;
      contents: string;
    } => entry !== null);
}

function createRootWrapperContents(fileName: string) {
  if (fileName.startsWith("App.")) {
    return [
      rootWrapperBanner,
      'import App from "./src/rn-mt/current/App";',
      "",
      "export default App;",
      "",
    ].join("\n");
  }

  return [
    rootWrapperBanner,
    'import "./src/rn-mt/current/index";',
    "",
  ].join("\n");
}

function stripSupportedSourceExtension(path: string) {
  return path.replace(/\.(ts|tsx|js|jsx)$/u, "");
}

function normalizeImportPath(path: string) {
  const normalized = path.replace(/\\/gu, "/");
  return normalized.startsWith(".") ? normalized : `./${normalized}`;
}

function hasDefaultExportSyntax(sourceContents: string) {
  return (
    /export\s+default\b/u.test(sourceContents) ||
    /module\.exports\s*=/u.test(sourceContents) ||
    /export\s*=\s*/u.test(sourceContents)
  );
}

function isFacadeSourceFile(path: string) {
  return /\.(ts|tsx|js|jsx)$/u.test(path);
}

function isTestSourcePath(path: string) {
  return /(\.test\.|\.spec\.|\/__tests__\/|\/tests\/)/u.test(path.replace(/\\/gu, "/"));
}

function createCurrentFacadeModuleContents(
  targetImportPath: string,
  sourceContents: string,
  relativeSharedPath: string,
) {
  const header = "// Generated by rn-mt. CLI-owned current facade. Do not edit directly.";

  if (/^index\.(ts|tsx|js|jsx)$/u.test(relativeSharedPath)) {
    return [
      header,
      `import "${targetImportPath}";`,
      "",
    ].join("\n");
  }

  const lines = [header];

  if (hasDefaultExportSyntax(sourceContents)) {
    lines.push(`export { default } from "${targetImportPath}";`);
  }

  lines.push(`export * from "${targetImportPath}";`, "");
  return lines.join("\n");
}

function createBridgeFacadeModuleContents(
  targetImportPath: string,
  sourceContents: string,
) {
  const lines = [
    "// Generated by rn-mt. CLI-owned host config bridge. Optional bridge mode. Do not edit directly.",
  ];

  if (hasDefaultExportSyntax(sourceContents)) {
    lines.push(`export { default } from "${targetImportPath}";`);
  }

  lines.push(`export * from "${targetImportPath}";`, "");
  return lines.join("\n");
}

function createHostConfigBridgeFile(
  rootDir: string,
  sourcePath: string,
  movedDestinationPath: string,
  sourceContents: string,
): RnMtSyncGeneratedFile {
  const sharedRootDir = getSharedRootDir(rootDir);
  const relativeSharedPath = movedDestinationPath.slice(sharedRootDir.length + 1);
  const currentFacadePath = join(getCurrentRootDir(rootDir), relativeSharedPath);
  const importPath = normalizeImportPath(
    stripSupportedSourceExtension(relative(dirname(sourcePath), currentFacadePath)),
  );

  return {
    path: sourcePath,
    kind: "host-config-bridge",
    contents: createBridgeFacadeModuleContents(importPath, sourceContents),
  };
}

function createRuntimeFacadeContents(hostLanguage: RnMtHostLanguage) {
  const importLine =
    hostLanguage === "typescript"
      ? 'import runtime from "../../../rn-mt.generated.runtime.json";'
      : 'import runtime from "../../../rn-mt.generated.runtime.json";';

  return [
    "// Generated by rn-mt. CLI-owned current runtime facade. Do not edit directly.",
    importLine,
    'import { createRuntimeAccessors } from "@rn-mt/runtime";',
    "",
    "const runtimeAccessors = createRuntimeAccessors(runtime);",
    "",
    "export const getConfig = runtimeAccessors.getConfig;",
    "export const getTenant = runtimeAccessors.getTenant;",
    "export const getEnv = runtimeAccessors.getEnv;",
    "export const getFlags = runtimeAccessors.getFlags;",
    "export const getAssets = runtimeAccessors.getAssets;",
    "export const getRoutes = runtimeAccessors.getRoutes;",
    "export const getFeatures = runtimeAccessors.getFeatures;",
    "export const getMenus = runtimeAccessors.getMenus;",
    "export const getActions = runtimeAccessors.getActions;",
    "",
    "export default runtimeAccessors;",
    "",
  ].join("\n");
}

interface RnMtPackageJsonLike {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  packageManager?: string;
}

function getRnMtPackageVersion() {
  const packageJsonPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "package.json",
  );
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    version?: string;
  };

  return packageJson.version ?? "0.1.0";
}

function getLocalRnMtPackagePlan(rootDir: string) {
  const version = getRnMtPackageVersion();
  const appKind = detectAppKind(rootDir).kind;
  const localPackages: Array<{
    name: string;
    version: string;
    section: "dependencies" | "devDependencies";
  }> = [
    {
      name: "@rn-mt/runtime",
      version,
      section: "dependencies",
    },
    {
      name: "@rn-mt/cli",
      version,
      section: "devDependencies",
    },
  ];

  if (appKind === "expo-managed" || appKind === "expo-prebuild") {
    localPackages.push({
      name: "@rn-mt/expo-plugin",
      version,
      section: "dependencies",
    });
  }

  return localPackages;
}

function createInstallCommand(
  packageManager: RnMtBaselineAnalyzeReport["repo"]["packageManager"],
) {
  if (packageManager.name === "pnpm") {
    return "pnpm install";
  }

  if (packageManager.name === "yarn") {
    return "yarn install";
  }

  if (packageManager.name === "bun") {
    return "bun install";
  }

  if (packageManager.name === "npm") {
    return "npm install";
  }

  return null;
}

function getDefaultWorkflowScripts(rootDir: string) {
  const appKind = detectAppKind(rootDir).kind;

  if (appKind === "expo-managed") {
    return {
      start: "expo start",
      android: "expo start --android",
      ios: "expo start --ios",
    };
  }

  if (appKind === "expo-prebuild") {
    return {
      start: "expo start --dev-client",
      android: "expo run:android",
      ios: "expo run:ios",
    };
  }

  return {
    start: "react-native start",
    android: "react-native run-android",
    ios: "react-native run-ios",
  };
}

function createRunHelperScript(command: string, options: { platform?: RnMtTargetPlatform } = {}) {
  return options.platform
    ? `rn-mt run --platform ${options.platform} -- ${command}`
    : `rn-mt run -- ${command}`;
}

function chainPackageScript(
  existingCommand: string | undefined,
  generatedCommand: string,
) {
  if (!existingCommand || existingCommand.trim().length === 0) {
    return generatedCommand;
  }

  return `${existingCommand} && ${generatedCommand}`;
}

function createConvertedPackageJsonContents(
  rootDir: string,
  packageJsonContents: string,
) {
  const parsedPackageJson = JSON.parse(packageJsonContents) as RnMtPackageJsonLike;
  const existingScripts = parsedPackageJson.scripts ?? {};
  const existingDependencies = parsedPackageJson.dependencies ?? {};
  const existingDevDependencies = parsedPackageJson.devDependencies ?? {};
  const defaultScripts = getDefaultWorkflowScripts(rootDir);
  const hostStartScript = existingScripts.start ?? defaultScripts.start;
  const hostAndroidScript = existingScripts.android ?? defaultScripts.android;
  const hostIosScript = existingScripts.ios ?? defaultScripts.ios;
  const localPackages = getLocalRnMtPackagePlan(rootDir);
  const dependencies = { ...existingDependencies };
  const devDependencies = { ...existingDevDependencies };

  for (const localPackage of localPackages) {
    if (localPackage.section === "dependencies") {
      dependencies[localPackage.name] = localPackage.version;
    } else {
      devDependencies[localPackage.name] = localPackage.version;
    }
  }

  return `${JSON.stringify(
    {
      ...parsedPackageJson,
      dependencies,
      devDependencies,
      scripts: {
        ...existingScripts,
        start: createRunHelperScript(hostStartScript),
        android: createRunHelperScript(hostAndroidScript, { platform: "android" }),
        ios: createRunHelperScript(hostIosScript, { platform: "ios" }),
        prestart: chainPackageScript(existingScripts.prestart, "rn-mt hook prestart"),
        preandroid: chainPackageScript(existingScripts.preandroid, "rn-mt hook preandroid"),
        preios: chainPackageScript(existingScripts.preios, "rn-mt hook preios"),
        postinstall: chainPackageScript(
          existingScripts.postinstall,
          "rn-mt hook postinstall",
        ),
        "rn-mt:sync": "rn-mt sync",
        "rn-mt:sync:android": "rn-mt sync --platform android",
        "rn-mt:sync:ios": "rn-mt sync --platform ios",
        "rn-mt:start": createRunHelperScript(hostStartScript),
        "rn-mt:android": createRunHelperScript(hostAndroidScript, { platform: "android" }),
        "rn-mt:ios": createRunHelperScript(hostIosScript, { platform: "ios" }),
      },
    },
    null,
    2,
  )}\n`;
}

function unwrapRunHelperScript(command: string | undefined) {
  if (!command) {
    return undefined;
  }

  const platformMatch = command.match(/^rn-mt run --platform (android|ios) -- (.+)$/u);

  if (platformMatch) {
    return platformMatch[2];
  }

  const directMatch = command.match(/^rn-mt run -- (.+)$/u);

  return directMatch?.[1] ?? command;
}

function removeGeneratedHookScript(command: string | undefined, generatedCommand: string) {
  if (!command || command.trim().length === 0) {
    return undefined;
  }

  const segments = command
    .split("&&")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && segment !== generatedCommand);

  return segments.length > 0 ? segments.join(" && ") : undefined;
}

function createStandalonePackageJsonContents(
  rootDir: string,
  packageJsonContents: string,
) {
  const parsedPackageJson = JSON.parse(packageJsonContents) as RnMtPackageJsonLike;
  const existingScripts = parsedPackageJson.scripts ?? {};
  const defaultScripts = getDefaultWorkflowScripts(rootDir);
  const dependencies = { ...(parsedPackageJson.dependencies ?? {}) };
  const devDependencies = { ...(parsedPackageJson.devDependencies ?? {}) };

  for (const localPackage of getLocalRnMtPackagePlan(rootDir)) {
    if (localPackage.section === "dependencies") {
      delete dependencies[localPackage.name];
    } else {
      delete devDependencies[localPackage.name];
    }
  }

  const scripts: Record<string, string> = { ...existingScripts };
  const restoredStartScript = unwrapRunHelperScript(
    existingScripts["rn-mt:start"] ?? existingScripts.start ?? defaultScripts.start,
  );
  const restoredAndroidScript = unwrapRunHelperScript(
    existingScripts["rn-mt:android"] ?? existingScripts.android ?? defaultScripts.android,
  );
  const restoredIosScript = unwrapRunHelperScript(
    existingScripts["rn-mt:ios"] ?? existingScripts.ios ?? defaultScripts.ios,
  );

  if (restoredStartScript) {
    scripts.start = restoredStartScript;
  }

  if (restoredAndroidScript) {
    scripts.android = restoredAndroidScript;
  }

  if (restoredIosScript) {
    scripts.ios = restoredIosScript;
  }

  const cleanedPrestart = removeGeneratedHookScript(
    existingScripts.prestart,
    "rn-mt hook prestart",
  );
  const cleanedPreandroid = removeGeneratedHookScript(
    existingScripts.preandroid,
    "rn-mt hook preandroid",
  );
  const cleanedPreios = removeGeneratedHookScript(existingScripts.preios, "rn-mt hook preios");
  const cleanedPostinstall = removeGeneratedHookScript(
    existingScripts.postinstall,
    "rn-mt hook postinstall",
  );

  if (cleanedPrestart) {
    scripts.prestart = cleanedPrestart;
  } else {
    delete scripts.prestart;
  }

  if (cleanedPreandroid) {
    scripts.preandroid = cleanedPreandroid;
  } else {
    delete scripts.preandroid;
  }

  if (cleanedPreios) {
    scripts.preios = cleanedPreios;
  } else {
    delete scripts.preios;
  }

  if (cleanedPostinstall) {
    scripts.postinstall = cleanedPostinstall;
  } else {
    delete scripts.postinstall;
  }

  delete scripts["rn-mt:sync"];
  delete scripts["rn-mt:sync:android"];
  delete scripts["rn-mt:sync:ios"];
  delete scripts["rn-mt:start"];
  delete scripts["rn-mt:android"];
  delete scripts["rn-mt:ios"];

  const nextPackageJson: RnMtPackageJsonLike = {
    ...parsedPackageJson,
    scripts,
  };

  if (Object.keys(dependencies).length > 0) {
    nextPackageJson.dependencies = dependencies;
  } else {
    delete nextPackageJson.dependencies;
  }

  if (Object.keys(devDependencies).length > 0) {
    nextPackageJson.devDependencies = devDependencies;
  } else {
    delete nextPackageJson.devDependencies;
  }

  return `${JSON.stringify(nextPackageJson, null, 2)}\n`;
}

function getSharedRootDir(rootDir: string) {
  return join(rootDir, "src", "rn-mt", "shared");
}

function getTenantRootDir(rootDir: string, tenantId: string) {
  return join(rootDir, "src", "rn-mt", "tenants", tenantId);
}

function getCurrentRootDir(rootDir: string) {
  return join(rootDir, "src", "rn-mt", "current");
}

function getExtensionsRootDir(rootDir: string) {
  return join(rootDir, "src", "rn-mt", "extensions");
}

function createUserOwnedExtensionContents(hostLanguage: RnMtHostLanguage) {
  return [
    "// User-owned rn-mt extension module. Safe to edit.",
    "// Add custom helpers here instead of editing CLI-owned generated files.",
    hostLanguage === "typescript"
      ? "export const rnMtExtensions = {} as const;"
      : "export const rnMtExtensions = {};",
    "",
  ].join("\n");
}

function createRepoLocalGuideContents() {
  return [
    "# rn-mt Ownership and Handoff Guide",
    "",
    "## CLI-owned files",
    "",
    "Do not edit rn-mt generated files directly. Re-run `rn-mt convert`, `rn-mt sync`, or other rn-mt commands instead.",
    "",
    "Common CLI-owned paths in this repo:",
    "",
    "- Root wrapper files such as `App.tsx`, `App.js`, `index.ts`, or `index.js` after conversion",
    "- `src/rn-mt/current/**` current facades",
    "- `rn-mt.generated.convert.ownership.json`",
    "- `rn-mt.generated.reconstruction.json`",
    "- `rn-mt.generated.runtime.json`",
    "- `rn-mt.generated.ownership.json`",
    "- Generated native include files, Expo bridge files, and derived assets written by `rn-mt sync`",
    "",
    "## User-owned files",
    "",
    "Make product changes in the user-owned surfaces:",
    "",
    "- `rn-mt.config.json`",
    "- `src/rn-mt/shared/**`",
    "- `src/rn-mt/tenants/**`",
    "- `src/rn-mt/extensions/**`",
    "",
    "Use `rn-mt override create <path>` when a shared file needs a tenant-specific override.",
    "",
    "## Handoff expectations",
    "",
    "A future `rn-mt handoff --tenant <id>` flow is expected to:",
    "",
    "- Create a new sibling output repo instead of mutating this workspace in place",
    "- Remove rn-mt-specific machinery from the delivered tenant repo",
    "- Strip git history by default and sanitize env files before delivery",
    "- Depend on a healthy repo with clean sync output and a clean audit result",
    "",
  ].join("\n");
}

function createRepoLocalGuideLinkSection() {
  return [
    "<!-- rn-mt:guide-link:start -->",
    "## rn-mt",
    "",
    "See [rn-mt ownership and handoff guide](./rn-mt.generated.README.md) for CLI-owned files, user-owned extension points, and handoff expectations.",
    "<!-- rn-mt:guide-link:end -->",
    "",
  ].join("\n");
}

function addRepoLocalGuideLinkToReadme(readmeContents: string) {
  const linkSection = createRepoLocalGuideLinkSection();
  const normalizedContents = readmeContents.trimEnd();
  const startMarker = "<!-- rn-mt:guide-link:start -->";
  const endMarker = "<!-- rn-mt:guide-link:end -->";
  const existingStartIndex = normalizedContents.indexOf(startMarker);
  const existingEndIndex = normalizedContents.indexOf(endMarker);

  if (existingStartIndex !== -1 && existingEndIndex !== -1 && existingEndIndex > existingStartIndex) {
    return `${normalizedContents.slice(0, existingStartIndex)}${linkSection}${normalizedContents.slice(existingEndIndex + endMarker.length).replace(/^\n*/u, "")}`.replace(/\n{3,}/gu, "\n\n");
  }

  if (normalizedContents.length === 0) {
    return linkSection;
  }

  return `${normalizedContents}\n\n${linkSection}`;
}

function removeRepoLocalGuideLinkFromReadme(readmeContents: string) {
  const normalizedContents = readmeContents.trimEnd();
  const startMarker = "<!-- rn-mt:guide-link:start -->";
  const endMarker = "<!-- rn-mt:guide-link:end -->";
  const existingStartIndex = normalizedContents.indexOf(startMarker);
  const existingEndIndex = normalizedContents.indexOf(endMarker);

  if (
    existingStartIndex === -1 ||
    existingEndIndex === -1 ||
    existingEndIndex < existingStartIndex
  ) {
    return `${normalizedContents}\n`;
  }

  const before = normalizedContents.slice(0, existingStartIndex).trimEnd();
  const after = normalizedContents
    .slice(existingEndIndex + endMarker.length)
    .trimStart();
  const nextContents = [before, after].filter((segment) => segment.length > 0).join("\n\n");

  return `${nextContents.trimEnd()}\n`;
}

function isSupportedBridgeConfigPath(rootDir: string, sourcePath: string) {
  const relativeSourcePath = relative(rootDir, sourcePath).replace(/\\/gu, "/");
  const pathSegments = relativeSourcePath.split("/");
  const fileName = pathSegments[pathSegments.length - 1] ?? "";

  return (
    pathSegments.includes("config") ||
    /^config\.(ts|tsx|js|jsx|json)$/u.test(fileName)
  );
}

function resolveBridgeConfigModulePath(
  rootDir: string,
  selectedPath: string | null | undefined,
  options: {
    fileExists?: (path: string) => boolean;
  } = {},
) {
  if (!selectedPath) {
    return null;
  }

  const fileExists = options.fileExists ?? existsSync;
  const candidatePath = selectedPath.startsWith(rootDir)
    ? selectedPath
    : join(rootDir, selectedPath);
  const relativeSelectedPath = relative(rootDir, candidatePath);

  if (relativeSelectedPath.startsWith("..") || !fileExists(candidatePath) || !statSync(candidatePath).isFile()) {
    throw new Error(`Bridge config module not found: ${candidatePath}`);
  }

  if (!isFacadeSourceFile(candidatePath) || !isSupportedBridgeConfigPath(rootDir, candidatePath)) {
    throw new Error(
      `Bridge mode only supports explicit host config modules. Received: ${candidatePath}`,
    );
  }

  return candidatePath;
}

function createCurrentFacadeFile(
  rootDir: string,
  tenantId: string,
  sharedFile: { path: string; contents: string },
  options: {
    preferShared?: boolean;
    overrideFile?: {
      path: string;
      contents: string;
    };
  } = {},
): RnMtSyncGeneratedFile {
  const sharedRootDir = getSharedRootDir(rootDir);
  const relativeSharedPath = sharedFile.path.slice(sharedRootDir.length + 1);
  const tenantOverridePath = join(getTenantRootDir(rootDir, tenantId), relativeSharedPath);
  const facadePath = join(getCurrentRootDir(rootDir), relativeSharedPath);
  const overrideFile = options.overrideFile;
  const preferShared = options.preferShared ?? false;
  const resolvedSourcePath = overrideFile?.path
    ? overrideFile.path
    : !preferShared && existsSync(tenantOverridePath)
      ? tenantOverridePath
      : sharedFile.path;
  const resolvedSourceContents = overrideFile?.contents
    ?? (resolvedSourcePath === sharedFile.path
      ? sharedFile.contents
      : readFileSync(resolvedSourcePath, "utf8"));
  const importPath = normalizeImportPath(
    stripSupportedSourceExtension(relative(dirname(facadePath), resolvedSourcePath)),
  );

  return isFacadeSourceFile(sharedFile.path)
    ? {
        path: facadePath,
        kind: "current-facade",
        contents: createCurrentFacadeModuleContents(
          importPath,
          resolvedSourceContents,
          relativeSharedPath,
        ),
      }
    : {
        path: facadePath,
        kind: "current-facade",
        contents: resolvedSourceContents,
      };
}

function createCurrentFacadeFiles(
  rootDir: string,
  tenantId: string,
  sharedFiles: Array<{ path: string; contents: string }>,
) {
  const facadeFiles: RnMtSyncGeneratedFile[] = [];

  for (const sharedFile of sharedFiles) {
    if (isTestSourcePath(sharedFile.path)) {
      continue;
    }

    facadeFiles.push(createCurrentFacadeFile(rootDir, tenantId, sharedFile));
  }

  const hostLanguage = detectHostLanguage(rootDir).language;
  facadeFiles.push({
    path: join(rootDir, "src", "rn-mt", "current", hostLanguage === "typescript" ? "runtime.ts" : "runtime.js"),
    kind: "current-facade",
    contents: createRuntimeFacadeContents(hostLanguage),
  });

  return facadeFiles;
}

function getRelativeImportResolutionCandidates(basePath: string) {
  const directCandidates = [basePath];
  const extensionCandidates = [".ts", ".tsx", ".js", ".jsx", ".json", ".png", ".jpg", ".jpeg", ".svg"];
  const indexCandidates = extensionCandidates.map((extension) => join(basePath, `index${extension}`));

  return [
    ...directCandidates,
    ...extensionCandidates.map((extension) => `${basePath}${extension}`),
    ...indexCandidates,
  ];
}

function resolveImportTarget(
  rootDir: string,
  sourcePath: string,
  specifier: string,
  fileExists: (path: string) => boolean,
  aliasRules: RnMtAliasRule[],
) {
  const resolvedBasePath = specifier.startsWith(".")
    ? join(dirname(sourcePath), specifier)
    : (() => {
        const aliasRule = aliasRules.find((rule) => specifier.startsWith(rule.specifierPrefix));

        if (!aliasRule) {
          return null;
        }

        return join(aliasRule.targetBasePath, specifier.slice(aliasRule.specifierPrefix.length));
      })();

  if (!resolvedBasePath) {
    return null;
  }

  for (const candidate of getRelativeImportResolutionCandidates(resolvedBasePath)) {
    if (fileExists(candidate) && statSync(candidate).isFile()) {
      return {
        resolvedPath: candidate,
        aliasRule: aliasRules.find((rule) => specifier.startsWith(rule.specifierPrefix)) ?? null,
      };
    }
  }

  return null;
}

function rewriteMovedSourceContents(
  rootDir: string,
  sourcePath: string,
  destinationPath: string,
  contents: string,
  currentPathBySourcePath: Map<string, string>,
  fileExists: (path: string) => boolean,
  aliasRules: RnMtAliasRule[],
) {
  const replaceSpecifier = (specifier: string) => {
    if (!specifier.startsWith(".") && !aliasRules.some((rule) => specifier.startsWith(rule.specifierPrefix))) {
      return specifier;
    }

    const resolvedTarget = resolveImportTarget(
      rootDir,
      sourcePath,
      specifier,
      fileExists,
      aliasRules,
    );

    if (!resolvedTarget) {
      return specifier;
    }

    const currentTargetPath = currentPathBySourcePath.get(resolvedTarget.resolvedPath);

    if (!currentTargetPath) {
      return specifier;
    }

    if (
      resolvedTarget.aliasRule &&
      currentTargetPath.startsWith(resolvedTarget.aliasRule.targetBasePath)
    ) {
      const aliasRelativePath = currentTargetPath.slice(resolvedTarget.aliasRule.targetBasePath.length);

      return /\.(png|jpg|jpeg|svg|json)$/u.test(resolvedTarget.resolvedPath)
        ? `${resolvedTarget.aliasRule.specifierPrefix}${aliasRelativePath.replace(/^[/\\]/u, "")}`
        : `${resolvedTarget.aliasRule.specifierPrefix}${stripSupportedSourceExtension(aliasRelativePath).replace(/^[/\\]/u, "")}`;
    }

    const rewrittenSpecifier = normalizeImportPath(
      stripSupportedSourceExtension(relative(dirname(destinationPath), currentTargetPath)),
    );

    return /\.(png|jpg|jpeg|svg|json)$/u.test(resolvedTarget.resolvedPath)
      ? normalizeImportPath(relative(dirname(destinationPath), currentTargetPath))
      : rewrittenSpecifier;
  };

  return contents
    .replace(/(from\s+["'])([^"']+)(["'])/gu, (_, prefix, specifier, suffix) => {
      return `${prefix}${replaceSpecifier(specifier)}${suffix}`;
    })
    .replace(/(import\s+["'])([^"']+)(["'])/gu, (_, prefix, specifier, suffix) => {
      return `${prefix}${replaceSpecifier(specifier)}${suffix}`;
    })
    .replace(/(require\(\s*["'])([^"']+)(["']\s*\))/gu, (_, prefix, specifier, suffix) => {
      return `${prefix}${replaceSpecifier(specifier)}${suffix}`;
    });
}

function rewriteHandoffSourceContents(
  rootDir: string,
  sourcePath: string,
  destinationPath: string,
  contents: string,
  originalPathByCurrentPath: Map<string, string>,
  fileExists: (path: string) => boolean,
  aliasRules: RnMtAliasRule[],
) {
  const collapseIndexSpecifier = (specifier: string) => {
    return specifier.endsWith("/index")
      ? specifier.slice(0, -"/index".length) || "."
      : specifier;
  };

  const replaceSpecifier = (specifier: string) => {
    if (
      !specifier.startsWith(".") &&
      !aliasRules.some((rule) => specifier.startsWith(rule.specifierPrefix))
    ) {
      return specifier;
    }

    const resolvedTarget = resolveImportTarget(
      rootDir,
      sourcePath,
      specifier,
      fileExists,
      aliasRules,
    );

    if (!resolvedTarget) {
      return specifier;
    }

    const originalTargetPath = originalPathByCurrentPath.get(resolvedTarget.resolvedPath);

    if (!originalTargetPath) {
      return specifier;
    }

    if (
      resolvedTarget.aliasRule &&
      originalTargetPath.startsWith(resolvedTarget.aliasRule.targetBasePath)
    ) {
      const aliasRelativePath = originalTargetPath.slice(
        resolvedTarget.aliasRule.targetBasePath.length,
      );

      return /\.(png|jpg|jpeg|svg|json)$/u.test(originalTargetPath)
        ? `${resolvedTarget.aliasRule.specifierPrefix}${aliasRelativePath.replace(/^[/\\]/u, "")}`
        : `${resolvedTarget.aliasRule.specifierPrefix}${collapseIndexSpecifier(
            stripSupportedSourceExtension(aliasRelativePath).replace(/^[/\\]/u, ""),
          )}`;
    }

    const rewrittenSpecifier = collapseIndexSpecifier(
      normalizeImportPath(
        stripSupportedSourceExtension(relative(dirname(destinationPath), originalTargetPath)),
      ),
    );

    return /\.(png|jpg|jpeg|svg|json)$/u.test(originalTargetPath)
      ? normalizeImportPath(relative(dirname(destinationPath), originalTargetPath))
      : rewrittenSpecifier;
  };

  return contents
    .replace(/(from\s+["'])([^"']+)(["'])/gu, (_, prefix, specifier, suffix) => {
      return `${prefix}${replaceSpecifier(specifier)}${suffix}`;
    })
    .replace(/(import\s+["'])([^"']+)(["'])/gu, (_, prefix, specifier, suffix) => {
      return `${prefix}${replaceSpecifier(specifier)}${suffix}`;
    })
    .replace(/(require\(\s*["'])([^"']+)(["']\s*\))/gu, (_, prefix, specifier, suffix) => {
      return `${prefix}${replaceSpecifier(specifier)}${suffix}`;
    });
}

export function createBaselineAnalyzeReport(
  rootDir: string = process.cwd(),
  options: {
    scopeToProvidedRoot?: boolean;
  } = {},
): RnMtBaselineAnalyzeReport {
  const resolvedRootDir = resolveAnalyzeRootDir(rootDir, options);
  const app = detectAppKind(resolvedRootDir);
  const support = detectSupportTier(app);
  const host = detectHostLanguage(resolvedRootDir);

  return {
    schemaVersion: 1,
    command: "analyze",
    status: app.candidates.length > 1 ? "ambiguous" : "ok",
    repo: {
      rootDir: resolvedRootDir,
      packageJsonPresent: existsSync(join(resolvedRootDir, "package.json")),
      gitPresent: existsSync(join(resolvedRootDir, ".git")),
      packageManager: detectPackageManager(resolvedRootDir),
      app,
      support,
      host,
    },
  };
}

export function formatBaselineAnalyzeReport(
  report: RnMtBaselineAnalyzeReport,
): string {
  const packageJsonStatus = report.repo.packageJsonPresent ? "yes" : "no";
  const gitStatus = report.repo.gitPresent ? "yes" : "no";
  const rawLine = report.repo.packageManager.raw
    ? `Raw package manager: ${report.repo.packageManager.raw}`
    : null;
  const statusLine = `Analyze status: ${report.status}`;
  const appKindLine = `App kind: ${report.repo.app.kind}`;
  const supportTierLine = `Support tier: ${report.repo.support.tier}`;
  const supportReasonLine = `Support reasons: ${report.repo.support.reasonCodes.join(", ")}`;
  const hostLanguageLine = `Host language: ${report.repo.host.language}`;
  const hostEvidenceLines = report.repo.host.evidence.map(
    (item) => `Host evidence: ${item}`,
  );
  const appCandidatesLine =
    report.repo.app.candidates.length > 1
      ? `App candidates: ${report.repo.app.candidates.join(", ")}`
      : null;
  const appEvidenceLines = report.repo.app.evidence.map(
    (item) => `App evidence: ${item}`,
  );
  const appRemediationLines = report.repo.app.remediation.map(
    (item) => `App remediation: ${item}`,
  );

  return [
    "rn-mt analyze",
    "",
    statusLine,
    `App root: ${report.repo.rootDir}`,
    `package.json present: ${packageJsonStatus}`,
    `Git repo present: ${gitStatus}`,
    `Package manager: ${report.repo.packageManager.name}`,
    `Package manager source: ${report.repo.packageManager.source}`,
    rawLine,
    appKindLine,
    supportTierLine,
    supportReasonLine,
    hostLanguageLine,
    appCandidatesLine,
    ...hostEvidenceLines,
    ...appEvidenceLines,
    ...appRemediationLines,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

function inferInitialTenantId(rootDir: string) {
  const packageJsonPath = join(rootDir, "package.json");

  if (existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      name?: string;
    };

    if (packageJson.name) {
      return packageJson.name
        .toLowerCase()
        .replace(/^@/, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "default";
    }
  }

  return "default";
}

function inferDisplayNameFromTenantId(tenantId: string) {
  return tenantId
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export function createInitialManifest(
  report: RnMtBaselineAnalyzeReport,
): RnMtManifest {
  const tenantId = inferInitialTenantId(report.repo.rootDir);
  const tenantDisplayName = inferDisplayNameFromTenantId(tenantId);

  return {
    schemaVersion: 1,
    source: {
      rootDir: report.repo.rootDir,
    },
    defaults: {
      tenant: tenantId,
      environment: "dev",
    },
    tenants: {
      [tenantId]: {
        displayName: tenantDisplayName || "Default",
      },
    },
    environments: {
      dev: {
        displayName: "Development",
      },
    },
  };
}

export function canInitializeFromAnalyzeReport(
  report: RnMtBaselineAnalyzeReport,
) {
  return report.repo.support.tier !== "unsupported";
}

export function getInitBlockedReason(report: RnMtBaselineAnalyzeReport) {
  if (canInitializeFromAnalyzeReport(report)) {
    return null;
  }

  return [
    "Cannot initialize rn-mt.config.json from an unsupported repo shape.",
    `Support tier: ${report.repo.support.tier}`,
    `Support reasons: ${report.repo.support.reasonCodes.join(", ")}`,
  ].join("\n");
}

export function createInitResult(
  report: RnMtBaselineAnalyzeReport,
): RnMtInitResult {
  const generatedHostFiles =
    report.repo.host.language === "javascript"
      ? [createJavaScriptHostFile(report.repo.rootDir)]
      : [createTypeScriptHostFile(report.repo.rootDir)];

  return {
    manifestPath: join(report.repo.rootDir, "rn-mt.config.json"),
    manifest: createInitialManifest(report),
    generatedHostFiles,
  };
}

export function createConvertResult(
  rootDir: string,
  manifest: RnMtManifest,
  options: {
    fileExists?: (path: string) => boolean;
    readFile?: (path: string) => string;
    bridgeConfigModulePath?: string | null;
  } = {},
): RnMtConvertResult {
  const fileExists = options.fileExists ?? existsSync;
  const readFile = options.readFile ?? ((path: string) => readFileSync(path, "utf8"));
  const packageManager = detectPackageManager(rootDir);
  const localPackages = getLocalRnMtPackagePlan(rootDir);
  const aliasRules = getAliasRules(rootDir);
  const entryFiles = getConvertibleRootEntryFiles(rootDir, options);
  const packageJsonPath = join(rootDir, "package.json");
  const bridgeConfigModulePath = resolveBridgeConfigModulePath(rootDir, options.bridgeConfigModulePath, {
    fileExists,
  });

  if (entryFiles.length === 0) {
    throw new Error(
      "No supported root entry files were found. Expected one of App.[jt]sx?, index.[jt]sx?.",
    );
  }

  if (entryFiles.some((entry) => entry.contents.startsWith(rootWrapperBanner))) {
    throw new Error(
      "Convert has already been applied to this repo. Root entry wrappers are already CLI-owned.",
    );
  }

  const plannedMovedFiles = entryFiles.map((entry) => ({
    sourcePath: entry.path,
    destinationPath: join(rootDir, "src", "rn-mt", "shared", entry.fileName),
    contents: entry.contents,
  }));
  const categoryMovedFiles = getConvertCategoryFilePaths(rootDir)
    .filter((sourcePath) => !entryFiles.some((entry) => entry.path === sourcePath))
    .map((sourcePath) => ({
      sourcePath,
      destinationPath: join(
        rootDir,
        "src",
        "rn-mt",
        "shared",
        sourcePath.startsWith(join(rootDir, "src"))
          ? join("src", sourcePath.slice(join(rootDir, "src").length + 1))
          : sourcePath.slice(rootDir.length + 1),
      ),
      contents: readFile(sourcePath),
      removeSourcePath: sourcePath === bridgeConfigModulePath ? false as const : true as const,
    }));
  const structuralMovedFiles = [...plannedMovedFiles, ...categoryMovedFiles];
  const rootEntrySourcePaths = new Set(entryFiles.map((entry) => entry.path));
  const currentPathBySourcePath = new Map(
    structuralMovedFiles
      .filter((file) => !isTestSourcePath(file.sourcePath))
      .map((file) => [
        file.sourcePath,
        join(
          rootDir,
          "src",
          "rn-mt",
          "current",
          file.destinationPath.slice(join(rootDir, "src", "rn-mt", "shared").length + 1),
        ),
      ]),
  );
  const movedFiles = structuralMovedFiles.map((file) => ({
    ...file,
    contents: isFacadeSourceFile(file.sourcePath)
      ? rewriteMovedSourceContents(
          rootDir,
          file.sourcePath,
          file.destinationPath,
          file.contents,
          currentPathBySourcePath,
          fileExists,
          aliasRules,
        )
      : file.contents,
  }));

  if (fileExists(packageJsonPath)) {
    movedFiles.push({
      sourcePath: packageJsonPath,
      destinationPath: packageJsonPath,
      contents: createConvertedPackageJsonContents(rootDir, readFile(packageJsonPath)),
    });
  }

  const rootReadmePath = join(rootDir, "README.md");

  if (fileExists(rootReadmePath)) {
    movedFiles.push({
      sourcePath: rootReadmePath,
      destinationPath: rootReadmePath,
      contents: addRepoLocalGuideLinkToReadme(readFile(rootReadmePath)),
    });
  }

  const generatedFiles: RnMtSyncGeneratedFile[] = entryFiles.map((entry) => ({
    path: entry.path,
    kind: "root-wrapper" as const,
    contents: createRootWrapperContents(entry.fileName),
  }));
  generatedFiles.push(
    ...createCurrentFacadeFiles(
      rootDir,
      manifest.defaults.tenant,
      structuralMovedFiles.map((file) => ({
        path: file.destinationPath,
        contents: file.contents,
      })),
    ),
  );
  if (bridgeConfigModulePath) {
    const bridgeMovedFile = movedFiles.find((file) => file.sourcePath === bridgeConfigModulePath);

    if (!bridgeMovedFile) {
      throw new Error(`Bridge config module could not be prepared for conversion: ${bridgeConfigModulePath}`);
    }

    generatedFiles.push(
      createHostConfigBridgeFile(
        rootDir,
        bridgeMovedFile.sourcePath,
        bridgeMovedFile.destinationPath,
        bridgeMovedFile.contents,
      ),
    );
  }
  generatedFiles.push({
    path: join(rootDir, "rn-mt.generated.README.md"),
    kind: "repo-readme",
    contents: createRepoLocalGuideContents(),
  });
  generatedFiles.push(
    createReconstructionMetadataFile(
      rootDir,
      manifest.defaults.tenant,
      structuralMovedFiles,
      currentPathBySourcePath,
      {
        rootEntrySourcePaths,
        bridgeConfigModulePath,
      },
    ),
  );
  const ownershipMetadata = createOwnershipMetadataFile(rootDir, generatedFiles, {
    fileName: "rn-mt.generated.convert.ownership.json",
  });
  const hostLanguage = detectHostLanguage(rootDir).language;
  const userOwnedFiles = [
    {
      path: join(
        getExtensionsRootDir(rootDir),
        hostLanguage === "typescript" ? "index.ts" : "index.js",
      ),
      contents: createUserOwnedExtensionContents(hostLanguage),
    },
  ];

  return {
    rootDir,
    movedFiles,
    generatedFiles: [...generatedFiles, ownershipMetadata],
    userOwnedFiles,
    packageManager,
    localPackages,
    installCommand: createInstallCommand(packageManager),
  };
}

function resolveSharedOverrideSourcePath(
  rootDir: string,
  selectedPath: string,
  fileExists: (path: string) => boolean,
) {
  const sharedRootDir = getSharedRootDir(rootDir);
  const candidatePath = selectedPath.startsWith(sharedRootDir)
    ? selectedPath
    : join(sharedRootDir, selectedPath);
  const relativeSelectedPath = relative(sharedRootDir, candidatePath);

  if (relativeSelectedPath.startsWith("..") || relativeSelectedPath.length === 0) {
    throw new Error(
      "override create requires a file path inside src/rn-mt/shared.",
    );
  }

  if (!fileExists(candidatePath) || !statSync(candidatePath).isFile()) {
    throw new Error(`Shared file not found: ${candidatePath}`);
  }

  return {
    sourcePath: candidatePath,
    relativePath: relativeSelectedPath,
  };
}

export function createOverrideCreateResult(
  rootDir: string,
  manifest: RnMtManifest,
  selectedPath: string,
  options: {
    fileExists?: (path: string) => boolean;
    readFile?: (path: string) => string;
  } = {},
): RnMtOverrideCreateResult {
  const fileExists = options.fileExists ?? existsSync;
  const readFile = options.readFile ?? ((path: string) => readFileSync(path, "utf8"));
  const selectedSharedFile = resolveSharedOverrideSourcePath(rootDir, selectedPath, fileExists);
  const copiedFile: RnMtOverrideCreatedFile = {
    sourcePath: selectedSharedFile.sourcePath,
    destinationPath: join(
      getTenantRootDir(rootDir, manifest.defaults.tenant),
      selectedSharedFile.relativePath,
    ),
    contents: readFile(selectedSharedFile.sourcePath),
  };

  if (fileExists(copiedFile.destinationPath)) {
    throw new Error(`Tenant override already exists: ${copiedFile.destinationPath}`);
  }

  return {
    rootDir,
    copiedFile,
    generatedFiles: [
      createCurrentFacadeFile(
        rootDir,
        manifest.defaults.tenant,
        {
          path: copiedFile.sourcePath,
          contents: copiedFile.contents,
        },
        {
          overrideFile: {
            path: copiedFile.destinationPath,
            contents: copiedFile.contents,
          },
        },
      ),
    ],
  };
}

function resolveTenantOverrideSelectionPath(
  rootDir: string,
  tenantId: string,
  selectedPath: string,
) {
  const tenantRootDir = getTenantRootDir(rootDir, tenantId);
  const candidatePath = selectedPath.startsWith(tenantRootDir)
    ? selectedPath
    : join(tenantRootDir, selectedPath);
  const relativeSelectedPath = relative(tenantRootDir, candidatePath);

  if (relativeSelectedPath.startsWith("..") || relativeSelectedPath.length === 0) {
    throw new Error(
      "override remove requires a file path inside src/rn-mt/tenants/<tenant-id>.",
    );
  }

  return {
    overridePath: candidatePath,
    relativePath: relativeSelectedPath,
  };
}

export function createOverrideRemoveResult(
  rootDir: string,
  manifest: RnMtManifest,
  selectedPath: string,
  options: {
    fileExists?: (path: string) => boolean;
    readFile?: (path: string) => string;
  } = {},
): RnMtOverrideRemoveResult {
  const fileExists = options.fileExists ?? existsSync;
  const readFile = options.readFile ?? ((path: string) => readFileSync(path, "utf8"));
  const selectedOverride = resolveTenantOverrideSelectionPath(
    rootDir,
    manifest.defaults.tenant,
    selectedPath,
  );
  const sharedSourcePath = join(getSharedRootDir(rootDir), selectedOverride.relativePath);

  if (!fileExists(selectedOverride.overridePath) || !statSync(selectedOverride.overridePath).isFile()) {
    throw new Error(`Tenant override not found: ${selectedOverride.overridePath}`);
  }

  if (!fileExists(sharedSourcePath) || !statSync(sharedSourcePath).isFile()) {
    throw new Error(`Shared file not found: ${sharedSourcePath}`);
  }

  return {
    rootDir,
    removedFilePath: selectedOverride.overridePath,
    generatedFiles: [
      createCurrentFacadeFile(rootDir, manifest.defaults.tenant, {
        path: sharedSourcePath,
        contents: readFile(sharedSourcePath),
      }, {
        preferShared: true,
      }),
    ],
  };
}

export function getManifestPath(rootDir: string) {
  return join(rootDir, "rn-mt.config.json");
}

function validateEnvSchemaShape(envSchema: unknown) {
  if (envSchema === undefined) {
    return null;
  }

  if (!isPlainObject(envSchema)) {
    return "Invalid envSchema: expected an object keyed by logical env input name.";
  }

  for (const [logicalName, entry] of Object.entries(envSchema)) {
    if (!isPlainObject(entry)) {
      return `Invalid envSchema.${logicalName}: expected an object.`;
    }

    if (
      entry.source !== undefined &&
      (typeof entry.source !== "string" || entry.source.trim().length === 0)
    ) {
      return `Invalid envSchema.${logicalName}.source: expected a non-empty string.`;
    }

    if (entry.required !== undefined && typeof entry.required !== "boolean") {
      return `Invalid envSchema.${logicalName}.required: expected a boolean.`;
    }

    if (entry.secret !== undefined && typeof entry.secret !== "boolean") {
      return `Invalid envSchema.${logicalName}.secret: expected a boolean.`;
    }
  }

  return null;
}

export function parseManifest(manifestContents: string): RnMtManifest {
  const manifest = JSON.parse(manifestContents) as RnMtManifest;
  const envSchemaError = validateEnvSchemaShape(manifest.envSchema);

  if (envSchemaError) {
    throw new Error(envSchemaError);
  }

  return manifest;
}

export function validateTargetSelection(
  manifest: RnMtManifest,
  target: {
    tenant: string;
    environment: string;
  },
) {
  if (!manifest.tenants[target.tenant]) {
    return `Unknown tenant: ${target.tenant}`;
  }

  if (!manifest.environments[target.environment]) {
    return `Unknown environment: ${target.environment}`;
  }

  return null;
}

export function createTargetSetResult(
  rootDir: string,
  manifest: RnMtManifest,
  target: {
    tenant: string;
    environment: string;
  },
): RnMtTargetSetResult {
  const validationError = validateTargetSelection(manifest, target);

  if (validationError) {
    throw new Error(validationError);
  }

  return {
    manifestPath: getManifestPath(rootDir),
    manifest: {
      ...manifest,
      defaults: {
        tenant: target.tenant,
        environment: target.environment,
      },
    },
  };
}

function validateTenantId(tenantId: string) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(tenantId)) {
    return [
      `Invalid tenant id: ${tenantId}`,
      "Tenant ids must use lowercase letters, numbers, and hyphen separators.",
    ].join("\n");
  }

  return null;
}

export function createTenantAddResult(
  rootDir: string,
  manifest: RnMtManifest,
  tenant: {
    id: string;
    displayName?: string;
  },
): RnMtTenantAddResult {
  const normalizedTenantId = tenant.id.trim();
  const tenantIdError = validateTenantId(normalizedTenantId);

  if (tenantIdError) {
    throw new Error(tenantIdError);
  }

  if (manifest.tenants[normalizedTenantId]) {
    throw new Error(`Tenant already exists: ${normalizedTenantId}`);
  }

  const displayName = tenant.displayName?.trim() || inferDisplayNameFromTenantId(normalizedTenantId) || normalizedTenantId;

  return {
    manifestPath: getManifestPath(rootDir),
    manifest: {
      ...manifest,
      tenants: {
        ...manifest.tenants,
        [normalizedTenantId]: {
          displayName,
        },
      },
    },
    tenant: {
      id: normalizedTenantId,
      displayName,
    },
    createdFiles: [
      {
        path: join(getTenantRootDir(rootDir, normalizedTenantId), ".gitkeep"),
        contents: "",
      },
    ],
  };
}

export function createTenantRenameResult(
  rootDir: string,
  manifest: RnMtManifest,
  tenant: {
    fromId: string;
    toId: string;
    displayName?: string;
  },
  options: {
    fileExists?: (path: string) => boolean;
    readFile?: (path: string) => string;
  } = {},
): RnMtTenantRenameResult {
  const fileExists = options.fileExists ?? existsSync;
  const readFile = options.readFile ?? ((path: string) => readFileSync(path, "utf8"));
  const fromId = tenant.fromId.trim();
  const toId = tenant.toId.trim();

  if (!manifest.tenants[fromId]) {
    throw new Error(`Unknown tenant: ${fromId}`);
  }

  const tenantIdError = validateTenantId(toId);

  if (tenantIdError) {
    throw new Error(tenantIdError);
  }

  if (fromId === toId) {
    throw new Error(`Tenant rename requires a different target id: ${fromId}`);
  }

  if (manifest.tenants[toId]) {
    throw new Error(`Tenant already exists: ${toId}`);
  }

  const fromTenantDir = getTenantRootDir(rootDir, fromId);
  const toTenantDir = getTenantRootDir(rootDir, toId);
  const renamedPaths: Array<{
    fromPath: string;
    toPath: string;
  }> = [];

  if (fileExists(fromTenantDir)) {
    if (fileExists(toTenantDir)) {
      throw new Error(`Tenant path already exists: ${toTenantDir}`);
    }

    renamedPaths.push({
      fromPath: fromTenantDir,
      toPath: toTenantDir,
    });
  }

  for (const environmentId of Object.keys(manifest.environments)) {
    const fromEnvPath = join(rootDir, `.env.${fromId}.${environmentId}`);
    const toEnvPath = join(rootDir, `.env.${toId}.${environmentId}`);

    if (!fileExists(fromEnvPath)) {
      continue;
    }

    if (fileExists(toEnvPath)) {
      throw new Error(`Tenant env file path already exists: ${toEnvPath}`);
    }

    renamedPaths.push({
      fromPath: fromEnvPath,
      toPath: toEnvPath,
    });
  }

  const previousTenantLayer = manifest.tenants[fromId];
  const displayName = tenant.displayName?.trim() || previousTenantLayer.displayName;
  const nextTenants = { ...manifest.tenants };

  delete nextTenants[fromId];
  nextTenants[toId] = {
    ...previousTenantLayer,
    displayName,
  };

  const isDefaultTenantRename = manifest.defaults.tenant === fromId;
  const sharedRootDir = getSharedRootDir(rootDir);
  const generatedFiles = isDefaultTenantRename
    ? listSharedFiles(rootDir, fileExists)
        .filter((path) => !isTestSourcePath(path))
        .map((sharedPath) => {
          const sharedFile = {
            path: sharedPath,
            contents: readFile(sharedPath),
          };
          const relativeSharedPath = sharedPath.slice(sharedRootDir.length + 1);
          const previousOverridePath = join(fromTenantDir, relativeSharedPath);

          return fileExists(previousOverridePath)
            ? createCurrentFacadeFile(rootDir, toId, sharedFile, {
                overrideFile: {
                  path: join(toTenantDir, relativeSharedPath),
                  contents: readFile(previousOverridePath),
                },
              })
            : createCurrentFacadeFile(rootDir, toId, sharedFile);
        })
    : [];

  return {
    manifestPath: getManifestPath(rootDir),
    manifest: {
      ...manifest,
      defaults: {
        tenant: isDefaultTenantRename ? toId : manifest.defaults.tenant,
        environment: manifest.defaults.environment,
      },
      tenants: nextTenants,
    },
    tenant: {
      previousId: fromId,
      id: toId,
      displayName,
    },
    renamedPaths,
    generatedFiles,
  };
}

export function createTenantRemoveResult(
  rootDir: string,
  manifest: RnMtManifest,
  tenant: {
    id: string;
  },
  options: {
    fileExists?: (path: string) => boolean;
  } = {},
): RnMtTenantRemoveResult {
  const fileExists = options.fileExists ?? existsSync;
  const tenantId = tenant.id.trim();
  const tenantLayer = manifest.tenants[tenantId];

  if (!tenantLayer) {
    throw new Error(`Unknown tenant: ${tenantId}`);
  }

  if (manifest.defaults.tenant === tenantId) {
    throw new Error(
      `Cannot remove default tenant: ${tenantId}. Select a different default target first.`,
    );
  }

  const removedPaths: string[] = [];
  const tenantDir = getTenantRootDir(rootDir, tenantId);

  if (fileExists(tenantDir)) {
    removedPaths.push(tenantDir);
  }

  for (const environmentId of Object.keys(manifest.environments)) {
    const envFilePath = join(rootDir, `.env.${tenantId}.${environmentId}`);

    if (fileExists(envFilePath)) {
      removedPaths.push(envFilePath);
    }
  }

  const nextTenants = { ...manifest.tenants };
  delete nextTenants[tenantId];

  return {
    manifestPath: getManifestPath(rootDir),
    manifest: {
      ...manifest,
      tenants: nextTenants,
    },
    tenant: {
      id: tenantId,
      displayName: tenantLayer.displayName,
    },
    removedPaths: removedPaths.sort((left, right) => left.localeCompare(right)),
  };
}

export function createDoctorResult(
  rootDir: string,
  manifest: RnMtManifest,
  options: {
    fileExists?: (path: string) => boolean;
  } = {},
): RnMtDoctorResult {
  const fileExists = options.fileExists ?? existsSync;
  const checks: RnMtDoctorCheck[] = [];
  const appKind = detectAppKind(rootDir).kind;

  if (appKind === "expo-managed" || appKind === "expo-prebuild") {
    const easJsonPath = join(rootDir, "eas.json");

    checks.push(
      fileExists(easJsonPath)
        ? {
            code: "expo-distribution-config",
            status: "ok",
            summary: "Expo distribution integration detected.",
            details: [`Found ${easJsonPath}.`],
          }
        : {
            code: "expo-distribution-config",
            status: "warning",
            summary: "Expo distribution integration is missing.",
            details: [
              `Expected ${easJsonPath} for EAS build and submit workflow wiring.`,
              "Add eas.json or document the alternative distribution workflow outside rn-mt.",
            ],
          },
    );
  }

  if (hasBareAndroidProject(rootDir, fileExists)) {
    const expectedPaths = [
      join(rootDir, "android", "app", "rn-mt.generated.identity.gradle"),
      join(rootDir, "android", "app", "rn-mt.generated.flavors.gradle"),
    ];
    const missingPaths = expectedPaths.filter((path) => !fileExists(path));

    checks.push(
      missingPaths.length === 0
        ? {
            code: "android-release-integration",
            status: "ok",
            summary: "Android release integration artifacts detected.",
            details: expectedPaths.map((path) => `Found ${path}.`),
          }
        : {
            code: "android-release-integration",
            status: "warning",
            summary: "Android release integration artifacts are missing.",
            details: [
              ...missingPaths.map((path) => `Missing ${path}.`),
              "Run rn-mt sync --platform android to regenerate release-facing Android integration files.",
            ],
          },
    );
  }

  const xcodeProjectName = getBareIosProjectName(rootDir, fileExists);

  if (xcodeProjectName) {
    const targetSlug = `${manifest.defaults.tenant}-${manifest.defaults.environment}`;
    const schemeName = `${toPascalIdentifier(manifest.defaults.tenant)}-${toPascalIdentifier(
      manifest.defaults.environment,
    )}`;
    const expectedPaths = [
      join(rootDir, "ios", "rn-mt.generated.current.xcconfig"),
      join(rootDir, "ios", `rn-mt.generated.${targetSlug}.xcconfig`),
      join(
        rootDir,
        "ios",
        `${xcodeProjectName}.xcodeproj`,
        "xcshareddata",
        "xcschemes",
        `${schemeName}.xcscheme`,
      ),
    ];
    const missingPaths = expectedPaths.filter((path) => !fileExists(path));

    checks.push(
      missingPaths.length === 0
        ? {
            code: "ios-release-integration",
            status: "ok",
            summary: "iOS release integration artifacts detected.",
            details: expectedPaths.map((path) => `Found ${path}.`),
          }
        : {
            code: "ios-release-integration",
            status: "warning",
            summary: "iOS release integration artifacts are missing.",
            details: [
              ...missingPaths.map((path) => `Missing ${path}.`),
              "Run rn-mt sync --platform ios to regenerate release-facing iOS integration files.",
            ],
          },
    );
  }

  return {
    rootDir,
    checks,
  };
}

function readJsonFileIfPresent<T>(
  path: string,
  options: {
    fileExists: (path: string) => boolean;
    readFile: (path: string) => string;
  },
) {
  if (!options.fileExists(path)) {
    return null;
  }

  return JSON.parse(options.readFile(path)) as T;
}

export function createHandoffPreflightResult(
  rootDir: string,
  manifest: RnMtManifest,
  tenantId: string,
  options: {
    fileExists?: (path: string) => boolean;
    readFile?: (path: string) => string;
  } = {},
): RnMtHandoffPreflightResult {
  const fileExists = options.fileExists ?? existsSync;
  const readFile = options.readFile ?? ((path: string) => readFileSync(path, "utf8"));
  const tenant = manifest.tenants[tenantId];
  const checks: RnMtHandoffPreflightCheck[] = [];

  if (tenant) {
    checks.push({
      code: "target-tenant",
      status: "ok",
      summary: `Tenant ${tenantId} is present in the manifest.`,
      details: [`Display name: ${tenant.displayName}`],
    });
  } else {
    checks.push({
      code: "target-tenant",
      status: "blocked",
      summary: `Tenant ${tenantId} is not defined in the manifest.`,
      details: [
        `Add tenant ${tenantId} first or choose one of: ${Object.keys(manifest.tenants).join(", ") || "(none)"}.`,
      ],
    });
  }

  const convertOwnershipPath = join(rootDir, "rn-mt.generated.convert.ownership.json");
  const convertOwnership = readJsonFileIfPresent<RnMtCliOwnershipMetadataFileLike>(
    convertOwnershipPath,
    {
      fileExists,
      readFile,
    },
  );

  if (
    convertOwnership &&
    convertOwnership.tool === "rn-mt" &&
    convertOwnership.owner === "cli" &&
    Array.isArray(convertOwnership.artifacts) &&
    convertOwnership.artifacts.some((artifact) => artifact.kind === "root-wrapper") &&
    convertOwnership.artifacts.some((artifact) => artifact.kind === "current-facade")
  ) {
    checks.push({
      code: "converted-repo",
      status: "ok",
      summary: "Converted repo ownership metadata is present.",
      details: [`Found ${convertOwnershipPath}.`],
    });
  } else {
    checks.push({
      code: "converted-repo",
      status: "blocked",
      summary: "Converted repo ownership metadata is missing or incomplete.",
      details: [
        `Expected ${convertOwnershipPath} with tracked root wrappers and current facades.`,
        "Run rn-mt convert before attempting handoff.",
      ],
    });
  }

  const reconstructionPath = join(rootDir, "rn-mt.generated.reconstruction.json");
  const reconstructionMetadata =
    readJsonFileIfPresent<RnMtReconstructionMetadataFile>(reconstructionPath, {
      fileExists,
      readFile,
    });

  if (
    reconstructionMetadata &&
    reconstructionMetadata.tool === "rn-mt" &&
    Array.isArray(reconstructionMetadata.entries) &&
    reconstructionMetadata.entries.length > 0
  ) {
    checks.push({
      code: "reconstruction-metadata",
      status: "ok",
      summary: "Reconstruction metadata is present.",
      details: [
        `Found ${reconstructionPath}.`,
        `Tracked paths: ${reconstructionMetadata.entries.length}.`,
      ],
    });
  } else {
    checks.push({
      code: "reconstruction-metadata",
      status: "blocked",
      summary: "Reconstruction metadata is missing or empty.",
      details: [
        `Expected ${reconstructionPath} with original-to-converted path mappings.`,
        "Re-run rn-mt convert to regenerate reconstruction metadata.",
      ],
    });
  }

  const doctorResult = createDoctorResult(rootDir, manifest, {
    fileExists,
  });
  const doctorWarnings = doctorResult.checks.filter((check) => check.status === "warning");

  if (doctorWarnings.length === 0) {
    checks.push({
      code: "doctor-clean",
      status: "ok",
      summary: "Doctor passed with no warnings.",
      details:
        doctorResult.checks.length > 0
          ? doctorResult.checks.map((check) => `${check.code}: ${check.summary}`)
          : ["No applicable doctor checks were required for this repo shape."],
    });
  } else {
    checks.push({
      code: "doctor-clean",
      status: "blocked",
      summary: "Doctor reported warnings.",
      details: doctorWarnings.flatMap((check) => [
        `${check.code}: ${check.summary}`,
        ...check.details,
      ]),
    });
  }

  return {
    rootDir,
    tenant: {
      id: tenantId,
      displayName: tenant?.displayName ?? tenantId,
    },
    status: checks.every((check) => check.status === "ok") ? "ready" : "blocked",
    checks,
  };
}

export function createHandoffFlattenResult(
  rootDir: string,
  manifest: RnMtManifest,
  tenantId: string,
  options: {
    fileExists?: (path: string) => boolean;
    readFile?: (path: string) => string;
  } = {},
): RnMtHandoffFlattenResult {
  const fileExists = options.fileExists ?? existsSync;
  const readFile = options.readFile ?? ((path: string) => readFileSync(path, "utf8"));
  const reconstructionPath = join(rootDir, "rn-mt.generated.reconstruction.json");
  const reconstructionMetadata =
    readJsonFileIfPresent<RnMtReconstructionMetadataFile>(reconstructionPath, {
      fileExists,
      readFile,
    });

  if (
    !reconstructionMetadata ||
    reconstructionMetadata.tool !== "rn-mt" ||
    !Array.isArray(reconstructionMetadata.entries) ||
    reconstructionMetadata.entries.length === 0
  ) {
    throw new Error(
      `Reconstruction metadata is missing or empty: ${reconstructionPath}`,
    );
  }

  const tenant = manifest.tenants[tenantId];

  if (!tenant) {
    throw new Error(`Unknown tenant: ${tenantId}`);
  }

  const sharedRootDir = join(rootDir, reconstructionMetadata.sharedRootPath);
  const currentRootDir = join(rootDir, reconstructionMetadata.currentRootPath);
  const tenantRootDir = getTenantRootDir(rootDir, tenantId);
  const aliasRules = getAliasRules(rootDir);
  const originalPathByCurrentPath = new Map<string, string>();

  for (const entry of reconstructionMetadata.entries) {
    if (!entry.currentPath) {
      continue;
    }

    originalPathByCurrentPath.set(
      join(rootDir, entry.currentPath),
      join(rootDir, entry.originalPath),
    );
  }

  const restoredFiles = reconstructionMetadata.entries.map((entry) => {
    const sharedPath = join(rootDir, entry.sharedPath);
    const relativeSharedPath = relative(sharedRootDir, sharedPath);
    const tenantSourcePath = join(tenantRootDir, relativeSharedPath);
    const selectedSourcePath =
      fileExists(tenantSourcePath) && statSync(tenantSourcePath).isFile()
        ? tenantSourcePath
        : sharedPath;

    if (!fileExists(selectedSourcePath) || !statSync(selectedSourcePath).isFile()) {
      throw new Error(
        `Unable to reconstruct ${entry.originalPath}. Missing source file: ${selectedSourcePath}`,
      );
    }

    const destinationPath = join(rootDir, entry.originalPath);
    const selectedContents = readFile(selectedSourcePath);
    const rewrittenContents = isFacadeSourceFile(selectedSourcePath)
      ? rewriteHandoffSourceContents(
          rootDir,
          selectedSourcePath,
          destinationPath,
          selectedContents,
          originalPathByCurrentPath,
          fileExists,
          aliasRules,
        )
      : selectedContents;

    return {
      sourcePath: selectedSourcePath,
      destinationPath,
      contents: rewrittenContents,
    };
  });

  return {
    rootDir,
    tenant: {
      id: tenantId,
      displayName: tenant.displayName,
    },
    restoredFiles,
  };
}

export function createHandoffCleanupResult(
  rootDir: string,
  options: {
    fileExists?: (path: string) => boolean;
    readFile?: (path: string) => string;
  } = {},
): RnMtHandoffCleanupResult {
  const fileExists = options.fileExists ?? existsSync;
  const readFile = options.readFile ?? ((path: string) => readFileSync(path, "utf8"));
  const rewrittenFiles: RnMtHandoffCleanupFile[] = [];

  const packageJsonPath = join(rootDir, "package.json");

  if (fileExists(packageJsonPath)) {
    rewrittenFiles.push({
      path: packageJsonPath,
      contents: createStandalonePackageJsonContents(rootDir, readFile(packageJsonPath)),
    });
  }

  const readmePath = join(rootDir, "README.md");

  if (fileExists(readmePath)) {
    rewrittenFiles.push({
      path: readmePath,
      contents: removeRepoLocalGuideLinkFromReadme(readFile(readmePath)),
    });
  }

  const candidateRemovedPaths = [
    join(rootDir, "rn-mt.config.json"),
    join(rootDir, "rn-mt.generated.README.md"),
    join(rootDir, "rn-mt.generated.convert.ownership.json"),
    join(rootDir, "rn-mt.generated.reconstruction.json"),
    join(rootDir, "rn-mt.generated.ownership.json"),
    join(rootDir, "rn-mt.generated.runtime.json"),
    join(rootDir, "rn-mt.generated.expo.js"),
    join(rootDir, "rn-mt.generated.asset-fingerprints.json"),
    join(rootDir, ".rn-mt"),
    join(rootDir, "src", "rn-mt"),
  ];

  return {
    rootDir,
    rewrittenFiles,
    removedPaths: candidateRemovedPaths.filter((path) => fileExists(path)).sort((left, right) =>
      left.localeCompare(right),
    ),
  };
}

function createSanitizedEnvExampleContents(
  manifest: RnMtManifest,
  environmentId: string,
  envKeys: string[],
) {
  const envSchemaBySource = new Map<string, RnMtEnvSchemaEntry>();

  for (const schemaEntry of Object.values(manifest.envSchema ?? {})) {
    if (schemaEntry.source) {
      envSchemaBySource.set(schemaEntry.source, schemaEntry);
    }
  }

  return [
    `# Fill in values for ${environmentId}.`,
    "# Real env values were removed from handoff output.",
    "",
    ...envKeys.flatMap((envKey) => {
      const schemaEntry = envSchemaBySource.get(envKey);
      const annotations = [
        schemaEntry?.required ? "required" : null,
        schemaEntry?.secret ? "secret" : null,
      ].filter((value): value is string => Boolean(value));

      return [
        annotations.length > 0 ? `# ${envKey} (${annotations.join(", ")})` : `# ${envKey}`,
        `${envKey}=`,
        "",
      ];
    }),
  ].join("\n");
}

export function createHandoffSanitizationResult(
  rootDir: string,
  manifest: RnMtManifest,
  tenantId: string,
  options: {
    fileExists?: (path: string) => boolean;
    readFile?: (path: string) => string;
  } = {},
): RnMtHandoffSanitizationResult {
  const fileExists = options.fileExists ?? existsSync;
  const readFile = options.readFile ?? ((path: string) => readFileSync(path, "utf8"));
  const generatedFiles: RnMtHandoffSanitizedFile[] = [];
  const removedPaths: string[] = [];
  const automationCandidatePaths = [
    join(rootDir, ".github"),
    join(rootDir, ".gitlab-ci.yml"),
    join(rootDir, ".circleci"),
    join(rootDir, ".buildkite"),
    join(rootDir, ".husky"),
    join(rootDir, "bitrise.yml"),
    join(rootDir, "azure-pipelines.yml"),
    join(rootDir, "fastlane"),
    join(rootDir, "eas.json"),
  ];

  for (const automationPath of automationCandidatePaths) {
    if (fileExists(automationPath)) {
      removedPaths.push(automationPath);
    }
  }

  for (const environmentId of Object.keys(manifest.environments).sort((left, right) =>
    left.localeCompare(right),
  )) {
    const envKeySet = new Set<string>();
    const canonicalEnvPaths = [
      join(rootDir, `.env.${environmentId}`),
      join(rootDir, `.env.${tenantId}.${environmentId}`),
    ];

    for (const envPath of canonicalEnvPaths) {
      if (!fileExists(envPath)) {
        continue;
      }

      removedPaths.push(envPath);

      for (const envKey of Object.keys(parseDotEnvContents(readFile(envPath))).sort((left, right) =>
        left.localeCompare(right),
      )) {
        envKeySet.add(envKey);
      }
    }

    for (const schemaEntry of Object.values(manifest.envSchema ?? {})) {
      if (schemaEntry.source) {
        envKeySet.add(schemaEntry.source);
      }
    }

    if (envKeySet.size === 0) {
      continue;
    }

    const examplePath = join(rootDir, `.env.${environmentId}.example`);
    const envKeys = [...envKeySet].sort((left, right) => left.localeCompare(right));

    generatedFiles.push({
      path: examplePath,
      contents: `${createSanitizedEnvExampleContents(manifest, environmentId, envKeys).trimEnd()}\n`,
    });
  }

  const uniqueRemovedPaths = [...new Set(removedPaths)].sort((left, right) =>
    left.localeCompare(right),
  );
  const reviewChecklist = [
    `Review stripped automation paths for the exported repo shape: ${
      uniqueRemovedPaths.filter((path) => !basename(path).startsWith(".env.")).length > 0
        ? uniqueRemovedPaths
            .filter((path) => !basename(path).startsWith(".env."))
            .map((path) => relative(rootDir, path) || ".")
            .join(", ")
        : "(none)"
    }.`,
    `Review sanitized env examples: ${
      generatedFiles.length > 0
        ? generatedFiles.map((file) => relative(rootDir, file.path) || ".").join(", ")
        : "(none generated)"
    }.`,
  ];

  return {
    rootDir,
    generatedFiles,
    removedPaths: uniqueRemovedPaths,
    reviewRequired: true,
    reviewChecklist,
  };
}

export function createHandoffIsolationAuditResult(
  rootDir: string,
  manifest: RnMtManifest,
  tenantId: string,
  options: {
    fileExists?: (path: string) => boolean;
    readFile?: (path: string) => string;
  } = {},
): RnMtAuditResult {
  const fileExists = options.fileExists ?? existsSync;
  const readFile = options.readFile ?? ((path: string) => readFileSync(path, "utf8"));

  if (!fileExists(rootDir) || !statSync(rootDir).isDirectory()) {
    return {
      rootDir,
      findings: [],
    };
  }

  const residueTerms = Object.entries(manifest.tenants)
    .filter(([candidateTenantId]) => candidateTenantId !== tenantId)
    .flatMap(([candidateTenantId, tenantLayer]) => [
      { label: `tenant id ${candidateTenantId}`, value: candidateTenantId },
      { label: `tenant display name ${tenantLayer.displayName}`, value: tenantLayer.displayName },
    ])
    .filter((entry, index, entries) => {
      const normalizedValue = entry.value.trim().toLowerCase();

      if (normalizedValue.length === 0) {
        return false;
      }

      return (
        entries.findIndex(
          (candidate) => candidate.value.trim().toLowerCase() === normalizedValue,
        ) === index
      );
    });

  if (residueTerms.length === 0) {
    return {
      rootDir,
      findings: [],
    };
  }

  const findings: RnMtAuditFinding[] = [];
  const ignoredTopLevelNames = new Set([".git", "node_modules"]);

  for (const path of walkDirectoryFiles(rootDir)) {
    const relativePath = relative(rootDir, path).replace(/\\/gu, "/");

    if (
      relativePath.length === 0 ||
      relativePath.split("/").some((segment) => ignoredTopLevelNames.has(segment))
    ) {
      continue;
    }

    if (!isAuditableTextFile(path)) {
      continue;
    }

    const contents = readFile(path);
    const evidence = residueTerms
      .filter((term) => contents.toLowerCase().includes(term.value.trim().toLowerCase()))
      .map((term) => `Found ${term.label}: ${term.value}`);

    if (evidence.length === 0) {
      continue;
    }

    findings.push({
      code: "other-tenant-residue",
      path,
      severity: "P0",
      confidence: "high",
      evidence,
      summary:
        "Exported handoff repo still contains identifiers from other tenants and is not isolated.",
    });
  }

  return {
    rootDir,
    findings,
  };
}

export function createCurrentImportsCodemodResult(
  rootDir: string,
  options: {
    fileExists?: (path: string) => boolean;
    readFile?: (path: string) => string;
  } = {},
): RnMtCodemodResult {
  const fileExists = options.fileExists ?? existsSync;
  const readFile = options.readFile ?? ((path: string) => readFileSync(path, "utf8"));
  const aliasRules = getAliasRules(rootDir);
  const sharedFiles = listSharedFiles(rootDir, fileExists);
  const sharedRootDir = getSharedRootDir(rootDir);
  const currentPathBySourcePath = new Map(
    sharedFiles
      .filter((path) => !isTestSourcePath(path))
      .map((path) => [
        path,
        join(
          rootDir,
          "src",
          "rn-mt",
          "current",
          path.slice(sharedRootDir.length + 1),
        ),
      ]),
  );

  const changes = sharedFiles
    .filter((path) => isFacadeSourceFile(path))
    .map((path) => {
      const before = readFile(path);
      const after = rewriteMovedSourceContents(
        rootDir,
        path,
        path,
        before,
        currentPathBySourcePath,
        fileExists,
        aliasRules,
      );

      return {
        path,
        before,
        after,
      };
    })
    .filter((change) => change.before !== change.after);

  return {
    rootDir,
    codemod: "current-imports",
    changes,
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeLayerValue(base: unknown, incoming: unknown): unknown {
  if (Array.isArray(incoming)) {
    return [...incoming];
  }

  if (isPlainObject(incoming)) {
    const baseObject = isPlainObject(base) ? base : {};
    const merged: Record<string, unknown> = { ...baseObject };

    for (const [key, value] of Object.entries(incoming)) {
      merged[key] = mergeLayerValue(baseObject[key], value);
    }

    return merged;
  }

  return incoming;
}

function mergeLayerRecord(
  base: Record<string, unknown> | undefined,
  incoming: Record<string, unknown> | undefined,
) {
  if (!incoming) {
    return { ...(base ?? {}) };
  }

  return mergeLayerValue(base ?? {}, incoming) as Record<string, unknown>;
}

function getCombinationKeys(target: RnMtResolvedTarget) {
  if (!target.platform) {
    return [
      `environment:${target.environment}+tenant:${target.tenant}`,
      `tenant:${target.tenant}+environment:${target.environment}`,
    ];
  }

  return [
    `environment:${target.environment}+tenant:${target.tenant}+platform:${target.platform}`,
    `environment:${target.environment}+platform:${target.platform}+tenant:${target.tenant}`,
    `tenant:${target.tenant}+environment:${target.environment}+platform:${target.platform}`,
    `tenant:${target.tenant}+platform:${target.platform}+environment:${target.environment}`,
    `platform:${target.platform}+environment:${target.environment}+tenant:${target.tenant}`,
    `platform:${target.platform}+tenant:${target.tenant}+environment:${target.environment}`,
  ];
}

function resolveManifestLayers(
  manifest: RnMtManifest,
  target: RnMtResolvedTarget,
) {
  const environment = manifest.environments[target.environment];
  const tenant = manifest.tenants[target.tenant];
  const platform = target.platform ? manifest.platforms?.[target.platform] : undefined;
  const combinationEntry = getCombinationKeys(target)
    .map((key) => ({ key, layer: manifest.combinations?.[key] }))
    .find((entry) => entry.layer);
  const combination = combinationEntry?.layer;
  const appliedLayers = [
    "base",
    `environment:${target.environment}`,
    `tenant:${target.tenant}`,
  ];

  if (target.platform) {
    appliedLayers.push(`platform:${target.platform}`);
  }

  if (combinationEntry) {
    appliedLayers.push(`combination:${combinationEntry.key}`);
  }

  return {
    appliedLayers,
    config: mergeLayerRecord(
      mergeLayerRecord(
        mergeLayerRecord(
          mergeLayerRecord(manifest.config, environment?.config),
          tenant?.config,
        ),
        platform?.config,
      ),
      combination?.config,
    ),
    flags: mergeLayerRecord(
      mergeLayerRecord(
        mergeLayerRecord(
          mergeLayerRecord(manifest.flags, environment?.flags),
          tenant?.flags,
        ),
        platform?.flags,
      ),
      combination?.flags,
    ),
    assets: mergeLayerRecord(
      mergeLayerRecord(
        mergeLayerRecord(
          mergeLayerRecord(manifest.assets, environment?.assets),
          tenant?.assets,
        ),
        platform?.assets,
      ),
      combination?.assets,
    ) as Record<string, string>,
  };
}

function applyStaticRegistryLayer<T extends RnMtStaticRegistryItem>(
  entries: T[],
  layer: RnMtStaticRegistryLayer<T> | undefined,
) {
  const orderedIds = entries.map((entry) => entry.id);
  const byId = new Map(entries.map((entry) => [entry.id, entry]));

  for (const entry of layer?.add ?? []) {
    if (!byId.has(entry.id)) {
      orderedIds.push(entry.id);
    }

    byId.set(entry.id, entry);
  }

  for (const entry of layer?.replace ?? []) {
    if (!byId.has(entry.id)) {
      orderedIds.push(entry.id);
    }

    byId.set(entry.id, entry);
  }

  for (const id of layer?.disable ?? []) {
    byId.delete(id);
  }

  return orderedIds
    .filter((id, index) => orderedIds.indexOf(id) === index)
    .map((id) => byId.get(id))
    .filter((entry): entry is T => entry !== undefined);
}

function applyStaticRegistryFlagGating<T extends RnMtStaticRegistryItem>(
  entries: T[],
  flags: Record<string, unknown>,
) {
  return entries.filter((entry) => {
    if (!entry.enabledByFlag) {
      return true;
    }

    return Boolean(flags[entry.enabledByFlag]);
  });
}

function resolveStaticRegistry<T extends RnMtStaticRegistryItem>(
  manifest: RnMtManifest,
  target: RnMtResolvedTarget,
  baseEntries: T[] | undefined,
  selectLayer: (layer: RnMtManifestLayer) => RnMtStaticRegistryLayer<T> | undefined,
  flags: Record<string, unknown>,
) {
  const environment = manifest.environments[target.environment];
  const tenant = manifest.tenants[target.tenant];
  const platform = target.platform ? manifest.platforms?.[target.platform] : undefined;
  const combination = getCombinationKeys(target)
    .map((key) => manifest.combinations?.[key])
    .find((entry) => entry);

  return applyStaticRegistryFlagGating(
    applyStaticRegistryLayer(
      applyStaticRegistryLayer(
        applyStaticRegistryLayer(
          applyStaticRegistryLayer(baseEntries ?? [], environment ? selectLayer(environment) : undefined),
          tenant ? selectLayer(tenant) : undefined,
        ),
        platform ? selectLayer(platform) : undefined,
      ),
      combination ? selectLayer(combination) : undefined,
    ),
    flags,
  );
}

function toTitleCase(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function getStringRecordValue(
  source: Record<string, unknown> | undefined,
  path: string[],
) {
  let current: unknown = source;

  for (const key of path) {
    if (!isPlainObject(current)) {
      return null;
    }

    current = current[key];
  }

  return typeof current === "string" ? current : null;
}

function setStringRecordValue(
  source: Record<string, unknown>,
  path: string[],
  value: string,
) {
  let current: Record<string, unknown> = source;

  for (const key of path.slice(0, -1)) {
    const next = current[key];

    if (!isPlainObject(next)) {
      current[key] = {};
    }

    current = current[key] as Record<string, unknown>;
  }

  const finalKey = path[path.length - 1];

  if (finalKey) {
    current[finalKey] = value;
  }
}

function cloneJsonRecord(source: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(source)) as Record<string, unknown>;
}

function deriveResolvedIdentity(
  manifest: RnMtManifest,
  resolvedConfig: Record<string, unknown>,
  target: RnMtResolvedTarget,
) {
  const baseDisplaySeed =
    getStringRecordValue(manifest.config, ["identity", "displayName"]) ??
    getStringRecordValue(manifest.config, ["identity", "appName"]) ??
    toTitleCase(target.tenant);
  const baseNativeSeed =
    getStringRecordValue(manifest.config, ["identity", "nativeId"]) ??
    `com.rnmt.${target.tenant}`;
  const explicitDisplayName = getStringRecordValue(resolvedConfig, [
    "identity",
    "displayName",
  ]);
  const resolvedAppName = getStringRecordValue(resolvedConfig, ["identity", "appName"]);
  const resolvedNativeId = getStringRecordValue(resolvedConfig, ["identity", "nativeId"]);
  const displaySeed = explicitDisplayName ?? resolvedAppName ?? baseDisplaySeed;
  const nativeIdSeed = resolvedNativeId ?? baseNativeSeed;
  const isProduction = target.environment === "prod" || target.environment === "production";

  if (isProduction) {
    return {
      displayName: explicitDisplayName ?? displaySeed,
      nativeId: nativeIdSeed,
    };
  }

  const environmentSuffix = ` (${toTitleCase(target.environment)})`;
  const hasDisplayOverride = explicitDisplayName !== null && explicitDisplayName !== baseDisplaySeed;
  const hasNativeIdOverride = resolvedNativeId !== null && resolvedNativeId !== baseNativeSeed;

  return {
    displayName: hasDisplayOverride ? explicitDisplayName : `${displaySeed}${environmentSuffix}`,
    nativeId: hasNativeIdOverride ? nativeIdSeed : `${nativeIdSeed}.${target.environment}`,
  };
}

function getResolvedAndroidApplicationId(
  resolvedConfig: Record<string, unknown>,
  fallbackApplicationId: string,
) {
  return (
    getStringRecordValue(resolvedConfig, ["native", "android", "applicationId"])
    ?? fallbackApplicationId
  );
}

function getResolvedIosBundleIdentifier(
  resolvedConfig: Record<string, unknown>,
  fallbackBundleIdentifier: string,
) {
  return (
    getStringRecordValue(resolvedConfig, ["native", "ios", "bundleIdentifier"])
    ?? fallbackBundleIdentifier
  );
}

function createBaseResolvedRuntime(
  manifest: RnMtManifest,
  target: RnMtResolvedTarget,
): RnMtResolvedRuntimeArtifact {
  const validationError = validateTargetSelection(manifest, target);
  const tenant = manifest.tenants[target.tenant];
  const environment = manifest.environments[target.environment];

  if (validationError) {
    throw new Error(validationError);
  }

  if (!tenant) {
    throw new Error(`Unknown tenant: ${target.tenant}`);
  }

  if (!environment) {
    throw new Error(`Unknown environment: ${target.environment}`);
  }

  const resolution = resolveManifestLayers(manifest, target);
  const resolvedConfig = cloneJsonRecord(resolution.config);
  const identity = deriveResolvedIdentity(manifest, resolvedConfig, target);
  const resolvedAndroidApplicationId = getResolvedAndroidApplicationId(
    resolvedConfig,
    identity.nativeId,
  );
  const resolvedIosBundleIdentifier = getResolvedIosBundleIdentifier(
    resolvedConfig,
    identity.nativeId,
  );

  setStringRecordValue(resolvedConfig, ["identity", "displayName"], identity.displayName);
  setStringRecordValue(resolvedConfig, ["identity", "nativeId"], identity.nativeId);
  setStringRecordValue(
    resolvedConfig,
    ["native", "android", "applicationId"],
    resolvedAndroidApplicationId,
  );
  setStringRecordValue(
    resolvedConfig,
    ["native", "ios", "bundleIdentifier"],
    resolvedIosBundleIdentifier,
  );

  return {
    config: resolvedConfig,
    identity,
    tenant: {
      id: target.tenant,
      displayName: tenant.displayName,
    },
    env: {
      id: target.environment,
    },
    flags: resolution.flags,
    assets: resolution.assets,
    routes: resolveStaticRegistry(
      manifest,
      target,
      manifest.routes,
      (layer) => layer.routes,
      resolution.flags,
    ),
    features: resolveStaticRegistry(
      manifest,
      target,
      manifest.features,
      (layer) => layer.features,
      resolution.flags,
    ),
    menus: resolveStaticRegistry(
      manifest,
      target,
      manifest.menus,
      (layer) => layer.menus,
      resolution.flags,
    ),
    actions: resolveStaticRegistry(
      manifest,
      target,
      manifest.actions,
      (layer) => layer.actions,
      resolution.flags,
    ),
  };
}

function createRuntimeArtifactFile(
  rootDir: string,
  runtime: RnMtResolvedRuntimeArtifact,
): RnMtSyncGeneratedFile {
  return {
    path: join(rootDir, "rn-mt.generated.runtime.json"),
    kind: "runtime-artifact",
    contents: `${JSON.stringify(runtime, null, 2)}\n`,
  };
}

function createOwnershipMetadataFile(
  rootDir: string,
  trackedFiles: RnMtSyncGeneratedFile[],
  options: {
    fileName?: string;
  } = {},
): RnMtSyncGeneratedFile {
  return {
    path: join(rootDir, options.fileName ?? "rn-mt.generated.ownership.json"),
    kind: "ownership-metadata",
    contents: `${JSON.stringify(
      {
        schemaVersion: 1,
        tool: "rn-mt",
        owner: "cli",
        artifacts: trackedFiles
          .map((file) => ({
            path: relative(rootDir, file.path),
            kind: file.kind,
            hash: hashText(file.contents),
          }))
          .sort((left, right) => left.path.localeCompare(right.path)),
      },
      null,
      2,
    )}\n`,
  };
}

function createReconstructionMetadataFile(
  rootDir: string,
  defaultTenant: string,
  movedFiles: RnMtConvertMovedFile[],
  currentPathBySourcePath: Map<string, string>,
  options: {
    rootEntrySourcePaths: Set<string>;
    bridgeConfigModulePath?: string | null;
  },
): RnMtSyncGeneratedFile {
  const metadata: RnMtReconstructionMetadataFile = {
    schemaVersion: 1,
    tool: "rn-mt",
    defaultTenant,
    sharedRootPath: relative(rootDir, getSharedRootDir(rootDir)),
    currentRootPath: relative(rootDir, getCurrentRootDir(rootDir)),
    entries: movedFiles
      .map((file) => {
        const currentPath = currentPathBySourcePath.get(file.sourcePath);
        const originalPathBehavior: RnMtReconstructionOriginalPathBehavior =
          options.rootEntrySourcePaths.has(file.sourcePath)
            ? "replaced-with-root-wrapper"
            : file.sourcePath === options.bridgeConfigModulePath
              ? "replaced-with-host-config-bridge"
              : "removed";

        return {
          originalPath: relative(rootDir, file.sourcePath),
          sharedPath: relative(rootDir, file.destinationPath),
          originalPathBehavior,
          ...(currentPath
            ? { currentPath: relative(rootDir, currentPath) }
            : {}),
        };
      })
      .sort((left, right) => left.originalPath.localeCompare(right.originalPath)),
  };

  return {
    path: join(rootDir, "rn-mt.generated.reconstruction.json"),
    kind: "reconstruction-metadata",
    contents: `${JSON.stringify(metadata, null, 2)}\n`,
  };
}

function createAssetFingerprintMetadataFile(
  rootDir: string,
  records: RnMtDerivedAssetFingerprintRecord[],
): RnMtSyncGeneratedFile {
  const metadata: RnMtDerivedAssetFingerprintMetadata = {
    schemaVersion: 1,
    tool: "rn-mt",
    derivedAssets: records
      .map((record) => ({
        ...record,
        outputPath: relative(rootDir, record.outputPath),
        sourcePath: relative(rootDir, record.sourcePath),
      }))
      .sort((left, right) => left.outputPath.localeCompare(right.outputPath)),
  };

  return {
    path: join(rootDir, "rn-mt.generated.asset-fingerprints.json"),
    kind: "asset-fingerprint-metadata",
    contents: `${JSON.stringify(metadata, null, 2)}\n`,
  };
}

function hasExpoComputedConfig(
  rootDir: string,
  fileExists: (path: string) => boolean,
) {
  return [
    join(rootDir, "app.config.ts"),
    join(rootDir, "app.config.js"),
    join(rootDir, "app.json"),
  ].some((path) => fileExists(path));
}

function createExpoTargetContextFile(
  rootDir: string,
  runtime: RnMtResolvedRuntimeArtifact,
  target: RnMtResolvedTarget,
  iconPath: string | undefined,
): RnMtSyncGeneratedFile {
  const artifact: RnMtExpoTargetContextArtifact = {
    schemaVersion: 1,
    target: target.platform
      ? {
          tenant: target.tenant,
          environment: target.environment,
          platform: target.platform,
        }
      : {
          tenant: target.tenant,
          environment: target.environment,
        },
    identity: runtime.identity,
    runtimeConfigPath: "./rn-mt.generated.runtime.json",
    ...(iconPath ? { iconPath } : {}),
  };

  return {
    path: join(rootDir, "rn-mt.generated.expo.js"),
    kind: "expo-target-context",
    contents: [
      "// Generated by rn-mt. Expo target context bridge. Do not edit directly.",
      `export default ${JSON.stringify(artifact, null, 2)};`,
      "",
    ].join("\n"),
  };
}

function hasBareAndroidProject(
  rootDir: string,
  fileExists: (path: string) => boolean,
) {
  return [
    join(rootDir, "android", "app", "build.gradle"),
    join(rootDir, "android", "app", "build.gradle.kts"),
  ].some((path) => fileExists(path));
}

function toGradleFlavorIdentifier(value: string) {
  const segments = value
    .split(/[^a-zA-Z0-9]+/u)
    .map((segment) => segment.replace(/[^a-zA-Z0-9]/gu, ""))
    .filter((segment) => segment.length > 0);

  const [firstSegment = "rnMt", ...remainingSegments] = segments;
  const first = firstSegment.charAt(0).toLowerCase() + firstSegment.slice(1);
  const rest = remainingSegments.map(
    (segment) => segment.charAt(0).toUpperCase() + segment.slice(1),
  );
  const combined = `${first}${rest.join("")}`;

  return /^[a-zA-Z]/u.test(combined)
    ? combined
    : `rnMt${combined.charAt(0).toUpperCase()}${combined.slice(1)}`;
}

function toGradleStringLiteral(value: string) {
  return `"${value
    .replace(/\\/gu, "\\\\")
    .replace(/"/gu, '\\"')}"`;
}

function createAndroidFlavorConfigFile(
  rootDir: string,
  manifest: RnMtManifest,
  runtime: RnMtResolvedRuntimeArtifact,
  target: RnMtResolvedTarget,
): RnMtSyncGeneratedFile {
  const tenantEntries = Object.entries(manifest.tenants).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  const environmentEntries = Object.entries(manifest.environments).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  const selectedVariant = `${toGradleFlavorIdentifier(target.tenant)}${
    toGradleFlavorIdentifier(target.environment).charAt(0).toUpperCase()
  }${toGradleFlavorIdentifier(target.environment).slice(1)}`;
  const selectedApplicationId = getResolvedAndroidApplicationId(
    runtime.config,
    runtime.identity.nativeId,
  );
  const lines = [
    "// Generated by rn-mt. Android flavor matrix. Do not edit directly.",
    `// Selected target: ${target.tenant}/${target.environment}/android`,
    `// Selected variant: ${selectedVariant}`,
    `// Selected applicationId: ${selectedApplicationId}`,
    "",
    "android {",
    '  flavorDimensions "tenant", "environment"',
    "",
    "  productFlavors {",
  ];

  for (const [tenantId, tenant] of tenantEntries) {
    lines.push(
      `    ${toGradleFlavorIdentifier(tenantId)} {`,
      '      dimension "tenant"',
      `      resValue "string", "RN_MT_TENANT_ID", ${toGradleStringLiteral(tenantId)}`,
      `      resValue "string", "RN_MT_TENANT_DISPLAY_NAME", ${toGradleStringLiteral(
        tenant.displayName,
      )}`,
      "    }",
      "",
    );
  }

  for (const [environmentId, environment] of environmentEntries) {
    const isProduction = environmentId === "prod" || environmentId === "production";

    lines.push(
      `    ${toGradleFlavorIdentifier(environmentId)} {`,
      '      dimension "environment"',
      `      resValue "string", "RN_MT_ENVIRONMENT_ID", ${toGradleStringLiteral(
        environmentId,
      )}`,
      `      resValue "string", "RN_MT_ENVIRONMENT_DISPLAY_NAME", ${toGradleStringLiteral(
        environment.displayName,
      )}`,
    );

    if (!isProduction) {
      lines.push(
        `      applicationIdSuffix ${toGradleStringLiteral(`.${environmentId}`)}`,
      );
    }

    lines.push("    }", "");
  }

  lines.push("  }", "}", "");

  return {
    path: join(rootDir, "android", "app", "rn-mt.generated.flavors.gradle"),
    kind: "android-flavor-config",
    contents: lines.join("\n"),
  };
}

function createAndroidNativeIdentityFile(
  rootDir: string,
  runtime: RnMtResolvedRuntimeArtifact,
  target: RnMtResolvedTarget,
): RnMtSyncGeneratedFile {
  const applicationId = getResolvedAndroidApplicationId(
    runtime.config,
    runtime.identity.nativeId,
  );

  return {
    path: join(rootDir, "android", "app", "rn-mt.generated.identity.gradle"),
    kind: "android-native-identity",
    contents: [
      "// Generated by rn-mt. Selected Android identity config. Do not edit directly.",
      `// Selected target: ${target.tenant}/${target.environment}/android`,
      "",
      "android {",
      "  defaultConfig {",
      `    applicationId ${toGradleStringLiteral(applicationId)}`,
      `    resValue "string", "app_name", ${toGradleStringLiteral(runtime.identity.displayName)}`,
      "  }",
      "}",
      "",
    ].join("\n"),
  };
}

function getBareIosProjectName(
  rootDir: string,
  fileExists: (path: string) => boolean,
) {
  const iosDir = join(rootDir, "ios");

  if (!fileExists(iosDir) || !statSync(iosDir).isDirectory()) {
    return null;
  }

  const projectDirName = readdirSync(iosDir)
    .sort((left, right) => left.localeCompare(right))
    .find((entry) => entry.endsWith(".xcodeproj"));

  return projectDirName ? projectDirName.replace(/\.xcodeproj$/u, "") : null;
}

function toPascalIdentifier(value: string) {
  const segments = value
    .split(/[^a-zA-Z0-9]+/u)
    .map((segment) => segment.replace(/[^a-zA-Z0-9]/gu, ""))
    .filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    return "RnMt";
  }

  return segments
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join("");
}

function toXcconfigStringLiteral(value: string) {
  return `"${value
    .replace(/\\/gu, "\\\\")
    .replace(/"/gu, '\\"')}"`;
}

function createIosNativeConfigFiles(
  rootDir: string,
  runtime: RnMtResolvedRuntimeArtifact,
  target: RnMtResolvedTarget,
  xcodeProjectName: string,
) {
  const bundleIdentifier = getResolvedIosBundleIdentifier(
    runtime.config,
    runtime.identity.nativeId,
  );
  const targetSlug = `${target.tenant}-${target.environment}`;
  const targetXcconfigFileName = `rn-mt.generated.${targetSlug}.xcconfig`;
  const currentXcconfigFileName = "rn-mt.generated.current.xcconfig";
  const schemeName = `${toPascalIdentifier(target.tenant)}-${toPascalIdentifier(
    target.environment,
  )}`;
  const schemePath = join(
    rootDir,
    "ios",
    `${xcodeProjectName}.xcodeproj`,
    "xcshareddata",
    "xcschemes",
    `${schemeName}.xcscheme`,
  );
  const targetXcconfigPath = join(rootDir, "ios", targetXcconfigFileName);
  const currentXcconfigPath = join(rootDir, "ios", currentXcconfigFileName);
  const schemeContents = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    "<Scheme LastUpgradeVersion=\"9999\" version=\"1.7\">",
    "  <!-- Generated by rn-mt. Shared tenant-environment scheme. Do not edit directly. -->",
    `  <!-- Selected target: ${target.tenant}/${target.environment}/ios -->`,
    `  <!-- xcconfig include: ${currentXcconfigFileName} -->`,
    "  <LaunchAction buildConfiguration=\"Debug\">",
    "    <EnvironmentVariables>",
    `      <EnvironmentVariable key="RN_MT_TENANT" value="${target.tenant}" isEnabled="YES" />`,
    `      <EnvironmentVariable key="RN_MT_ENVIRONMENT" value="${target.environment}" isEnabled="YES" />`,
    "    </EnvironmentVariables>",
    "  </LaunchAction>",
    "</Scheme>",
    "",
  ].join("\n");
  const targetXcconfigContents = [
    "// Generated by rn-mt. Selected iOS tenant-environment config. Do not edit directly.",
    `// Selected target: ${target.tenant}/${target.environment}/ios`,
    `PRODUCT_BUNDLE_IDENTIFIER = ${bundleIdentifier}`,
    `INFOPLIST_KEY_CFBundleDisplayName = ${toXcconfigStringLiteral(runtime.identity.displayName)}`,
    `RN_MT_TENANT_ID = ${target.tenant}`,
    `RN_MT_ENVIRONMENT_ID = ${target.environment}`,
    `RN_MT_DISPLAY_NAME = ${toXcconfigStringLiteral(runtime.identity.displayName)}`,
    "",
  ].join("\n");
  const currentXcconfigContents = [
    "// Generated by rn-mt. Selected iOS xcconfig include. Do not edit directly.",
    `#include "${targetXcconfigFileName}"`,
    "",
  ].join("\n");

  return [
    {
      path: schemePath,
      kind: "ios-scheme" as const,
      contents: schemeContents,
    },
    {
      path: targetXcconfigPath,
      kind: "ios-xcconfig" as const,
      contents: targetXcconfigContents,
    },
    {
      path: currentXcconfigPath,
      kind: "ios-xcconfig" as const,
      contents: currentXcconfigContents,
    },
  ];
}

function getDerivedAssetFingerprintMetadata(
  rootDir: string,
  options: {
    fileExists: (path: string) => boolean;
    readFile: (path: string) => string;
  },
) {
  const metadataPath = join(rootDir, "rn-mt.generated.asset-fingerprints.json");

  if (!options.fileExists(metadataPath)) {
    return null;
  }

  return JSON.parse(options.readFile(metadataPath)) as RnMtDerivedAssetFingerprintMetadata;
}

function getSourceFingerprint(contents: string) {
  return createHash("sha256").update(contents).digest("hex");
}

function createDerivedIconContents(
  environment: string,
  sourceAssetPath: string,
  sourceFingerprint: string,
) {
  const isProduction = environment === "prod" || environment === "production";
  const label = environment.toUpperCase();

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">`,
    `  <!-- source: ${sourceAssetPath} -->`,
    `  <!-- fingerprint: ${sourceFingerprint} -->`,
    `  <image href="${sourceAssetPath}" width="256" height="256" preserveAspectRatio="xMidYMid slice"/>`,
    ...(isProduction
      ? []
      : [
          `  <rect x="24" y="168" width="208" height="48" rx="18" fill="#f59e0b"/>`,
          `  <text x="128" y="201" text-anchor="middle" font-family="system-ui, sans-serif" font-size="24" font-weight="700" fill="#111827">${label}</text>`,
        ]),
    `</svg>`,
    "",
  ].join("\n");
}

function createDerivedPlatformAssetFiles(
  rootDir: string,
  runtime: RnMtResolvedRuntimeArtifact,
  target: RnMtResolvedTarget,
  options: {
    fileExists: (path: string) => boolean;
    readFile: (path: string) => string;
  },
) {
  const sourceAssetPath = runtime.assets.icon ? join(rootDir, runtime.assets.icon) : null;

  if (!target.platform || target.platform !== "ios" || !sourceAssetPath) {
    return {
      files: [] as RnMtSyncGeneratedFile[],
      fingerprintRecords: [] as RnMtDerivedAssetFingerprintRecord[],
    };
  }

  if (!options.fileExists(sourceAssetPath)) {
    return {
      files: [] as RnMtSyncGeneratedFile[],
      fingerprintRecords: [] as RnMtDerivedAssetFingerprintRecord[],
    };
  }

  const sourceContents = options.readFile(sourceAssetPath);
  const sourceFingerprint = getSourceFingerprint(sourceContents);
  const outputPath = join(rootDir, "ios", `rn-mt.generated.icon.${target.environment}.svg`);
  const previousMetadata = getDerivedAssetFingerprintMetadata(rootDir, options);
  const previousRecord = previousMetadata?.derivedAssets.find(
    (record) =>
      join(rootDir, record.outputPath) === outputPath
      && record.sourceFingerprint === sourceFingerprint
      && record.environment === target.environment
      && record.platform === target.platform
      && join(rootDir, record.sourcePath) === sourceAssetPath,
  );
  const contents = previousRecord && options.fileExists(outputPath)
    ? options.readFile(outputPath)
    : createDerivedIconContents(
        target.environment,
        relative(dirname(outputPath), sourceAssetPath).replace(/\\/gu, "/"),
        sourceFingerprint,
      );
  const fingerprintRecord: RnMtDerivedAssetFingerprintRecord = {
    outputPath,
    platform: target.platform,
    environment: target.environment,
    sourcePath: sourceAssetPath,
    sourceFingerprint,
  };

  return {
    files: [
      {
        path: outputPath,
        kind: "derived-asset" as const,
        contents,
      },
    ],
    fingerprintRecords: [fingerprintRecord],
  };
}

function listSharedFiles(
  rootDir: string,
  fileExists: (path: string) => boolean,
) {
  const sharedRootDir = getSharedRootDir(rootDir);

  if (!fileExists(sharedRootDir) || !statSync(sharedRootDir).isDirectory()) {
    return [];
  }

  return walkDirectoryFiles(sharedRootDir).sort((left, right) => left.localeCompare(right));
}

function collectOverrideCandidateEvidence(
  manifest: RnMtManifest,
  contents: string,
) {
  const defaultTenantId = manifest.defaults.tenant;
  const defaultTenantDisplayName = manifest.tenants[defaultTenantId]?.displayName ?? null;
  const evidence: string[] = [];

  if (contents.includes(defaultTenantId)) {
    evidence.push(
      `Matched default tenant id "${defaultTenantId}" in shared file contents.`,
    );
  }

  if (
    defaultTenantDisplayName &&
    defaultTenantDisplayName !== defaultTenantId &&
    contents.includes(defaultTenantDisplayName)
  ) {
    evidence.push(
      `Matched default tenant display name "${defaultTenantDisplayName}" in shared file contents.`,
    );
  }

  return evidence;
}

export function createAuditResult(
  rootDir: string,
  manifest: RnMtManifest,
  options: {
    fileExists?: (path: string) => boolean;
    readFile?: (path: string) => string;
  } = {},
): RnMtAuditResult {
  const fileExists = options.fileExists ?? existsSync;
  const readFile = options.readFile ?? ((path: string) => readFileSync(path, "utf8"));
  const sharedRootDir = getSharedRootDir(rootDir);
  const tenantRootDir = getTenantRootDir(rootDir, manifest.defaults.tenant);
  const findings: RnMtAuditFinding[] = [];

  for (const path of listSharedFiles(rootDir, fileExists)) {
    if (isTestSourcePath(path) || !isAuditableTextFile(path)) {
      continue;
    }

    const relativeSharedPath = relative(sharedRootDir, path);

    if (fileExists(join(tenantRootDir, relativeSharedPath))) {
      continue;
    }

    const evidence = collectOverrideCandidateEvidence(manifest, readFile(path));

    if (evidence.length === 0) {
      continue;
    }

    findings.push({
      code: "override-candidate",
      path,
      severity: "P2",
      confidence: evidence.length > 1 ? "high" : "medium",
      evidence,
      summary:
        "Shared file appears tenant-specific for the current default tenant and likely wants a mirrored tenant override.",
    });
  }

  return {
    rootDir,
    findings,
  };
}

function hasEnvInputValue(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateEnvInputs(
  manifest: RnMtManifest,
  target: RnMtResolvedTarget,
  envSource: RnMtEnvSource,
) {
  if (!manifest.envSchema) {
    return null;
  }

  const missingInputs = Object.entries(manifest.envSchema)
    .map(([logicalName, entry]) => ({
      logicalName,
      source: entry.source ?? logicalName,
      required: entry.required ?? false,
    }))
    .filter((entry) => entry.required && !hasEnvInputValue(envSource[entry.source]));

  if (missingInputs.length === 0) {
    return null;
  }

  const targetLabel = target.platform
    ? `${target.tenant}/${target.environment}/${target.platform}`
    : `${target.tenant}/${target.environment}`;
  const missingDetails = missingInputs
    .map((entry) => `${entry.logicalName} (${entry.source})`)
    .sort((left, right) => left.localeCompare(right));

  return [
    `Missing required env inputs for ${targetLabel}: ${missingDetails.join(", ")}.`,
    "Set these variables in the command environment before running sync.",
  ].join(" ");
}

function parseDotEnvValue(rawValue: string) {
  const trimmedValue = rawValue.trim();

  if (
    (trimmedValue.startsWith("\"") && trimmedValue.endsWith("\"")) ||
    (trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))
  ) {
    const innerValue = trimmedValue.slice(1, -1);

    if (trimmedValue.startsWith("\"")) {
      return innerValue.replace(/\\n/g, "\n");
    }

    return innerValue;
  }

  return trimmedValue;
}

function parseDotEnvContents(contents: string): RnMtEnvSource {
  const parsedEnv: RnMtEnvSource = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const trimmedLine = rawLine.trim();

    if (trimmedLine.length === 0 || trimmedLine.startsWith("#")) {
      continue;
    }

    const normalizedLine = trimmedLine.startsWith("export ")
      ? trimmedLine.slice("export ".length).trim()
      : trimmedLine;
    const separatorIndex = normalizedLine.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = normalizedLine.slice(0, separatorIndex).trim();
    const value = normalizedLine.slice(separatorIndex + 1);

    if (key.length === 0) {
      continue;
    }

    parsedEnv[key] = parseDotEnvValue(value);
  }

  return parsedEnv;
}

export function createSubprocessEnv(
  rootDir: string,
  manifest: RnMtManifest,
  target: RnMtResolvedTarget = manifest.defaults,
  options: {
    baseEnv?: RnMtEnvSource;
    fileExists?: (path: string) => boolean;
    readFile?: (path: string) => string;
  } = {},
): RnMtSubprocessEnvResult {
  const targetValidationError = validateTargetSelection(manifest, target);

  if (targetValidationError) {
    throw new Error(targetValidationError);
  }

  const fileExists = options.fileExists ?? existsSync;
  const readFile = options.readFile ?? ((path: string) => readFileSync(path, "utf8"));
  const mergedEnv: RnMtEnvSource = {
    ...(options.baseEnv ?? process.env),
  };
  const loadedFiles: RnMtLoadedEnvFile[] = [];
  const envFileDescriptors: RnMtLoadedEnvFile[] = [
    {
      path: join(rootDir, `.env.${target.environment}`),
      scope: "environment",
    },
    {
      path: join(rootDir, `.env.${target.tenant}.${target.environment}`),
      scope: "tenant-environment",
    },
  ];

  for (const descriptor of envFileDescriptors) {
    if (!fileExists(descriptor.path)) {
      continue;
    }

    Object.assign(mergedEnv, parseDotEnvContents(readFile(descriptor.path)));
    loadedFiles.push(descriptor);
  }

  const envValidationError = validateEnvInputs(manifest, target, mergedEnv);

  if (envValidationError) {
    throw new Error(
      envValidationError.replace(
        "before running sync.",
        "before running rn-mt run.",
      ),
    );
  }

  return {
    env: mergedEnv,
    loadedFiles,
  };
}

export function createSyncResult(
  rootDir: string,
  manifest: RnMtManifest,
  target: RnMtResolvedTarget = manifest.defaults,
  options: {
    env?: RnMtEnvSource;
    fileExists?: (path: string) => boolean;
    readFile?: (path: string) => string;
  } = {},
): RnMtSyncResult {
  const targetValidationError = validateTargetSelection(manifest, target);

  if (targetValidationError) {
    throw new Error(targetValidationError);
  }

  const envValidationError = validateEnvInputs(
    manifest,
    target,
    options.env ?? process.env,
  );

  if (envValidationError) {
    throw new Error(envValidationError);
  }

  const resolution = resolveManifestLayers(manifest, target);
  const runtime = createBaseResolvedRuntime(manifest, target);
  const fileExists = options.fileExists ?? existsSync;
  const readFile = options.readFile ?? ((path: string) => readFileSync(path, "utf8"));
  const runtimeArtifact = createRuntimeArtifactFile(rootDir, runtime);
  const derivedAssets = createDerivedPlatformAssetFiles(rootDir, runtime, target, {
    fileExists,
    readFile,
  });
  const derivedIconPath = derivedAssets.files[0]
    ? `./${relative(rootDir, derivedAssets.files[0].path).replace(/\\/gu, "/")}`
    : runtime.assets.icon
      ? `./${runtime.assets.icon.replace(/\\/gu, "/")}`
      : undefined;
  const trackedFiles: RnMtSyncGeneratedFile[] = [
    runtimeArtifact,
    ...derivedAssets.files,
  ];

  if (hasExpoComputedConfig(rootDir, fileExists)) {
    trackedFiles.push(
      createExpoTargetContextFile(rootDir, runtime, target, derivedIconPath),
    );
  }

  if (target.platform === "android" && hasBareAndroidProject(rootDir, fileExists)) {
    trackedFiles.push(
      createAndroidNativeIdentityFile(rootDir, runtime, target),
      createAndroidFlavorConfigFile(rootDir, manifest, runtime, target),
    );
  }

  if (target.platform === "ios") {
    const xcodeProjectName = getBareIosProjectName(rootDir, fileExists);

    if (xcodeProjectName) {
      trackedFiles.push(
        ...createIosNativeConfigFiles(rootDir, runtime, target, xcodeProjectName),
      );
    }
  }

  if (derivedAssets.fingerprintRecords.length > 0) {
    trackedFiles.push(
      createAssetFingerprintMetadataFile(rootDir, derivedAssets.fingerprintRecords),
    );
  }

  const ownershipMetadata = createOwnershipMetadataFile(rootDir, trackedFiles);

  return {
    rootDir,
    target: target.platform
      ? {
          tenant: target.tenant,
          environment: target.environment,
          platform: target.platform,
        }
      : {
          tenant: target.tenant,
          environment: target.environment,
        },
    resolution: {
      appliedLayers: resolution.appliedLayers,
    },
    runtime,
    generatedFiles: [...trackedFiles, ownershipMetadata],
  };
}
