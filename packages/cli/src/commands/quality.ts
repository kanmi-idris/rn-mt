/**
 * Implements the quality CLI command module.
 */
import type { RnMtCliCommandContext } from "../types";

/**
 * Aggregates related quality subcommands behind one seam.
 */
export class RnMtCliQualityCommands {
  /**
   * Initializes the quality with its shared dependencies.
   */
  constructor(private readonly context: RnMtCliCommandContext) {}

  /**
   * Delegates the audit command path to its dedicated subcommand module.
   */
  handleAudit() {
    const manifestPath = this.context.executionContext.manifestPath;

    if (!this.context.fileExists(manifestPath)) {
      this.context.io.stderr(`Manifest not found: ${manifestPath}\n`);
      return 1;
    }

    try {
      const ignoreRules = this.context.optionsModule.getAuditIgnoreRules();
      const failThreshold = this.context.optionsModule.getAuditFailThreshold();
      const manifest = this.context.execution.readScopedManifest(
        manifestPath,
        this.context.cwd,
        this.context.readFile,
      );
      const result = this.context.core.createAuditResult(manifest);
      const findings = this.context.audit.applyIgnoreRules(
        result.findings,
        ignoreRules,
      );
      const failingFindings = this.context.audit.countFailingFindings(
        findings,
        failThreshold,
      );
      const summary = {
        totalFindings: result.findings.length,
        ignoredFindings: result.findings.length - findings.length,
        reportedFindings: findings.length,
        failingFindings,
      };
      const status = findings.length > 0 ? "findings" : "passed";

      if (this.context.optionsModule.wantsJsonOutput()) {
        this.context.io.stdout(
          `${JSON.stringify(
            {
              command: "audit",
              status,
              failOn: failThreshold,
              ignores: ignoreRules,
              summary,
              findings,
            },
            null,
            2,
          )}\n`,
        );
        return failingFindings > 0 ? 1 : 0;
      }

      if (findings.length === 0) {
        this.context.io.stdout("Audit passed with no findings.\n");

        if (summary.ignoredFindings > 0) {
          this.context.io.stdout(
            `Ignored findings: ${summary.ignoredFindings} via ${ignoreRules.length} audit rule(s).\n`,
          );
        }

        return 0;
      }

      this.context.io.stdout(`Audit status: ${status}\n`);

      if (failThreshold !== null) {
        this.context.io.stdout(`Fail threshold: ${failThreshold}\n`);
      }

      if (summary.ignoredFindings > 0) {
        this.context.io.stdout(
          `Ignored findings: ${summary.ignoredFindings} via ${ignoreRules.length} audit rule(s).\n`,
        );
      }

      for (const finding of findings) {
        this.context.io.stdout(
          `${finding.severity} ${finding.confidence} ${finding.code}: ${finding.path}\n`,
        );
        this.context.io.stdout(`${finding.summary}\n`);

        for (const evidenceLine of finding.evidence) {
          this.context.io.stdout(`Evidence: ${evidenceLine}\n`);
        }
      }

      if (failingFindings === 0) {
        this.context.io.stdout(
          `No findings met fail threshold ${failThreshold}. Audit will exit successfully.\n`,
        );
        return 0;
      }

      return 1;
    } catch (error) {
      this.context.io.stderr(
        `${error instanceof Error ? error.message : "Unable to run audit."}\n`,
      );
      return 1;
    }
  }

  /**
   * Delegates the doctor command path to its dedicated subcommand module.
   */
  handleDoctor() {
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
      const result = this.context.core.createDoctorResult(manifest);
      const warningCount = result.checks.filter(
        (check) => check.status === "warning",
      ).length;
      const status = warningCount > 0 ? "warnings" : "passed";

      if (this.context.optionsModule.wantsJsonOutput()) {
        this.context.io.stdout(
          `${JSON.stringify(
            {
              command: "doctor",
              status,
              summary: {
                totalChecks: result.checks.length,
                warningChecks: warningCount,
              },
              checks: result.checks,
            },
            null,
            2,
          )}\n`,
        );
        return warningCount > 0 ? 1 : 0;
      }

      if (result.checks.length === 0) {
        this.context.io.stdout(
          "Doctor passed with no applicable release integration checks.\n",
        );
        return 0;
      }

      this.context.io.stdout(`Doctor status: ${status}\n`);

      for (const check of result.checks) {
        this.context.io.stdout(
          `${check.status.toUpperCase()} ${check.code}: ${check.summary}\n`,
        );

        for (const detail of check.details) {
          this.context.io.stdout(`Detail: ${detail}\n`);
        }
      }

      return warningCount > 0 ? 1 : 0;
    } catch (error) {
      this.context.io.stderr(
        `${error instanceof Error ? error.message : "Unable to run doctor."}\n`,
      );
      return 1;
    }
  }
}
