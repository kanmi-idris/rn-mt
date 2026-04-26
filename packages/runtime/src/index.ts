export interface ResolvedTenantRuntime {
  config: Record<string, unknown>;
  tenant: {
    id: string;
    displayName: string;
  };
  env: {
    id: string;
  };
  flags: Record<string, unknown>;
  assets: Record<string, string>;
  routes: Array<{
    id: string;
    path: string;
    screen: string;
  }>;
  features: Array<{
    id: string;
    module: string;
    enabledByFlag?: string;
  }>;
  menus: Array<{
    id: string;
    label: string;
    actionId: string;
    enabledByFlag?: string;
  }>;
  actions: Array<{
    id: string;
    label: string;
    handler: string;
    enabledByFlag?: string;
  }>;
}

export function createRuntimeAccessors(runtime: ResolvedTenantRuntime) {
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
