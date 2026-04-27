/**
 * Builds CLI execution context and runs a single rn-mt invocation.
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { RnMtCliCoreAdapters } from "./core-adapters";
import { RnMtCliCommandDispatcher } from "./commands/dispatcher";
import { RnMtCliProjectCommands } from "./commands/project";
import { RnMtCliOverrideCommands } from "./commands/override";
import { RnMtCliQualityCommands } from "./commands/quality";
import { RnMtCliHandoffCommands } from "./commands/handoff";
import { RnMtCliWorkflowCommands } from "./commands/workflow";
import { RnMtCliTenancyCommands } from "./commands/tenancy";
import { helpText } from "./help";
import { RnMtCliAuditModule } from "./shared/audit";
import { RnMtCliExecutionModule } from "./shared/execution";
import { RnMtCliFilesModule } from "./shared/files";
import { RnMtCliHooksModule } from "./shared/hooks";
import { RnMtCliInteractionModule } from "./shared/interaction";
import { RnMtCliOptionsModule } from "./shared/options";
import { RnMtCliUpgradeModule } from "./shared/upgrade";
import { RnMtCliVersionModule } from "./shared/version";
import { RnMtCliWorkflowModule } from "./shared/workflow";
import { RnMtCliWorkspaceFactory } from "./shared/workspace";

import type {
  RnMtCliCommandContext,
  RnMtCliExecutionContext,
  RnMtCliIo,
  RnMtCliRunOptions,
  RnMtCliSubprocessRunner,
} from "./types";

const defaultIo: RnMtCliIo = {
  stdout(text) {
    process.stdout.write(text);
  },
  stderr(text) {
    process.stderr.write(text);
  },
};

/**
 * Builds CLI execution context and runs a single rn-mt invocation.
 */
export class RnMtCliApplication {
  /**
   * Initializes the application with its shared dependencies.
   */
  constructor(private readonly options: RnMtCliRunOptions = {}) {}

  /**
   * Runs a single rn-mt CLI invocation.
   */
  run(args: string[]) {
    const io = this.options.io ?? defaultIo;
    const [command, ...commandArgs] = args;
    const optionsModule = new RnMtCliOptionsModule(commandArgs);
    const invocationCwd =
      this.options.cwd ?? optionsModule.getDefaultExecutionCwd();

    if (
      command === "--help" ||
      command === "-h" ||
      optionsModule.wantsHelpOutput() ||
      args.length === 0
    ) {
      io.stdout(`${helpText}\n`);
      return 0;
    }

    let executionContext: RnMtCliExecutionContext;

    try {
      executionContext = this.createExecutionModule().resolveExecutionContext(
        invocationCwd,
        optionsModule.optionArgs,
        {
          getSelectedAppRoot: () => optionsModule.getSelectedAppRoot(),
          getSelectedConfigPath: () => optionsModule.getSelectedConfigPath(),
        },
      );
    } catch (error) {
      io.stderr(
        `${error instanceof Error ? error.message : "Unable to resolve app-root scope."}\n`,
      );
      return 1;
    }

    const commandContext = this.createCommandContext({
      command: command ?? "",
      commandArgs,
      optionsModule,
      executionContext,
      io,
    });

    if (
      commandContext.command !== "upgrade" &&
      commandContext.versionCompatibility?.status === "incompatible"
    ) {
      return this.writeVersionCompatibilityBlock(
        commandContext.command,
        commandContext.optionsModule,
        commandContext.versionCompatibility,
        io,
      );
    }

    const projectCommands = new RnMtCliProjectCommands(commandContext);
    const overrideCommands = new RnMtCliOverrideCommands(commandContext);
    const qualityCommands = new RnMtCliQualityCommands(commandContext);
    const handoffCommands = new RnMtCliHandoffCommands(commandContext);
    const workflowCommands = new RnMtCliWorkflowCommands(commandContext);
    const tenancyCommands = new RnMtCliTenancyCommands(commandContext);
    return new RnMtCliCommandDispatcher({
      project: projectCommands,
      override: overrideCommands,
      quality: qualityCommands,
      handoff: handoffCommands,
      workflow: workflowCommands,
      tenancy: tenancyCommands,
      unsupportedCommandMessage:
        "The command surface is not implemented yet. See docs/issues/0001-rn-mt-prd.md and docs/architecture.md for the approved product definition.",
    }).dispatch(commandContext.command, commandArgs, io);
  }

  /**
   * Checks whether direct execution for the application flow.
   */
  static isDirectExecution(
    importMetaUrl: string,
    argvPath: string | undefined,
  ) {
    return argvPath ? importMetaUrl === pathToFileURL(argvPath).href : false;
  }

  /**
   * Builds the shared command context for the current CLI invocation.
   */
  private createCommandContext(input: {
    command: string;
    commandArgs: string[];
    optionsModule: RnMtCliOptionsModule;
    executionContext: RnMtCliExecutionContext;
    io: RnMtCliIo;
  }): RnMtCliCommandContext {
    const env = this.options.env ?? process.env;
    const fileExists = this.options.fileExists ?? existsSync;
    const writeFile =
      this.options.writeFile ??
      ((path, contents) => writeFileSync(path, contents));
    const readFile =
      this.options.readFile ?? ((path) => readFileSync(path, "utf8"));
    const runSubprocess =
      this.options.runSubprocess ?? this.createSubprocessRunner();
    const workspaceOverrides = {
      fileExists,
      readFile,
    };
    const workspaceFactory = new RnMtCliWorkspaceFactory(workspaceOverrides);
    const execution = new RnMtCliExecutionModule({ workspaceFactory });
    const files = new RnMtCliFilesModule({
      fileExists,
      readFile,
      writeFile,
    });
    const workflow = new RnMtCliWorkflowModule({
      cwd: input.executionContext.cwd,
      fileExists,
      readFile,
    });
    const version = new RnMtCliVersionModule({ workflow });
    const audit = new RnMtCliAuditModule({
      rootDir: input.executionContext.cwd,
    });
    const hooks = new RnMtCliHooksModule({
      rootDir: input.executionContext.cwd,
      files,
      fileExists,
      readFile,
    });
    const interaction = new RnMtCliInteractionModule(
      this.options.promptForAppKind
        ? {
            promptForAppKind: this.options.promptForAppKind,
          }
        : {},
    );
    const core = new RnMtCliCoreAdapters({
      rootDir: input.executionContext.cwd,
      workspaceFactory,
    });
    const analyzeReportFactory =
      this.options.analyzeReportFactory ??
      ((rootDir = input.executionContext.cwd, options = {}) =>
        core
          .forRoot(rootDir, workspaceFactory)
          .createBaselineAnalyzeReport(options));
    const upgrade = new RnMtCliUpgradeModule({
      cwd: input.executionContext.cwd,
      analyzeReportFactory,
      version,
      files,
      hooks,
      readFile,
    });

    return {
      command: input.command,
      commandArgs: input.commandArgs,
      optionArgs: input.optionsModule.optionArgs,
      cwd: input.executionContext.cwd,
      env,
      io: input.io,
      executionContext: input.executionContext,
      core,
      audit,
      execution,
      files,
      hooks,
      interaction,
      optionsModule: input.optionsModule,
      workflow,
      upgrade,
      version,
      analyzeReportFactory,
      fileExists,
      writeFile,
      readFile,
      runSubprocess,
      versionCompatibility: version.getVersionCompatibilityResult(
        input.executionContext.cwd,
        {
          fileExists,
          readFile,
        },
      ),
    };
  }

  /**
   * Creates the default subprocess runner used by CLI commands.
   */
  private createSubprocessRunner(): RnMtCliSubprocessRunner {
    return (command, subprocessArgs, subprocessOptions) =>
      spawnSync(command, subprocessArgs, {
        cwd: subprocessOptions.cwd,
        env: subprocessOptions.env,
        stdio: "inherit",
      });
  }

  /**
   * Creates the execution module used to resolve invocation scope.
   */
  private createExecutionModule() {
    return new RnMtCliExecutionModule({
      workspaceFactory: new RnMtCliWorkspaceFactory(),
    });
  }

  /**
   * Writes the version compatibility failure block in the active output format.
   */
  private writeVersionCompatibilityBlock(
    command: string,
    optionsModule: RnMtCliOptionsModule,
    compatibility: NonNullable<RnMtCliCommandContext["versionCompatibility"]>,
    io: RnMtCliIo,
  ) {
    if (optionsModule.wantsJsonOutput()) {
      io.stdout(
        `${JSON.stringify(
          {
            command,
            status: "blocked",
            reason: compatibility.reason,
            compatibility: {
              globalVersion: compatibility.globalVersion,
              localVersion: compatibility.localVersion,
              installCommand: compatibility.installCommand,
            },
            remediation: compatibility.remediation,
          },
          null,
          2,
        )}\n`,
      );
    } else {
      io.stderr(`${compatibility.reason}\n`);

      for (const remediationLine of compatibility.remediation) {
        io.stderr(`${remediationLine}\n`);
      }
    }

    return 1;
  }
}
