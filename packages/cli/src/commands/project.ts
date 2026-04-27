/**
 * Implements the project CLI command module.
 */
import { RnMtCliProjectAnalyzeCommand } from "./project-analyze";
import { RnMtCliProjectCodemodCommand } from "./project-codemod";
import { RnMtCliProjectConvertCommand } from "./project-convert";
import { RnMtCliProjectInitCommand } from "./project-init";
import { RnMtCliProjectUpgradeCommand } from "./project-upgrade";

import type { RnMtCliCommandContext } from "../types";

/**
 * Aggregates related project subcommands behind one seam.
 */
export class RnMtCliProjectCommands {
  private readonly analyze: RnMtCliProjectAnalyzeCommand;
  private readonly init: RnMtCliProjectInitCommand;
  private readonly convert: RnMtCliProjectConvertCommand;
  private readonly codemod: RnMtCliProjectCodemodCommand;
  private readonly upgrade: RnMtCliProjectUpgradeCommand;

  /**
   * Initializes the project with its shared dependencies.
   */
  constructor(context: RnMtCliCommandContext) {
    this.analyze = new RnMtCliProjectAnalyzeCommand(context);
    this.init = new RnMtCliProjectInitCommand(context);
    this.convert = new RnMtCliProjectConvertCommand(context);
    this.codemod = new RnMtCliProjectCodemodCommand(context);
    this.upgrade = new RnMtCliProjectUpgradeCommand(context);
  }

  /**
   * Delegates the analyze command path to its dedicated subcommand module.
   */
  handleAnalyze() {
    return this.analyze.run();
  }

  /**
   * Delegates the init command path to its dedicated subcommand module.
   */
  handleInit() {
    return this.init.run();
  }

  /**
   * Delegates the convert command path to its dedicated subcommand module.
   */
  handleConvert() {
    return this.convert.run();
  }

  /**
   * Delegates the codemod command path to its dedicated subcommand module.
   */
  handleCodemod() {
    return this.codemod.run();
  }

  /**
   * Delegates the upgrade command path to its dedicated subcommand module.
   */
  handleUpgrade() {
    return this.upgrade.run();
  }
}
