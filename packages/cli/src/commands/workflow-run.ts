/**
 * Implements the workflow run CLI command module.
 */
import type { RnMtCliCommandContext } from "../types";

/**
 * Handles the workflow run command flow.
 */
export class RnMtCliWorkflowRunCommand {
  /**
   * Initializes the workflow run with its shared dependencies.
   */
  constructor(private readonly context: RnMtCliCommandContext) {}

  /**
   * Executes the workflow run command flow.
   */
  run() {
    const passthroughArgs = this.context.optionsModule.passthroughArgs;
    const manifestPath = this.context.executionContext.manifestPath;

    if (!this.context.fileExists(manifestPath)) {
      this.context.io.stderr(`Manifest not found: ${manifestPath}\n`);
      return 1;
    }

    try {
      if (this.context.command === "run" && passthroughArgs.length > 0) {
        const manifest = this.context.execution.readScopedManifest(
          manifestPath,
          this.context.cwd,
          this.context.readFile,
        );
        const selectedPlatform =
          this.context.optionsModule.getSelectedPlatform();
        const target = selectedPlatform
          ? {
              tenant: manifest.defaults.tenant,
              environment: manifest.defaults.environment,
              platform: selectedPlatform,
            }
          : {
              tenant: manifest.defaults.tenant,
              environment: manifest.defaults.environment,
            };
        const resolvedEnv = this.context.core.createSubprocessEnv(
          manifest,
          target,
          {
            baseEnv: this.context.env,
          },
        );
        const [subprocessCommand, ...subprocessArgs] = passthroughArgs;

        if (!subprocessCommand) {
          this.context.io.stderr(
            "run requires a subprocess command after --.\n",
          );
          return 1;
        }

        const subprocessResult = this.context.runSubprocess(
          subprocessCommand,
          subprocessArgs,
          {
            cwd: this.context.cwd,
            env: this.context.workflow.applyLocalFirstSubprocessPolicy(
              this.context.workflow.prependLocalNodeModulesBin(resolvedEnv.env),
            ),
          },
        );

        if (subprocessResult.error) {
          throw subprocessResult.error;
        }

        const exitCode =
          typeof subprocessResult.status === "number"
            ? subprocessResult.status
            : 1;

        if (this.context.optionsModule.wantsJsonOutput()) {
          this.context.io.stdout(
            `${JSON.stringify(
              {
                command: "run",
                status: exitCode === 0 ? "ok" : "failed",
                target,
                loadedEnvFiles: resolvedEnv.loadedFiles,
                subprocess: {
                  command: subprocessCommand,
                  args: subprocessArgs,
                  exitCode,
                  signal: subprocessResult.signal ?? null,
                },
              },
              null,
              2,
            )}\n`,
          );
        }

        return exitCode;
      }

      const selectedAppKind = this.context.optionsModule.getSelectedAppKind();
      const initialReport = this.context.analyzeReportFactory(
        this.context.cwd,
        {
          scopeToProvidedRoot:
            this.context.executionContext.explicitlyScopedAppRoot,
        },
      );
      const report = this.context.interaction.applyAppKindSelection(
        initialReport,
        selectedAppKind,
      );

      if (report.status === "ambiguous" || report.repo.app.kind === "unknown") {
        this.context.io.stderr(
          `${this.context.workflow.createWorkflowBlockedMessage(
            this.context.command as "start" | "build" | "run",
            report,
          )}\n`,
        );
        return 1;
      }

      const manifest = this.context.execution.readScopedManifest(
        manifestPath,
        this.context.cwd,
        this.context.readFile,
      );
      const selectedPlatform = this.context.optionsModule.getSelectedPlatform();
      const target = selectedPlatform
        ? {
            tenant: manifest.defaults.tenant,
            environment: manifest.defaults.environment,
            platform: selectedPlatform,
          }
        : {
            tenant: manifest.defaults.tenant,
            environment: manifest.defaults.environment,
          };
      const resolvedEnv = this.context.core.createSubprocessEnv(
        manifest,
        target,
        {
          baseEnv: this.context.env,
        },
      );
      const { subprocessCommand, subprocessArgs } =
        this.context.workflow.resolveWorkflowDispatch(
          this.context.command as "start" | "build" | "run",
          report.repo.app.kind,
          selectedPlatform,
        );
      const dispatchedArgs =
        this.context.command === "start" || this.context.command === "build"
          ? [...subprocessArgs, ...passthroughArgs]
          : subprocessArgs;

      const subprocessResult = this.context.runSubprocess(
        subprocessCommand,
        dispatchedArgs,
        {
          cwd: this.context.cwd,
          env: this.context.workflow.applyLocalFirstSubprocessPolicy(
            this.context.workflow.prependLocalNodeModulesBin(resolvedEnv.env),
          ),
        },
      );

      if (subprocessResult.error) {
        throw subprocessResult.error;
      }

      const exitCode =
        typeof subprocessResult.status === "number"
          ? subprocessResult.status
          : 1;

      if (this.context.optionsModule.wantsJsonOutput()) {
        this.context.io.stdout(
          `${JSON.stringify(
            {
              command: this.context.command,
              status: exitCode === 0 ? "ok" : "failed",
              repoAppKind: report.repo.app.kind,
              target,
              loadedEnvFiles: resolvedEnv.loadedFiles,
              subprocess: {
                command: subprocessCommand,
                args: dispatchedArgs,
                exitCode,
                signal: subprocessResult.signal ?? null,
              },
            },
            null,
            2,
          )}\n`,
        );
      }

      return exitCode;
    } catch (error) {
      this.context.io.stderr(
        `${error instanceof Error ? error.message : "Unable to run subprocess."}\n`,
      );
      return 1;
    }
  }
}
