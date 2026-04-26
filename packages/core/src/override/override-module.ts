import { join, relative } from "node:path";

import type { RnMtManifest } from "../manifest/types";
import { RnMtWorkspace } from "../workspace";
import { createCurrentFacadeFile } from "../convert";

import type { RnMtOverrideCreateResult, RnMtOverrideCreatedFile, RnMtOverrideRemoveResult } from "./types";

function resolveSharedOverrideSourcePath(
  workspace: RnMtWorkspace,
  selectedPath: string,
) {
  const sharedRootDir = workspace.getSharedRootDir();
  const candidatePath = selectedPath.startsWith(sharedRootDir)
    ? selectedPath
    : join(sharedRootDir, selectedPath);
  const relativeSelectedPath = relative(sharedRootDir, candidatePath);

  if (relativeSelectedPath.startsWith("..") || relativeSelectedPath.length === 0) {
    throw new Error(
      "override create requires a file path inside src/rn-mt/shared.",
    );
  }

  if (!workspace.isFile(candidatePath)) {
    throw new Error(`Shared file not found: ${candidatePath}`);
  }

  return {
    sourcePath: candidatePath,
    relativePath: relativeSelectedPath,
  };
}

function resolveTenantOverrideSelectionPath(
  workspace: RnMtWorkspace,
  tenantId: string,
  selectedPath: string,
) {
  const tenantRootDir = workspace.getTenantRootDir(tenantId);
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

export class RnMtOverrideModule {
  constructor(private readonly dependencies: { workspace: RnMtWorkspace }) {}

  create(options: {
    manifest: RnMtManifest;
    selectedPath: string;
  }): RnMtOverrideCreateResult {
    const selectedSharedFile = resolveSharedOverrideSourcePath(
      this.dependencies.workspace,
      options.selectedPath,
    );
    const copiedFile: RnMtOverrideCreatedFile = {
      sourcePath: selectedSharedFile.sourcePath,
      destinationPath: join(
        this.dependencies.workspace.getTenantRootDir(options.manifest.defaults.tenant),
        selectedSharedFile.relativePath,
      ),
      contents: this.dependencies.workspace.readText(selectedSharedFile.sourcePath),
    };

    if (this.dependencies.workspace.exists(copiedFile.destinationPath)) {
      throw new Error(`Tenant override already exists: ${copiedFile.destinationPath}`);
    }

    return {
      rootDir: this.dependencies.workspace.rootDir,
      copiedFile,
      generatedFiles: [
        createCurrentFacadeFile(
          this.dependencies.workspace,
          options.manifest.defaults.tenant,
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

  remove(options: {
    manifest: RnMtManifest;
    selectedPath: string;
  }): RnMtOverrideRemoveResult {
    const selectedOverride = resolveTenantOverrideSelectionPath(
      this.dependencies.workspace,
      options.manifest.defaults.tenant,
      options.selectedPath,
    );
    const sharedSourcePath = join(
      this.dependencies.workspace.getSharedRootDir(),
      selectedOverride.relativePath,
    );

    if (!this.dependencies.workspace.isFile(selectedOverride.overridePath)) {
      throw new Error(`Tenant override not found: ${selectedOverride.overridePath}`);
    }

    if (!this.dependencies.workspace.isFile(sharedSourcePath)) {
      throw new Error(`Shared file not found: ${sharedSourcePath}`);
    }

    return {
      rootDir: this.dependencies.workspace.rootDir,
      removedFilePath: selectedOverride.overridePath,
      generatedFiles: [
        createCurrentFacadeFile(
          this.dependencies.workspace,
          options.manifest.defaults.tenant,
          {
            path: sharedSourcePath,
            contents: this.dependencies.workspace.readText(sharedSourcePath),
          },
          {
            preferShared: true,
          },
        ),
      ],
    };
  }
}
