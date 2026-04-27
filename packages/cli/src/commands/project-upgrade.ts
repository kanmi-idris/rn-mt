/**
 * Implements the project upgrade CLI command module.
 */
import { relative } from "node:path";

import type { RnMtCliCommandContext, RnMtCliUpgradeStage } from "../types";

/**
 * Handles the project upgrade command flow.
 */
export class RnMtCliProjectUpgradeCommand {
  /**
   * Initializes the project upgrade with its shared dependencies.
   */
  constructor(private readonly context: RnMtCliCommandContext) {}

  /**
   * Executes the project upgrade command flow.
   */
  run() {
    const manifestPath = this.context.executionContext.manifestPath;
    const packageJsonPath = `${this.context.cwd}/package.json`;

    if (!this.context.fileExists(manifestPath)) {
      this.context.io.stderr(`Manifest not found: ${manifestPath}\n`);
      return 1;
    }

    if (!this.context.fileExists(packageJsonPath)) {
      this.context.io.stderr(`package.json not found: ${packageJsonPath}\n`);
      return 1;
    }

    try {
      const manifest = this.context.execution.readScopedManifest(
        manifestPath,
        this.context.cwd,
        this.context.readFile,
      );
      const packageManagerName =
        this.context.workflow.detectRepoPackageManagerName();
      const installCommand =
        this.context.workflow.createInstallCommand(packageManagerName);
      const packageUpgrade = this.context.upgrade.createPackageJsonContents(
        this.context.readFile(packageJsonPath),
      );
      const stages: RnMtCliUpgradeStage[] = [];

      if (packageUpgrade.changed) {
        this.context.writeFile(packageJsonPath, packageUpgrade.contents);

        if (!packageManagerName) {
          throw new Error(
            "Unable to determine the repo package manager for rn-mt upgrade. Add a packageManager field or lockfile first.",
          );
        }

        const installResult = this.context.runSubprocess(
          packageManagerName,
          ["install"],
          {
            cwd: this.context.cwd,
            env: this.context.env,
          },
        );

        if (installResult.error) {
          throw installResult.error;
        }

        if (installResult.status !== 0) {
          throw new Error(
            `Unable to run ${packageManagerName} install during rn-mt upgrade.`,
          );
        }

        stages.push({
          name: "packages",
          status: "updated",
          details: [
            ...packageUpgrade.details,
            installCommand
              ? `Ran ${installCommand}.`
              : `Ran ${packageManagerName} install.`,
          ],
        });
      } else {
        stages.push({
          name: "packages",
          status: "unchanged",
          details: [
            `Local rn-mt package versions already match ${this.context.version.getCliPackageVersion()}.`,
          ],
        });
      }

      const metadataMigration = this.context.upgrade.createMetadataMigrations();

      for (const file of metadataMigration.rewrittenFiles) {
        this.context.files.ensureParentDir(file.path);
        this.context.writeFile(file.path, file.contents);
      }

      stages.push({
        name: "metadata",
        status: metadataMigration.changed ? "updated" : "unchanged",
        details: metadataMigration.changed
          ? metadataMigration.details
          : ["No metadata migrations were required."],
      });

      const syncResult = this.context.core.createSyncResult(
        manifest,
        {
          tenant: manifest.defaults.tenant,
          environment: manifest.defaults.environment,
        },
        {
          env: this.context.env,
        },
      );
      const generatedFiles = this.context.files
        .writeGeneratedFiles(syncResult.generatedFiles)
        .map(({ path, kind, changed }) => ({
          path,
          kind,
          changed,
        }));
      const syncStatus = generatedFiles.some((file) => file.changed)
        ? "updated"
        : "unchanged";

      stages.push({
        name: "sync",
        status: syncStatus,
        details: [
          `Target ${syncResult.target.tenant}/${syncResult.target.environment}.`,
          `Applied layers: ${syncResult.resolution.appliedLayers.join(" -> ")}.`,
          ...generatedFiles
            .filter((file) => file.changed)
            .map(
              (file) =>
                `Updated ${relative(this.context.cwd, file.path) || file.path}.`,
            ),
        ],
      });

      const auditResult = this.context.core.createAuditResult(manifest);
      const auditStatus =
        auditResult.findings.length > 0 ? "findings" : "passed";

      stages.push({
        name: "audit",
        status: auditStatus,
        details:
          auditResult.findings.length > 0
            ? auditResult.findings.map(
                (finding) =>
                  `${finding.severity} ${finding.code}: ${
                    relative(this.context.cwd, finding.path) || finding.path
                  }`,
              )
            : ["Audit passed with no findings."],
      });

      const status =
        auditResult.findings.length > 0
          ? "findings"
          : stages.some((stage) => stage.status === "updated")
            ? "updated"
            : "unchanged";

      if (this.context.optionsModule.wantsJsonOutput()) {
        this.context.io.stdout(
          `${JSON.stringify(
            {
              command: "upgrade",
              status,
              compatibility: this.context.versionCompatibility
                ? {
                    status: this.context.versionCompatibility.status,
                    globalVersion:
                      this.context.versionCompatibility.globalVersion,
                    localVersion:
                      this.context.versionCompatibility.localVersion,
                    installCommand:
                      this.context.versionCompatibility.installCommand,
                  }
                : null,
              stages,
              sync: {
                target: syncResult.target,
                resolution: syncResult.resolution,
                generatedFiles,
              },
              audit: {
                findings: auditResult.findings,
              },
            },
            null,
            2,
          )}\n`,
        );
        return auditResult.findings.length > 0 ? 1 : 0;
      }

      this.context.io.stdout(`Upgrade status: ${status}\n`);

      for (const stage of stages) {
        this.context.io.stdout(`${stage.status.toUpperCase()} ${stage.name}\n`);

        for (const detail of stage.details) {
          this.context.io.stdout(`Detail: ${detail}\n`);
        }
      }

      return auditResult.findings.length > 0 ? 1 : 0;
    } catch (error) {
      this.context.io.stderr(
        `${error instanceof Error ? error.message : "Unable to run rn-mt upgrade."}\n`,
      );
      return 1;
    }
  }
}
