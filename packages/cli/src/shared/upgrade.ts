/**
 * Provides shared upgrade behavior for CLI execution.
 */
import type { RnMtCliFilesModule } from "./files";
import type { RnMtCliHooksModule } from "./hooks";

import type { RnMtCliVersionModule } from "./version";
import type {
  RnMtCliAnalyzeReportFactory,
  RnMtCliHookName,
  RnMtCliHookStateEntry,
  RnMtCliHookStateFile,
} from "../types";

/**
 * Encapsulates upgrade behavior behind a constructor-backed seam.
 */
export class RnMtCliUpgradeModule {
  /**
   * Initializes the upgrade with its shared dependencies.
   */
  constructor(
    private readonly dependencies: {
      cwd: string;
      analyzeReportFactory: RnMtCliAnalyzeReportFactory;
      version: RnMtCliVersionModule;
      files: RnMtCliFilesModule;
      hooks: RnMtCliHooksModule;
      readFile: (path: string) => string;
    },
  ) {}

  /**
   * Creates package json contents for the upgrade flow.
   */
  createPackageJsonContents(packageJsonContents: string) {
    const parsedPackageJson = JSON.parse(packageJsonContents) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      [key: string]: unknown;
    };
    const dependencies = { ...(parsedPackageJson.dependencies ?? {}) };
    const devDependencies = { ...(parsedPackageJson.devDependencies ?? {}) };
    const details: string[] = [];

    for (const expectedPackage of this.getExpectedRnMtPackagePlan()) {
      const targetRecord =
        expectedPackage.section === "dependencies"
          ? dependencies
          : devDependencies;
      const otherRecord =
        expectedPackage.section === "dependencies"
          ? devDependencies
          : dependencies;
      const previousVersion =
        targetRecord[expectedPackage.name] ??
        otherRecord[expectedPackage.name] ??
        null;

      if (otherRecord[expectedPackage.name]) {
        delete otherRecord[expectedPackage.name];
      }

      if (targetRecord[expectedPackage.name] !== expectedPackage.version) {
        targetRecord[expectedPackage.name] = expectedPackage.version;

        details.push(
          previousVersion
            ? `${expectedPackage.name}: ${previousVersion} -> ${expectedPackage.version}`
            : `${expectedPackage.name}: added ${expectedPackage.version}`,
        );
      }
    }

    const nextPackageJson = {
      ...parsedPackageJson,
      dependencies,
      devDependencies,
    };

    return {
      changed: details.length > 0,
      contents: `${JSON.stringify(nextPackageJson, null, 2)}\n`,
      details,
    };
  }

  /**
   * Returns the metadata rewrites needed to bring legacy rn-mt files up to the
   * current schema.
   */
  createMetadataMigrations() {
    const rewrittenFiles: Array<{ path: string; contents: string }> = [];
    const details: string[] = [];
    const hookStatePath = this.dependencies.hooks.getStatePath();

    if (this.dependencies.files.isReadableFile(hookStatePath)) {
      try {
        const parsed = JSON.parse(
          this.dependencies.readFile(hookStatePath),
        ) as {
          schemaVersion?: number;
          tool?: string;
          hooks?: Partial<Record<RnMtCliHookName, RnMtCliHookStateEntry>>;
        };

        if (
          typeof parsed.hooks === "object" &&
          parsed.hooks !== null &&
          (parsed.schemaVersion !== 1 || parsed.tool !== "rn-mt")
        ) {
          rewrittenFiles.push({
            path: hookStatePath,
            contents: `${JSON.stringify(
              {
                schemaVersion: 1,
                tool: "rn-mt",
                hooks: parsed.hooks,
              } satisfies RnMtCliHookStateFile,
              null,
              2,
            )}\n`,
          });
          details.push(
            "Migrated .rn-mt/hook-state.json to schemaVersion=1 with tool=rn-mt.",
          );
        }
      } catch {
        // Ignore malformed legacy state in the first tracer-bullet slice.
      }
    }

    return {
      changed: rewrittenFiles.length > 0,
      rewrittenFiles,
      details,
    };
  }

  /**
   * Returns the rn-mt package versions that the upgraded repo should use.
   */
  private getExpectedRnMtPackagePlan() {
    const analyzeReport = this.dependencies.analyzeReportFactory(
      this.dependencies.cwd,
      {
        scopeToProvidedRoot: true,
      },
    );
    const version = this.dependencies.version.getCliPackageVersion();
    const packages: Array<{
      name: string;
      version: string;
      section: "dependencies" | "devDependencies";
    }> = [
      {
        name: "@_molaidrislabs/rn-mt",
        version,
        section: "dependencies",
      },
    ];

    return packages;
  }
}
