import type {
  RnMtManifest,
  RnMtManifestResolution,
  RnMtResolvedIdentity,
  RnMtResolvedRuntimeArtifact,
  RnMtResolvedTarget,
} from "./types";

import { resolveStaticRegistry } from "./registry";

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeLayerValue(base: unknown, incoming: unknown): unknown {
  if (Array.isArray(incoming)) {
    return [...incoming];
  }

  if (isPlainObject(incoming)) {
    const baseObject = isPlainObject(base) ? base : {};
    const merged: Record<string, unknown> = { ...baseObject };

    for (const [key, value] of Object.entries(incoming)) {
      merged[key] = mergeLayerValue(baseObject[key], value);
    }

    return merged;
  }

  return incoming;
}

export function mergeLayerRecord(
  base: Record<string, unknown> | undefined,
  incoming: Record<string, unknown> | undefined,
) {
  if (!incoming) {
    return { ...(base ?? {}) };
  }

  return mergeLayerValue(base ?? {}, incoming) as Record<string, unknown>;
}

export function getCombinationKeys(target: RnMtResolvedTarget) {
  if (!target.platform) {
    return [
      `environment:${target.environment}+tenant:${target.tenant}`,
      `tenant:${target.tenant}+environment:${target.environment}`,
    ];
  }

  return [
    `environment:${target.environment}+tenant:${target.tenant}+platform:${target.platform}`,
    `environment:${target.environment}+platform:${target.platform}+tenant:${target.tenant}`,
    `tenant:${target.tenant}+environment:${target.environment}+platform:${target.platform}`,
    `tenant:${target.tenant}+platform:${target.platform}+environment:${target.environment}`,
    `platform:${target.platform}+environment:${target.environment}+tenant:${target.tenant}`,
    `platform:${target.platform}+tenant:${target.tenant}+environment:${target.environment}`,
  ];
}

export function resolveManifestLayers(
  manifest: RnMtManifest,
  target: RnMtResolvedTarget,
): RnMtManifestResolution {
  const environment = manifest.environments[target.environment];
  const tenant = manifest.tenants[target.tenant];
  const platform = target.platform ? manifest.platforms?.[target.platform] : undefined;
  const combinationEntry = getCombinationKeys(target)
    .map((key) => ({ key, layer: manifest.combinations?.[key] }))
    .find((entry) => entry.layer);
  const combination = combinationEntry?.layer;
  const appliedLayers = ["base", `environment:${target.environment}`, `tenant:${target.tenant}`];

  if (target.platform) {
    appliedLayers.push(`platform:${target.platform}`);
  }

  if (combinationEntry) {
    appliedLayers.push(`combination:${combinationEntry.key}`);
  }

  return {
    appliedLayers,
    config: mergeLayerRecord(
      mergeLayerRecord(
        mergeLayerRecord(
          mergeLayerRecord(manifest.config, environment?.config),
          tenant?.config,
        ),
        platform?.config,
      ),
      combination?.config,
    ),
    flags: mergeLayerRecord(
      mergeLayerRecord(
        mergeLayerRecord(
          mergeLayerRecord(manifest.flags, environment?.flags),
          tenant?.flags,
        ),
        platform?.flags,
      ),
      combination?.flags,
    ),
    assets: mergeLayerRecord(
      mergeLayerRecord(
        mergeLayerRecord(
          mergeLayerRecord(manifest.assets, environment?.assets),
          tenant?.assets,
        ),
        platform?.assets,
      ),
      combination?.assets,
    ) as Record<string, string>,
  };
}

export function toTitleCase(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

export function getStringRecordValue(
  source: Record<string, unknown> | undefined,
  path: string[],
) {
  let current: unknown = source;

  for (const key of path) {
    if (!isPlainObject(current)) {
      return null;
    }

    current = current[key];
  }

  return typeof current === "string" ? current : null;
}

export function setStringRecordValue(
  source: Record<string, unknown>,
  path: string[],
  value: string,
) {
  let current: Record<string, unknown> = source;

  for (const key of path.slice(0, -1)) {
    const next = current[key];

    if (!isPlainObject(next)) {
      current[key] = {};
    }

    current = current[key] as Record<string, unknown>;
  }

  const finalKey = path[path.length - 1];

  if (finalKey) {
    current[finalKey] = value;
  }
}

export function cloneJsonRecord(source: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(source)) as Record<string, unknown>;
}

export function deriveResolvedIdentity(
  manifest: RnMtManifest,
  resolvedConfig: Record<string, unknown>,
  target: RnMtResolvedTarget,
): RnMtResolvedIdentity {
  const baseDisplaySeed =
    getStringRecordValue(manifest.config, ["identity", "displayName"]) ??
    getStringRecordValue(manifest.config, ["identity", "appName"]) ??
    toTitleCase(target.tenant);
  const baseNativeSeed =
    getStringRecordValue(manifest.config, ["identity", "nativeId"]) ??
    `com.rnmt.${target.tenant}`;
  const explicitDisplayName = getStringRecordValue(resolvedConfig, [
    "identity",
    "displayName",
  ]);
  const resolvedAppName = getStringRecordValue(resolvedConfig, ["identity", "appName"]);
  const resolvedNativeId = getStringRecordValue(resolvedConfig, ["identity", "nativeId"]);
  const displaySeed = explicitDisplayName ?? resolvedAppName ?? baseDisplaySeed;
  const nativeIdSeed = resolvedNativeId ?? baseNativeSeed;
  const isProduction = target.environment === "prod" || target.environment === "production";

  if (isProduction) {
    return {
      displayName: explicitDisplayName ?? displaySeed,
      nativeId: nativeIdSeed,
    };
  }

  const environmentSuffix = ` (${toTitleCase(target.environment)})`;
  const hasDisplayOverride = explicitDisplayName !== null && explicitDisplayName !== baseDisplaySeed;
  const hasNativeIdOverride = resolvedNativeId !== null && resolvedNativeId !== baseNativeSeed;

  return {
    displayName: hasDisplayOverride ? explicitDisplayName : `${displaySeed}${environmentSuffix}`,
    nativeId: hasNativeIdOverride ? nativeIdSeed : `${nativeIdSeed}.${target.environment}`,
  };
}

export function getResolvedAndroidApplicationId(
  resolvedConfig: Record<string, unknown>,
  fallbackApplicationId: string,
) {
  return (
    getStringRecordValue(resolvedConfig, ["native", "android", "applicationId"])
    ?? fallbackApplicationId
  );
}

export function getResolvedIosBundleIdentifier(
  resolvedConfig: Record<string, unknown>,
  fallbackBundleIdentifier: string,
) {
  return (
    getStringRecordValue(resolvedConfig, ["native", "ios", "bundleIdentifier"])
    ?? fallbackBundleIdentifier
  );
}

export function resolveTargetRuntime(
  manifest: RnMtManifest,
  target: RnMtResolvedTarget,
): RnMtResolvedRuntimeArtifact {
  const environment = manifest.environments[target.environment];
  const tenant = manifest.tenants[target.tenant];

  if (!tenant) {
    throw new Error(`Unknown tenant: ${target.tenant}`);
  }

  if (!environment) {
    throw new Error(`Unknown environment: ${target.environment}`);
  }

  const resolution = resolveManifestLayers(manifest, target);
  const resolvedConfig = cloneJsonRecord(resolution.config);
  const identity = deriveResolvedIdentity(manifest, resolvedConfig, target);
  const resolvedAndroidApplicationId = getResolvedAndroidApplicationId(
    resolvedConfig,
    identity.nativeId,
  );
  const resolvedIosBundleIdentifier = getResolvedIosBundleIdentifier(
    resolvedConfig,
    identity.nativeId,
  );

  setStringRecordValue(resolvedConfig, ["identity", "displayName"], identity.displayName);
  setStringRecordValue(resolvedConfig, ["identity", "nativeId"], identity.nativeId);
  setStringRecordValue(
    resolvedConfig,
    ["native", "android", "applicationId"],
    resolvedAndroidApplicationId,
  );
  setStringRecordValue(
    resolvedConfig,
    ["native", "ios", "bundleIdentifier"],
    resolvedIosBundleIdentifier,
  );

  return {
    config: resolvedConfig,
    identity,
    tenant: {
      id: target.tenant,
      displayName: tenant.displayName,
    },
    env: {
      id: target.environment,
    },
    flags: resolution.flags,
    assets: resolution.assets,
    routes: resolveStaticRegistry(
      manifest,
      target,
      manifest.routes,
      (layer) => layer.routes,
      resolution.flags,
    ),
    features: resolveStaticRegistry(
      manifest,
      target,
      manifest.features,
      (layer) => layer.features,
      resolution.flags,
    ),
    menus: resolveStaticRegistry(
      manifest,
      target,
      manifest.menus,
      (layer) => layer.menus,
      resolution.flags,
    ),
    actions: resolveStaticRegistry(
      manifest,
      target,
      manifest.actions,
      (layer) => layer.actions,
      resolution.flags,
    ),
  };
}
