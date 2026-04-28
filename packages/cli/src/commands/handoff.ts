/**
 * Implements the handoff CLI command module.
 */
import { basename, dirname } from "node:path";
import { rmSync } from "node:fs";

import { RnMtCliWorkspaceFactory } from "../shared/workspace";

import type { RnMtCliCommandContext } from "../types";

/**
 * Aggregates related handoff subcommands behind one seam.
 */
export class RnMtCliHandoffCommands {
  /**
   * Initializes the handoff with its shared dependencies.
   */
  constructor(private readonly context: RnMtCliCommandContext) {}

  /**
   * Delegates the handoff command path to its dedicated subcommand module.
   */
  handleHandoff() {
    const tenantId = this.context.optionsModule.getRequiredOption("--tenant");

    if (!tenantId) {
      this.context.io.stderr("handoff requires --tenant <tenant-id>.\n");
      return 1;
    }

    const manifestPath = this.context.executionContext.manifestPath;

    if (!this.context.fileExists(manifestPath)) {
      this.context.io.stderr(`Manifest not found: ${manifestPath}\n`);
      return 1;
    }

    try {
      const manifest = this.context.execution.readScopedManifest(
        manifestPath,
        this.context.cwd,
        this.context.readFile,
      );
      const result = this.context.core.createHandoffPreflightResult(
        manifest,
        tenantId,
      );
      const outputDir = this.context.files.getDefaultHandoffOutputDir(
        this.context.cwd,
        tenantId,
      );
      const archivePath =
        this.context.files.getDefaultHandoffArchivePath(outputDir);
      const force = this.context.optionsModule.hasFlag("--force");
      const shouldZip = this.context.optionsModule.hasFlag("--zip");
      const outputCore = this.context.core.forRoot(
        outputDir,
        new RnMtCliWorkspaceFactory({
          fileExists: this.context.fileExists,
          readFile: this.context.readFile,
        }),
      );

      if (result.status === "blocked") {
        if (this.context.optionsModule.wantsJsonOutput()) {
          this.context.io.stdout(
            `${JSON.stringify(
              {
                command: "handoff",
                status: result.status,
                tenant: result.tenant,
                output: {
                  path: outputDir,
                  replacedExisting: false,
                  gitInitialized: false,
                },
                package: {
                  enabled: shouldZip,
                  path: shouldZip ? archivePath : null,
                  created: false,
                },
                checks: result.checks,
              },
              null,
              2,
            )}\n`,
          );
        } else {
          this.context.io.stdout(
            `Handoff preflight status: ${result.status}\n`,
          );
          this.context.io.stdout(`Target tenant: ${result.tenant.id}\n`);

          for (const check of result.checks) {
            this.context.io.stdout(
              `${check.status.toUpperCase()} ${check.code}: ${check.summary}\n`,
            );

            for (const detail of check.details) {
              this.context.io.stdout(`Detail: ${detail}\n`);
            }
          }
        }

        return 1;
      }

      if (this.context.fileExists(outputDir) && !force) {
        const reason = `Handoff output already exists: ${outputDir}. Re-run with --force to replace it.`;

        if (this.context.optionsModule.wantsJsonOutput()) {
          this.context.io.stdout(
            `${JSON.stringify(
              {
                command: "handoff",
                status: "blocked",
                reason,
                tenant: result.tenant,
                output: {
                  path: outputDir,
                  replacedExisting: false,
                  gitInitialized: false,
                },
                package: {
                  enabled: shouldZip,
                  path: shouldZip ? archivePath : null,
                  created: false,
                },
                checks: result.checks,
              },
              null,
              2,
            )}\n`,
          );
        } else {
          this.context.io.stderr(`${reason}\n`);
        }

        return 1;
      }

      const replacedExisting = this.context.fileExists(outputDir);

      if (replacedExisting) {
        rmSync(outputDir, { recursive: true, force: true });
      }

      this.context.files.copyRepoForHandoff(this.context.cwd, outputDir);
      const outputManifest = {
        ...manifest,
        source: {
          ...manifest.source,
          rootDir: outputDir,
        },
      };
      const flattenResult = outputCore.createHandoffFlattenResult(
        outputManifest,
        tenantId,
      );

      for (const file of flattenResult.restoredFiles) {
        this.context.files.ensureParentDir(file.destinationPath);
        this.context.files.writePathContents(
          file.destinationPath,
          file.contents,
        );
      }

      const cleanupResult = outputCore.createHandoffCleanupResult();

      for (const file of cleanupResult.rewrittenFiles) {
        this.context.files.ensureParentDir(file.path);
        this.context.writeFile(file.path, file.contents);
      }

      for (const removedPath of cleanupResult.removedPaths) {
        rmSync(removedPath, { recursive: true, force: true });
      }

      const sanitizationResult = outputCore.createHandoffSanitizationResult(
        outputManifest,
        tenantId,
      );

      for (const file of sanitizationResult.generatedFiles) {
        this.context.files.ensureParentDir(file.path);
        this.context.writeFile(file.path, file.contents);
      }

      for (const removedPath of sanitizationResult.removedPaths) {
        rmSync(removedPath, { recursive: true, force: true });
      }

      const handoffAuditResult = outputCore.createHandoffIsolationAuditResult(
        outputManifest,
        tenantId,
      );

      if (handoffAuditResult.findings.length > 0) {
        if (this.context.optionsModule.wantsJsonOutput()) {
          this.context.io.stdout(
            `${JSON.stringify(
              {
                command: "handoff",
                status: "blocked",
                reason: "Final handoff isolation audit failed.",
                tenant: result.tenant,
                output: {
                  path: outputDir,
                  replacedExisting,
                  gitInitialized: false,
                },
                package: {
                  enabled: shouldZip,
                  path: shouldZip ? archivePath : null,
                  created: false,
                },
                cleanup: {
                  rewrittenFiles: cleanupResult.rewrittenFiles.map(
                    (file) => file.path,
                  ),
                  removedPaths: cleanupResult.removedPaths,
                },
                sanitization: {
                  generatedFiles: sanitizationResult.generatedFiles.map(
                    (file) => file.path,
                  ),
                  removedPaths: sanitizationResult.removedPaths,
                  reviewRequired: sanitizationResult.reviewRequired,
                  reviewChecklist: sanitizationResult.reviewChecklist,
                },
                audit: {
                  findings: handoffAuditResult.findings,
                },
                restoredFiles: flattenResult.restoredFiles.map((file) => ({
                  sourcePath: file.sourcePath,
                  destinationPath: file.destinationPath,
                })),
                checks: result.checks,
              },
              null,
              2,
            )}\n`,
          );
        } else {
          this.context.io.stdout(
            "Handoff blocked: final isolation audit failed.\n",
          );
          this.context.io.stdout(`Output kept for inspection: ${outputDir}\n`);

          for (const finding of handoffAuditResult.findings) {
            this.context.io.stdout(
              `${finding.severity} ${finding.confidence} ${finding.code}: ${finding.path}\n`,
            );
            this.context.io.stdout(`${finding.summary}\n`);

            for (const evidenceLine of finding.evidence) {
              this.context.io.stdout(`Evidence: ${evidenceLine}\n`);
            }
          }
        }

        return 1;
      }

      const gitInitResult = this.context.runSubprocess("git", ["init"], {
        cwd: outputDir,
        env: this.context.env,
      });

      if (gitInitResult.error) {
        throw gitInitResult.error;
      }

      if (gitInitResult.status !== 0) {
        throw new Error(
          `Unable to initialize fresh git repo in handoff output: ${outputDir}`,
        );
      }

      if (shouldZip && this.context.fileExists(archivePath)) {
        rmSync(archivePath, { force: true });
      }

      if (shouldZip) {
        const zipResult = this.context.runSubprocess(
          "zip",
          ["-qr", archivePath, basename(outputDir)],
          {
            cwd: dirname(outputDir),
            env: this.context.env,
          },
        );

        if (zipResult.error) {
          throw zipResult.error;
        }

        if (zipResult.status !== 0) {
          throw new Error(
            `Unable to package handoff output as zip: ${archivePath}`,
          );
        }
      }

      if (this.context.optionsModule.wantsJsonOutput()) {
        this.context.io.stdout(
          `${JSON.stringify(
            {
              command: "handoff",
              status: "initialized",
              tenant: result.tenant,
              output: {
                path: outputDir,
                replacedExisting,
                gitInitialized: true,
              },
              package: {
                enabled: shouldZip,
                path: shouldZip ? archivePath : null,
                created: shouldZip,
              },
              cleanup: {
                rewrittenFiles: cleanupResult.rewrittenFiles.map(
                  (file) => file.path,
                ),
                removedPaths: cleanupResult.removedPaths,
              },
              sanitization: {
                generatedFiles: sanitizationResult.generatedFiles.map(
                  (file) => file.path,
                ),
                removedPaths: sanitizationResult.removedPaths,
                reviewRequired: sanitizationResult.reviewRequired,
                reviewChecklist: sanitizationResult.reviewChecklist,
              },
              audit: {
                findings: handoffAuditResult.findings,
              },
              restoredFiles: flattenResult.restoredFiles.map((file) => ({
                sourcePath: file.sourcePath,
                destinationPath: file.destinationPath,
              })),
              checks: result.checks,
            },
            null,
            2,
          )}\n`,
        );
        return 0;
      }

      this.context.io.stdout("Handoff preflight status: ready\n");
      this.context.io.stdout(`Target tenant: ${result.tenant.id}\n`);

      for (const check of result.checks) {
        this.context.io.stdout(
          `${check.status.toUpperCase()} ${check.code}: ${check.summary}\n`,
        );

        for (const detail of check.details) {
          this.context.io.stdout(`Detail: ${detail}\n`);
        }
      }

      this.context.io.stdout(`Initialized handoff output: ${outputDir}\n`);
      this.context.io.stdout(
        `Restored original app structure files: ${flattenResult.restoredFiles.length}\n`,
      );
      this.context.io.stdout(
        `Removed rn-mt machinery paths: ${cleanupResult.removedPaths.length}\n`,
      );
      this.context.io.stdout(
        `Sanitized env and automation paths: ${sanitizationResult.removedPaths.length}\n`,
      );
      if (shouldZip) {
        this.context.io.stdout(`Packaged handoff zip: ${archivePath}\n`);
      }
      this.context.io.stdout(
        "Human review required: verify stripped automation and generated env examples.\n",
      );
      this.context.io.stdout(
        "Fresh git history was created in the output repo.\n",
      );
      return 0;
    } catch (error) {
      this.context.io.stderr(
        `${error instanceof Error ? error.message : "Unable to run handoff preflight."}\n`,
      );
      return 1;
    }
  }
}
