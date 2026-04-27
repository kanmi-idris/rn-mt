/**
 * Shared runtime-facing type definitions used across rn-mt packages.
 */
export type RnMtTargetPlatform = "ios" | "android";

export interface RnMtTargetContext {
  tenant: string;
  environment: string;
  platform?: RnMtTargetPlatform;
}

export interface RnMtRuntimeIdentity {
  displayName: string;
  nativeId: string;
}

export interface RnMtRuntimeTenant {
  id: string;
  displayName: string;
}

export interface RnMtRuntimeEnvironment {
  id: string;
}

export interface RnMtRouteDefinition {
  id: string;
  path: string;
  screen: string;
}

export interface RnMtFeatureDefinition {
  id: string;
  module: string;
  enabledByFlag?: string;
}

export interface RnMtMenuDefinition {
  id: string;
  label: string;
  actionId: string;
  enabledByFlag?: string;
}

export interface RnMtActionDefinition {
  id: string;
  label: string;
  handler: string;
  enabledByFlag?: string;
}

export interface RnMtResolvedTenantRuntime {
  config: Record<string, unknown>;
  tenant: RnMtRuntimeTenant;
  env: RnMtRuntimeEnvironment;
  flags: Record<string, unknown>;
  assets: Record<string, string>;
  routes: RnMtRouteDefinition[];
  features: RnMtFeatureDefinition[];
  menus: RnMtMenuDefinition[];
  actions: RnMtActionDefinition[];
}

export interface RnMtRuntimeAccessors<
  TRuntime extends RnMtResolvedTenantRuntime = RnMtResolvedTenantRuntime,
> {
  getConfig(): TRuntime["config"];
  getTenant(): TRuntime["tenant"];
  getEnv(): TRuntime["env"];
  getFlags(): TRuntime["flags"];
  getAssets(): TRuntime["assets"];
  getRoutes(): TRuntime["routes"];
  getFeatures(): TRuntime["features"];
  getMenus(): TRuntime["menus"];
  getActions(): TRuntime["actions"];
}
