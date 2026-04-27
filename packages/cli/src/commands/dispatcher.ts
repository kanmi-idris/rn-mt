/**
 * Routes parsed CLI commands to the matching command modules.
 */
import type { RnMtCliIo } from "../types";
import type { RnMtCliHandoffCommands } from "./handoff";
import type { RnMtCliOverrideCommands } from "./override";
import type { RnMtCliProjectCommands } from "./project";
import type { RnMtCliQualityCommands } from "./quality";
import type { RnMtCliTenancyCommands } from "./tenancy";
import type { RnMtCliWorkflowCommands } from "./workflow";

/**
 * Dispatches resolved CLI commands to the matching command modules.
 */
export class RnMtCliCommandDispatcher {
  /**
   * Stores the command modules that handle each top-level CLI verb.
   */
  constructor(
    private readonly dependencies: {
      project: RnMtCliProjectCommands;
      override: RnMtCliOverrideCommands;
      quality: RnMtCliQualityCommands;
      handoff: RnMtCliHandoffCommands;
      workflow: RnMtCliWorkflowCommands;
      tenancy: RnMtCliTenancyCommands;
      unsupportedCommandMessage: string;
    },
  ) {}

  /**
   * Routes the parsed command to the matching command module and subcommand
   * handler.
   */
  dispatch(command: string, commandArgs: string[], io: RnMtCliIo) {
    const nestedCommand = commandArgs[0];

    const handlers: Array<{
      matches: () => boolean;
      run: () => number;
    }> = [
      {
        matches: () => command === "analyze",
        run: () => this.dependencies.project.handleAnalyze(),
      },
      {
        matches: () => command === "init",
        run: () => this.dependencies.project.handleInit(),
      },
      {
        matches: () => command === "convert",
        run: () => this.dependencies.project.handleConvert(),
      },
      {
        matches: () => command === "override" && nestedCommand === "create",
        run: () => this.dependencies.override.handleCreate(),
      },
      {
        matches: () => command === "override" && nestedCommand === "remove",
        run: () => this.dependencies.override.handleRemove(),
      },
      {
        matches: () => command === "audit",
        run: () => this.dependencies.quality.handleAudit(),
      },
      {
        matches: () => command === "doctor",
        run: () => this.dependencies.quality.handleDoctor(),
      },
      {
        matches: () => command === "handoff",
        run: () => this.dependencies.handoff.handleHandoff(),
      },
      {
        matches: () => command === "codemod",
        run: () => this.dependencies.project.handleCodemod(),
      },
      {
        matches: () => command === "upgrade",
        run: () => this.dependencies.project.handleUpgrade(),
      },
      {
        matches: () => command === "sync",
        run: () => this.dependencies.workflow.handleSync(),
      },
      {
        matches: () =>
          command === "start" || command === "build" || command === "run",
        run: () => this.dependencies.workflow.handleWorkflow(),
      },
      {
        matches: () => command === "hook",
        run: () => this.dependencies.workflow.handleHook(),
      },
      {
        matches: () => command === "tenant" && nestedCommand === "add",
        run: () => this.dependencies.tenancy.handleTenantAdd(),
      },
      {
        matches: () => command === "tenant" && nestedCommand === "rename",
        run: () => this.dependencies.tenancy.handleTenantRename(),
      },
      {
        matches: () => command === "tenant" && nestedCommand === "remove",
        run: () => this.dependencies.tenancy.handleTenantRemove(),
      },
      {
        matches: () => command === "target" && nestedCommand === "set",
        run: () => this.dependencies.tenancy.handleTargetSet(),
      },
    ];

    const matchedHandler = handlers.find((handler) => handler.matches());

    if (matchedHandler) {
      return matchedHandler.run();
    }

    io.stderr(`${this.dependencies.unsupportedCommandMessage}\n`);
    return 1;
  }
}
