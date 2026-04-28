/**
 * Implements the override core module.
 */
import { join, relative } from "node:path";

import type { RnMtManifest } from "../manifest/types";
import { RnMtWorkspace } from "../workspace";
import {
  createCurrentFacadeFile,
  isFacadeSourceFile,
  rebaseRelativeImportSpecifiers,
} from "../convert";

import type {
  RnMtOverrideCreateResult,
  RnMtOverrideCreatedFile,
  RnMtOverrideRemoveResult,
} from "./types";

/**
 * Encapsulates override behavior behind a constructor-backed seam.
 */
export class RnMtOverrideModule {
  /**
   * Initializes the override with its shared dependencies.
   */
  constructor(private readonly dependencies: { workspace: RnMtWorkspace }) {}

  /**
   * Creates the requested value for the override flow.
   */
  create(options: {
    manifest: RnMtManifest;
    selectedPath: string;
  }): RnMtOverrideCreateResult {
    const selectedSharedFile = this.resolveSharedOverrideSourcePath(
      options.selectedPath,
    );
    const destinationPath = join(
      this.dependencies.workspace.getTenantRootDir(
        options.manifest.defaults.tenant,
      ),
      selectedSharedFile.relativePath,
    );
    const sourceContents = isFacadeSourceFile(selectedSharedFile.sourcePath)
      ? this.dependencies.workspace.readText(selectedSharedFile.sourcePath)
      : this.dependencies.workspace.readBuffer(selectedSharedFile.sourcePath);
    const copiedFile: RnMtOverrideCreatedFile = {
      sourcePath: selectedSharedFile.sourcePath,
      destinationPath,
      contents: isFacadeSourceFile(selectedSharedFile.sourcePath)
        ? (() => {
            if (Buffer.isBuffer(sourceContents)) {
              throw new Error(
                `Expected override source contents to be text: ${selectedSharedFile.sourcePath}`,
              );
            }

            return rebaseRelativeImportSpecifiers(
              this.dependencies.workspace,
              selectedSharedFile.sourcePath,
              destinationPath,
              sourceContents,
            );
          })()
        : sourceContents,
    };

    if (this.dependencies.workspace.exists(copiedFile.destinationPath)) {
      throw new Error(
        `Tenant override already exists: ${copiedFile.destinationPath}`,
      );
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
            contents: sourceContents,
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

  /**
   * Removes the requested value for the override flow.
   */
  remove(options: {
    manifest: RnMtManifest;
    selectedPath: string;
  }): RnMtOverrideRemoveResult {
    const selectedOverride = this.resolveTenantOverrideSelectionPath(
      options.manifest.defaults.tenant,
      options.selectedPath,
    );
    const sharedSourcePath = join(
      this.dependencies.workspace.getSharedRootDir(),
      selectedOverride.relativePath,
    );

    if (!this.dependencies.workspace.isFile(selectedOverride.overridePath)) {
      throw new Error(
        `Tenant override not found: ${selectedOverride.overridePath}`,
      );
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

  /**
   * Resolves shared override source path for the override flow.
   */
  private resolveSharedOverrideSourcePath(selectedPath: string) {
    const sharedRootDir = this.dependencies.workspace.getSharedRootDir();
    const candidatePath = selectedPath.startsWith(sharedRootDir)
      ? selectedPath
      : join(sharedRootDir, selectedPath);
    const relativeSelectedPath = relative(sharedRootDir, candidatePath);

    if (
      relativeSelectedPath.startsWith("..") ||
      relativeSelectedPath.length === 0
    ) {
      throw new Error(
        "override create requires a file path inside src/rn-mt/shared.",
      );
    }

    if (!this.dependencies.workspace.isFile(candidatePath)) {
      throw new Error(`Shared file not found: ${candidatePath}`);
    }

    return {
      sourcePath: candidatePath,
      relativePath: relativeSelectedPath,
    };
  }

  /**
   * Resolves tenant override selection path for the override flow.
   */
  private resolveTenantOverrideSelectionPath(
    tenantId: string,
    selectedPath: string,
  ) {
    const tenantRootDir =
      this.dependencies.workspace.getTenantRootDir(tenantId);
    const candidatePath = selectedPath.startsWith(tenantRootDir)
      ? selectedPath
      : join(tenantRootDir, selectedPath);
    const relativeSelectedPath = relative(tenantRootDir, candidatePath);

    if (
      relativeSelectedPath.startsWith("..") ||
      relativeSelectedPath.length === 0
    ) {
      throw new Error(
        "override remove requires a file path inside src/rn-mt/tenants/<tenant-id>.",
      );
    }

    return {
      overridePath: candidatePath,
      relativePath: relativeSelectedPath,
    };
  }
}
