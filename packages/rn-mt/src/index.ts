/**
 * Public entrypoint for the single-package rn-mt distribution.
 */
export { runCli } from "@_molaidrislabs/cli";
export { createRuntimeAccessors } from "@_molaidrislabs/runtime";
export {
  applyExpoTargetContext,
  expoPluginBridgeContract,
} from "@_molaidrislabs/expo-plugin";

export type { ResolvedTenantRuntime, RuntimeAccessors } from "@_molaidrislabs/runtime";
export type {
  ExpoConfigLike,
  ExpoPluginBridgeContract,
  RnMtExpoTargetContext,
} from "@_molaidrislabs/expo-plugin";
