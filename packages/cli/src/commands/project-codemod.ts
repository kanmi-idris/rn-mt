/**
 * Implements the project codemod CLI command module.
 */
import type { RnMtCliCommandContext } from "../types";

/**
 * Handles the project codemod command flow.
 */
export class RnMtCliProjectCodemodCommand {
  /**
   * Initializes the project codemod with its shared dependencies.
   */
  constructor(private readonly context: RnMtCliCommandContext) {}

  /**
   * Executes the project codemod command flow.
   */
  run() {
    const codemodName = this.context.commandArgs[0];

    if (codemodName !== "current-imports") {
      this.context.io.stderr(
        "codemod requires a supported codemod name. Available: current-imports\n",
      );
      return 1;
    }

    try {
      const shouldWrite = this.context.optionsModule.hasFlag("--write");
      const result = this.context.core.createCurrentImportsCodemodResult();

      if (shouldWrite) {
        for (const change of result.changes) {
          this.context.files.ensureParentDir(change.path);
          this.context.writeFile(change.path, change.after);
        }
      }

      const status =
        result.changes.length === 0
          ? "unchanged"
          : shouldWrite
            ? "written"
            : "preview";

      if (this.context.optionsModule.wantsJsonOutput()) {
        this.context.io.stdout(
          `${JSON.stringify(
            {
              command: "codemod",
              codemod: result.codemod,
              status,
              write: shouldWrite,
              changes: result.changes,
            },
            null,
            2,
          )}\n`,
        );
        return 0;
      }

      if (result.changes.length === 0) {
        this.context.io.stdout(
          `Codemod ${result.codemod} has no changes to apply.\n`,
        );
        return 0;
      }

      this.context.io.stdout(
        shouldWrite
          ? `Applied codemod ${result.codemod} to ${result.changes.length} file(s).\n`
          : `Previewed codemod ${result.codemod} for ${result.changes.length} file(s). Re-run with --write to apply.\n`,
      );

      for (const change of result.changes) {
        this.context.io.stdout(`File: ${change.path}\n`);
      }

      return 0;
    } catch (error) {
      this.context.io.stderr(
        `${error instanceof Error ? error.message : "Unable to run codemod."}\n`,
      );
      return 1;
    }
  }
}
