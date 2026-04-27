/**
 * Shared Expo-facing type definitions used across rn-mt packages.
 */
import type { RnMtRuntimeIdentity, RnMtTargetContext } from "./runtime-types";

export interface RnMtExpoTargetContext {
  schemaVersion: 1;
  target: RnMtTargetContext;
  identity: RnMtRuntimeIdentity;
  runtimeConfigPath: string;
  iconPath?: string;
}
