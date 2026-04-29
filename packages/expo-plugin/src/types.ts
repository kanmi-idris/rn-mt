/**
 * Defines the narrow type surface shared by the Expo bridge helpers.
 */
import type { RnMtExpoTargetContext } from "@_molaidrislabs/shared";

export interface ExpoPluginBridgeContract {
  targetContextSource: "rn-mt-state";
  computedAuthority: "app.config.ts";
  preservesAppJsonLayering: true;
}

export interface ExpoConfigLike {
  name?: string;
  slug?: string;
  scheme?: string | string[];
  icon?: string;
  ios?: Record<string, unknown>;
  android?: Record<string, unknown>;
  extra?: Record<string, unknown>;
}

export type { RnMtExpoTargetContext };
