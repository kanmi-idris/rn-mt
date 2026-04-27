/**
 * Resolves target runtime state and generates the CLI-owned artifacts written
 * by rn-mt sync.
 */
import type { RnMtManifest, RnMtResolvedTarget } from "../manifest/types";
import {
  resolveManifestLayers,
  resolveTargetRuntime,
  validateEnvInputs,
  validateTargetSelection,
} from "../manifest";

import {
  createDerivedPlatformAssetFiles,
  createAssetFingerprintMetadataFile,
} from "./asset-artifacts";
import {
  createAndroidFlavorConfigFile,
  createAndroidNativeIdentityFile,
  createExpoTargetContextFile,
  createIosNativeConfigFiles,
  getBareIosProjectName,
  hasBareAndroidProject,
  hasExpoComputedConfig,
} from "./native-artifacts";
import {
  createOwnershipMetadataFile,
  createRuntimeArtifactFile,
} from "./runtime-artifacts";
import { createSubprocessEnv } from "./subprocess-env";

import type { RnMtEnvSource } from "../manifest/types";
import type {
  RnMtSyncModuleDependencies,
  RnMtSyncRunOptions,
  RnMtSyncResult,
  RnMtSubprocessEnvResult,
} from "./types";

/**
 * Encapsulates sync behavior behind a constructor-backed seam.
 */
export class RnMtSyncModule {
  /**
   * Initializes the sync with its shared dependencies.
   */
  constructor(private readonly dependencies: RnMtSyncModuleDependencies) {}

  /**
   * Runs the sync flow.
   */
  run(options: RnMtSyncRunOptions): RnMtSyncResult {
    const manifest = options.manifest;
    const target: RnMtResolvedTarget = options.target
      ? options.target
      : {
          tenant: manifest.defaults.tenant,
          environment: manifest.defaults.environment,
        };
    const targetValidationError = validateTargetSelection(manifest, target);

    if (targetValidationError) {
      throw new Error(targetValidationError);
    }

    const envValidationError = validateEnvInputs(
      manifest,
      target,
      options.env ?? process.env,
    );

    if (envValidationError) {
      throw new Error(envValidationError);
    }

    const resolution = resolveManifestLayers(manifest, target);
    const runtime = resolveTargetRuntime(manifest, target);
    const runtimeArtifact = createRuntimeArtifactFile(
      this.dependencies.workspace,
      runtime,
    );
    const derivedAssets = createDerivedPlatformAssetFiles(
      this.dependencies.workspace,
      runtime,
      target,
    );
    const derivedIconPath = derivedAssets.files[0]
      ? `./${this.dependencies.workspace
          .toRootRelative(derivedAssets.files[0].path)
          .replace(/\\/gu, "/")}`
      : runtime.assets.icon
        ? `./${runtime.assets.icon.replace(/\\/gu, "/")}`
        : undefined;
    const trackedFiles = [runtimeArtifact, ...derivedAssets.files];

    if (hasExpoComputedConfig(this.dependencies.workspace)) {
      trackedFiles.push(
        createExpoTargetContextFile(
          this.dependencies.workspace,
          runtime,
          target,
          derivedIconPath,
        ),
      );
    }

    if (
      target.platform === "android" &&
      hasBareAndroidProject(this.dependencies.workspace)
    ) {
      trackedFiles.push(
        createAndroidNativeIdentityFile(
          this.dependencies.workspace,
          runtime,
          target,
        ),
        createAndroidFlavorConfigFile(
          this.dependencies.workspace,
          manifest,
          runtime,
          target,
        ),
      );
    }

    if (target.platform === "ios") {
      const xcodeProjectName = getBareIosProjectName(
        this.dependencies.workspace,
      );

      if (xcodeProjectName) {
        trackedFiles.push(
          ...createIosNativeConfigFiles(
            this.dependencies.workspace,
            runtime,
            target,
            xcodeProjectName,
          ),
        );
      }
    }

    if (derivedAssets.fingerprintRecords.length > 0) {
      trackedFiles.push(
        createAssetFingerprintMetadataFile(
          this.dependencies.workspace,
          derivedAssets.fingerprintRecords,
        ),
      );
    }

    const ownershipMetadata = createOwnershipMetadataFile(
      this.dependencies.workspace,
      trackedFiles,
    );

    const normalizedTarget: RnMtSyncResult["target"] = target.platform
      ? {
          tenant: target.tenant,
          environment: target.environment,
          platform: target.platform,
        }
      : {
          tenant: target.tenant,
          environment: target.environment,
        };

    return {
      rootDir: this.dependencies.workspace.rootDir,
      target: normalizedTarget,
      resolution: {
        appliedLayers: resolution.appliedLayers,
      },
      runtime,
      generatedFiles: [...trackedFiles, ownershipMetadata],
    };
  }

  /**
   * Loads and validates the env map used for target-aware subprocess execution.
   */
  createSubprocessEnv(options: {
    manifest: RnMtManifest;
    target?: RnMtResolvedTarget;
    baseEnv?: RnMtEnvSource;
  }): RnMtSubprocessEnvResult {
    const target: RnMtResolvedTarget = options.target
      ? options.target
      : {
          tenant: options.manifest.defaults.tenant,
          environment: options.manifest.defaults.environment,
        };

    return createSubprocessEnv(
      this.dependencies.workspace,
      options.manifest,
      target,
      options.baseEnv ? { baseEnv: options.baseEnv } : {},
    );
  }
}
