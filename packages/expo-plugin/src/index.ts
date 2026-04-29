/**
 * Public entrypoint for the @molaidrislabs/expo-plugin package.
 */
export { applyExpoTargetContext } from "./apply-target-context";
export { expoPluginBridgeContract } from "./bridge-contract";

export type {
  ExpoConfigLike,
  ExpoPluginBridgeContract,
  RnMtExpoTargetContext,
} from "./types";
