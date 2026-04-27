/**
 * Implements the workflow hook CLI command module.
 */
import { hashText } from "@rn-mt/shared";

import type {
  RnMtCliCommandContext,
  RnMtCliHookStateEntry,
  RnMtCliHookStateFile,
} from "../types";

/**
 * Handles the workflow hook command flow.
 */
export class RnMtCliWorkflowHookCommand {
  /**
   * Initializes the workflow hook with its shared dependencies.
   */
  constructor(private readonly context: RnMtCliCommandContext) {}

  /**
   * Executes the workflow hook command flow.
   */
  run() {
    const hookName = this.context.hooks.getHookName(this.context.commandArgs);

    if (!hookName) {
      this.context.io.stderr(
        "hook requires one of: prestart, preandroid, preios, postinstall.\n",
      );
      return 1;
    }

    const manifestPath = this.context.executionContext.manifestPath;

    if (!this.context.fileExists(manifestPath)) {
      this.context.io.stderr(`Manifest not found: ${manifestPath}\n`);
      return 1;
    }

    try {
      const manifestContents = this.context.readFile(manifestPath);
      const manifest = this.context.execution.readScopedManifest(
        manifestPath,
        this.context.cwd,
        () => manifestContents,
      );
      const platform = this.context.hooks.getHookPlatform(hookName);
      const target = platform
        ? {
            tenant: manifest.defaults.tenant,
            environment: manifest.defaults.environment,
            platform,
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
      const inputHash = this.context.hooks.createInputHash(
        manifestPath,
        manifestContents,
        target,
        resolvedEnv.loadedFiles,
      );
      const existingState = this.context.hooks.readState();
      const existingEntry = existingState?.hooks[hookName];
      const canSkipSync = Boolean(
        existingEntry &&
        existingEntry.inputHash === inputHash &&
        existingEntry.trackedFiles.every(
          (file) =>
            this.context.files.isReadableFile(file.path) &&
            hashText(this.context.readFile(file.path)) === file.hash,
        ),
      );

      if (canSkipSync && existingEntry) {
        const banner = this.context.hooks.createBanner(
          existingEntry,
          "up-to-date",
        );

        if (this.context.optionsModule.wantsJsonOutput()) {
          this.context.io.stdout(
            `${JSON.stringify(
              {
                command: "hook",
                hook: hookName,
                status: "up-to-date",
                target: existingEntry.target,
                identity: existingEntry.identity,
                configSource: existingEntry.configSource,
                banner,
              },
              null,
              2,
            )}\n`,
          );
        } else {
          this.context.io.stdout(`${banner}\n`);
        }

        return 0;
      }

      const result = this.context.core.createSyncResult(manifest, target, {
        env: resolvedEnv.env,
      });
      const generatedFiles = this.context.files.writeGeneratedFiles(
        result.generatedFiles,
      );
      const stateEntry: RnMtCliHookStateEntry = {
        inputHash,
        target: result.target,
        identity: result.runtime.identity,
        configSource: manifestPath,
        trackedFiles: generatedFiles.map((file) => ({
          path: file.path,
          hash: file.hash,
        })),
      };
      const stateFile: RnMtCliHookStateFile = {
        schemaVersion: 1,
        tool: "rn-mt",
        hooks: {
          ...(existingState?.hooks ?? {}),
          [hookName]: stateEntry,
        },
      };
      const statePath = this.context.hooks.getStatePath();

      this.context.files.ensureParentDir(statePath);
      this.context.writeFile(
        statePath,
        `${JSON.stringify(stateFile, null, 2)}\n`,
      );

      const banner = this.context.hooks.createBanner(stateEntry, "updated");

      if (this.context.optionsModule.wantsJsonOutput()) {
        this.context.io.stdout(
          `${JSON.stringify(
            {
              command: "hook",
              hook: hookName,
              status: "updated",
              target: result.target,
              identity: result.runtime.identity,
              configSource: manifestPath,
              banner,
              generatedFiles: generatedFiles.map(({ path, kind, changed }) => ({
                path,
                kind,
                changed,
              })),
            },
            null,
            2,
          )}\n`,
        );
      } else {
        this.context.io.stdout(`${banner}\n`);
      }

      return 0;
    } catch (error) {
      this.context.io.stderr(
        `${error instanceof Error ? error.message : "Unable to run hook workflow."}\n`,
      );
      return 1;
    }
  }
}
