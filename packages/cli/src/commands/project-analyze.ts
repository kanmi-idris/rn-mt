/**
 * Implements the project analyze CLI command module.
 */
import type { RnMtCliCommandContext } from "../types";

/**
 * Handles the project analyze command flow.
 */
export class RnMtCliProjectAnalyzeCommand {
  /**
   * Initializes the project analyze with its shared dependencies.
   */
  constructor(private readonly context: RnMtCliCommandContext) {}

  /**
   * Executes the project analyze command flow.
   */
  run() {
    const selectedAppKind = this.context.optionsModule.getSelectedAppKind();
    const initialReport = this.context.analyzeReportFactory(this.context.cwd, {
      scopeToProvidedRoot:
        this.context.executionContext.explicitlyScopedAppRoot,
    });
    let report = this.context.interaction.applyAppKindSelection(
      initialReport,
      selectedAppKind,
    );

    if (
      report.status === "ambiguous" &&
      this.context.optionsModule.isNonInteractive()
    ) {
      const blockedResult =
        this.context.interaction.createAnalyzeBlockedResult(report);

      if (this.context.optionsModule.wantsJsonOutput()) {
        this.context.io.stdout(`${JSON.stringify(blockedResult, null, 2)}\n`);
      } else {
        this.context.io.stderr(`${blockedResult.reason}\n`);
        this.context.io.stderr(
          `${this.context.core.formatBaselineAnalyzeReport(report)}\n`,
        );
      }

      return 1;
    }

    if (report.status === "ambiguous" && !selectedAppKind) {
      const promptedAppKind =
        this.context.interaction.promptForAmbiguousAppKind(
          report,
          this.context.io,
        );

      if (!promptedAppKind) {
        const blockedResult =
          this.context.interaction.createAnalyzeBlockedResult(report);

        if (this.context.optionsModule.wantsJsonOutput()) {
          this.context.io.stdout(`${JSON.stringify(blockedResult, null, 2)}\n`);
        } else {
          this.context.io.stderr(`${blockedResult.reason}\n`);
          this.context.io.stderr(
            `${this.context.core.formatBaselineAnalyzeReport(report)}\n`,
          );
        }

        return 1;
      }

      report = this.context.interaction.applyAppKindSelection(
        report,
        promptedAppKind,
      );

      if (!this.context.optionsModule.wantsJsonOutput()) {
        this.context.io.stdout(
          `Selected app kind for this run: ${promptedAppKind}\n`,
        );
      }
    }

    if (this.context.optionsModule.wantsJsonOutput()) {
      this.context.io.stdout(`${JSON.stringify(report, null, 2)}\n`);
      return 0;
    }

    this.context.io.stdout(
      `${this.context.core.formatBaselineAnalyzeReport(report)}\n`,
    );
    return 0;
  }
}
