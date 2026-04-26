import type { RnMtBaselineAnalyzeReport } from "../analyze/types";

import {
  type RnMtInitialManifestInput,
  type RnMtManifest,
  type RnMtResolvedTarget,
} from "./types";
import { resolveTargetRuntime } from "./merge";
import { validateEnvSchemaShape } from "./env";

function inferInitialTenantId(input: RnMtInitialManifestInput) {
  if (input.packageName) {
    return input.packageName
      .toLowerCase()
      .replace(/^@/, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "default";
  }

  return "default";
}

function inferDisplayNameFromTenantId(tenantId: string) {
  return tenantId
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export function createInitialManifest(
  report: Pick<RnMtBaselineAnalyzeReport, "repo">,
  options: { packageName?: string } = {},
): RnMtManifest {
  const tenantId = inferInitialTenantId({
    rootDir: report.repo.rootDir,
    hostLanguage: report.repo.host.language,
    ...(options.packageName ? { packageName: options.packageName } : {}),
  });
  const tenantDisplayName = inferDisplayNameFromTenantId(tenantId);

  return {
    schemaVersion: 1,
    source: {
      rootDir: report.repo.rootDir,
    },
    defaults: {
      tenant: tenantId,
      environment: "dev",
    },
    tenants: {
      [tenantId]: {
        displayName: tenantDisplayName || "Default",
      },
    },
    environments: {
      dev: {
        displayName: "Development",
      },
    },
  };
}

export function parseManifest(manifestContents: string): RnMtManifest {
  const manifest = JSON.parse(manifestContents) as RnMtManifest;
  const envSchemaError = validateEnvSchemaShape(manifest.envSchema);

  if (envSchemaError) {
    throw new Error(envSchemaError);
  }

  return manifest;
}

export function validateTargetSelection(
  manifest: RnMtManifest,
  target: Pick<RnMtResolvedTarget, "tenant" | "environment">,
) {
  if (!manifest.tenants[target.tenant]) {
    return `Unknown tenant: ${target.tenant}`;
  }

  if (!manifest.environments[target.environment]) {
    return `Unknown environment: ${target.environment}`;
  }

  return null;
}

export { resolveTargetRuntime };
