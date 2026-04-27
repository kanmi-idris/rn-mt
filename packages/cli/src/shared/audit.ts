/**
 * Provides shared audit behavior for CLI execution.
 */
import type { RnMtAuditFinding, RnMtAuditSeverity } from "@rn-mt/core";

/**
 * Encapsulates audit behavior behind a constructor-backed seam.
 */
export class RnMtCliAuditModule {
  /**
   * Initializes the audit with its shared dependencies.
   */
  constructor(private readonly dependencies: { rootDir: string }) {}

  /**
   * Applies ignore rules for the audit flow.
   */
  applyIgnoreRules(findings: RnMtAuditFinding[], ignoreRules: string[]) {
    if (ignoreRules.length === 0) {
      return findings;
    }

    return findings.filter(
      (finding) =>
        !ignoreRules.some((ignoreRule) =>
          this.findingMatchesIgnoreRule(finding, ignoreRule),
        ),
    );
  }

  /**
   * Counts failing findings for the audit flow.
   */
  countFailingFindings(
    findings: RnMtAuditFinding[],
    failThreshold: RnMtAuditSeverity | null,
  ) {
    if (failThreshold === null) {
      return findings.length;
    }

    const failThresholdRank = this.getSeverityRank(failThreshold);

    return findings.filter(
      (finding) => this.getSeverityRank(finding.severity) <= failThresholdRank,
    ).length;
  }

  /**
   * Normalizes match path for the audit flow.
   */
  private normalizeMatchPath(value: string) {
    return value.replaceAll("\\", "/");
  }

  /**
   * Converts an audit severity label into a numeric rank used for comparisons.
   */
  private getSeverityRank(severity: RnMtAuditSeverity) {
    switch (severity) {
      case "P0":
        return 0;
      case "P1":
        return 1;
      case "P2":
        return 2;
      case "P3":
        return 3;
    }
  }

  /**
   * Checks whether a finding should be suppressed by a user-provided ignore
   * rule.
   */
  private findingMatchesIgnoreRule(
    finding: RnMtAuditFinding,
    ignoreRule: string,
  ) {
    const normalizedRule = this.normalizeMatchPath(ignoreRule);
    const normalizedPath = this.normalizeMatchPath(finding.path);
    const relativePath = this.normalizeMatchPath(
      normalizedPath.startsWith(this.dependencies.rootDir)
        ? normalizedPath
            .slice(this.dependencies.rootDir.length)
            .replace(/^\/+/u, "")
        : normalizedPath,
    );

    return (
      finding.code === normalizedRule ||
      normalizedPath.includes(normalizedRule) ||
      relativePath.includes(normalizedRule)
    );
  }
}
