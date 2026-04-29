/**
 * Public entrypoint for the @_molaidrislabs/expo-plugin package.
 */
export { applyExpoTargetContext } from "./apply-target-context";
export { expoPluginBridgeContract } from "./bridge-contract";

export type {
  ExpoConfigLike,
  ExpoPluginBridgeContract,
  RnMtExpoTargetContext,
} from "./types";
