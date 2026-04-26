import type { RnMtManifest } from "../manifest/types";
import type { RnMtSyncGeneratedFile } from "../sync/types";

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
