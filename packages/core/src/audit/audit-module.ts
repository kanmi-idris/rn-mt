/**
 * Implements the audit core module.
 */
import { join, relative } from "node:path";

import type { RnMtManifest } from "../manifest/types";
import { RnMtWorkspace } from "../workspace";
import {
  isAuditableTextFile,
  isTestSourcePath,
  listSharedFiles,
} from "../convert";

import type { RnMtAuditFinding, RnMtAuditResult } from "./types";

/**
 * Encapsulates audit behavior behind a constructor-backed seam.
 */
export class RnMtAuditModule {
  /**
   * Initializes the audit with its shared dependencies.
   */
  constructor(private readonly dependencies: { workspace: RnMtWorkspace }) {}

  /**
   * Runs the audit flow.
   */
  run(manifest: RnMtManifest): RnMtAuditResult {
    const sharedRootDir = this.dependencies.workspace.getSharedRootDir();
    const tenantRootDir = this.dependencies.workspace.getTenantRootDir(
      manifest.defaults.tenant,
    );
    const findings: RnMtAuditFinding[] = [];

    for (const path of listSharedFiles(this.dependencies.workspace)) {
      if (
        isTestSourcePath(relative(sharedRootDir, path)) ||
        !isAuditableTextFile(path)
      ) {
        continue;
      }

      const relativeSharedPath = relative(sharedRootDir, path);

      if (
        this.dependencies.workspace.exists(
          join(tenantRootDir, relativeSharedPath),
        )
      ) {
        continue;
      }

      const evidence = this.collectOverrideCandidateEvidence(
        manifest,
        this.dependencies.workspace.readText(path),
      );

      if (evidence.length === 0) {
        continue;
      }

      findings.push({
        code: "override-candidate" as const,
        path,
        severity: "P2" as const,
        confidence:
          evidence.length > 1 ? ("high" as const) : ("medium" as const),
        evidence,
        summary:
          "Shared file appears tenant-specific for the current default tenant and likely wants a mirrored tenant override.",
      });
    }

    return {
      rootDir: this.dependencies.workspace.rootDir,
      findings,
    };
  }

  /**
   * Collects override candidate evidence for the audit flow.
   */
  private collectOverrideCandidateEvidence(
    manifest: RnMtManifest,
    contents: string,
  ) {
    const defaultTenantId = manifest.defaults.tenant;
    const defaultTenantDisplayName =
      manifest.tenants[defaultTenantId]?.displayName ?? null;
    const evidence: string[] = [];

    if (contents.includes(defaultTenantId)) {
      evidence.push(
        `Matched default tenant id "${defaultTenantId}" in shared file contents.`,
      );
    }

    if (
      defaultTenantDisplayName &&
      defaultTenantDisplayName !== defaultTenantId &&
      contents.includes(defaultTenantDisplayName)
    ) {
      evidence.push(
        `Matched default tenant display name "${defaultTenantDisplayName}" in shared file contents.`,
      );
    }

    return evidence;
  }
}
