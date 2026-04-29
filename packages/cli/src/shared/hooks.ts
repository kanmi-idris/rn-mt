/**
 * Provides shared hooks behavior for CLI execution.
 */
import { createHash } from "node:crypto";
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

import { hashText, type RnMtTargetPlatform } from "@molaidrislabs/shared";

import { RnMtCliFilesModule } from "./files";

import type {
  RnMtCliHookName,
  RnMtCliHookStateEntry,
  RnMtCliHookStateFile,
  RnMtCliWorkspaceOverrides,
} from "../types";

/**
 * Encapsulates hooks behavior behind a constructor-backed seam.
 */
export class RnMtCliHooksModule {
  /**
   * Initializes the hooks with its shared dependencies.
   */
  constructor(
    private readonly dependencies: {
      rootDir: string;
      files: RnMtCliFilesModule;
      fileExists: Required<
        Pick<RnMtCliWorkspaceOverrides, "fileExists">
      >["fileExists"];
      readFile: Required<
        Pick<RnMtCliWorkspaceOverrides, "readFile">
      >["readFile"];
    },
  ) {}

  /**
   * Returns the persistent hook-state cache path used for incremental sync
   * decisions.
   */
  getStatePath() {
    return join(this.dependencies.rootDir, ".rn-mt", "hook-state.json");
  }

  /**
   * Parses and validates the hook name passed on the CLI command line.
   */
  getHookName(commandArgsToCheck: string[]): RnMtCliHookName | null {
    const hookName = commandArgsToCheck[0];

    if (
      hookName === "prestart" ||
      hookName === "preandroid" ||
      hookName === "preios" ||
      hookName === "postinstall"
    ) {
      return hookName;
    }

    return null;
  }

  /**
   * Maps a platform-specific hook name to its platform, or null for generic
   * hooks.
   */
  getHookPlatform(hookName: RnMtCliHookName) {
    if (hookName === "preandroid") {
      return "android" as const;
    }

    if (hookName === "preios") {
      return "ios" as const;
    }

    return null;
  }

  /**
   * Hashes the inputs that determine whether a hook-triggered sync can be
   * skipped safely.
   */
  createInputHash(
    manifestPath: string,
    manifestContents: string,
    target: {
      tenant: string;
      environment: string;
      platform?: RnMtTargetPlatform;
    },
    loadedEnvFiles: Array<{
      path: string;
      scope: string;
    }>,
  ) {
    const fingerprint = createHash("sha256");
    const assetPaths = new Set<string>();
    const parsedManifest = JSON.parse(manifestContents) as Record<
      string,
      unknown
    >;

    this.collectManifestAssetPaths(parsedManifest, assetPaths);

    fingerprint.update(manifestPath);
    fingerprint.update("\n");
    fingerprint.update(manifestContents);
    fingerprint.update("\n");
    fingerprint.update(JSON.stringify(target));
    fingerprint.update("\n");

    const auxiliaryPaths = [
      join(this.dependencies.rootDir, "app.json"),
      join(this.dependencies.rootDir, "app.config.ts"),
      join(this.dependencies.rootDir, "app.config.js"),
      join(this.dependencies.rootDir, "android", "app", "build.gradle"),
      join(this.dependencies.rootDir, "android", "app", "build.gradle.kts"),
      ...readdirSync(join(this.dependencies.rootDir), { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && entry.name === "ios")
        .flatMap(() =>
          readdirSync(join(this.dependencies.rootDir, "ios"), {
            withFileTypes: true,
          })
            .filter(
              (entry) =>
                entry.isDirectory() && entry.name.endsWith(".xcodeproj"),
            )
            .map((entry) => join(this.dependencies.rootDir, "ios", entry.name)),
        ),
      ...[...assetPaths].map((assetPath) =>
        join(this.dependencies.rootDir, assetPath),
      ),
    ].sort((left, right) => left.localeCompare(right));

    for (const path of auxiliaryPaths) {
      fingerprint.update(path);
      fingerprint.update(":");

      if (this.dependencies.fileExists(path)) {
        fingerprint.update(statSync(path).isDirectory() ? "dir" : "file");

        if (statSync(path).isFile()) {
          fingerprint.update(":");
          fingerprint.update(hashText(this.dependencies.readFile(path)));
        }
      } else {
        fingerprint.update("missing");
      }

      fingerprint.update("\n");
    }

    for (const loadedFile of loadedEnvFiles) {
      fingerprint.update(`${loadedFile.scope}:${loadedFile.path}\n`);
    }

    return fingerprint.digest("hex");
  }

  /**
   * Reads state for the hooks flow.
   */
  readState(): RnMtCliHookStateFile | null {
    const statePath = this.getStatePath();

    if (!this.dependencies.files.isReadableFile(statePath)) {
      return null;
    }

    return JSON.parse(
      this.dependencies.readFile(statePath),
    ) as RnMtCliHookStateFile;
  }

  /**
   * Formats the target banner shown after a hook-triggered sync or no-op.
   */
  createBanner(
    entry: RnMtCliHookStateEntry,
    syncStatus: "updated" | "up-to-date",
  ) {
    const targetLabel = entry.target.platform
      ? `${entry.target.tenant}/${entry.target.environment}/${entry.target.platform}`
      : `${entry.target.tenant}/${entry.target.environment}`;
    const configSource =
      relative(this.dependencies.rootDir, entry.configSource) ||
      "rn-mt.config.json";

    return [
      `[rn-mt] target=${targetLabel}`,
      `identity="${entry.identity.displayName}"`,
      `nativeId=${entry.identity.nativeId}`,
      `config=${configSource}`,
      `sync=${syncStatus}`,
    ].join(" | ");
  }

  /**
   * Walks the manifest JSON tree and collects asset paths that should
   * participate in hook invalidation.
   */
  private collectManifestAssetPaths(source: unknown, assetPaths: Set<string>) {
    if (!source || typeof source !== "object") {
      return;
    }

    if (Array.isArray(source)) {
      for (const entry of source) {
        this.collectManifestAssetPaths(entry, assetPaths);
      }

      return;
    }

    for (const [key, value] of Object.entries(source)) {
      if (
        key === "assets" &&
        value &&
        typeof value === "object" &&
        !Array.isArray(value)
      ) {
        for (const assetPath of Object.values(value)) {
          if (typeof assetPath === "string") {
            assetPaths.add(assetPath);
          }
        }
      } else {
        this.collectManifestAssetPaths(value, assetPaths);
      }
    }
  }
}
