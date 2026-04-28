/**
 * Type definitions for the override module.
 */
import type { RnMtSyncGeneratedFile } from "../sync/types";

export interface RnMtOverrideCreatedFile {
  sourcePath: string;
  destinationPath: string;
  contents: string | Buffer;
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
