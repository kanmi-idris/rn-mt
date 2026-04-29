/**
 * Defines the shared CLI types used for IO, subprocesses, ownership metadata,
 * and command-module wiring.
 */
import type {
  RnMtAuditFinding,
  RnMtBaselineAnalyzeReport,
  RnMtManifest,
  RnMtRepoAppKind,
} from "@_molaidrislabs/core";
import type { RnMtTargetPlatform } from "@_molaidrislabs/shared";
import type { RnMtCliCoreAdapters } from "./core-adapters";
import type { RnMtCliAuditModule } from "./shared/audit";
import type { RnMtCliExecutionModule } from "./shared/execution";
import type { RnMtCliFilesModule } from "./shared/files";
import type { RnMtCliHooksModule } from "./shared/hooks";
import type { RnMtCliInteractionModule } from "./shared/interaction";
import type { RnMtCliOptionsModule } from "./shared/options";
import type { RnMtCliUpgradeModule } from "./shared/upgrade";
import type { RnMtCliVersionModule } from "./shared/version";
import type { RnMtCliWorkflowModule } from "./shared/workflow";

export interface RnMtCliIo {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

export interface RnMtCliSubprocessResult {
  status: number | null;
  error?: Error;
  signal?: NodeJS.Signals | null;
}

export interface RnMtCliSubprocessRunner {
  (
    command: string,
    args: string[],
    options: {
      cwd: string;
      env: Record<string, string | undefined>;
    },
  ): RnMtCliSubprocessResult;
}

export interface RnMtCliAnalyzeBlockResult {
  command: "analyze";
  status: "blocked";
  analyze: RnMtBaselineAnalyzeReport;
  reason: string;
  remediation: string[];
}

export type RnMtCliWorkflowCommand = "start" | "run" | "build";

export interface RnMtCliVersionCompatibilityResult {
  status: "compatible" | "incompatible";
  globalVersion: string;
  localVersion: string;
  installCommand: string | null;
  reason?: string;
  remediation: string[];
}

export type RnMtCliHookName =
  | "prestart"
  | "preandroid"
  | "preios"
  | "postinstall";

export interface RnMtCliHookStateEntry {
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

export interface RnMtCliHookStateFile {
  schemaVersion: 1;
  tool: "rn-mt";
  hooks: Partial<Record<RnMtCliHookName, RnMtCliHookStateEntry>>;
}

export interface RnMtCliOwnershipMetadataFile {
  schemaVersion: 1;
  tool: "rn-mt";
  owner: "cli";
  artifacts: Array<{
    path: string;
    kind: string;
    hash?: string;
  }>;
}

export interface RnMtCliExecutionContext {
  cwd: string;
  manifestPath: string;
  explicitlyScopedAppRoot: boolean;
}

export interface RnMtCliAnalyzeReportFactory {
  (
    rootDir?: string,
    options?: {
      scopeToProvidedRoot?: boolean;
    },
  ): RnMtBaselineAnalyzeReport;
}

export interface RnMtCliUpgradeStage {
  name: "packages" | "metadata" | "sync" | "audit";
  status: "updated" | "unchanged" | "passed" | "findings";
  details: string[];
}

export interface RnMtCliWorkspaceOverrides {
  fileExists?: (path: string) => boolean;
  readFile?: (path: string) => string;
}

export interface RnMtCliAuditSummary {
  failOn: "P0" | "P1" | "P2" | "P3" | null;
  ignoreRules: string[];
  findings: RnMtAuditFinding[];
}

export interface RnMtCliCoreManifestTarget {
  manifest: RnMtManifest;
  tenantId: string;
}

export interface RnMtCliCommandContext {
  command: string;
  commandArgs: string[];
  optionArgs: string[];
  cwd: string;
  env: Record<string, string | undefined>;
  io: RnMtCliIo;
  executionContext: RnMtCliExecutionContext;
  core: RnMtCliCoreAdapters;
  audit: RnMtCliAuditModule;
  execution: RnMtCliExecutionModule;
  files: RnMtCliFilesModule;
  hooks: RnMtCliHooksModule;
  interaction: RnMtCliInteractionModule;
  optionsModule: RnMtCliOptionsModule;
  workflow: RnMtCliWorkflowModule;
  upgrade: RnMtCliUpgradeModule;
  version: RnMtCliVersionModule;
  analyzeReportFactory: RnMtCliAnalyzeReportFactory;
  fileExists: (path: string) => boolean;
  writeFile: (path: string, contents: string) => void;
  readFile: (path: string) => string;
  runSubprocess: RnMtCliSubprocessRunner;
  versionCompatibility: RnMtCliVersionCompatibilityResult | null;
}

export interface RnMtCliRunOptions {
  cwd?: string;
  io?: RnMtCliIo;
  analyzeReportFactory?: RnMtCliAnalyzeReportFactory;
  env?: Record<string, string | undefined>;
  fileExists?: (path: string) => boolean;
  writeFile?: (path: string, contents: string) => void;
  readFile?: (path: string) => string;
  runSubprocess?: RnMtCliSubprocessRunner;
  promptForAppKind?: (
    report: RnMtBaselineAnalyzeReport,
    io: RnMtCliIo,
  ) => RnMtRepoAppKind | null;
}

export type { RnMtRepoAppKind };
