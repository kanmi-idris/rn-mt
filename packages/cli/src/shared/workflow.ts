/**
 * Provides shared workflow behavior for CLI execution.
 */
import { delimiter, join } from "node:path";

import type { RnMtRepoAppKind } from "@rn-mt/core";
import type { RnMtTargetPlatform } from "@rn-mt/shared";

import type {
  RnMtCliWorkflowCommand,
  RnMtCliWorkspaceOverrides,
} from "../types";

type RnMtCliPackageManagerName = "pnpm" | "npm" | "yarn" | "bun";

/**
 * Encapsulates workflow behavior behind a constructor-backed seam.
 */
export class RnMtCliWorkflowModule {
  /**
   * Initializes the workflow with its shared dependencies.
   */
  constructor(
    private readonly dependencies: {
      cwd: string;
      fileExists: Required<
        Pick<RnMtCliWorkspaceOverrides, "fileExists">
      >["fileExists"];
      readFile: Required<
        Pick<RnMtCliWorkspaceOverrides, "readFile">
      >["readFile"];
    },
  ) {}

  /**
   * Prepends the repo-local node_modules bin directory so subprocesses resolve
   * project-installed CLIs first.
   */
  prependLocalNodeModulesBin(env: Record<string, string | undefined>) {
    const localBin = join(this.dependencies.cwd, "node_modules", ".bin");

    return {
      ...env,
      PATH: env.PATH ? `${localBin}${delimiter}${env.PATH}` : localBin,
    };
  }

  /**
   * Applies local first subprocess policy for the workflow flow.
   */
  applyLocalFirstSubprocessPolicy(
    sourceEnv: Record<string, string | undefined>,
  ) {
    return {
      ...sourceEnv,
      EXPO_NO_TELEMETRY: "1",
      DO_NOT_TRACK: "1",
      RN_MT_NETWORK_MODE: "local-first",
    };
  }

  /**
   * Detects repo package manager name for the workflow flow.
   */
  detectRepoPackageManagerName(): RnMtCliPackageManagerName | null {
    const packageJsonPath = join(this.dependencies.cwd, "package.json");

    if (this.dependencies.fileExists(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(
          this.dependencies.readFile(packageJsonPath),
        ) as {
          packageManager?: string;
        };
        const packageManagerName = this.detectPackageManagerName(
          packageJson.packageManager,
        );

        if (packageManagerName) {
          return packageManagerName;
        }
      } catch {
        // Fall through to lockfile detection.
      }
    }

    const lockfileCandidates: Array<{
      name: RnMtCliPackageManagerName;
      path: string;
    }> = [
      { name: "pnpm", path: join(this.dependencies.cwd, "pnpm-lock.yaml") },
      { name: "npm", path: join(this.dependencies.cwd, "package-lock.json") },
      { name: "yarn", path: join(this.dependencies.cwd, "yarn.lock") },
      { name: "bun", path: join(this.dependencies.cwd, "bun.lockb") },
      { name: "bun", path: join(this.dependencies.cwd, "bun.lock") },
    ];

    for (const lockfile of lockfileCandidates) {
      if (this.dependencies.fileExists(lockfile.path)) {
        return lockfile.name;
      }
    }

    return null;
  }

  /**
   * Returns the install command that matches the detected repo package manager.
   */
  createInstallCommand(packageManagerName: RnMtCliPackageManagerName | null) {
    if (packageManagerName === "pnpm") {
      return "pnpm install";
    }

    if (packageManagerName === "yarn") {
      return "yarn install";
    }

    if (packageManagerName === "bun") {
      return "bun install";
    }

    if (packageManagerName === "npm") {
      return "npm install";
    }

    return null;
  }

  /**
   * Explains why a workflow command cannot run against the current repo
   * classification.
   */
  createWorkflowBlockedMessage(
    command: RnMtCliWorkflowCommand,
    report: {
      status: "ok" | "ambiguous";
      repo: { app: { kind: RnMtRepoAppKind } };
    },
  ) {
    if (report.status === "ambiguous") {
      return `${command} requires an explicit --app-kind when repo classification is ambiguous.`;
    }

    return `${command} requires a supported Expo or bare React Native repo. Run rn-mt analyze for details.`;
  }

  /**
   * Resolves workflow dispatch for the workflow flow.
   */
  resolveWorkflowDispatch(
    command: RnMtCliWorkflowCommand,
    appKind: RnMtRepoAppKind,
    platform: RnMtTargetPlatform | null,
  ) {
    if (command !== "start" && !platform) {
      throw new Error(
        `${command} requires --platform ios or --platform android.`,
      );
    }

    if (appKind === "expo-managed") {
      if (command === "start") {
        return {
          subprocessCommand: "expo",
          subprocessArgs: ["start"],
        };
      }

      if (command === "run") {
        return {
          subprocessCommand: "expo",
          subprocessArgs: [
            platform === "ios" ? "start" : "start",
            `--${platform}`,
          ],
        };
      }

      return {
        subprocessCommand: "expo",
        subprocessArgs: [platform === "ios" ? "run:ios" : "run:android"],
      };
    }

    if (appKind === "expo-prebuild") {
      if (command === "start") {
        return {
          subprocessCommand: "expo",
          subprocessArgs: ["start", "--dev-client"],
        };
      }

      if (command === "build") {
        return {
          subprocessCommand: "expo",
          subprocessArgs: [platform === "ios" ? "run:ios" : "run:android"],
        };
      }

      return {
        subprocessCommand: "expo",
        subprocessArgs: [platform === "ios" ? "run:ios" : "run:android"],
      };
    }

    if (appKind === "bare-react-native") {
      if (command === "start") {
        return {
          subprocessCommand: "react-native",
          subprocessArgs: ["start"],
        };
      }

      return {
        subprocessCommand: "react-native",
        subprocessArgs: [platform === "ios" ? "run-ios" : "run-android"],
      };
    }

    throw new Error(`Unsupported workflow repo kind: ${appKind}`);
  }

  /**
   * Detects package manager name for the workflow flow.
   */
  private detectPackageManagerName(
    packageManagerField: string | null | undefined,
  ) {
    const rawName = packageManagerField?.split("@")[0];

    if (
      rawName === "pnpm" ||
      rawName === "npm" ||
      rawName === "yarn" ||
      rawName === "bun"
    ) {
      return rawName;
    }

    return null;
  }
}
