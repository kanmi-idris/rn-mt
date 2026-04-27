/**
 * Resolves manifest-backed static registries such as routes, features, menus, and actions.
 */
import type {
  RnMtManifest,
  RnMtManifestLayer,
  RnMtResolvedTarget,
  RnMtStaticRegistryItem,
  RnMtStaticRegistryLayer,
} from "./types";

import { getCombinationKeys } from "./merge";

/**
 * Applies a single add/replace/disable registry layer while preserving stable
 * item ordering by id.
 */
export function applyStaticRegistryLayer<T extends RnMtStaticRegistryItem>(
  entries: T[],
  layer: RnMtStaticRegistryLayer<T> | undefined,
) {
  const orderedIds = entries.map((entry) => entry.id);
  const byId = new Map(entries.map((entry) => [entry.id, entry]));

  for (const entry of layer?.add ?? []) {
    if (!byId.has(entry.id)) {
      orderedIds.push(entry.id);
    }

    byId.set(entry.id, entry);
  }

  for (const entry of layer?.replace ?? []) {
    if (!byId.has(entry.id)) {
      orderedIds.push(entry.id);
    }

    byId.set(entry.id, entry);
  }

  for (const id of layer?.disable ?? []) {
    byId.delete(id);
  }

  return orderedIds
    .filter((id, index) => orderedIds.indexOf(id) === index)
    .map((id) => byId.get(id))
    .filter((entry): entry is T => entry !== undefined);
}

/**
 * Removes registry entries whose enabledByFlag is false in the resolved flag
 * set.
 */
export function applyStaticRegistryFlagGating<T extends RnMtStaticRegistryItem>(
  entries: T[],
  flags: Record<string, unknown>,
) {
  return entries.filter((entry) => {
    if (!entry.enabledByFlag) {
      return true;
    }

    return Boolean(flags[entry.enabledByFlag]);
  });
}

/**
 * Resolves a static registry such as routes, features, menus, or actions for a
 * selected target.
 */
export function resolveStaticRegistry<T extends RnMtStaticRegistryItem>(
  manifest: RnMtManifest,
  target: RnMtResolvedTarget,
  baseEntries: T[] | undefined,
  selectLayer: (
    layer: RnMtManifestLayer,
  ) => RnMtStaticRegistryLayer<T> | undefined,
  flags: Record<string, unknown>,
) {
  const environment = manifest.environments[target.environment];
  const tenant = manifest.tenants[target.tenant];
  const platform = target.platform
    ? manifest.platforms?.[target.platform]
    : undefined;
  const combination = getCombinationKeys(target)
    .map((key) => manifest.combinations?.[key])
    .find((entry) => entry);

  return applyStaticRegistryFlagGating(
    applyStaticRegistryLayer(
      applyStaticRegistryLayer(
        applyStaticRegistryLayer(
          applyStaticRegistryLayer(
            baseEntries ?? [],
            environment ? selectLayer(environment) : undefined,
          ),
          tenant ? selectLayer(tenant) : undefined,
        ),
        platform ? selectLayer(platform) : undefined,
      ),
      combination ? selectLayer(combination) : undefined,
    ),
    flags,
  );
}
