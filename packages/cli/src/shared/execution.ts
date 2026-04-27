/**
 * Provides shared execution behavior for CLI execution.
 */
import { basename, dirname, resolve } from "node:path";

import type { RnMtManifest } from "@rn-mt/core";
import { manifest as manifestNamespace } from "@rn-mt/core";

import { RnMtCliWorkspaceFactory } from "./workspace";

import type { RnMtCliExecutionContext } from "../types";

/**
 * Encapsulates execution behavior behind a constructor-backed seam.
 */
export class RnMtCliExecutionModule {
  /**
   * Initializes the execution with its shared dependencies.
   */
  constructor(
    private readonly dependencies: {
      workspaceFactory: RnMtCliWorkspaceFactory;
    },
  ) {}

  /**
   * Resolves execution context for the execution flow.
   */
  resolveExecutionContext(
    invocationCwd: string,
    commandArgsToCheck: string[],
    options: {
      getSelectedAppRoot: (commandArgs: string[]) => string | null;
      getSelectedConfigPath: (commandArgs: string[]) => string | null;
    },
  ): RnMtCliExecutionContext {
    const selectedAppRoot = options.getSelectedAppRoot(commandArgsToCheck);
    const selectedConfigPath =
      options.getSelectedConfigPath(commandArgsToCheck);
    const resolvedAppRoot = selectedAppRoot
      ? resolve(invocationCwd, selectedAppRoot)
      : null;
    const resolvedConfigPath = selectedConfigPath
      ? resolve(invocationCwd, selectedConfigPath)
      : null;

    if (
      resolvedConfigPath &&
      basename(resolvedConfigPath) !== "rn-mt.config.json"
    ) {
      throw new Error(
        `Config path must point to rn-mt.config.json. Received: ${resolvedConfigPath}`,
      );
    }

    const configRoot = resolvedConfigPath ? dirname(resolvedConfigPath) : null;

    if (resolvedAppRoot && configRoot && resolvedAppRoot !== configRoot) {
      throw new Error(
        `Cross-root config usage is not allowed. --app-root resolves to ${resolvedAppRoot} but --config resolves to ${resolvedConfigPath}.`,
      );
    }

    const cwd = resolvedAppRoot ?? configRoot ?? invocationCwd;

    return {
      cwd,
      manifestPath:
        resolvedConfigPath ??
        this.dependencies.workspaceFactory.create(cwd).getManifestPath(),
      explicitlyScopedAppRoot: resolvedAppRoot !== null,
    };
  }

  /**
   * Reads scoped manifest for the execution flow.
   */
  readScopedManifest(
    manifestPath: string,
    executionRoot: string,
    readFile: (path: string) => string,
  ): RnMtManifest {
    const manifest = manifestNamespace.parseManifest(readFile(manifestPath));

    if (resolve(manifest.source.rootDir) !== resolve(executionRoot)) {
      throw new Error(
        `Cross-root config usage is not allowed. Manifest at ${manifestPath} is bound to ${manifest.source.rootDir}, not ${executionRoot}.`,
      );
    }

    return manifest;
  }
}
