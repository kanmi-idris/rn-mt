import type { RnMtHostLanguage } from "../analyze/types";

export type RnMtTargetPlatform = "ios" | "android";

export interface RnMtManifestLayer {
  config?: Record<string, unknown>;
  flags?: Record<string, unknown>;
  assets?: Record<string, string>;
  routes?: RnMtStaticRegistryLayer<RnMtRouteDefinition>;
  features?: RnMtStaticRegistryLayer<RnMtFeatureDefinition>;
  menus?: RnMtStaticRegistryLayer<RnMtMenuDefinition>;
  actions?: RnMtStaticRegistryLayer<RnMtActionDefinition>;
}

export interface RnMtStaticRegistryItem {
  id: string;
  enabledByFlag?: string;
}

export interface RnMtRouteDefinition extends RnMtStaticRegistryItem {
  id: string;
  path: string;
  screen: string;
}

export interface RnMtFeatureDefinition extends RnMtStaticRegistryItem {
  id: string;
  module: string;
}

export interface RnMtMenuDefinition extends RnMtStaticRegistryItem {
  id: string;
  label: string;
  actionId: string;
}

export interface RnMtActionDefinition extends RnMtStaticRegistryItem {
  id: string;
  label: string;
  handler: string;
}

export interface RnMtStaticRegistryLayer<T extends RnMtStaticRegistryItem> {
  add?: T[];
  replace?: T[];
  disable?: string[];
}

export interface RnMtEnvSchemaEntry {
  source?: string;
  required?: boolean;
  secret?: boolean;
}

export type RnMtEnvSource = Record<string, string | undefined>;

export interface RnMtResolvedIdentity {
  displayName: string;
  nativeId: string;
}

export interface RnMtResolvedTarget {
  tenant: string;
  environment: string;
  platform?: RnMtTargetPlatform;
}

export interface RnMtManifest {
  schemaVersion: 1;
  source: {
    rootDir: string;
  };
  envSchema?: Record<string, RnMtEnvSchemaEntry>;
  config?: Record<string, unknown>;
  flags?: Record<string, unknown>;
  assets?: Record<string, string>;
  routes?: RnMtRouteDefinition[];
  features?: RnMtFeatureDefinition[];
  menus?: RnMtMenuDefinition[];
  actions?: RnMtActionDefinition[];
  defaults: {
    tenant: string;
    environment: string;
  };
  tenants: Record<string, RnMtManifestLayer & { displayName: string }>;
  environments: Record<string, RnMtManifestLayer & { displayName: string }>;
  platforms?: Partial<Record<RnMtTargetPlatform, RnMtManifestLayer>>;
  combinations?: Record<string, RnMtManifestLayer>;
}

export interface RnMtTargetSetResult {
  manifestPath: string;
  manifest: RnMtManifest;
}

export interface RnMtResolvedRuntimeArtifact {
  config: Record<string, unknown>;
  identity: RnMtResolvedIdentity;
  tenant: {
    id: string;
    displayName: string;
  };
  env: {
    id: string;
  };
  flags: Record<string, unknown>;
  assets: Record<string, string>;
  routes: RnMtRouteDefinition[];
  features: RnMtFeatureDefinition[];
  menus: RnMtMenuDefinition[];
  actions: RnMtActionDefinition[];
}

export interface RnMtManifestResolution {
  appliedLayers: string[];
  config: Record<string, unknown>;
  flags: Record<string, unknown>;
  assets: Record<string, string>;
}

export interface RnMtInitialManifestInput {
  rootDir: string;
  hostLanguage: RnMtHostLanguage;
  packageName?: string;
}
