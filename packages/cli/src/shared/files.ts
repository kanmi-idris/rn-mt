/**
 * Provides shared files behavior for CLI execution.
 */
import { cpSync, mkdirSync, statSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";

import { hashText } from "@rn-mt/shared";

import type { RnMtCliOwnershipMetadataFile } from "../types";

/**
 * Encapsulates files behavior behind a constructor-backed seam.
 */
export class RnMtCliFilesModule {
  /**
   * Initializes the files with its shared dependencies.
   */
  constructor(
    private readonly dependencies: {
      fileExists: (path: string) => boolean;
      readFile: (path: string) => string;
      writeFile: (path: string, contents: string) => void;
    },
  ) {}

  /**
   * Ensures the parent directory exists before the CLI writes a generated file.
   */
  ensureParentDir(path: string) {
    mkdirSync(dirname(path), { recursive: true });
  }

  /**
   * Returns the default sibling output directory used for tenant handoff
   * exports.
   */
  getDefaultHandoffOutputDir(rootDir: string, tenantId: string) {
    return join(dirname(rootDir), `${basename(rootDir)}-handoff-${tenantId}`);
  }

  /**
   * Returns the default zip archive path for a handoff export directory.
   */
  getDefaultHandoffArchivePath(outputDir: string) {
    return `${outputDir}.zip`;
  }

  /**
   * Copies repo for handoff for the files flow.
   */
  copyRepoForHandoff(sourceDir: string, outputDir: string) {
    const skippedTopLevelNames = new Set([".git", "node_modules"]);

    cpSync(sourceDir, outputDir, {
      recursive: true,
      filter(sourcePath) {
        return !skippedTopLevelNames.has(basename(sourcePath));
      },
    });
  }

  /**
   * Returns true when a path exists and can be treated as a readable file.
   */
  isReadableFile(path: string) {
    if (!this.dependencies.fileExists(path)) {
      return false;
    }

    try {
      return statSync(path).isFile();
    } catch {
      return true;
    }
  }

  /**
   * Writes generated files for the files flow.
   */
  writeGeneratedFiles(
    generatedFilesToWrite: Array<{
      path: string;
      contents: string;
      kind: string;
    }>,
    options: {
      ownershipMetadataPath?: string;
      allowedUntrackedOverwritePaths?: Set<string>;
    } = {},
  ) {
    const ownershipMetadataPath =
      options.ownershipMetadataPath ??
      generatedFilesToWrite.find((file) => file.kind === "ownership-metadata")
        ?.path ??
      null;
    const ownershipRootDir = ownershipMetadataPath
      ? dirname(ownershipMetadataPath)
      : null;
    let ownershipMetadata: RnMtCliOwnershipMetadataFile | null = null;

    if (ownershipMetadataPath && this.isReadableFile(ownershipMetadataPath)) {
      try {
        const parsed = JSON.parse(
          this.dependencies.readFile(ownershipMetadataPath),
        ) as RnMtCliOwnershipMetadataFile;

        if (
          parsed.tool !== "rn-mt" ||
          parsed.owner !== "cli" ||
          !Array.isArray(parsed.artifacts)
        ) {
          throw new Error("Ownership metadata is not CLI-owned.");
        }

        ownershipMetadata = parsed;
      } catch {
        throw new Error(
          `Generated artifact ownership metadata is invalid: ${ownershipMetadataPath}. Restore the CLI-owned metadata file or remove conflicting generated artifacts before rerunning the command.`,
        );
      }
    }

    const ownershipByRelativePath = new Map(
      ownershipMetadata?.artifacts.map((artifact) => [
        artifact.path,
        artifact,
      ]) ?? [],
    );

    return generatedFilesToWrite.map((file) => {
      const fileExists = this.isReadableFile(file.path);
      const currentContents = fileExists
        ? this.dependencies.readFile(file.path)
        : null;
      const changed = !fileExists || currentContents !== file.contents;

      if (changed && fileExists && ownershipMetadataPath && ownershipRootDir) {
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

            if (
              trackedArtifact.hash &&
              currentContents &&
              trackedArtifact.hash !== hashText(currentContents)
            ) {
              throw new Error(
                `Generated artifact drift detected for ${file.path}. The file was modified outside rn-mt. Restore the CLI-owned file or remove it before rerunning the command.`,
              );
            }
          }
        }
      }

      if (changed) {
        this.ensureParentDir(file.path);
        this.dependencies.writeFile(file.path, file.contents);
      }

      return {
        path: file.path,
        kind: file.kind,
        changed,
        hash: hashText(file.contents),
      };
    });
  }
}
