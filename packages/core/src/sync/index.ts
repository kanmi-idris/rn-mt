/**
 * Public entrypoint for the sync module.
 */
export { RnMtSyncModule } from "./sync-module";

export { createOwnershipMetadataFile } from "./runtime-artifacts";
export { createSubprocessEnv, parseDotEnvContents } from "./subprocess-env";
export {
  getBareIosProjectName,
  hasBareAndroidProject,
  toPascalIdentifier,
} from "./native-artifacts";

export type {
  RnMtDerivedAssetFingerprintMetadata,
  RnMtDerivedAssetFingerprintRecord,
  RnMtExpoTargetContextArtifact,
  RnMtGeneratedArtifactKind,
  RnMtLoadedEnvFile,
  RnMtOwnershipMetadataFile,
  RnMtSubprocessEnvResult,
  RnMtSyncGeneratedFile,
  RnMtSyncModuleDependencies,
  RnMtSyncResult,
} from "./types";
