export {
  createInitialManifest,
  parseManifest,
  resolveTargetRuntime,
  validateTargetSelection,
} from "./manifest-module";

export {
  getCombinationKeys,
  getResolvedAndroidApplicationId,
  getResolvedIosBundleIdentifier,
  isPlainObject,
  mergeLayerRecord,
  resolveManifestLayers,
} from "./merge";

export { validateEnvInputs, validateEnvSchemaShape } from "./env";

export type {
  RnMtActionDefinition,
  RnMtEnvSchemaEntry,
  RnMtEnvSource,
  RnMtFeatureDefinition,
  RnMtInitialManifestInput,
  RnMtManifest,
  RnMtManifestLayer,
  RnMtManifestResolution,
  RnMtMenuDefinition,
  RnMtResolvedIdentity,
  RnMtResolvedRuntimeArtifact,
  RnMtResolvedTarget,
  RnMtRouteDefinition,
  RnMtStaticRegistryItem,
  RnMtStaticRegistryLayer,
  RnMtTargetPlatform,
  RnMtTargetSetResult,
} from "./types";
