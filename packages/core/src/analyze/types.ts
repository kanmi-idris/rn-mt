/**
 * Type definitions for the analyze module.
 */
import type { RnMtManifest } from "../manifest/types";

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

export interface RnMtInitGeneratedHostFile {
  path: string;
  contents: string;
  language: RnMtHostLanguage;
}

export interface RnMtInitResult {
  manifestPath: string;
  manifest: RnMtManifest;
  generatedHostFiles: RnMtInitGeneratedHostFile[];
}

export interface RnMtModuleContract {
  name: string;
  purpose: string;
  whyDeep: string;
  testFocus: string[];
}
