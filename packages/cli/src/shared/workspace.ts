/**
 * Provides shared workspace behavior for CLI execution.
 */
import { RnMtAnalyzeModule, RnMtWorkspace } from "@rn-mt/core";

import type { RnMtCliWorkspaceOverrides } from "../types";

/**
 * Creates workspace instances for the surrounding module graph.
 */
export class RnMtCliWorkspaceFactory {
  /**
   * Initializes the workspace with its shared dependencies.
   */
  constructor(
    private readonly defaultOverrides: RnMtCliWorkspaceOverrides = {},
  ) {}

  /**
   * Creates a core workspace instance, applying any filesystem overrides used
   * by CLI tests.
   */
  create(
    rootDir: string,
    overrides: RnMtCliWorkspaceOverrides = this.defaultOverrides,
  ) {
    const workspace = new RnMtWorkspace({ rootDir });
    const canReadFile = (path: string) => {
      if (!overrides.readFile) {
        return false;
      }

      try {
        overrides.readFile(path);
        return true;
      } catch {
        return false;
      }
    };

    if (overrides.fileExists) {
      workspace.exists = overrides.fileExists;
    }

    if (overrides.readFile) {
      workspace.readText = overrides.readFile;
      workspace.readJson = <T>(path: string) =>
        JSON.parse(overrides.readFile!(path)) as T;
    }

    if (overrides.fileExists && overrides.readFile) {
      workspace.isFile = (path: string) =>
        overrides.fileExists!(path) && canReadFile(path);
      workspace.isDirectory = (path: string) =>
        overrides.fileExists!(path) && !workspace.isFile(path);
      workspace.readJsonIfPresent = <T>(path: string) =>
        overrides.fileExists!(path)
          ? (JSON.parse(overrides.readFile!(path)) as T)
          : null;
    }

    return workspace;
  }

  /**
   * Creates an analyze module backed by a workspace for the requested root.
   */
  createAnalyzeModule(
    rootDir: string,
    overrides: RnMtCliWorkspaceOverrides = this.defaultOverrides,
  ) {
    return new RnMtAnalyzeModule({
      workspace: this.create(rootDir, overrides),
    });
  }
}
