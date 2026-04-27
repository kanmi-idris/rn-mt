/**
 * Implements the doctor core module.
 */
import { join } from "node:path";

import { RnMtAnalyzeModule } from "../analyze";
import type { RnMtManifest } from "../manifest/types";
import {
  getBareIosProjectName,
  hasBareAndroidProject,
  toPascalIdentifier,
} from "../sync";
import { RnMtWorkspace } from "../workspace";

import type { RnMtDoctorResult } from "./types";

/**
 * Encapsulates doctor behavior behind a constructor-backed seam.
 */
export class RnMtDoctorModule {
  /**
   * Initializes the doctor with its shared dependencies.
   */
  constructor(private readonly dependencies: { workspace: RnMtWorkspace }) {}

  /**
   * Runs the doctor flow.
   */
  run(manifest: RnMtManifest): RnMtDoctorResult {
    const checks = [];
    const appKind = new RnMtAnalyzeModule({
      workspace: this.dependencies.workspace,
    }).detectAppKind(this.dependencies.workspace.rootDir).kind;

    if (appKind === "expo-managed" || appKind === "expo-prebuild") {
      const easJsonPath = join(this.dependencies.workspace.rootDir, "eas.json");

      checks.push(
        this.dependencies.workspace.exists(easJsonPath)
          ? {
              code: "expo-distribution-config" as const,
              status: "ok" as const,
              summary: "Expo distribution integration detected.",
              details: [`Found ${easJsonPath}.`],
            }
          : {
              code: "expo-distribution-config" as const,
              status: "warning" as const,
              summary: "Expo distribution integration is missing.",
              details: [
                `Expected ${easJsonPath} for EAS build and submit workflow wiring.`,
                "Add eas.json or document the alternative distribution workflow outside rn-mt.",
              ],
            },
      );
    }

    if (hasBareAndroidProject(this.dependencies.workspace)) {
      const expectedPaths = [
        join(
          this.dependencies.workspace.rootDir,
          "android",
          "app",
          "rn-mt.generated.identity.gradle",
        ),
        join(
          this.dependencies.workspace.rootDir,
          "android",
          "app",
          "rn-mt.generated.flavors.gradle",
        ),
      ];
      const missingPaths = expectedPaths.filter(
        (path) => !this.dependencies.workspace.exists(path),
      );

      checks.push(
        missingPaths.length === 0
          ? {
              code: "android-release-integration" as const,
              status: "ok" as const,
              summary: "Android release integration artifacts detected.",
              details: expectedPaths.map((path) => `Found ${path}.`),
            }
          : {
              code: "android-release-integration" as const,
              status: "warning" as const,
              summary: "Android release integration artifacts are missing.",
              details: [
                ...missingPaths.map((path) => `Missing ${path}.`),
                "Run rn-mt sync --platform android to regenerate release-facing Android integration files.",
              ],
            },
      );
    }

    const xcodeProjectName = getBareIosProjectName(this.dependencies.workspace);

    if (xcodeProjectName) {
      const targetSlug = `${manifest.defaults.tenant}-${manifest.defaults.environment}`;
      const schemeName = `${toPascalIdentifier(manifest.defaults.tenant)}-${toPascalIdentifier(
        manifest.defaults.environment,
      )}`;
      const expectedPaths = [
        join(
          this.dependencies.workspace.rootDir,
          "ios",
          "rn-mt.generated.current.xcconfig",
        ),
        join(
          this.dependencies.workspace.rootDir,
          "ios",
          `rn-mt.generated.${targetSlug}.xcconfig`,
        ),
        join(
          this.dependencies.workspace.rootDir,
          "ios",
          `${xcodeProjectName}.xcodeproj`,
          "xcshareddata",
          "xcschemes",
          `${schemeName}.xcscheme`,
        ),
      ];
      const missingPaths = expectedPaths.filter(
        (path) => !this.dependencies.workspace.exists(path),
      );

      checks.push(
        missingPaths.length === 0
          ? {
              code: "ios-release-integration" as const,
              status: "ok" as const,
              summary: "iOS release integration artifacts detected.",
              details: expectedPaths.map((path) => `Found ${path}.`),
            }
          : {
              code: "ios-release-integration" as const,
              status: "warning" as const,
              summary: "iOS release integration artifacts are missing.",
              details: [
                ...missingPaths.map((path) => `Missing ${path}.`),
                "Run rn-mt sync --platform ios to regenerate release-facing iOS integration files.",
              ],
            },
      );
    }

    return {
      rootDir: this.dependencies.workspace.rootDir,
      checks,
    };
  }
}
