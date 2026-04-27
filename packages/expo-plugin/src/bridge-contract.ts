/**
 * Defines the generated Expo bridge contract shared with host configs.
 */
import type { ExpoPluginBridgeContract } from "./types";

export const expoPluginBridgeContract: ExpoPluginBridgeContract = {
  targetContextSource: "rn-mt-state",
  computedAuthority: "app.config.ts",
  preservesAppJsonLayering: true,
};
