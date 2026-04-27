/**
 * Provides shared version behavior for CLI execution.
 */
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync } from "node:fs";

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
    const packageJsonPath = join(
      dirname(fileURLToPath(import.meta.url)),
      "..",
      "..",
      "package.json",
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
        packageJson.devDependencies?.["@rn-mt/cli"] ??
        packageJson.dependencies?.["@rn-mt/cli"] ??
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
    const localVersion = this.getRepoLocalCliVersion(cwd, options);

    if (!localVersion) {
      return null;
    }

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
      reason: `Global rn-mt CLI version ${globalVersion} is incompatible with repo-local @rn-mt/cli version ${localVersion}.`,
      remediation: [
        `Upgrade or reinstall the global rn-mt CLI to version ${localVersion}.`,
        installCommand
          ? `Run ${installCommand} after aligning the repo-local rn-mt package versions.`
          : "Reinstall the repo-local rn-mt packages with the repo package manager after aligning versions.",
      ],
    };
  }
}
