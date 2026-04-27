/**
 * Type definitions for the sync module.
 */
import type {
  RnMtEnvSource,
  RnMtManifest,
  RnMtResolvedIdentity,
  RnMtResolvedRuntimeArtifact,
  RnMtResolvedTarget,
  RnMtTargetPlatform,
} from "../manifest/types";

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

export interface RnMtSyncGeneratedFile {
  path: string;
  contents: string;
  kind: RnMtGeneratedArtifactKind;
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

export interface RnMtDerivedAssetFingerprintRecord {
  outputPath: string;
  platform: RnMtTargetPlatform;
  environment: string;
  sourcePath: string;
  sourceFingerprint: string;
}

export interface RnMtDerivedAssetFingerprintMetadata {
  schemaVersion: 1;
  tool: "rn-mt";
  derivedAssets: RnMtDerivedAssetFingerprintRecord[];
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

export interface RnMtOwnershipMetadataFile {
  schemaVersion: 1;
  tool: "rn-mt";
  owner: "cli";
  artifacts: Array<{
    path: string;
    kind: string;
    hash?: string;
  }>;
}

export interface RnMtSyncModuleDependencies {
  manifest: typeof import("../manifest");
  workspace: import("../workspace").RnMtWorkspace;
}

export interface RnMtSyncRunOptions {
  manifest: RnMtManifest;
  target?: RnMtResolvedTarget;
  env?: RnMtEnvSource;
}
