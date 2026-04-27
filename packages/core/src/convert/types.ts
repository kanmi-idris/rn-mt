/**
 * Type definitions for the convert module.
 */
import type { RnMtManifest } from "../manifest/types";
import type { RnMtSyncGeneratedFile } from "../sync/types";

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
  packageManager: {
    name: import("../analyze/types").RnMtPackageManagerName;
    source: import("../analyze/types").RnMtPackageManagerSource;
    raw: string | null;
  };
  localPackages: Array<{
    name: string;
    version: string;
    section: "dependencies" | "devDependencies";
  }>;
  installCommand: string | null;
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

export interface RnMtConvertModuleDependencies {
  workspace: import("../workspace").RnMtWorkspace;
}

export interface RnMtConvertRunOptions {
  manifest: RnMtManifest;
  bridgeConfigModulePath?: string | null;
}

export interface RnMtAliasRule {
  specifierPrefix: string;
  targetBasePath: string;
}
