import type { RnMtAuditResult } from "../audit/types";

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
