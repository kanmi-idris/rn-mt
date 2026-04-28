/**
 * Implements the override CLI command module.
 */
import { rmSync } from "node:fs";

import type { RnMtCliCommandContext } from "../types";

/**
 * Aggregates related override subcommands behind one seam.
 */
export class RnMtCliOverrideCommands {
  /**
   * Initializes the override with its shared dependencies.
   */
  constructor(private readonly context: RnMtCliCommandContext) {}

  /**
   * Delegates the create command path to its dedicated subcommand module.
   */
  handleCreate() {
    const selectedSharedPath = this.context.commandArgs[1] ?? null;

    if (!selectedSharedPath) {
      this.context.io.stderr(
        "override create requires a shared file path relative to src/rn-mt/shared.\n",
      );
      return 1;
    }

    const manifestPath = this.context.executionContext.manifestPath;

    if (!this.context.fileExists(manifestPath)) {
      this.context.io.stderr(`Manifest not found: ${manifestPath}\n`);
      return 1;
    }

    try {
      const manifest = this.context.execution.readScopedManifest(
        manifestPath,
        this.context.cwd,
        this.context.readFile,
      );
      const result = this.context.core.createOverrideCreateResult(
        manifest,
        selectedSharedPath,
      );
      const copiedChanged =
        !this.context.fileExists(result.copiedFile.destinationPath) ||
        this.context.files.readPathContents(
          result.copiedFile.destinationPath,
          {
            binary: Buffer.isBuffer(result.copiedFile.contents),
          },
        ) !==
          result.copiedFile.contents;

      if (copiedChanged) {
        this.context.files.ensureParentDir(result.copiedFile.destinationPath);
        this.context.files.writePathContents(
          result.copiedFile.destinationPath,
          result.copiedFile.contents,
        );
      }

      const generatedFiles = result.generatedFiles.map((file) => {
        const changed =
          !this.context.fileExists(file.path) ||
          this.context.files.readPathContents(file.path) !== file.contents;

        if (changed) {
          this.context.files.ensureParentDir(file.path);
          this.context.files.writePathContents(file.path, file.contents);
        }

        return {
          path: file.path,
          kind: file.kind,
          changed,
        };
      });

      if (this.context.optionsModule.wantsJsonOutput()) {
        this.context.io.stdout(
          `${JSON.stringify(
            {
              command: "override create",
              status: "created",
              copiedFile: {
                sourcePath: result.copiedFile.sourcePath,
                destinationPath: result.copiedFile.destinationPath,
                changed: copiedChanged,
              },
              generatedFiles,
            },
            null,
            2,
          )}\n`,
        );
        return 0;
      }

      this.context.io.stdout(
        `Created tenant override: ${result.copiedFile.sourcePath} -> ${result.copiedFile.destinationPath}\n`,
      );

      for (const file of generatedFiles) {
        if (file.changed) {
          this.context.io.stdout(`Updated file: ${file.path}\n`);
        }
      }

      return 0;
    } catch (error) {
      this.context.io.stderr(
        `${error instanceof Error ? error.message : "Unable to create tenant override."}\n`,
      );
      return 1;
    }
  }

  /**
   * Delegates the remove command path to its dedicated subcommand module.
   */
  handleRemove() {
    const selectedSharedPath = this.context.commandArgs[1] ?? null;

    if (!selectedSharedPath) {
      this.context.io.stderr(
        "override remove requires a file path relative to src/rn-mt/shared.\n",
      );
      return 1;
    }

    const manifestPath = this.context.executionContext.manifestPath;

    if (!this.context.fileExists(manifestPath)) {
      this.context.io.stderr(`Manifest not found: ${manifestPath}\n`);
      return 1;
    }

    try {
      const manifest = this.context.execution.readScopedManifest(
        manifestPath,
        this.context.cwd,
        this.context.readFile,
      );
      const result = this.context.core.createOverrideRemoveResult(
        manifest,
        selectedSharedPath,
      );

      if (this.context.fileExists(result.removedFilePath)) {
        rmSync(result.removedFilePath, { force: true });
      }

      const generatedFiles = result.generatedFiles.map((file) => {
        const changed =
          !this.context.fileExists(file.path) ||
          this.context.files.readPathContents(file.path) !== file.contents;

        if (changed) {
          this.context.files.ensureParentDir(file.path);
          this.context.files.writePathContents(file.path, file.contents);
        }

        return {
          path: file.path,
          kind: file.kind,
          changed,
        };
      });

      if (this.context.optionsModule.wantsJsonOutput()) {
        this.context.io.stdout(
          `${JSON.stringify(
            {
              command: "override remove",
              status: "removed",
              removedFilePath: result.removedFilePath,
              generatedFiles,
            },
            null,
            2,
          )}\n`,
        );
        return 0;
      }

      this.context.io.stdout(
        `Removed tenant override: ${result.removedFilePath}\n`,
      );

      for (const file of generatedFiles) {
        if (file.changed) {
          this.context.io.stdout(`Updated file: ${file.path}\n`);
        }
      }

      return 0;
    } catch (error) {
      this.context.io.stderr(
        `${error instanceof Error ? error.message : "Unable to remove tenant override."}\n`,
      );
      return 1;
    }
  }
}
