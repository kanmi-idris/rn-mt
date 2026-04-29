/**
 * Provides shared version behavior for CLI execution.
 */
import { fileURLToPath } from "node:url";
import { dirname, isAbsolute, join } from "node:path";
import { existsSync, readFileSync } from "node:fs";

import { RnMtCliWorkflowModule } from "./workflow";

import type {
  RnMtCliVersionCompatibilityResult,
  RnMtCliWorkspaceOverrides,
} from "../types";

/**
 * Encapsulates version behavior behind a constructor-backed seam.
 */
export class RnMtCliVersionModule {
  /**
   * Initializes the version with its shared dependencies.
   */
  constructor(
    private readonly dependencies: {
      workflow?: RnMtCliWorkflowModule;
    } = {},
  ) {}

  /**
   * Returns cli package version for the version flow.
   */
  getCliPackageVersion() {
    const packageJsonPath = this.findPackageJsonPath(
      dirname(fileURLToPath(import.meta.url)),
      ["rn-mt", "@_molaidrislabs/rn-mt"],
    );
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      version?: string;
    };

    return packageJson.version ?? "0.1.0";
  }

  /**
   * Returns repo local cli version for the version flow.
   */
  getRepoLocalCliVersion(
    cwd: string,
    options: Required<
      Pick<RnMtCliWorkspaceOverrides, "fileExists" | "readFile">
    >,
  ) {
    const packageJsonPath = join(cwd, "package.json");

    if (!options.fileExists(packageJsonPath)) {
      return null;
    }

    try {
      const packageJson = JSON.parse(options.readFile(packageJsonPath)) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };

      return (
        packageJson.devDependencies?.["@_molaidrislabs/rn-mt"] ??
        packageJson.dependencies?.["@_molaidrislabs/rn-mt"] ??
        null
      );
    } catch {
      return null;
    }
  }

  /**
   * Returns version compatibility result for the version flow.
   */
  getVersionCompatibilityResult(
    cwd: string,
    options: Required<
      Pick<RnMtCliWorkspaceOverrides, "fileExists" | "readFile">
    >,
  ): RnMtCliVersionCompatibilityResult | null {
    const localVersionSpecifier = this.getRepoLocalCliVersion(cwd, options);

    if (!localVersionSpecifier) {
      return null;
    }

    const localVersion = this.resolveRepoLocalCliVersion(
      cwd,
      localVersionSpecifier,
      options,
    );
    const globalVersion = this.getCliPackageVersion();
    const workflow =
      this.dependencies.workflow ??
      new RnMtCliWorkflowModule({
        cwd,
        fileExists: options.fileExists,
        readFile: options.readFile,
      });
    const installCommand = workflow.createInstallCommand(
      workflow.detectRepoPackageManagerName(),
    );

    if (localVersion === globalVersion) {
      return {
        status: "compatible",
        globalVersion,
        localVersion,
        installCommand,
        remediation: [],
      };
    }

    return {
      status: "incompatible",
      globalVersion,
      localVersion,
      installCommand,
      reason: `Global rn-mt CLI version ${globalVersion} is incompatible with repo-local @_molaidrislabs/rn-mt version ${localVersion}.`,
      remediation: [
        `Upgrade or reinstall the global rn-mt CLI to version ${localVersion}.`,
        installCommand
          ? `Run ${installCommand} after aligning the repo-local rn-mt package versions.`
          : "Reinstall the repo-local rn-mt packages with the repo package manager after aligning versions.",
      ],
    };
  }

  /**
   * Walks upward from the current module until it finds the owning package.json
   * for the expected package name.
   */
  private findPackageJsonPath(
    startDir: string,
    expectedPackageNames: string[],
  ) {
    let currentDir = startDir;

    while (true) {
      const candidatePath = join(currentDir, "package.json");

      if (existsSync(candidatePath)) {
        const candidatePackageJson = JSON.parse(
          readFileSync(candidatePath, "utf8"),
        ) as { name?: string };

        if (
          candidatePackageJson.name &&
          expectedPackageNames.includes(candidatePackageJson.name)
        ) {
          return candidatePath;
        }
      }

      const parentDir = dirname(currentDir);

      if (parentDir === currentDir) {
        throw new Error(
          `Unable to locate package.json for ${expectedPackageNames.join(" or ")}.`,
        );
      }

      currentDir = parentDir;
    }
  }

  /**
   * Resolves a repo-local cli dependency spec into the actual linked package
   * version when the repo uses a `link:` or `file:` reference.
   */
  private resolveRepoLocalCliVersion(
    cwd: string,
    versionSpecifier: string,
    options: Required<
      Pick<RnMtCliWorkspaceOverrides, "fileExists" | "readFile">
    >,
  ) {
    const linkedPackageDir = this.resolveLinkedPackageDir(cwd, versionSpecifier);

    if (!linkedPackageDir) {
      return versionSpecifier;
    }

    const packageJsonPath = join(linkedPackageDir, "package.json");

    if (!options.fileExists(packageJsonPath)) {
      return versionSpecifier;
    }

    try {
      const packageJson = JSON.parse(options.readFile(packageJsonPath)) as {
        version?: string;
      };

      return packageJson.version ?? versionSpecifier;
    } catch {
      return versionSpecifier;
    }
  }

  /**
   * Resolves a local dependency spec to a package directory when the repo uses
   * a link-based local reference instead of a published semver string.
   */
  private resolveLinkedPackageDir(cwd: string, versionSpecifier: string) {
    const linkPrefix = versionSpecifier.startsWith("link:")
      ? "link:"
      : versionSpecifier.startsWith("file:")
        ? "file:"
        : null;

    if (!linkPrefix) {
      return null;
    }

    const linkedPath = versionSpecifier.slice(linkPrefix.length);

    return isAbsolute(linkedPath) ? linkedPath : join(cwd, linkedPath);
  }
}
