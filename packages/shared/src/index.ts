/**
 * Public entrypoint for the shared utilities package.
 */
export { hashText } from "./hash";
export { isPlainRecord } from "./object";

export type { RnMtExpoTargetContext } from "./expo-types";
export type {
  RnMtActionDefinition,
  RnMtFeatureDefinition,
  RnMtMenuDefinition,
  RnMtResolvedTenantRuntime,
  RnMtRouteDefinition,
  RnMtRuntimeAccessors,
  RnMtRuntimeEnvironment,
  RnMtRuntimeIdentity,
  RnMtRuntimeTenant,
  RnMtTargetContext,
  RnMtTargetPlatform,
} from "./runtime-types";
