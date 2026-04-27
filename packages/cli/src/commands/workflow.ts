/**
 * Implements the workflow CLI command module.
 */
import { RnMtCliWorkflowHookCommand } from "./workflow-hook";
import { RnMtCliWorkflowRunCommand } from "./workflow-run";
import { RnMtCliWorkflowSyncCommand } from "./workflow-sync";

import type { RnMtCliCommandContext } from "../types";

/**
 * Aggregates related workflow subcommands behind one seam.
 */
export class RnMtCliWorkflowCommands {
  private readonly sync: RnMtCliWorkflowSyncCommand;
  private readonly workflow: RnMtCliWorkflowRunCommand;
  private readonly hook: RnMtCliWorkflowHookCommand;

  /**
   * Initializes the workflow with its shared dependencies.
   */
  constructor(context: RnMtCliCommandContext) {
    this.sync = new RnMtCliWorkflowSyncCommand(context);
    this.workflow = new RnMtCliWorkflowRunCommand(context);
    this.hook = new RnMtCliWorkflowHookCommand(context);
  }

  /**
   * Delegates the sync command path to its dedicated subcommand module.
   */
  handleSync() {
    return this.sync.run();
  }

  /**
   * Delegates the workflow command path to its dedicated subcommand module.
   */
  handleWorkflow() {
    return this.workflow.run();
  }

  /**
   * Delegates the hook command path to its dedicated subcommand module.
   */
  handleHook() {
    return this.hook.run();
  }
}
