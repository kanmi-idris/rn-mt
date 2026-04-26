#!/usr/bin/env node

import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, delimiter, dirname, join, relative, resolve } from "node:path";

import {
  type RnMtAuditFinding,
  type RnMtAuditSeverity,
  type RnMtBaselineAnalyzeReport,
  type RnMtEnvSource,
  type RnMtManifest,
  type RnMtRepoAppKind,
  type RnMtResolvedTarget,
  type RnMtTargetPlatform,
  RnMtAnalyzeModule,
  RnMtAuditModule,
  RnMtConvertModule,
  RnMtDoctorModule,
  RnMtHandoffModule,
  RnMtOverrideModule,
  RnMtSyncModule,
  RnMtTenantModule,
  RnMtWorkspace,
  manifest,
} from "@rn-mt/core";

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

const helpText = `rn-mt

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

export interface RnMtCliIo {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

interface RnMtCliSubprocessResult {
  status: number | null;
  error?: Error;
  signal?: NodeJS.Signals | null;
}

interface RnMtCliSubprocessRunner {
  (
    command: string,
    args: string[],
    options: {
      cwd: string;
      env: Record<string, string | undefined>;
    },
  ): RnMtCliSubprocessResult;
}

interface RnMtCliAnalyzeBlockResult {
  command: "analyze";
  status: "blocked";
  analyze: ReturnType<typeof createBaselineAnalyzeReport>;
  reason: string;
  remediation: string[];
}

type RnMtCliWorkflowCommand = "start" | "run" | "build";

interface RnMtCliVersionCompatibilityResult {
  status: "compatible" | "incompatible";
  globalVersion: string;
  localVersion: string;
  installCommand: string | null;
  reason?: string;
  remediation: string[];
}

type RnMtCliHookName = "prestart" | "preandroid" | "preios" | "postinstall";

interface RnMtCliHookStateEntry {
  inputHash: string;
  target: {
    tenant: string;
    environment: string;
    platform?: RnMtTargetPlatform;
  };
  identity: {
    displayName: string;
    nativeId: string;
  };
  configSource: string;
  trackedFiles: Array<{
    path: string;
    hash: string;
  }>;
}

interface RnMtCliHookStateFile {
  schemaVersion: 1;
  tool: "rn-mt";
  hooks: Partial<Record<RnMtCliHookName, RnMtCliHookStateEntry>>;
}

interface RnMtCliOwnershipMetadataFile {
  schemaVersion: 1;
  tool: "rn-mt";
  owner: "cli";
  artifacts: Array<{
    path: string;
    kind: string;
    hash?: string;
  }>;
}

interface RnMtCliExecutionContext {
  cwd: string;
  manifestPath: string;
  explicitlyScopedAppRoot: boolean;
}

interface RnMtCliUpgradeStage {
  name: "packages" | "metadata" | "sync" | "audit";
  status: "updated" | "unchanged" | "passed" | "findings";
  details: string[];
}

interface RnMtCliWorkspaceOverrides {
  fileExists?: (path: string) => boolean;
  readFile?: (path: string) => string;
}

const defaultIo: RnMtCliIo = {
  stdout(text) {
    process.stdout.write(text);
  },
  stderr(text) {
    process.stderr.write(text);
  },
};

function getWorkspace(
  rootDir: string,
  overrides: RnMtCliWorkspaceOverrides = {},
) {
  const workspace = new RnMtWorkspace({ rootDir });
  const canReadFile = (path: string) => {
    if (!overrides.readFile) {
      return false;
    }

    try {
      overrides.readFile(path);
      return true;
    } catch {
      return false;
    }
  };

  if (overrides.fileExists) {
    workspace.exists = overrides.fileExists;
  }

  if (overrides.readFile) {
    workspace.readText = overrides.readFile;
    workspace.readJson = <T>(path: string) => JSON.parse(overrides.readFile!(path)) as T;
  }

  if (overrides.fileExists && overrides.readFile) {
    workspace.isFile = (path: string) =>
      overrides.fileExists!(path) && canReadFile(path);
    workspace.isDirectory = (path: string) =>
      overrides.fileExists!(path) && !workspace.isFile(path);
    workspace.readJsonIfPresent = <T>(path: string) =>
      overrides.fileExists!(path)
        ? (JSON.parse(overrides.readFile!(path)) as T)
        : null;
  }

  return workspace;
}

function getAnalyzeModule(rootDir: string, overrides: RnMtCliWorkspaceOverrides = {}) {
  return new RnMtAnalyzeModule({ workspace: getWorkspace(rootDir, overrides) });
}

function createBaselineAnalyzeReport(
  rootDir: string = process.cwd(),
  options: {
    scopeToProvidedRoot?: boolean;
  } = {},
) {
  return getAnalyzeModule(rootDir).run(options);
}

function formatBaselineAnalyzeReport(report: RnMtBaselineAnalyzeReport) {
  return getAnalyzeModule(report.repo.rootDir).format(report);
}

function canInitializeFromAnalyzeReport(report: RnMtBaselineAnalyzeReport) {
  return getAnalyzeModule(report.repo.rootDir).canInitialize(report);
}

function getInitBlockedReason(report: RnMtBaselineAnalyzeReport) {
  return getAnalyzeModule(report.repo.rootDir).getInitBlockedReason(report);
}

function createInitResult(report: RnMtBaselineAnalyzeReport) {
  return getAnalyzeModule(report.repo.rootDir).createInitResult(report);
}

function createConvertResult(
  rootDir: string,
  manifestValue: RnMtManifest,
  options: {
    bridgeConfigModulePath?: string | null;
    fileExists?: (path: string) => boolean;
    readFile?: (path: string) => string;
  } = {},
) {
  const runOptions = {
    manifest: manifestValue,
    ...(options.bridgeConfigModulePath !== undefined
      ? { bridgeConfigModulePath: options.bridgeConfigModulePath }
      : {}),
  };

  return new RnMtConvertModule({
    workspace: getWorkspace(rootDir, options),
  }).run(runOptions);
}

function createCurrentImportsCodemodResult(
  rootDir: string,
  options: RnMtCliWorkspaceOverrides = {},
) {
  return new RnMtConvertModule({
    workspace: getWorkspace(rootDir, options),
  }).planCurrentImportsCodemod();
}

function getManifestPath(rootDir: string) {
  return getWorkspace(rootDir).getManifestPath();
}

function parseManifest(manifestContents: string) {
  return manifest.parseManifest(manifestContents);
}

function createTargetSetResult(
  rootDir: string,
  manifestValue: RnMtManifest,
  target: {
    tenant: string;
    environment: string;
  },
) {
  return new RnMtTenantModule({
    workspace: getWorkspace(rootDir),
  }).setDefaultTarget({
    manifest: manifestValue,
    target,
  });
}

function createTenantAddResult(
  rootDir: string,
  manifestValue: RnMtManifest,
  tenant: {
    id: string;
    displayName?: string;
  },
) {
  return new RnMtTenantModule({
    workspace: getWorkspace(rootDir),
  }).add({
    manifest: manifestValue,
    tenant,
  });
}

function createTenantRenameResult(
  rootDir: string,
  manifestValue: RnMtManifest,
  tenant: {
    fromId: string;
    toId: string;
    displayName?: string;
  },
  _options?: unknown,
) {
  return new RnMtTenantModule({
    workspace: getWorkspace(rootDir),
  }).rename({
    manifest: manifestValue,
    tenant,
  });
}

function createTenantRemoveResult(
  rootDir: string,
  manifestValue: RnMtManifest,
  tenant: {
    id: string;
  },
  _options?: unknown,
) {
  return new RnMtTenantModule({
    workspace: getWorkspace(rootDir),
  }).remove({
    manifest: manifestValue,
    tenant,
  });
}

function createOverrideCreateResult(
  rootDir: string,
  manifestValue: RnMtManifest,
  selectedPath: string,
  options: RnMtCliWorkspaceOverrides = {},
) {
  return new RnMtOverrideModule({
    workspace: getWorkspace(rootDir, options),
  }).create({
    manifest: manifestValue,
    selectedPath,
  });
}

function createOverrideRemoveResult(
  rootDir: string,
  manifestValue: RnMtManifest,
  selectedPath: string,
  options: RnMtCliWorkspaceOverrides = {},
) {
  return new RnMtOverrideModule({
    workspace: getWorkspace(rootDir, options),
  }).remove({
    manifest: manifestValue,
    selectedPath,
  });
}

function createDoctorResult(
  rootDir: string,
  manifestValue: RnMtManifest,
  options: RnMtCliWorkspaceOverrides = {},
) {
  return new RnMtDoctorModule({
    workspace: getWorkspace(rootDir, options),
  }).run(manifestValue);
}

function createAuditResult(
  rootDir: string,
  manifestValue: RnMtManifest,
  options: RnMtCliWorkspaceOverrides = {},
) {
  return new RnMtAuditModule({
    workspace: getWorkspace(rootDir, options),
  }).run(manifestValue);
}

function createSubprocessEnv(
  rootDir: string,
  manifestValue: RnMtManifest,
  target: RnMtResolvedTarget = manifestValue.defaults,
  options: {
    baseEnv?: RnMtEnvSource | undefined;
    fileExists?: (path: string) => boolean;
    readFile?: (path: string) => string;
  } = {},
) {
  const runOptions = {
    manifest: manifestValue,
    target,
    ...(options.baseEnv ? { baseEnv: options.baseEnv } : {}),
  };

  return new RnMtSyncModule({
    manifest,
    workspace: getWorkspace(rootDir, options),
  }).createSubprocessEnv(runOptions);
}

function createSyncResult(
  rootDir: string,
  manifestValue: RnMtManifest,
  target: RnMtResolvedTarget = manifestValue.defaults,
  options: {
    env?: RnMtEnvSource | undefined;
    fileExists?: (path: string) => boolean;
    readFile?: (path: string) => string;
  } = {},
) {
  const runOptions = {
    manifest: manifestValue,
    target,
    ...(options.env ? { env: options.env } : {}),
  };

  return new RnMtSyncModule({
    manifest,
    workspace: getWorkspace(rootDir, options),
  }).run(runOptions);
}

function getHandoffModule(rootDir: string, overrides: RnMtCliWorkspaceOverrides = {}) {
  const workspace = getWorkspace(rootDir, overrides);

  return new RnMtHandoffModule({
    audit: new RnMtAuditModule({ workspace }),
    doctor: new RnMtDoctorModule({ workspace }),
    workspace,
  });
}

function createHandoffPreflightResult(
  rootDir: string,
  manifestValue: RnMtManifest,
  tenantId: string,
  options: RnMtCliWorkspaceOverrides = {},
) {
  return getHandoffModule(rootDir, options).preflight({
    manifest: manifestValue,
    tenantId,
  });
}

function createHandoffFlattenResult(
  rootDir: string,
  manifestValue: RnMtManifest,
  tenantId: string,
  options: RnMtCliWorkspaceOverrides = {},
) {
  return getHandoffModule(rootDir, options).flatten({
    manifest: manifestValue,
    tenantId,
  });
}

function createHandoffCleanupResult(
  rootDir: string,
  options: RnMtCliWorkspaceOverrides = {},
) {
  return getHandoffModule(rootDir, options).cleanup();
}

function createHandoffSanitizationResult(
  rootDir: string,
  manifestValue: RnMtManifest,
  tenantId: string,
  options: RnMtCliWorkspaceOverrides = {},
) {
  return getHandoffModule(rootDir, options).sanitize({
    manifest: manifestValue,
    tenantId,
  });
}

function createHandoffIsolationAuditResult(
  rootDir: string,
  manifestValue: RnMtManifest,
  tenantId: string,
  options: RnMtCliWorkspaceOverrides = {},
) {
  return getHandoffModule(rootDir, options).auditIsolation({
    manifest: manifestValue,
    tenantId,
  });
}

function getDefaultExecutionCwd() {
  return process.env.INIT_CWD ?? process.env.PWD ?? process.cwd();
}

function wantsJsonOutput(commandArgsToCheck: string[]) {
  return commandArgsToCheck.includes("--json");
}

function normalizeAuditMatchPath(value: string) {
  return value.replaceAll("\\", "/");
}

function isNonInteractive(commandArgsToCheck: string[]) {
  return commandArgsToCheck.includes("--non-interactive");
}

function getRepeatedOptionValues(
  commandArgsToCheck: string[],
  optionName: string,
) {
  const values: string[] = [];

  for (let index = 0; index < commandArgsToCheck.length; index += 1) {
    if (commandArgsToCheck[index] !== optionName) {
      continue;
    }

    const rawValue = commandArgsToCheck[index + 1];

    if (!rawValue || rawValue.startsWith("--")) {
      throw new Error(`Option requires a value: ${optionName}`);
    }

    values.push(
      ...rawValue
        .split(",")
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0),
    );
  }

  return values;
}

function getCliPackageVersion() {
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

function getSelectedAppKind(
  commandArgsToCheck: string[],
): RnMtRepoAppKind | null {
  const appKindIndex = commandArgsToCheck.indexOf("--app-kind");

  if (appKindIndex === -1) {
    return null;
  }

  const requestedKind = commandArgsToCheck[appKindIndex + 1];

  if (
    requestedKind === "expo-managed" ||
    requestedKind === "expo-prebuild" ||
    requestedKind === "bare-react-native"
  ) {
    return requestedKind;
  }

  return null;
}

function getRequiredOption(
  commandArgsToCheck: string[],
  optionName: string,
) {
  const optionIndex = commandArgsToCheck.indexOf(optionName);

  if (optionIndex === -1) {
    return null;
  }

  return commandArgsToCheck[optionIndex + 1] ?? null;
}

function getSelectedPlatform(
  commandArgsToCheck: string[],
): RnMtTargetPlatform | null {
  const platform = getRequiredOption(commandArgsToCheck, "--platform");

  if (platform === "ios" || platform === "android") {
    return platform;
  }

  return null;
}

function getSelectedBridgeConfigModulePath(commandArgsToCheck: string[]) {
  return getRequiredOption(commandArgsToCheck, "--bridge-config");
}

function getSelectedTenantDisplayName(commandArgsToCheck: string[]) {
  return getRequiredOption(commandArgsToCheck, "--display-name");
}

function getSelectedAppRoot(commandArgsToCheck: string[]) {
  return getRequiredOption(commandArgsToCheck, "--app-root");
}

function getSelectedConfigPath(commandArgsToCheck: string[]) {
  return getRequiredOption(commandArgsToCheck, "--config");
}

function hasFlag(commandArgsToCheck: string[], flagName: string) {
  return commandArgsToCheck.includes(flagName);
}

function resolveExecutionContext(
  invocationCwd: string,
  commandArgsToCheck: string[],
): RnMtCliExecutionContext {
  const selectedAppRoot = getSelectedAppRoot(commandArgsToCheck);
  const selectedConfigPath = getSelectedConfigPath(commandArgsToCheck);
  const resolvedAppRoot = selectedAppRoot ? resolve(invocationCwd, selectedAppRoot) : null;
  const resolvedConfigPath = selectedConfigPath ? resolve(invocationCwd, selectedConfigPath) : null;

  if (resolvedConfigPath && basename(resolvedConfigPath) !== "rn-mt.config.json") {
    throw new Error(
      `Config path must point to rn-mt.config.json. Received: ${resolvedConfigPath}`,
    );
  }

  const configRoot = resolvedConfigPath ? dirname(resolvedConfigPath) : null;

  if (resolvedAppRoot && configRoot && resolvedAppRoot !== configRoot) {
    throw new Error(
      `Cross-root config usage is not allowed. --app-root resolves to ${resolvedAppRoot} but --config resolves to ${resolvedConfigPath}.`,
    );
  }

  const cwd = resolvedAppRoot ?? configRoot ?? invocationCwd;

  return {
    cwd,
    manifestPath: resolvedConfigPath ?? getManifestPath(cwd),
    explicitlyScopedAppRoot: resolvedAppRoot !== null,
  };
}

function readScopedManifest(
  manifestPath: string,
  executionRoot: string,
  readFile: (path: string) => string,
) {
  const manifest = parseManifest(readFile(manifestPath));

  if (resolve(manifest.source.rootDir) !== resolve(executionRoot)) {
    throw new Error(
      `Cross-root config usage is not allowed. Manifest at ${manifestPath} is bound to ${manifest.source.rootDir}, not ${executionRoot}.`,
    );
  }

  return manifest;
}

function getAuditFailThreshold(
  commandArgsToCheck: string[],
): RnMtAuditSeverity | null {
  const optionIndex = commandArgsToCheck.indexOf("--fail-on");

  if (optionIndex === -1) {
    return null;
  }

  const requestedSeverity = commandArgsToCheck[optionIndex + 1];

  if (
    requestedSeverity === "P0" ||
    requestedSeverity === "P1" ||
    requestedSeverity === "P2" ||
    requestedSeverity === "P3"
  ) {
    return requestedSeverity;
  }

  throw new Error(
    `Invalid --fail-on severity: ${requestedSeverity ?? "(missing)"}. Expected one of P0, P1, P2, P3.`,
  );
}

function getAuditIgnoreRules(commandArgsToCheck: string[]) {
  return getRepeatedOptionValues(commandArgsToCheck, "--ignore");
}

function getAuditSeverityRank(severity: RnMtAuditSeverity) {
  switch (severity) {
    case "P0":
      return 0;
    case "P1":
      return 1;
    case "P2":
      return 2;
    case "P3":
      return 3;
  }
}

function findingMatchesAuditIgnoreRule(
  cwd: string,
  finding: RnMtAuditFinding,
  rule: string,
) {
  const normalizedRule = normalizeAuditMatchPath(rule);

  if (finding.code === normalizedRule) {
    return true;
  }

  const normalizedAbsolutePath = normalizeAuditMatchPath(finding.path);

  if (normalizedAbsolutePath === normalizedRule) {
    return true;
  }

  const normalizedRelativePath = normalizeAuditMatchPath(
    relative(cwd, finding.path),
  );

  return normalizedRelativePath === normalizedRule;
}

function applyAuditIgnoreRules(
  cwd: string,
  findings: RnMtAuditFinding[],
  ignoreRules: string[],
) {
  if (ignoreRules.length === 0) {
    return findings;
  }

  return findings.filter(
    (finding) =>
      !ignoreRules.some((rule) => findingMatchesAuditIgnoreRule(cwd, finding, rule)),
  );
}

function countFailingAuditFindings(
  findings: RnMtAuditFinding[],
  failThreshold: RnMtAuditSeverity | null,
) {
  if (failThreshold === null) {
    return findings.length;
  }

  const failThresholdRank = getAuditSeverityRank(failThreshold);

  return findings.filter(
    (finding) => getAuditSeverityRank(finding.severity) <= failThresholdRank,
  ).length;
}

function prependLocalNodeModulesBin(
  cwd: string,
  sourceEnv: Record<string, string | undefined>,
) {
  const localBinPath = join(cwd, "node_modules", ".bin");
  const currentPath = sourceEnv.PATH ?? "";

  return {
    ...sourceEnv,
    PATH: currentPath.length > 0
      ? `${localBinPath}${delimiter}${currentPath}`
      : localBinPath,
  };
}

function applyLocalFirstSubprocessPolicy(
  sourceEnv: Record<string, string | undefined>,
) {
  return {
    ...sourceEnv,
    EXPO_NO_TELEMETRY: "1",
    DO_NOT_TRACK: "1",
    RN_MT_NETWORK_MODE: "local-first",
  };
}

function splitCommandArgs(commandArgsToCheck: string[]) {
  const separatorIndex = commandArgsToCheck.indexOf("--");

  if (separatorIndex === -1) {
    return {
      optionArgs: commandArgsToCheck,
      passthroughArgs: [],
    };
  }

  return {
    optionArgs: commandArgsToCheck.slice(0, separatorIndex),
    passthroughArgs: commandArgsToCheck.slice(separatorIndex + 1),
  };
}

function detectPackageManagerName(
  cwd: string,
  options: {
    fileExists: (path: string) => boolean;
    readFile: (path: string) => string;
  },
) {
  const packageJsonPath = join(cwd, "package.json");

  if (options.fileExists(packageJsonPath)) {
    try {
      const packageJson = JSON.parse(options.readFile(packageJsonPath)) as {
        packageManager?: string;
      };
      const rawName = packageJson.packageManager?.split("@")[0];

      if (rawName === "pnpm" || rawName === "npm" || rawName === "yarn" || rawName === "bun") {
        return rawName;
      }
    } catch {
      return null;
    }
  }

  if (options.fileExists(join(cwd, "pnpm-lock.yaml"))) {
    return "pnpm";
  }

  if (options.fileExists(join(cwd, "package-lock.json"))) {
    return "npm";
  }

  if (options.fileExists(join(cwd, "yarn.lock"))) {
    return "yarn";
  }

  if (options.fileExists(join(cwd, "bun.lockb"))) {
    return "bun";
  }

  return null;
}

function createInstallCommandForPackageManager(
  packageManagerName: "pnpm" | "npm" | "yarn" | "bun" | null,
) {
  if (!packageManagerName) {
    return null;
  }

  return `${packageManagerName} install`;
}

function ensureParentDir(path: string) {
  mkdirSync(dirname(path), { recursive: true });
}

function getDefaultHandoffOutputDir(rootDir: string, tenantId: string) {
  return join(dirname(rootDir), `${basename(rootDir)}-handoff-${tenantId}`);
}

function getDefaultHandoffArchivePath(outputDir: string) {
  return `${outputDir}.zip`;
}

function copyRepoForHandoff(sourceDir: string, outputDir: string) {
  const skippedTopLevelNames = new Set([".git", "node_modules"]);

  cpSync(sourceDir, outputDir, {
    recursive: true,
    filter(sourcePath) {
      const sourceName = basename(sourcePath);

      if (skippedTopLevelNames.has(sourceName)) {
        return false;
      }

      return true;
    },
  });
}

function isReadableFile(
  path: string,
  fileExists: (path: string) => boolean,
) {
  if (!fileExists(path)) {
    return false;
  }

  try {
    return statSync(path).isFile();
  } catch {
    return true;
  }
}

function hashText(contents: string) {
  return createHash("sha256").update(contents).digest("hex");
}

function getHookStatePath(rootDir: string) {
  return join(rootDir, ".rn-mt", "hook-state.json");
}

function getHookName(commandArgsToCheck: string[]): RnMtCliHookName | null {
  const hookName = commandArgsToCheck[0];

  if (
    hookName === "prestart" ||
    hookName === "preandroid" ||
    hookName === "preios" ||
    hookName === "postinstall"
  ) {
    return hookName;
  }

  return null;
}

function getHookPlatform(hookName: RnMtCliHookName) {
  if (hookName === "preandroid") {
    return "android" as const;
  }

  if (hookName === "preios") {
    return "ios" as const;
  }

  return null;
}

function collectManifestAssetPaths(source: unknown, assetPaths: Set<string>) {
  if (!source || typeof source !== "object") {
    return;
  }

  if (Array.isArray(source)) {
    for (const entry of source) {
      collectManifestAssetPaths(entry, assetPaths);
    }

    return;
  }

  for (const [key, value] of Object.entries(source)) {
    if (key === "assets" && value && typeof value === "object" && !Array.isArray(value)) {
      for (const assetPath of Object.values(value)) {
        if (typeof assetPath === "string") {
          assetPaths.add(assetPath);
        }
      }
    } else {
      collectManifestAssetPaths(value, assetPaths);
    }
  }
}

function createHookInputHash(
  rootDir: string,
  manifestPath: string,
  manifestContents: string,
  target: {
    tenant: string;
    environment: string;
    platform?: RnMtTargetPlatform;
  },
  loadedEnvFiles: Array<{
    path: string;
    scope: string;
  }>,
  options: {
    fileExists: (path: string) => boolean;
    readFile: (path: string) => string;
  },
) {
  const fingerprint = createHash("sha256");
  const assetPaths = new Set<string>();
  const parsedManifest = JSON.parse(manifestContents) as Record<string, unknown>;

  collectManifestAssetPaths(parsedManifest, assetPaths);

  fingerprint.update(manifestPath);
  fingerprint.update("\n");
  fingerprint.update(manifestContents);
  fingerprint.update("\n");
  fingerprint.update(JSON.stringify(target));
  fingerprint.update("\n");

  const auxiliaryPaths = [
    join(rootDir, "app.json"),
    join(rootDir, "app.config.ts"),
    join(rootDir, "app.config.js"),
    join(rootDir, "android", "app", "build.gradle"),
    join(rootDir, "android", "app", "build.gradle.kts"),
    ...readdirSync(join(rootDir), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name === "ios")
      .flatMap(() =>
        readdirSync(join(rootDir, "ios"), { withFileTypes: true })
          .filter((entry) => entry.isDirectory() && entry.name.endsWith(".xcodeproj"))
          .map((entry) => join(rootDir, "ios", entry.name)),
      ),
    ...[...assetPaths].map((assetPath) => join(rootDir, assetPath)),
  ].sort((left, right) => left.localeCompare(right));

  for (const path of auxiliaryPaths) {
    fingerprint.update(path);
    fingerprint.update(":");

    if (options.fileExists(path)) {
      fingerprint.update(statSync(path).isDirectory() ? "dir" : "file");

      if (statSync(path).isFile()) {
        fingerprint.update(":");
        fingerprint.update(hashText(options.readFile(path)));
      }
    } else {
      fingerprint.update("missing");
    }

    fingerprint.update("\n");
  }

  for (const loadedFile of loadedEnvFiles) {
    fingerprint.update(`${loadedFile.scope}:${loadedFile.path}\n`);
  }

  return fingerprint.digest("hex");
}

function readHookState(
  rootDir: string,
  options: {
    fileExists: (path: string) => boolean;
    readFile: (path: string) => string;
  },
): RnMtCliHookStateFile | null {
  const statePath = getHookStatePath(rootDir);

  if (!isReadableFile(statePath, options.fileExists)) {
    return null;
  }

  return JSON.parse(options.readFile(statePath)) as RnMtCliHookStateFile;
}

function createHookBanner(
  rootDir: string,
  entry: RnMtCliHookStateEntry,
  syncStatus: "updated" | "up-to-date",
) {
  const targetLabel = entry.target.platform
    ? `${entry.target.tenant}/${entry.target.environment}/${entry.target.platform}`
    : `${entry.target.tenant}/${entry.target.environment}`;
  const configSource = relative(rootDir, entry.configSource) || "rn-mt.config.json";

  return [
    `[rn-mt] target=${targetLabel}`,
    `identity="${entry.identity.displayName}"`,
    `nativeId=${entry.identity.nativeId}`,
    `config=${configSource}`,
    `sync=${syncStatus}`,
  ].join(" | ");
}

function writeGeneratedFiles(
  generatedFilesToWrite: Array<{
    path: string;
    contents: string;
    kind: string;
  }>,
  options: {
    fileExists: (path: string) => boolean;
    readFile: (path: string) => string;
    writeFile: (path: string, contents: string) => void;
    ownershipMetadataPath?: string;
    allowedUntrackedOverwritePaths?: Set<string>;
  },
) {
  const ownershipMetadataPath =
    options.ownershipMetadataPath
    ?? generatedFilesToWrite.find((file) => file.kind === "ownership-metadata")?.path
    ?? null;
  const ownershipRootDir = ownershipMetadataPath ? dirname(ownershipMetadataPath) : null;
  let ownershipMetadata: RnMtCliOwnershipMetadataFile | null = null;

  if (ownershipMetadataPath && isReadableFile(ownershipMetadataPath, options.fileExists)) {
    try {
      const parsed = JSON.parse(options.readFile(ownershipMetadataPath)) as RnMtCliOwnershipMetadataFile;

      if (parsed.tool !== "rn-mt" || parsed.owner !== "cli" || !Array.isArray(parsed.artifacts)) {
        throw new Error("Ownership metadata is not CLI-owned.");
      }

      ownershipMetadata = parsed;
    } catch (error) {
      throw new Error(
        `Generated artifact ownership metadata is invalid: ${ownershipMetadataPath}. Restore the CLI-owned metadata file or remove conflicting generated artifacts before rerunning the command.`,
      );
    }
  }

  const ownershipByRelativePath = new Map(
    ownershipMetadata?.artifacts.map((artifact) => [artifact.path, artifact]) ?? [],
  );

  return generatedFilesToWrite.map((file) => {
    const fileExists = isReadableFile(file.path, options.fileExists);
    const currentContents = fileExists ? options.readFile(file.path) : null;
    const changed = !fileExists || currentContents !== file.contents;

    if (
      changed &&
      fileExists &&
      ownershipMetadataPath &&
      ownershipRootDir
    ) {
      if (file.path === ownershipMetadataPath) {
        if (!ownershipMetadata) {
          throw new Error(
            `Refusing to overwrite ${file.path} because no CLI ownership metadata is available. Remove the conflicting file or restore the generated ownership metadata first.`,
          );
        }
      } else {
        const relativePath = relative(ownershipRootDir, file.path);
        const trackedArtifact = ownershipByRelativePath.get(relativePath);

        if (options.allowedUntrackedOverwritePaths?.has(file.path)) {
          // Convert intentionally replaces original root entry files with CLI-owned wrappers.
        } else {
          if (!ownershipMetadata) {
            throw new Error(
              `Refusing to overwrite generated artifact without CLI ownership metadata: ${file.path}. Remove the conflicting file or restore ${ownershipMetadataPath} before rerunning the command.`,
            );
          }

          if (!trackedArtifact || trackedArtifact.kind !== file.kind) {
            throw new Error(
              `Generated artifact ownership conflict for ${file.path}. The file exists but is not tracked as CLI-owned in ${ownershipMetadataPath}.`,
            );
          }

          if (trackedArtifact.hash && currentContents && trackedArtifact.hash !== hashText(currentContents)) {
            throw new Error(
              `Generated artifact drift detected for ${file.path}. The file was modified outside rn-mt. Restore the CLI-owned file or remove it before rerunning the command.`,
            );
          }
        }
      }
    }

    if (changed) {
      ensureParentDir(file.path);
      options.writeFile(file.path, file.contents);
    }

    return {
      path: file.path,
      kind: file.kind,
      changed,
      hash: hashText(file.contents),
    };
  });
}

function applyAppKindSelection(
  report: ReturnType<typeof createBaselineAnalyzeReport>,
  selectedAppKind: RnMtRepoAppKind | null,
) {
  if (!selectedAppKind || !report.repo.app.candidates.includes(selectedAppKind)) {
    return report;
  }

  return {
    ...report,
    status: "ok" as const,
    repo: {
      ...report.repo,
      app: {
        ...report.repo.app,
        kind: selectedAppKind,
        candidates: [selectedAppKind],
        remediation: [],
      },
    },
  };
}

function readInteractiveLine() {
  const buffer = Buffer.alloc(1);
  let collected = "";

  while (true) {
    const bytesRead = readSync(process.stdin.fd, buffer, 0, 1, null);

    if (bytesRead === 0) {
      return collected.trim();
    }

    const character = buffer.toString("utf8", 0, bytesRead);

    if (character === "\n") {
      return collected.trim();
    }

    if (character !== "\r") {
      collected += character;
    }
  }
}

function createAnalyzeBlockedResult(
  report: ReturnType<typeof createBaselineAnalyzeReport>,
): RnMtCliAnalyzeBlockResult {
  return {
    command: "analyze",
    status: "blocked",
    analyze: report,
    reason: "Ambiguous repo classification requires an explicit app-kind selection.",
    remediation: report.repo.app.remediation,
  };
}

function getRepoLocalCliVersion(
  cwd: string,
  options: {
    fileExists: (path: string) => boolean;
    readFile: (path: string) => string;
  },
) {
  const packageJsonPath = join(cwd, "package.json");

  if (!options.fileExists(packageJsonPath)) {
    return null;
  }

  try {
    const packageJson = JSON.parse(options.readFile(packageJsonPath)) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    return packageJson.devDependencies?.["@rn-mt/cli"]
      ?? packageJson.dependencies?.["@rn-mt/cli"]
      ?? null;
  } catch {
    return null;
  }
}

function getVersionCompatibilityResult(
  cwd: string,
  options: {
    fileExists: (path: string) => boolean;
    readFile: (path: string) => string;
  },
): RnMtCliVersionCompatibilityResult | null {
  const localVersion = getRepoLocalCliVersion(cwd, options);

  if (!localVersion) {
    return null;
  }

  const globalVersion = getCliPackageVersion();
  const installCommand = createInstallCommandForPackageManager(
    detectPackageManagerName(cwd, options),
  );

  if (localVersion === globalVersion) {
    return {
      status: "compatible",
      globalVersion,
      localVersion,
      installCommand,
      remediation: [],
    };
  }

  return {
    status: "incompatible",
    globalVersion,
    localVersion,
    installCommand,
    reason: `Global rn-mt CLI version ${globalVersion} is incompatible with repo-local @rn-mt/cli version ${localVersion}.`,
    remediation: [
      `Upgrade or reinstall the global rn-mt CLI to version ${localVersion}.`,
      installCommand
        ? `Run ${installCommand} after aligning the repo-local rn-mt package versions.`
        : "Reinstall the repo-local rn-mt packages with the repo package manager after aligning versions.",
    ],
  };
}

function getExpectedRnMtPackagePlan(
  cwd: string,
  analyzeReportFactory: typeof createBaselineAnalyzeReport,
) {
  const analyzeReport = analyzeReportFactory(cwd, {
    scopeToProvidedRoot: true,
  });
  const packages: Array<{
    name: string;
    version: string;
    section: "dependencies" | "devDependencies";
  }> = [
    {
      name: "@rn-mt/runtime",
      version: getCliPackageVersion(),
      section: "dependencies",
    },
    {
      name: "@rn-mt/cli",
      version: getCliPackageVersion(),
      section: "devDependencies",
    },
  ];

  if (
    analyzeReport.repo.app.kind === "expo-managed"
    || analyzeReport.repo.app.kind === "expo-prebuild"
  ) {
    packages.push({
      name: "@rn-mt/expo-plugin",
      version: getCliPackageVersion(),
      section: "dependencies",
    });
  }

  return packages;
}

function createUpgradePackageJsonContents(
  cwd: string,
  packageJsonContents: string,
  analyzeReportFactory: typeof createBaselineAnalyzeReport,
) {
  const parsedPackageJson = JSON.parse(packageJsonContents) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    [key: string]: unknown;
  };
  const dependencies = { ...(parsedPackageJson.dependencies ?? {}) };
  const devDependencies = { ...(parsedPackageJson.devDependencies ?? {}) };
  const details: string[] = [];

  for (const expectedPackage of getExpectedRnMtPackagePlan(cwd, analyzeReportFactory)) {
    const targetRecord =
      expectedPackage.section === "dependencies" ? dependencies : devDependencies;
    const otherRecord =
      expectedPackage.section === "dependencies" ? devDependencies : dependencies;
    const previousVersion =
      targetRecord[expectedPackage.name] ?? otherRecord[expectedPackage.name] ?? null;

    if (otherRecord[expectedPackage.name]) {
      delete otherRecord[expectedPackage.name];
    }

    if (targetRecord[expectedPackage.name] !== expectedPackage.version) {
      targetRecord[expectedPackage.name] = expectedPackage.version;

      details.push(
        previousVersion
          ? `${expectedPackage.name}: ${previousVersion} -> ${expectedPackage.version}`
          : `${expectedPackage.name}: added ${expectedPackage.version}`,
      );
    }
  }

  const nextPackageJson = {
    ...parsedPackageJson,
    dependencies,
    devDependencies,
  };

  return {
    changed: details.length > 0,
    contents: `${JSON.stringify(nextPackageJson, null, 2)}\n`,
    details,
  };
}

function createUpgradeMetadataMigrations(
  cwd: string,
  options: {
    fileExists: (path: string) => boolean;
    readFile: (path: string) => string;
  },
) {
  const rewrittenFiles: Array<{ path: string; contents: string }> = [];
  const details: string[] = [];
  const hookStatePath = getHookStatePath(cwd);

  if (isReadableFile(hookStatePath, options.fileExists)) {
    try {
      const parsed = JSON.parse(options.readFile(hookStatePath)) as {
        schemaVersion?: number;
        tool?: string;
        hooks?: Partial<Record<RnMtCliHookName, RnMtCliHookStateEntry>>;
      };

      if (
        typeof parsed.hooks === "object"
        && parsed.hooks !== null
        && (parsed.schemaVersion !== 1 || parsed.tool !== "rn-mt")
      ) {
        rewrittenFiles.push({
          path: hookStatePath,
          contents: `${JSON.stringify(
            {
              schemaVersion: 1,
              tool: "rn-mt",
              hooks: parsed.hooks,
            } satisfies RnMtCliHookStateFile,
            null,
            2,
          )}\n`,
        });
        details.push("Migrated .rn-mt/hook-state.json to schemaVersion=1 with tool=rn-mt.");
      }
    } catch {
      // Ignore malformed legacy state in the first tracer-bullet slice.
    }
  }

  return {
    changed: rewrittenFiles.length > 0,
    rewrittenFiles,
    details,
  };
}

function promptForAmbiguousAppKind(
  report: ReturnType<typeof createBaselineAnalyzeReport>,
  io: RnMtCliIo,
): RnMtRepoAppKind | null {
  const { candidates } = report.repo.app;

  if (!process.stdin.isTTY) {
    return null;
  }

  io.stdout("Ambiguous repo classification detected.\n");
  io.stdout("Select the intended app kind for this run:\n");

  candidates.forEach((candidate, index) => {
    io.stdout(`${index + 1}. ${candidate}\n`);
  });

  io.stdout("Selection: ");

  while (true) {
    const response = readInteractiveLine();

    if (response.length === 0) {
      return null;
    }

    const selectedIndex = Number.parseInt(response, 10);

    if (
      Number.isInteger(selectedIndex) &&
      selectedIndex >= 1 &&
      selectedIndex <= candidates.length
    ) {
      return candidates[selectedIndex - 1] ?? null;
    }

    if (
      response === "expo-managed" ||
      response === "expo-prebuild" ||
      response === "bare-react-native"
    ) {
      return candidates.includes(response) ? response : null;
    }

    io.stdout("Invalid selection. Choose a number from the list or an exact app kind: ");
  }
}

function createWorkflowBlockedMessage(
  command: RnMtCliWorkflowCommand,
  report: ReturnType<typeof createBaselineAnalyzeReport>,
) {
  if (report.status === "ambiguous") {
    return `${command} requires an explicit --app-kind when repo classification is ambiguous.`;
  }

  return `${command} requires a supported Expo or bare React Native repo. Run rn-mt analyze for details.`;
}

function resolveWorkflowDispatch(
  command: RnMtCliWorkflowCommand,
  appKind: RnMtRepoAppKind,
  platform: RnMtTargetPlatform | null,
) {
  if (command !== "start" && !platform) {
    throw new Error(`${command} requires --platform ios or --platform android.`);
  }

  if (appKind === "expo-managed") {
    if (command === "start") {
      return {
        subprocessCommand: "expo",
        subprocessArgs: ["start"],
      };
    }

    if (command === "run") {
      return {
        subprocessCommand: "expo",
        subprocessArgs: ["start", `--${platform}`],
      };
    }

    return {
      subprocessCommand: "expo",
      subprocessArgs: [platform === "ios" ? "run:ios" : "run:android"],
    };
  }

  if (appKind === "expo-prebuild") {
    if (command === "start") {
      return {
        subprocessCommand: "expo",
        subprocessArgs: ["start", "--dev-client"],
      };
    }

    return {
      subprocessCommand: "expo",
      subprocessArgs: [platform === "ios" ? "run:ios" : "run:android"],
    };
  }

  if (appKind === "bare-react-native") {
    if (command === "start") {
      return {
        subprocessCommand: "react-native",
        subprocessArgs: ["start"],
      };
    }

    return {
      subprocessCommand: "react-native",
      subprocessArgs: [platform === "ios" ? "run-ios" : "run-android"],
    };
  }

  throw new Error(
    `${command} requires a supported Expo or bare React Native repo. Run rn-mt analyze for details.`,
  );
}

export function runCli(
  args: string[],
  options: {
    cwd?: string;
    io?: RnMtCliIo;
    analyzeReportFactory?: typeof createBaselineAnalyzeReport;
    env?: Record<string, string | undefined>;
    fileExists?: (path: string) => boolean;
    writeFile?: (path: string, contents: string) => void;
    readFile?: (path: string) => string;
    runSubprocess?: RnMtCliSubprocessRunner;
    promptForAppKind?: (
      report: ReturnType<typeof createBaselineAnalyzeReport>,
      io: RnMtCliIo,
    ) => RnMtRepoAppKind | null;
  } = {},
) {
  const io = options.io ?? defaultIo;
  const invocationCwd = options.cwd ?? getDefaultExecutionCwd();
  const analyzeReportFactory =
    options.analyzeReportFactory ?? createBaselineAnalyzeReport;
  const env = options.env ?? process.env;
  const fileExists = options.fileExists ?? existsSync;
  const writeFile = options.writeFile ?? ((path, contents) => writeFileSync(path, contents));
  const readFile = options.readFile ?? ((path) => readFileSync(path, "utf8"));
  const runSubprocess =
    options.runSubprocess ??
    ((command, subprocessArgs, subprocessOptions) =>
      spawnSync(command, subprocessArgs, {
        cwd: subprocessOptions.cwd,
        env: subprocessOptions.env,
        stdio: "inherit",
      }));
  const promptForAppKind = options.promptForAppKind ?? promptForAmbiguousAppKind;
  const [command, ...commandArgs] = args;
  const { optionArgs } = splitCommandArgs(commandArgs);

  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    io.stdout(`${helpText}\n`);
    return 0;
  }

  let executionContext: RnMtCliExecutionContext;

  try {
    executionContext = resolveExecutionContext(invocationCwd, optionArgs);
  } catch (error) {
    io.stderr(
      `${error instanceof Error ? error.message : "Unable to resolve app-root scope."}\n`,
    );
    return 1;
  }

  const cwd = executionContext.cwd;

  const versionCompatibility = getVersionCompatibilityResult(cwd, {
    fileExists,
    readFile,
  });

  if (command !== "upgrade" && versionCompatibility?.status === "incompatible") {
    if (wantsJsonOutput(commandArgs)) {
      io.stdout(
        `${JSON.stringify(
          {
            command,
            status: "blocked",
            reason: versionCompatibility.reason,
            compatibility: {
              globalVersion: versionCompatibility.globalVersion,
              localVersion: versionCompatibility.localVersion,
              installCommand: versionCompatibility.installCommand,
            },
            remediation: versionCompatibility.remediation,
          },
          null,
          2,
        )}\n`,
      );
    } else {
      io.stderr(`${versionCompatibility.reason}\n`);

      for (const remediationLine of versionCompatibility.remediation) {
        io.stderr(`${remediationLine}\n`);
      }
    }

    return 1;
  }

  if (command === "analyze") {
    const selectedAppKind = getSelectedAppKind(optionArgs);
    const initialReport = analyzeReportFactory(cwd, {
      scopeToProvidedRoot: executionContext.explicitlyScopedAppRoot,
    });
    let report = applyAppKindSelection(initialReport, selectedAppKind);

    if (report.status === "ambiguous" && isNonInteractive(commandArgs)) {
      const blockedResult = createAnalyzeBlockedResult(report);

      if (wantsJsonOutput(commandArgs)) {
        io.stdout(`${JSON.stringify(blockedResult, null, 2)}\n`);
      } else {
        io.stderr(`${blockedResult.reason}\n`);
        io.stderr(`${formatBaselineAnalyzeReport(report)}\n`);
      }

      return 1;
    }

    if (report.status === "ambiguous" && !selectedAppKind) {
      const promptedAppKind = promptForAppKind(report, io);

      if (!promptedAppKind) {
        const blockedResult = createAnalyzeBlockedResult(report);

        if (wantsJsonOutput(commandArgs)) {
          io.stdout(`${JSON.stringify(blockedResult, null, 2)}\n`);
        } else {
          io.stderr(`${blockedResult.reason}\n`);
          io.stderr(`${formatBaselineAnalyzeReport(report)}\n`);
        }

        return 1;
      }

      report = applyAppKindSelection(report, promptedAppKind);

      if (!wantsJsonOutput(commandArgs)) {
        io.stdout(`Selected app kind for this run: ${promptedAppKind}\n`);
      }
    }

    if (wantsJsonOutput(commandArgs)) {
      io.stdout(`${JSON.stringify(report, null, 2)}\n`);
      return 0;
    }

    io.stdout(`${formatBaselineAnalyzeReport(report)}\n`);
    return 0;
  }

  if (command === "init") {
    const report = analyzeReportFactory(cwd, {
      scopeToProvidedRoot: executionContext.explicitlyScopedAppRoot,
    });
    const initBlockedReason = getInitBlockedReason(report);

    if (initBlockedReason) {
      if (wantsJsonOutput(commandArgs)) {
        io.stdout(
          `${JSON.stringify(
            {
              command: "init",
              status: "blocked",
              analyze: report,
              reason: initBlockedReason,
            },
            null,
            2,
          )}\n`,
        );
      } else {
        io.stderr(`${initBlockedReason}\n`);
      }

      return 1;
    }

    const initResult = createInitResult(report);

    if (fileExists(initResult.manifestPath)) {
      const alreadyExistsMessage = `Manifest already exists: ${initResult.manifestPath}`;

      if (wantsJsonOutput(commandArgs)) {
        io.stdout(
          `${JSON.stringify(
            {
              command: "init",
              status: "skipped",
              analyze: report,
              manifestPath: initResult.manifestPath,
              manifest: initResult.manifest,
              reason: alreadyExistsMessage,
            },
            null,
            2,
          )}\n`,
        );
      } else {
        io.stdout(`${alreadyExistsMessage}\n`);
      }

      return 0;
    }

    writeFile(initResult.manifestPath, `${JSON.stringify(initResult.manifest, null, 2)}\n`);

    for (const generatedHostFile of initResult.generatedHostFiles) {
      writeFile(generatedHostFile.path, generatedHostFile.contents);
    }

    if (wantsJsonOutput(commandArgs)) {
      io.stdout(
        `${JSON.stringify(
          {
            command: "init",
            status: "created",
            analyze: report,
            manifestPath: initResult.manifestPath,
            manifest: initResult.manifest,
            generatedHostFiles: initResult.generatedHostFiles.map(
              ({ path, language }) => ({ path, language }),
            ),
          },
          null,
          2,
        )}\n`,
      );
      return 0;
    }

    io.stdout(`Created manifest: ${initResult.manifestPath}\n`);
    io.stdout(`Default tenant: ${initResult.manifest.defaults.tenant}\n`);
    io.stdout(`Default environment: ${initResult.manifest.defaults.environment}\n`);

    for (const generatedHostFile of initResult.generatedHostFiles) {
      io.stdout(`Generated host file: ${generatedHostFile.path}\n`);
    }

    return 0;
  }

  if (command === "convert") {
    const manifestPath = executionContext.manifestPath;

    if (!fileExists(manifestPath)) {
      io.stderr(`Manifest not found: ${manifestPath}\n`);
      return 1;
    }

    try {
      const manifest = readScopedManifest(manifestPath, cwd, readFile);
      const bridgeConfigModulePath = getSelectedBridgeConfigModulePath(commandArgs);
      const result = createConvertResult(cwd, manifest, {
        fileExists,
        readFile,
        bridgeConfigModulePath,
      });
      const movedFiles = result.movedFiles.map((file) => {
        const changed =
          !isReadableFile(file.destinationPath, fileExists) ||
          readFile(file.destinationPath) !== file.contents;

        if (changed) {
          ensureParentDir(file.destinationPath);
          writeFile(file.destinationPath, file.contents);
        }

        if (file.removeSourcePath && file.sourcePath !== file.destinationPath && fileExists(file.sourcePath)) {
          rmSync(file.sourcePath, { force: true });
        }

        return {
          sourcePath: file.sourcePath,
          destinationPath: file.destinationPath,
          changed,
        };
      });
      const generatedFiles = writeGeneratedFiles(result.generatedFiles, {
        fileExists,
        readFile,
        writeFile,
        allowedUntrackedOverwritePaths: new Set(
          result.movedFiles
            .filter((file) => file.sourcePath !== file.destinationPath && !file.removeSourcePath)
            .map((file) => file.sourcePath),
        ),
      }).map(({ path, kind, changed }) => ({
        path,
        kind,
        changed,
      }));
      const userOwnedFiles = result.userOwnedFiles.map((file) => {
        const changed = !isReadableFile(file.path, fileExists);

        if (changed) {
          ensureParentDir(file.path);
          writeFile(file.path, file.contents);
        }

        return {
          path: file.path,
          changed,
        };
      });
      const status =
        movedFiles.some((file) => file.changed)
          || generatedFiles.some((file) => file.changed)
          || userOwnedFiles.some((file) => file.changed)
          ? "converted"
          : "unchanged";

      if (wantsJsonOutput(commandArgs)) {
        io.stdout(
          `${JSON.stringify(
            {
              command: "convert",
              status,
              userOwnedFiles,
              packageManager: result.packageManager,
              localPackages: result.localPackages,
              installCommand: result.installCommand,
              movedFiles,
              generatedFiles,
            },
            null,
            2,
          )}\n`,
        );
        return 0;
      }

      io.stdout(`Convert status: ${status}\n`);
      io.stdout(
        `Detected package manager: ${result.packageManager.name} (${result.packageManager.source})\n`,
      );

      for (const file of movedFiles) {
        if (file.changed) {
          if (file.sourcePath === file.destinationPath) {
            io.stdout(`Updated file: ${file.sourcePath}\n`);
          } else {
            io.stdout(`Moved root source: ${file.sourcePath} -> ${file.destinationPath}\n`);
          }
        }
      }

      for (const file of generatedFiles) {
        if (file.changed) {
          io.stdout(`Generated file: ${file.path}\n`);
        }
      }

      for (const file of userOwnedFiles) {
        if (file.changed) {
          io.stdout(`Created user-owned extension file: ${file.path}\n`);
        }
      }

      if (result.installCommand) {
        io.stdout(`Install local rn-mt packages: ${result.installCommand}\n`);
      }

      return 0;
    } catch (error) {
      io.stderr(
        `${error instanceof Error ? error.message : "Unable to convert repo structure."}\n`,
      );
      return 1;
    }
  }

  if (command === "override" && commandArgs[0] === "create") {
    const selectedSharedPath = commandArgs[1] ?? null;

    if (!selectedSharedPath) {
      io.stderr(
        "override create requires a shared file path relative to src/rn-mt/shared.\n",
      );
      return 1;
    }

    const manifestPath = executionContext.manifestPath;

    if (!fileExists(manifestPath)) {
      io.stderr(`Manifest not found: ${manifestPath}\n`);
      return 1;
    }

    try {
      const manifest = readScopedManifest(manifestPath, cwd, readFile);
      const result = createOverrideCreateResult(cwd, manifest, selectedSharedPath, {
        fileExists,
        readFile,
      });
      const copiedChanged =
        !fileExists(result.copiedFile.destinationPath)
        || readFile(result.copiedFile.destinationPath) !== result.copiedFile.contents;

      if (copiedChanged) {
        ensureParentDir(result.copiedFile.destinationPath);
        writeFile(result.copiedFile.destinationPath, result.copiedFile.contents);
      }

      const generatedFiles = result.generatedFiles.map((file) => {
        const changed = !fileExists(file.path) || readFile(file.path) !== file.contents;

        if (changed) {
          ensureParentDir(file.path);
          writeFile(file.path, file.contents);
        }

        return {
          path: file.path,
          kind: file.kind,
          changed,
        };
      });

      if (wantsJsonOutput(commandArgs)) {
        io.stdout(
          `${JSON.stringify(
            {
              command: "override create",
              status: "created",
              copiedFile: {
                sourcePath: result.copiedFile.sourcePath,
                destinationPath: result.copiedFile.destinationPath,
                changed: copiedChanged,
              },
              generatedFiles,
            },
            null,
            2,
          )}\n`,
        );
        return 0;
      }

      io.stdout(
        `Created tenant override: ${result.copiedFile.sourcePath} -> ${result.copiedFile.destinationPath}\n`,
      );

      for (const file of generatedFiles) {
        if (file.changed) {
          io.stdout(`Updated file: ${file.path}\n`);
        }
      }

      return 0;
    } catch (error) {
      io.stderr(
        `${error instanceof Error ? error.message : "Unable to create tenant override."}\n`,
      );
      return 1;
    }
  }

  if (command === "override" && commandArgs[0] === "remove") {
    const selectedSharedPath = commandArgs[1] ?? null;

    if (!selectedSharedPath) {
      io.stderr(
        "override remove requires a file path relative to src/rn-mt/shared.\n",
      );
      return 1;
    }

    const manifestPath = executionContext.manifestPath;

    if (!fileExists(manifestPath)) {
      io.stderr(`Manifest not found: ${manifestPath}\n`);
      return 1;
    }

    try {
      const manifest = readScopedManifest(manifestPath, cwd, readFile);
      const result = createOverrideRemoveResult(cwd, manifest, selectedSharedPath, {
        fileExists,
        readFile,
      });

      if (fileExists(result.removedFilePath)) {
        rmSync(result.removedFilePath, { force: true });
      }

      const generatedFiles = result.generatedFiles.map((file) => {
        const changed = !fileExists(file.path) || readFile(file.path) !== file.contents;

        if (changed) {
          ensureParentDir(file.path);
          writeFile(file.path, file.contents);
        }

        return {
          path: file.path,
          kind: file.kind,
          changed,
        };
      });

      if (wantsJsonOutput(commandArgs)) {
        io.stdout(
          `${JSON.stringify(
            {
              command: "override remove",
              status: "removed",
              removedFilePath: result.removedFilePath,
              generatedFiles,
            },
            null,
            2,
          )}\n`,
        );
        return 0;
      }

      io.stdout(`Removed tenant override: ${result.removedFilePath}\n`);

      for (const file of generatedFiles) {
        if (file.changed) {
          io.stdout(`Updated file: ${file.path}\n`);
        }
      }

      return 0;
    } catch (error) {
      io.stderr(
        `${error instanceof Error ? error.message : "Unable to remove tenant override."}\n`,
      );
      return 1;
    }
  }

  if (command === "audit") {
    const manifestPath = executionContext.manifestPath;

    if (!fileExists(manifestPath)) {
      io.stderr(`Manifest not found: ${manifestPath}\n`);
      return 1;
    }

    try {
      const ignoreRules = getAuditIgnoreRules(commandArgs);
      const failThreshold = getAuditFailThreshold(commandArgs);
      const manifest = readScopedManifest(manifestPath, cwd, readFile);
      const result = createAuditResult(cwd, manifest, {
        fileExists,
        readFile,
      });
      const findings = applyAuditIgnoreRules(cwd, result.findings, ignoreRules);
      const failingFindings = countFailingAuditFindings(findings, failThreshold);
      const summary = {
        totalFindings: result.findings.length,
        ignoredFindings: result.findings.length - findings.length,
        reportedFindings: findings.length,
        failingFindings,
      };
      const status = findings.length > 0 ? "findings" : "passed";

      if (wantsJsonOutput(commandArgs)) {
        io.stdout(
          `${JSON.stringify(
            {
              command: "audit",
              status,
              failOn: failThreshold,
              ignores: ignoreRules,
              summary,
              findings,
            },
            null,
            2,
          )}\n`,
        );
        return failingFindings > 0 ? 1 : 0;
      }

      if (findings.length === 0) {
        io.stdout("Audit passed with no findings.\n");

        if (summary.ignoredFindings > 0) {
          io.stdout(
            `Ignored findings: ${summary.ignoredFindings} via ${ignoreRules.length} audit rule(s).\n`,
          );
        }

        return 0;
      }

      io.stdout(`Audit status: ${status}\n`);

      if (failThreshold !== null) {
        io.stdout(`Fail threshold: ${failThreshold}\n`);
      }

      if (summary.ignoredFindings > 0) {
        io.stdout(
          `Ignored findings: ${summary.ignoredFindings} via ${ignoreRules.length} audit rule(s).\n`,
        );
      }

      for (const finding of findings) {
        io.stdout(
          `${finding.severity} ${finding.confidence} ${finding.code}: ${finding.path}\n`,
        );
        io.stdout(`${finding.summary}\n`);

        for (const evidenceLine of finding.evidence) {
          io.stdout(`Evidence: ${evidenceLine}\n`);
        }
      }

      if (failingFindings === 0) {
        io.stdout(
          `No findings met fail threshold ${failThreshold}. Audit will exit successfully.\n`,
        );
        return 0;
      }

      return 1;
    } catch (error) {
      io.stderr(
        `${error instanceof Error ? error.message : "Unable to run audit."}\n`,
      );
      return 1;
    }
  }

  if (command === "doctor") {
    const manifestPath = executionContext.manifestPath;

    if (!fileExists(manifestPath)) {
      io.stderr(`Manifest not found: ${manifestPath}\n`);
      return 1;
    }

    try {
      const manifest = readScopedManifest(manifestPath, cwd, readFile);
      const result = createDoctorResult(cwd, manifest, {
        fileExists,
      });
      const warningCount = result.checks.filter((check) => check.status === "warning").length;
      const status = warningCount > 0 ? "warnings" : "passed";

      if (wantsJsonOutput(commandArgs)) {
        io.stdout(
          `${JSON.stringify(
            {
              command: "doctor",
              status,
              summary: {
                totalChecks: result.checks.length,
                warningChecks: warningCount,
              },
              checks: result.checks,
            },
            null,
            2,
          )}\n`,
        );
        return warningCount > 0 ? 1 : 0;
      }

      if (result.checks.length === 0) {
        io.stdout("Doctor passed with no applicable release integration checks.\n");
        return 0;
      }

      io.stdout(`Doctor status: ${status}\n`);

      for (const check of result.checks) {
        io.stdout(`${check.status.toUpperCase()} ${check.code}: ${check.summary}\n`);

        for (const detail of check.details) {
          io.stdout(`Detail: ${detail}\n`);
        }
      }

      return warningCount > 0 ? 1 : 0;
    } catch (error) {
      io.stderr(
        `${error instanceof Error ? error.message : "Unable to run doctor."}\n`,
      );
      return 1;
    }
  }

  if (command === "handoff") {
    const tenantId = getRequiredOption(commandArgs, "--tenant");

    if (!tenantId) {
      io.stderr("handoff requires --tenant <tenant-id>.\n");
      return 1;
    }

    const manifestPath = executionContext.manifestPath;

    if (!fileExists(manifestPath)) {
      io.stderr(`Manifest not found: ${manifestPath}\n`);
      return 1;
    }

    try {
      const manifest = readScopedManifest(manifestPath, cwd, readFile);
      const result = createHandoffPreflightResult(cwd, manifest, tenantId, {
        fileExists,
        readFile,
      });
      const outputDir = getDefaultHandoffOutputDir(cwd, tenantId);
      const archivePath = getDefaultHandoffArchivePath(outputDir);
      const force = hasFlag(commandArgs, "--force");
      const shouldZip = hasFlag(commandArgs, "--zip");

      if (result.status === "blocked") {
        if (wantsJsonOutput(commandArgs)) {
          io.stdout(
            `${JSON.stringify(
              {
                command: "handoff",
                status: result.status,
                tenant: result.tenant,
                output: {
                  path: outputDir,
                  replacedExisting: false,
                  gitInitialized: false,
                },
                package: {
                  enabled: shouldZip,
                  path: shouldZip ? archivePath : null,
                  created: false,
                },
                checks: result.checks,
              },
              null,
              2,
            )}\n`,
          );
        } else {
          io.stdout(`Handoff preflight status: ${result.status}\n`);
          io.stdout(`Target tenant: ${result.tenant.id}\n`);

          for (const check of result.checks) {
            io.stdout(`${check.status.toUpperCase()} ${check.code}: ${check.summary}\n`);

            for (const detail of check.details) {
              io.stdout(`Detail: ${detail}\n`);
            }
          }
        }

        return 1;
      }

      if (fileExists(outputDir) && !force) {
        const reason = `Handoff output already exists: ${outputDir}. Re-run with --force to replace it.`;

        if (wantsJsonOutput(commandArgs)) {
          io.stdout(
            `${JSON.stringify(
              {
                command: "handoff",
                status: "blocked",
                reason,
                tenant: result.tenant,
                output: {
                  path: outputDir,
                  replacedExisting: false,
                  gitInitialized: false,
                },
                package: {
                  enabled: shouldZip,
                  path: shouldZip ? archivePath : null,
                  created: false,
                },
                checks: result.checks,
              },
              null,
              2,
            )}\n`,
          );
        } else {
          io.stderr(`${reason}\n`);
        }

        return 1;
      }

      const replacedExisting = fileExists(outputDir);

      if (replacedExisting) {
        rmSync(outputDir, { recursive: true, force: true });
      }

      copyRepoForHandoff(cwd, outputDir);
      const outputManifest = {
        ...manifest,
        source: {
          ...manifest.source,
          rootDir: outputDir,
        },
      };
      const flattenResult = createHandoffFlattenResult(
        outputDir,
        outputManifest,
        tenantId,
        {
          fileExists,
          readFile,
        },
      );

      for (const file of flattenResult.restoredFiles) {
        ensureParentDir(file.destinationPath);
        writeFile(file.destinationPath, file.contents);
      }

      const cleanupResult = createHandoffCleanupResult(outputDir, {
        fileExists,
        readFile,
      });

      for (const file of cleanupResult.rewrittenFiles) {
        ensureParentDir(file.path);
        writeFile(file.path, file.contents);
      }

      for (const removedPath of cleanupResult.removedPaths) {
        rmSync(removedPath, { recursive: true, force: true });
      }

      const sanitizationResult = createHandoffSanitizationResult(
        outputDir,
        outputManifest,
        tenantId,
        {
          fileExists,
          readFile,
        },
      );

      for (const file of sanitizationResult.generatedFiles) {
        ensureParentDir(file.path);
        writeFile(file.path, file.contents);
      }

      for (const removedPath of sanitizationResult.removedPaths) {
        rmSync(removedPath, { recursive: true, force: true });
      }

      const handoffAuditResult = createHandoffIsolationAuditResult(
        outputDir,
        outputManifest,
        tenantId,
        {
          fileExists,
          readFile,
        },
      );

      if (handoffAuditResult.findings.length > 0) {
        if (wantsJsonOutput(commandArgs)) {
          io.stdout(
            `${JSON.stringify(
              {
                command: "handoff",
                status: "blocked",
                reason: "Final handoff isolation audit failed.",
                tenant: result.tenant,
                output: {
                  path: outputDir,
                  replacedExisting,
                  gitInitialized: false,
                },
                package: {
                  enabled: shouldZip,
                  path: shouldZip ? archivePath : null,
                  created: false,
                },
                cleanup: {
                  rewrittenFiles: cleanupResult.rewrittenFiles.map((file) => file.path),
                  removedPaths: cleanupResult.removedPaths,
                },
                sanitization: {
                  generatedFiles: sanitizationResult.generatedFiles.map((file) => file.path),
                  removedPaths: sanitizationResult.removedPaths,
                  reviewRequired: sanitizationResult.reviewRequired,
                  reviewChecklist: sanitizationResult.reviewChecklist,
                },
                audit: {
                  findings: handoffAuditResult.findings,
                },
                restoredFiles: flattenResult.restoredFiles.map((file) => ({
                  sourcePath: file.sourcePath,
                  destinationPath: file.destinationPath,
                })),
                checks: result.checks,
              },
              null,
              2,
            )}\n`,
          );
        } else {
          io.stdout("Handoff blocked: final isolation audit failed.\n");
          io.stdout(`Output kept for inspection: ${outputDir}\n`);

          for (const finding of handoffAuditResult.findings) {
            io.stdout(
              `${finding.severity} ${finding.confidence} ${finding.code}: ${finding.path}\n`,
            );
            io.stdout(`${finding.summary}\n`);

            for (const evidenceLine of finding.evidence) {
              io.stdout(`Evidence: ${evidenceLine}\n`);
            }
          }
        }

        return 1;
      }

      const gitInitResult = runSubprocess("git", ["init"], {
        cwd: outputDir,
        env,
      });

      if (gitInitResult.error) {
        throw gitInitResult.error;
      }

      if (gitInitResult.status !== 0) {
        throw new Error(
          `Unable to initialize fresh git repo in handoff output: ${outputDir}`,
        );
      }

      if (shouldZip && fileExists(archivePath)) {
        rmSync(archivePath, { force: true });
      }

      if (shouldZip) {
        const zipResult = runSubprocess(
          "zip",
          ["-qr", archivePath, basename(outputDir)],
          {
            cwd: dirname(outputDir),
            env,
          },
        );

        if (zipResult.error) {
          throw zipResult.error;
        }

        if (zipResult.status !== 0) {
          throw new Error(`Unable to package handoff output as zip: ${archivePath}`);
        }
      }

      if (wantsJsonOutput(commandArgs)) {
        io.stdout(
          `${JSON.stringify(
            {
              command: "handoff",
              status: "initialized",
              tenant: result.tenant,
              output: {
                path: outputDir,
                replacedExisting,
                gitInitialized: true,
              },
              package: {
                enabled: shouldZip,
                path: shouldZip ? archivePath : null,
                created: shouldZip,
              },
              cleanup: {
                rewrittenFiles: cleanupResult.rewrittenFiles.map((file) => file.path),
                removedPaths: cleanupResult.removedPaths,
              },
              sanitization: {
                generatedFiles: sanitizationResult.generatedFiles.map((file) => file.path),
                removedPaths: sanitizationResult.removedPaths,
                reviewRequired: sanitizationResult.reviewRequired,
                reviewChecklist: sanitizationResult.reviewChecklist,
              },
              audit: {
                findings: handoffAuditResult.findings,
              },
              restoredFiles: flattenResult.restoredFiles.map((file) => ({
                sourcePath: file.sourcePath,
                destinationPath: file.destinationPath,
              })),
              checks: result.checks,
            },
            null,
            2,
          )}\n`,
        );
        return 0;
      }

      io.stdout("Handoff preflight status: ready\n");
      io.stdout(`Target tenant: ${result.tenant.id}\n`);

      for (const check of result.checks) {
        io.stdout(`${check.status.toUpperCase()} ${check.code}: ${check.summary}\n`);

        for (const detail of check.details) {
          io.stdout(`Detail: ${detail}\n`);
        }
      }

      io.stdout(`Initialized handoff output: ${outputDir}\n`);
      io.stdout(`Restored original app structure files: ${flattenResult.restoredFiles.length}\n`);
      io.stdout(`Removed rn-mt machinery paths: ${cleanupResult.removedPaths.length}\n`);
      io.stdout(`Sanitized env and automation paths: ${sanitizationResult.removedPaths.length}\n`);
      if (shouldZip) {
        io.stdout(`Packaged handoff zip: ${archivePath}\n`);
      }
      io.stdout("Human review required: verify stripped automation and generated env examples.\n");
      io.stdout("Fresh git history was created in the output repo.\n");
      return 0;
    } catch (error) {
      io.stderr(
        `${error instanceof Error ? error.message : "Unable to run handoff preflight."}\n`,
      );
      return 1;
    }
  }

  if (command === "codemod") {
    const codemodName = commandArgs[0];

    if (codemodName !== "current-imports") {
      io.stderr("codemod requires a supported codemod name. Available: current-imports\n");
      return 1;
    }

    try {
      const shouldWrite = hasFlag(commandArgs, "--write");
      const result = createCurrentImportsCodemodResult(cwd, {
        fileExists,
        readFile,
      });

      if (shouldWrite) {
        for (const change of result.changes) {
          writeFile(change.path, change.after);
        }
      }

      const status = result.changes.length === 0
        ? "unchanged"
        : shouldWrite
          ? "written"
          : "preview";

      if (wantsJsonOutput(commandArgs)) {
        io.stdout(
          `${JSON.stringify(
            {
              command: "codemod",
              codemod: result.codemod,
              status,
              write: shouldWrite,
              changes: result.changes,
            },
            null,
            2,
          )}\n`,
        );
        return 0;
      }

      if (result.changes.length === 0) {
        io.stdout(`Codemod ${result.codemod} has no changes to apply.\n`);
        return 0;
      }

      io.stdout(
        shouldWrite
          ? `Applied codemod ${result.codemod} to ${result.changes.length} file(s).\n`
          : `Previewed codemod ${result.codemod} for ${result.changes.length} file(s). Re-run with --write to apply.\n`,
      );

      for (const change of result.changes) {
        io.stdout(`File: ${change.path}\n`);
      }

      return 0;
    } catch (error) {
      io.stderr(
        `${error instanceof Error ? error.message : "Unable to run codemod."}\n`,
      );
      return 1;
    }
  }

  if (command === "upgrade") {
    const manifestPath = executionContext.manifestPath;
    const packageJsonPath = join(cwd, "package.json");

    if (!fileExists(manifestPath)) {
      io.stderr(`Manifest not found: ${manifestPath}\n`);
      return 1;
    }

    if (!fileExists(packageJsonPath)) {
      io.stderr(`package.json not found: ${packageJsonPath}\n`);
      return 1;
    }

    try {
      const manifest = readScopedManifest(manifestPath, cwd, readFile);
      const packageManagerName = detectPackageManagerName(cwd, {
        fileExists,
        readFile,
      });
      const installCommand = createInstallCommandForPackageManager(packageManagerName);
      const packageUpgrade = createUpgradePackageJsonContents(
        cwd,
        readFile(packageJsonPath),
        analyzeReportFactory,
      );
      const stages: RnMtCliUpgradeStage[] = [];

      if (packageUpgrade.changed) {
        writeFile(packageJsonPath, packageUpgrade.contents);

        if (!packageManagerName) {
          throw new Error(
            "Unable to determine the repo package manager for rn-mt upgrade. Add a packageManager field or lockfile first.",
          );
        }

        const installResult = runSubprocess(packageManagerName, ["install"], {
          cwd,
          env,
        });

        if (installResult.error) {
          throw installResult.error;
        }

        if (installResult.status !== 0) {
          throw new Error(`Unable to run ${packageManagerName} install during rn-mt upgrade.`);
        }

        stages.push({
          name: "packages",
          status: "updated",
          details: [
            ...packageUpgrade.details,
            installCommand
              ? `Ran ${installCommand}.`
              : `Ran ${packageManagerName} install.`,
          ],
        });
      } else {
        stages.push({
          name: "packages",
          status: "unchanged",
          details: [
            `Local rn-mt package versions already match ${getCliPackageVersion()}.`,
          ],
        });
      }

      const metadataMigration = createUpgradeMetadataMigrations(cwd, {
        fileExists,
        readFile,
      });

      for (const file of metadataMigration.rewrittenFiles) {
        ensureParentDir(file.path);
        writeFile(file.path, file.contents);
      }

      stages.push({
        name: "metadata",
        status: metadataMigration.changed ? "updated" : "unchanged",
        details: metadataMigration.changed
          ? metadataMigration.details
          : ["No metadata migrations were required."],
      });

      const syncResult = createSyncResult(
        cwd,
        manifest,
        {
          tenant: manifest.defaults.tenant,
          environment: manifest.defaults.environment,
        },
        {
          env,
          fileExists,
          readFile,
        },
      );
      const generatedFiles = writeGeneratedFiles(syncResult.generatedFiles, {
        fileExists,
        readFile,
        writeFile,
      }).map(({ path, kind, changed }) => ({
        path,
        kind,
        changed,
      }));
      const syncStatus = generatedFiles.some((file) => file.changed)
        ? "updated"
        : "unchanged";

      stages.push({
        name: "sync",
        status: syncStatus,
        details: [
          `Target ${syncResult.target.tenant}/${syncResult.target.environment}.`,
          `Applied layers: ${syncResult.resolution.appliedLayers.join(" -> ")}.`,
          ...generatedFiles
            .filter((file) => file.changed)
            .map((file) => `Updated ${relative(cwd, file.path) || file.path}.`),
        ],
      });

      const auditResult = createAuditResult(cwd, manifest, {
        fileExists,
        readFile,
      });
      const auditStatus = auditResult.findings.length > 0 ? "findings" : "passed";

      stages.push({
        name: "audit",
        status: auditStatus,
        details:
          auditResult.findings.length > 0
            ? auditResult.findings.map(
                (finding) =>
                  `${finding.severity} ${finding.code}: ${relative(cwd, finding.path) || finding.path}`,
              )
            : ["Audit passed with no findings."],
      });

      const status =
        auditResult.findings.length > 0
          ? "findings"
          : stages.some((stage) => stage.status === "updated")
            ? "updated"
            : "unchanged";

      if (wantsJsonOutput(commandArgs)) {
        io.stdout(
          `${JSON.stringify(
            {
              command: "upgrade",
              status,
              compatibility:
                versionCompatibility
                  ? {
                      status: versionCompatibility.status,
                      globalVersion: versionCompatibility.globalVersion,
                      localVersion: versionCompatibility.localVersion,
                      installCommand: versionCompatibility.installCommand,
                    }
                  : null,
              stages,
              sync: {
                target: syncResult.target,
                resolution: syncResult.resolution,
                generatedFiles,
              },
              audit: {
                findings: auditResult.findings,
              },
            },
            null,
            2,
          )}\n`,
        );
        return auditResult.findings.length > 0 ? 1 : 0;
      }

      io.stdout(`Upgrade status: ${status}\n`);

      for (const stage of stages) {
        io.stdout(`${stage.status.toUpperCase()} ${stage.name}\n`);

        for (const detail of stage.details) {
          io.stdout(`Detail: ${detail}\n`);
        }
      }

      return auditResult.findings.length > 0 ? 1 : 0;
    } catch (error) {
      io.stderr(
        `${error instanceof Error ? error.message : "Unable to run rn-mt upgrade."}\n`,
      );
      return 1;
    }
  }

  if (command === "sync") {
    const manifestPath = executionContext.manifestPath;

    if (!fileExists(manifestPath)) {
      io.stderr(`Manifest not found: ${manifestPath}\n`);
      return 1;
    }

    try {
      const manifest = readScopedManifest(manifestPath, cwd, readFile);
      const selectedPlatform = getSelectedPlatform(commandArgs);
      const result = createSyncResult(
        cwd,
        manifest,
        selectedPlatform
          ? {
              tenant: manifest.defaults.tenant,
              environment: manifest.defaults.environment,
              platform: selectedPlatform,
            }
          : {
              tenant: manifest.defaults.tenant,
              environment: manifest.defaults.environment,
            },
        {
          env,
          fileExists,
          readFile,
        },
      );
      const generatedFiles = writeGeneratedFiles(result.generatedFiles, {
        fileExists,
        readFile,
        writeFile,
      }).map(({ path, kind, changed }) => ({
        path,
        kind,
        changed,
      }));
      const status = generatedFiles.some((file) => file.changed)
        ? "updated"
        : "unchanged";

      if (wantsJsonOutput(commandArgs)) {
        io.stdout(
          `${JSON.stringify(
            {
              command: "sync",
              status,
              target: result.target,
              resolution: result.resolution,
              runtime: result.runtime,
              generatedFiles,
            },
            null,
            2,
          )}\n`,
        );
        return 0;
      }

      if (status === "unchanged") {
        io.stdout(
          `Sync is up to date for ${result.target.tenant}/${result.target.environment}.\n`,
        );
        io.stdout(`Applied layers: ${result.resolution.appliedLayers.join(" -> ")}\n`);
        return 0;
      }

      io.stdout(`Synced target: ${result.target.tenant}/${result.target.environment}\n`);
      io.stdout(`Applied layers: ${result.resolution.appliedLayers.join(" -> ")}\n`);

      for (const file of generatedFiles) {
        if (file.changed) {
          io.stdout(`Updated file: ${file.path}\n`);
        }
      }

      return 0;
    } catch (error) {
      io.stderr(
        `${error instanceof Error ? error.message : "Unable to sync generated artifacts."}\n`,
      );
      return 1;
    }
  }

  if (command === "start" || command === "build" || command === "run") {
    const { optionArgs, passthroughArgs } = splitCommandArgs(commandArgs);
    const manifestPath = executionContext.manifestPath;

    if (!fileExists(manifestPath)) {
      io.stderr(`Manifest not found: ${manifestPath}\n`);
      return 1;
    }

    try {
      if (command === "run" && passthroughArgs.length > 0) {
        const manifest = readScopedManifest(manifestPath, cwd, readFile);
        const selectedPlatform = getSelectedPlatform(optionArgs);
        const target = selectedPlatform
          ? {
              tenant: manifest.defaults.tenant,
              environment: manifest.defaults.environment,
              platform: selectedPlatform,
            }
          : {
              tenant: manifest.defaults.tenant,
              environment: manifest.defaults.environment,
            };
        const resolvedEnv = createSubprocessEnv(cwd, manifest, target, {
          baseEnv: env,
          fileExists,
          readFile,
        });
        const [subprocessCommand, ...subprocessArgs] = passthroughArgs;

        if (!subprocessCommand) {
          io.stderr("run requires a subprocess command after --.\n");
          return 1;
        }

        const subprocessResult = runSubprocess(subprocessCommand, subprocessArgs, {
          cwd,
          env: applyLocalFirstSubprocessPolicy(
            prependLocalNodeModulesBin(cwd, resolvedEnv.env),
          ),
        });

        if (subprocessResult.error) {
          throw subprocessResult.error;
        }

        const exitCode = typeof subprocessResult.status === "number"
          ? subprocessResult.status
          : 1;

        if (wantsJsonOutput(optionArgs)) {
          io.stdout(
            `${JSON.stringify(
              {
                command: "run",
                status: exitCode === 0 ? "ok" : "failed",
                target,
                loadedEnvFiles: resolvedEnv.loadedFiles,
                subprocess: {
                  command: subprocessCommand,
                  args: subprocessArgs,
                  exitCode,
                  signal: subprocessResult.signal ?? null,
                },
              },
              null,
              2,
            )}\n`,
          );
        }

        return exitCode;
      }

      const selectedAppKind = getSelectedAppKind(optionArgs);
      const initialReport = analyzeReportFactory(cwd, {
        scopeToProvidedRoot: executionContext.explicitlyScopedAppRoot,
      });
      const report = applyAppKindSelection(initialReport, selectedAppKind);

      if (report.status === "ambiguous" || report.repo.app.kind === "unknown") {
        io.stderr(`${createWorkflowBlockedMessage(command, report)}\n`);
        return 1;
      }

      const manifest = readScopedManifest(manifestPath, cwd, readFile);
      const selectedPlatform = getSelectedPlatform(optionArgs);
      const target = selectedPlatform
        ? {
            tenant: manifest.defaults.tenant,
            environment: manifest.defaults.environment,
            platform: selectedPlatform,
          }
        : {
            tenant: manifest.defaults.tenant,
            environment: manifest.defaults.environment,
          };
      const resolvedEnv = createSubprocessEnv(cwd, manifest, target, {
        baseEnv: env,
        fileExists,
        readFile,
      });
      const { subprocessCommand, subprocessArgs } = resolveWorkflowDispatch(
        command,
        report.repo.app.kind,
        selectedPlatform,
      );
      const dispatchedArgs =
        command === "start" || command === "build"
          ? [...subprocessArgs, ...passthroughArgs]
          : subprocessArgs;

      const subprocessResult = runSubprocess(subprocessCommand, dispatchedArgs, {
        cwd,
        env: applyLocalFirstSubprocessPolicy(
          prependLocalNodeModulesBin(cwd, resolvedEnv.env),
        ),
      });

      if (subprocessResult.error) {
        throw subprocessResult.error;
      }

      const exitCode = typeof subprocessResult.status === "number"
        ? subprocessResult.status
        : 1;

      if (wantsJsonOutput(optionArgs)) {
        io.stdout(
          `${JSON.stringify(
              {
                command,
                status: exitCode === 0 ? "ok" : "failed",
                repoAppKind: report.repo.app.kind,
                target,
                loadedEnvFiles: resolvedEnv.loadedFiles,
                subprocess: {
                  command: subprocessCommand,
                  args: dispatchedArgs,
                  exitCode,
                  signal: subprocessResult.signal ?? null,
                },
            },
            null,
            2,
          )}\n`,
        );
      }

      return exitCode;
    } catch (error) {
      io.stderr(
        `${error instanceof Error ? error.message : "Unable to run subprocess."}\n`,
      );
      return 1;
    }
  }

  if (command === "hook") {
    const hookName = getHookName(commandArgs);

    if (!hookName) {
      io.stderr("hook requires one of: prestart, preandroid, preios, postinstall.\n");
      return 1;
    }

    const manifestPath = executionContext.manifestPath;

    if (!fileExists(manifestPath)) {
      io.stderr(`Manifest not found: ${manifestPath}\n`);
      return 1;
    }

    try {
      const manifestContents = readFile(manifestPath);
      const manifest = readScopedManifest(manifestPath, cwd, () => manifestContents);
      const platform = getHookPlatform(hookName);
      const target = platform
        ? {
            tenant: manifest.defaults.tenant,
            environment: manifest.defaults.environment,
            platform,
          }
        : {
            tenant: manifest.defaults.tenant,
            environment: manifest.defaults.environment,
          };
      const resolvedEnv = createSubprocessEnv(cwd, manifest, target, {
        baseEnv: env,
        fileExists,
        readFile,
      });
      const inputHash = createHookInputHash(
        cwd,
        manifestPath,
        manifestContents,
        target,
        resolvedEnv.loadedFiles,
        {
          fileExists,
          readFile,
        },
      );
      const existingState = readHookState(cwd, {
        fileExists,
        readFile,
      });
      const existingEntry = existingState?.hooks[hookName];
      const canSkipSync = Boolean(
        existingEntry &&
        existingEntry.inputHash === inputHash &&
        existingEntry.trackedFiles.every(
          (file) =>
            isReadableFile(file.path, fileExists) &&
            hashText(readFile(file.path)) === file.hash,
        ),
      );

      if (canSkipSync && existingEntry) {
        const banner = createHookBanner(cwd, existingEntry, "up-to-date");

        if (wantsJsonOutput(commandArgs)) {
          io.stdout(
            `${JSON.stringify(
              {
                command: "hook",
                hook: hookName,
                status: "up-to-date",
                target: existingEntry.target,
                identity: existingEntry.identity,
                configSource: existingEntry.configSource,
                banner,
              },
              null,
              2,
            )}\n`,
          );
        } else {
          io.stdout(`${banner}\n`);
        }

        return 0;
      }

      const result = createSyncResult(cwd, manifest, target, {
        env: resolvedEnv.env,
        fileExists,
        readFile,
      });
      const generatedFiles = writeGeneratedFiles(result.generatedFiles, {
        fileExists,
        readFile,
        writeFile,
      });
      const stateEntry: RnMtCliHookStateEntry = {
        inputHash,
        target: result.target,
        identity: result.runtime.identity,
        configSource: manifestPath,
        trackedFiles: generatedFiles.map((file) => ({
          path: file.path,
          hash: file.hash,
        })),
      };
      const stateFile: RnMtCliHookStateFile = {
        schemaVersion: 1,
        tool: "rn-mt",
        hooks: {
          ...(existingState?.hooks ?? {}),
          [hookName]: stateEntry,
        },
      };
      const statePath = getHookStatePath(cwd);

      ensureParentDir(statePath);
      writeFile(statePath, `${JSON.stringify(stateFile, null, 2)}\n`);

      const banner = createHookBanner(cwd, stateEntry, "updated");

      if (wantsJsonOutput(commandArgs)) {
        io.stdout(
          `${JSON.stringify(
            {
              command: "hook",
              hook: hookName,
              status: "updated",
              target: result.target,
              identity: result.runtime.identity,
              configSource: manifestPath,
              banner,
              generatedFiles: generatedFiles.map(({ path, kind, changed }) => ({
                path,
                kind,
                changed,
              })),
            },
            null,
            2,
          )}\n`,
        );
      } else {
        io.stdout(`${banner}\n`);
      }

      return 0;
    } catch (error) {
      io.stderr(
        `${error instanceof Error ? error.message : "Unable to run hook workflow."}\n`,
      );
      return 1;
    }
  }

  if (command === "tenant" && commandArgs[0] === "add") {
    const tenantId = getRequiredOption(commandArgs, "--id");
    const displayName = getSelectedTenantDisplayName(commandArgs);

    if (!tenantId) {
      io.stderr("tenant add requires --id <tenant-id>.\n");
      return 1;
    }

    const manifestPath = executionContext.manifestPath;

    if (!fileExists(manifestPath)) {
      io.stderr(`Manifest not found: ${manifestPath}\n`);
      return 1;
    }

    try {
      const manifest = readScopedManifest(manifestPath, cwd, readFile);
      const result = createTenantAddResult(cwd, manifest, {
        id: tenantId,
        ...(displayName ? { displayName } : {}),
      });

      writeFile(result.manifestPath, `${JSON.stringify(result.manifest, null, 2)}\n`);

      const createdFiles = result.createdFiles.map((file) => {
        const changed = !fileExists(file.path) || readFile(file.path) !== file.contents;

        if (changed) {
          ensureParentDir(file.path);
          writeFile(file.path, file.contents);
        }

        return {
          path: file.path,
          changed,
        };
      });

      if (wantsJsonOutput(commandArgs)) {
        io.stdout(
          `${JSON.stringify(
            {
              command: "tenant add",
              status: "added",
              manifestPath: result.manifestPath,
              tenant: result.tenant,
              createdFiles,
            },
            null,
            2,
          )}\n`,
        );
        return 0;
      }

      io.stdout(`Updated manifest: ${result.manifestPath}\n`);
      io.stdout(`Added tenant: ${result.tenant.id}\n`);
      io.stdout(`Display name: ${result.tenant.displayName}\n`);

      for (const file of createdFiles) {
        if (file.changed) {
          io.stdout(`Created file: ${file.path}\n`);
        }
      }

      return 0;
    } catch (error) {
      io.stderr(
        `${error instanceof Error ? error.message : "Unable to add tenant."}\n`,
      );
      return 1;
    }
  }

  if (command === "tenant" && commandArgs[0] === "rename") {
    const fromId = getRequiredOption(commandArgs, "--from");
    const toId = getRequiredOption(commandArgs, "--to");
    const displayName = getSelectedTenantDisplayName(commandArgs);

    if (!fromId || !toId) {
      io.stderr("tenant rename requires --from <tenant-id> and --to <tenant-id>.\n");
      return 1;
    }

    const manifestPath = executionContext.manifestPath;

    if (!fileExists(manifestPath)) {
      io.stderr(`Manifest not found: ${manifestPath}\n`);
      return 1;
    }

    try {
      const manifest = readScopedManifest(manifestPath, cwd, readFile);
      const result = createTenantRenameResult(
        cwd,
        manifest,
        {
          fromId,
          toId,
          ...(displayName ? { displayName } : {}),
        },
        {
          fileExists,
          readFile,
        },
      );

      writeFile(result.manifestPath, `${JSON.stringify(result.manifest, null, 2)}\n`);

      const renamedPaths = result.renamedPaths.map((pathChange) => {
        const changed = fileExists(pathChange.fromPath);

        if (changed) {
          ensureParentDir(pathChange.toPath);
          renameSync(pathChange.fromPath, pathChange.toPath);
        }

        return {
          fromPath: pathChange.fromPath,
          toPath: pathChange.toPath,
          changed,
        };
      });

      const generatedFiles = result.generatedFiles.map((file) => {
        const changed = !fileExists(file.path) || readFile(file.path) !== file.contents;

        if (changed) {
          ensureParentDir(file.path);
          writeFile(file.path, file.contents);
        }

        return {
          path: file.path,
          kind: file.kind,
          changed,
        };
      });

      if (wantsJsonOutput(commandArgs)) {
        io.stdout(
          `${JSON.stringify(
            {
              command: "tenant rename",
              status: "renamed",
              manifestPath: result.manifestPath,
              tenant: result.tenant,
              renamedPaths,
              generatedFiles,
            },
            null,
            2,
          )}\n`,
        );
        return 0;
      }

      io.stdout(`Updated manifest: ${result.manifestPath}\n`);
      io.stdout(`Renamed tenant: ${result.tenant.previousId} -> ${result.tenant.id}\n`);
      io.stdout(`Display name: ${result.tenant.displayName}\n`);

      for (const pathChange of renamedPaths) {
        if (pathChange.changed) {
          io.stdout(`Renamed path: ${pathChange.fromPath} -> ${pathChange.toPath}\n`);
        }
      }

      for (const file of generatedFiles) {
        if (file.changed) {
          io.stdout(`Updated file: ${file.path}\n`);
        }
      }

      return 0;
    } catch (error) {
      io.stderr(
        `${error instanceof Error ? error.message : "Unable to rename tenant."}\n`,
      );
      return 1;
    }
  }

  if (command === "tenant" && commandArgs[0] === "remove") {
    const tenantId = getRequiredOption(commandArgs, "--id");

    if (!tenantId) {
      io.stderr("tenant remove requires --id <tenant-id>.\n");
      return 1;
    }

    const manifestPath = executionContext.manifestPath;

    if (!fileExists(manifestPath)) {
      io.stderr(`Manifest not found: ${manifestPath}\n`);
      return 1;
    }

    try {
      const manifest = readScopedManifest(manifestPath, cwd, readFile);
      const result = createTenantRemoveResult(
        cwd,
        manifest,
        {
          id: tenantId,
        },
        {
          fileExists,
        },
      );

      writeFile(result.manifestPath, `${JSON.stringify(result.manifest, null, 2)}\n`);

      const removedPaths = result.removedPaths.map((path) => {
        const changed = fileExists(path);

        if (changed) {
          rmSync(path, { recursive: true, force: true });
        }

        return {
          path,
          changed,
        };
      });

      if (wantsJsonOutput(commandArgs)) {
        io.stdout(
          `${JSON.stringify(
            {
              command: "tenant remove",
              status: "removed",
              manifestPath: result.manifestPath,
              tenant: result.tenant,
              removedPaths,
            },
            null,
            2,
          )}\n`,
        );
        return 0;
      }

      io.stdout(`Updated manifest: ${result.manifestPath}\n`);
      io.stdout(`Removed tenant: ${result.tenant.id}\n`);
      io.stdout(`Display name: ${result.tenant.displayName}\n`);

      for (const removedPath of removedPaths) {
        if (removedPath.changed) {
          io.stdout(`Removed path: ${removedPath.path}\n`);
        }
      }

      return 0;
    } catch (error) {
      io.stderr(
        `${error instanceof Error ? error.message : "Unable to remove tenant."}\n`,
      );
      return 1;
    }
  }

  if (command === "target" && commandArgs[0] === "set") {
    const tenant = getRequiredOption(commandArgs, "--tenant");
    const environment = getRequiredOption(commandArgs, "--environment");

    if (!tenant || !environment) {
      io.stderr("target set requires --tenant <id> and --environment <id>.\n");
      return 1;
    }

    const manifestPath = executionContext.manifestPath;

    if (!fileExists(manifestPath)) {
      io.stderr(`Manifest not found: ${manifestPath}\n`);
      return 1;
    }

    const manifest = readScopedManifest(manifestPath, cwd, readFile);

    try {
      const result = createTargetSetResult(cwd, manifest, {
        tenant,
        environment,
      });

      writeFile(result.manifestPath, `${JSON.stringify(result.manifest, null, 2)}\n`);

      if (wantsJsonOutput(commandArgs)) {
        io.stdout(
          `${JSON.stringify(
            {
              command: "target set",
              status: "updated",
              manifestPath: result.manifestPath,
              defaults: result.manifest.defaults,
            },
            null,
            2,
          )}\n`,
        );
        return 0;
      }

      io.stdout(`Updated manifest: ${result.manifestPath}\n`);
      io.stdout(`Default tenant: ${result.manifest.defaults.tenant}\n`);
      io.stdout(`Default environment: ${result.manifest.defaults.environment}\n`);
      return 0;
    } catch (error) {
      io.stderr(
        `${error instanceof Error ? error.message : "Unable to update target defaults."}\n`,
      );
      return 1;
    }
  }

  io.stderr(
    "The command surface is not implemented yet. See docs/issues/0001-rn-mt-prd.md and docs/architecture.md for the approved product definition.\n",
  );
  return 1;
}

function isDirectExecution() {
  return process.argv[1]
    ? import.meta.url === pathToFileURL(process.argv[1]).href
    : false;
}

if (isDirectExecution()) {
  process.exit(runCli(process.argv.slice(2)));
}
