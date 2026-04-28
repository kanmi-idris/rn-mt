/**
 * Implements the project convert CLI command module.
 */
import { rmSync } from "node:fs";

import type { RnMtCliCommandContext } from "../types";

/**
 * Handles the project convert command flow.
 */
export class RnMtCliProjectConvertCommand {
  /**
   * Initializes the project convert with its shared dependencies.
   */
  constructor(private readonly context: RnMtCliCommandContext) {}

  /**
   * Executes the project convert command flow.
   */
  run() {
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
      const bridgeConfigModulePath =
        this.context.optionsModule.getSelectedBridgeConfigModulePath();
      const result = this.context.core.createConvertResult(manifest, {
        bridgeConfigModulePath,
      });
      const movedFiles = result.movedFiles.map((file) => {
        const expectsBinary = Buffer.isBuffer(file.contents);
        const existingContents = this.context.files.isReadableFile(
          file.destinationPath,
        )
          ? this.context.files.readPathContents(file.destinationPath, {
              binary: expectsBinary,
            })
          : null;
        const changed =
          existingContents === null ||
          (Buffer.isBuffer(existingContents) && Buffer.isBuffer(file.contents)
            ? !existingContents.equals(file.contents)
            : existingContents !== file.contents);

        if (changed) {
          this.context.files.ensureParentDir(file.destinationPath);
          this.context.files.writePathContents(
            file.destinationPath,
            file.contents,
          );
        }

        if (
          file.removeSourcePath &&
          file.sourcePath !== file.destinationPath &&
          this.context.fileExists(file.sourcePath)
        ) {
          rmSync(file.sourcePath, { force: true });
        }

        return {
          sourcePath: file.sourcePath,
          destinationPath: file.destinationPath,
          changed,
        };
      });
      const generatedFiles = this.context.files
        .writeGeneratedFiles(result.generatedFiles, {
          allowedUntrackedOverwritePaths: new Set(
            result.movedFiles
              .filter(
                (file) =>
                  file.sourcePath !== file.destinationPath &&
                  !file.removeSourcePath,
              )
              .map((file) => file.sourcePath),
          ),
        })
        .map(({ path, kind, changed }) => ({
          path,
          kind,
          changed,
        }));
      const userOwnedFiles = result.userOwnedFiles.map((file) => {
        const changed = !this.context.files.isReadableFile(file.path);

        if (changed) {
          this.context.files.ensureParentDir(file.path);
          this.context.writeFile(file.path, file.contents);
        }

        return {
          path: file.path,
          changed,
        };
      });
      const status =
        movedFiles.some((file) => file.changed) ||
        generatedFiles.some((file) => file.changed) ||
        userOwnedFiles.some((file) => file.changed)
          ? "converted"
          : "unchanged";

      if (this.context.optionsModule.wantsJsonOutput()) {
        this.context.io.stdout(
          `${JSON.stringify(
            {
              command: "convert",
              status,
              userOwnedFiles,
              packageManager: result.packageManager,
              localPackages: result.localPackages,
              installCommand: result.installCommand,
              movedFiles,
              generatedFiles,
            },
            null,
            2,
          )}\n`,
        );
        return 0;
      }

      this.context.io.stdout(`Convert status: ${status}\n`);
      this.context.io.stdout(
        `Detected package manager: ${result.packageManager.name} (${result.packageManager.source})\n`,
      );

      for (const file of movedFiles) {
        if (file.changed) {
          if (file.sourcePath === file.destinationPath) {
            this.context.io.stdout(`Updated file: ${file.sourcePath}\n`);
          } else {
            this.context.io.stdout(
              `Moved root source: ${file.sourcePath} -> ${file.destinationPath}\n`,
            );
          }
        }
      }

      for (const file of generatedFiles) {
        if (file.changed) {
          this.context.io.stdout(`Generated file: ${file.path}\n`);
        }
      }

      for (const file of userOwnedFiles) {
        if (file.changed) {
          this.context.io.stdout(
            `Created user-owned extension file: ${file.path}\n`,
          );
        }
      }

      if (result.installCommand) {
        this.context.io.stdout(
          `Install local rn-mt packages: ${result.installCommand}\n`,
        );
      }

      return 0;
    } catch (error) {
      this.context.io.stderr(
        `${error instanceof Error ? error.message : "Unable to convert repo structure."}\n`,
      );
      return 1;
    }
  }
}
