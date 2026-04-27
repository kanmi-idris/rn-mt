/**
 * Implements the project init CLI command module.
 */
import type { RnMtCliCommandContext } from "../types";

/**
 * Handles the project init command flow.
 */
export class RnMtCliProjectInitCommand {
  /**
   * Initializes the project init with its shared dependencies.
   */
  constructor(private readonly context: RnMtCliCommandContext) {}

  /**
   * Executes the project init command flow.
   */
  run() {
    const report = this.context.analyzeReportFactory(this.context.cwd, {
      scopeToProvidedRoot:
        this.context.executionContext.explicitlyScopedAppRoot,
    });
    const initBlockedReason = this.context.core.getInitBlockedReason(report);
    const manifestPath = this.context.executionContext.manifestPath;

    if (initBlockedReason) {
      if (this.context.optionsModule.wantsJsonOutput()) {
        this.context.io.stdout(
          `${JSON.stringify(
            {
              command: "init",
              status: "blocked",
              analyze: report,
              reason: initBlockedReason,
            },
            null,
            2,
          )}\n`,
        );
      } else {
        this.context.io.stderr(`${initBlockedReason}\n`);
      }

      return 1;
    }

    if (this.context.fileExists(manifestPath)) {
      const alreadyExistsMessage = `Manifest already exists: ${manifestPath}`;

      if (this.context.optionsModule.wantsJsonOutput()) {
        this.context.io.stdout(
          `${JSON.stringify(
            {
              command: "init",
              status: "skipped",
              analyze: report,
              manifestPath,
              reason: alreadyExistsMessage,
            },
            null,
            2,
          )}\n`,
        );
      } else {
        this.context.io.stdout(`${alreadyExistsMessage}\n`);
      }

      return 0;
    }

    const initResult = this.context.core.createInitResult(report);

    this.context.writeFile(
      initResult.manifestPath,
      `${JSON.stringify(initResult.manifest, null, 2)}\n`,
    );

    for (const generatedHostFile of initResult.generatedHostFiles) {
      this.context.writeFile(
        generatedHostFile.path,
        generatedHostFile.contents,
      );
    }

    if (this.context.optionsModule.wantsJsonOutput()) {
      this.context.io.stdout(
        `${JSON.stringify(
          {
            command: "init",
            status: "created",
            analyze: report,
            manifestPath: initResult.manifestPath,
            manifest: initResult.manifest,
            generatedHostFiles: initResult.generatedHostFiles.map(
              ({ path, language }) => ({ path, language }),
            ),
          },
          null,
          2,
        )}\n`,
      );
      return 0;
    }

    this.context.io.stdout(`Created manifest: ${initResult.manifestPath}\n`);
    this.context.io.stdout(
      `Default tenant: ${initResult.manifest.defaults.tenant}\n`,
    );
    this.context.io.stdout(
      `Default environment: ${initResult.manifest.defaults.environment}\n`,
    );

    for (const generatedHostFile of initResult.generatedHostFiles) {
      this.context.io.stdout(
        `Generated host file: ${generatedHostFile.path}\n`,
      );
    }

    return 0;
  }
}
