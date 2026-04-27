/**
 * Builds the narrow runtime accessor surface exposed to host apps.
 */
import type { ResolvedTenantRuntime, RuntimeAccessors } from "./types";

/**
 * Wraps resolved runtime data in the stable getter-based API consumed by host
 * applications.
 */
export function createRuntimeAccessors(
  runtime: ResolvedTenantRuntime,
): RuntimeAccessors {
  return {
    getConfig() {
      return runtime.config;
    },
    getTenant() {
      return runtime.tenant;
    },
    getEnv() {
      return runtime.env;
    },
    getFlags() {
      return runtime.flags;
    },
    getAssets() {
      return runtime.assets;
    },
    getRoutes() {
      return runtime.routes;
    },
    getFeatures() {
      return runtime.features;
    },
    getMenus() {
      return runtime.menus;
    },
    getActions() {
      return runtime.actions;
    },
  };
}
