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
  };
}
