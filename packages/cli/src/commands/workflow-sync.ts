/**
 * Implements the workflow sync CLI command module.
 */
import type { RnMtCliCommandContext } from "../types";

/**
 * Handles the workflow sync command flow.
 */
export class RnMtCliWorkflowSyncCommand {
  /**
   * Initializes the workflow sync with its shared dependencies.
   */
  constructor(private readonly context: RnMtCliCommandContext) {}

  /**
   * Executes the workflow sync command flow.
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
      const selectedPlatform = this.context.optionsModule.getSelectedPlatform();
      const result = this.context.core.createSyncResult(
        manifest,
        selectedPlatform
          ? {
              tenant: manifest.defaults.tenant,
              environment: manifest.defaults.environment,
              platform: selectedPlatform,
            }
          : {
              tenant: manifest.defaults.tenant,
              environment: manifest.defaults.environment,
            },
        {
          env: this.context.env,
        },
      );
      const generatedFiles = this.context.files
        .writeGeneratedFiles(result.generatedFiles)
        .map(({ path, kind, changed }) => ({
          path,
          kind,
          changed,
        }));
      const status = generatedFiles.some((file) => file.changed)
        ? "updated"
        : "unchanged";

      if (this.context.optionsModule.wantsJsonOutput()) {
        this.context.io.stdout(
          `${JSON.stringify(
            {
              command: "sync",
              status,
              target: result.target,
              resolution: result.resolution,
              runtime: result.runtime,
              generatedFiles,
            },
            null,
            2,
          )}\n`,
        );
        return 0;
      }

      if (status === "unchanged") {
        this.context.io.stdout(
          `Sync is up to date for ${result.target.tenant}/${result.target.environment}.\n`,
        );
        this.context.io.stdout(
          `Applied layers: ${result.resolution.appliedLayers.join(" -> ")}\n`,
        );
        return 0;
      }

      this.context.io.stdout(
        `Synced target: ${result.target.tenant}/${result.target.environment}\n`,
      );
      this.context.io.stdout(
        `Applied layers: ${result.resolution.appliedLayers.join(" -> ")}\n`,
      );

      for (const file of generatedFiles) {
        if (file.changed) {
          this.context.io.stdout(`Updated file: ${file.path}\n`);
        }
      }

      return 0;
    } catch (error) {
      this.context.io.stderr(
        `${error instanceof Error ? error.message : "Unable to sync generated artifacts."}\n`,
      );
      return 1;
    }
  }
}
