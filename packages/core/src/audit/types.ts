export type RnMtAuditSeverity = "P0" | "P1" | "P2" | "P3";

export type RnMtAuditConfidence = "low" | "medium" | "high";

export interface RnMtAuditFinding {
  code: "override-candidate" | "other-tenant-residue";
  path: string;
  severity: RnMtAuditSeverity;
  confidence: RnMtAuditConfidence;
  evidence: string[];
  summary: string;
}

export interface RnMtAuditResult {
  rootDir: string;
  findings: RnMtAuditFinding[];
}
