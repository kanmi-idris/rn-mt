/**
 * Handles tenant lifecycle operations and updates the manifest's default target
 * selection.
 */
import { join } from "node:path";

import type { RnMtManifest } from "../manifest/types";
import { validateTargetSelection } from "../manifest";
import {
  createCurrentFacadeFile,
  listSharedFiles,
  isTestSourcePath,
} from "../convert";
import { RnMtWorkspace } from "../workspace";

import type {
  RnMtTargetSetResult,
  RnMtTenantAddResult,
  RnMtTenantRemoveResult,
  RnMtTenantRenameResult,
} from "./types";

/**
 * Encapsulates tenant behavior behind a constructor-backed seam.
 */
export class RnMtTenantModule {
  /**
   * Initializes the tenant with its shared dependencies.
   */
  constructor(private readonly dependencies: { workspace: RnMtWorkspace }) {}

  /**
   * Sets default target for the tenant flow.
   */
  setDefaultTarget(options: {
    manifest: RnMtManifest;
    target: {
      tenant: string;
      environment: string;
    };
  }): RnMtTargetSetResult {
    const validationError = validateTargetSelection(
      options.manifest,
      options.target,
    );

    if (validationError) {
      throw new Error(validationError);
    }

    return {
      manifestPath: this.dependencies.workspace.getManifestPath(),
      manifest: {
        ...options.manifest,
        defaults: {
          tenant: options.target.tenant,
          environment: options.target.environment,
        },
      },
    };
  }

  /**
   * Adds a new tenant entry to the manifest and seeds its override directory.
   */
  add(options: {
    manifest: RnMtManifest;
    tenant: {
      id: string;
      displayName?: string;
    };
  }): RnMtTenantAddResult {
    const normalizedTenantId = options.tenant.id.trim();
    const tenantIdError = this.validateTenantId(normalizedTenantId);

    if (tenantIdError) {
      throw new Error(tenantIdError);
    }

    if (options.manifest.tenants[normalizedTenantId]) {
      throw new Error(`Tenant already exists: ${normalizedTenantId}`);
    }

    const displayName =
      options.tenant.displayName?.trim() ||
      this.inferDisplayNameFromTenantId(normalizedTenantId) ||
      normalizedTenantId;

    return {
      manifestPath: this.dependencies.workspace.getManifestPath(),
      manifest: {
        ...options.manifest,
        tenants: {
          ...options.manifest.tenants,
          [normalizedTenantId]: {
            displayName,
          },
        },
      },
      tenant: {
        id: normalizedTenantId,
        displayName,
      },
      createdFiles: [
        {
          path: join(
            this.dependencies.workspace.getTenantRootDir(normalizedTenantId),
            ".gitkeep",
          ),
          contents: "",
        },
      ],
    };
  }

  /**
   * Renames an existing tenant across manifest state, tenant directories, and
   * tenant-scoped env files.
   */
  rename(options: {
    manifest: RnMtManifest;
    tenant: {
      fromId: string;
      toId: string;
      displayName?: string;
    };
  }): RnMtTenantRenameResult {
    const fromId = options.tenant.fromId.trim();
    const toId = options.tenant.toId.trim();

    if (!options.manifest.tenants[fromId]) {
      throw new Error(`Unknown tenant: ${fromId}`);
    }

    const tenantIdError = this.validateTenantId(toId);

    if (tenantIdError) {
      throw new Error(tenantIdError);
    }

    if (fromId === toId) {
      throw new Error(
        `Tenant rename requires a different target id: ${fromId}`,
      );
    }

    if (options.manifest.tenants[toId]) {
      throw new Error(`Tenant already exists: ${toId}`);
    }

    const fromTenantDir = this.dependencies.workspace.getTenantRootDir(fromId);
    const toTenantDir = this.dependencies.workspace.getTenantRootDir(toId);
    const renamedPaths: Array<{
      fromPath: string;
      toPath: string;
    }> = [];

    if (this.dependencies.workspace.exists(fromTenantDir)) {
      if (this.dependencies.workspace.exists(toTenantDir)) {
        throw new Error(`Tenant path already exists: ${toTenantDir}`);
      }

      renamedPaths.push({
        fromPath: fromTenantDir,
        toPath: toTenantDir,
      });
    }

    for (const environmentId of Object.keys(options.manifest.environments)) {
      const fromEnvPath = join(
        this.dependencies.workspace.rootDir,
        `.env.${fromId}.${environmentId}`,
      );
      const toEnvPath = join(
        this.dependencies.workspace.rootDir,
        `.env.${toId}.${environmentId}`,
      );

      if (!this.dependencies.workspace.exists(fromEnvPath)) {
        continue;
      }

      if (this.dependencies.workspace.exists(toEnvPath)) {
        throw new Error(`Tenant env file path already exists: ${toEnvPath}`);
      }

      renamedPaths.push({
        fromPath: fromEnvPath,
        toPath: toEnvPath,
      });
    }

    const previousTenantLayer = options.manifest.tenants[fromId];
    const displayName =
      options.tenant.displayName?.trim() || previousTenantLayer.displayName;
    const nextTenants = { ...options.manifest.tenants };

    delete nextTenants[fromId];
    nextTenants[toId] = {
      ...previousTenantLayer,
      displayName,
    };

    const isDefaultTenantRename = options.manifest.defaults.tenant === fromId;
    const sharedRootDir = this.dependencies.workspace.getSharedRootDir();
    const generatedFiles = isDefaultTenantRename
      ? listSharedFiles(this.dependencies.workspace)
          .filter((path) => !isTestSourcePath(path))
          .map((sharedPath) => {
            const sharedFile = {
              path: sharedPath,
              contents: this.dependencies.workspace.readText(sharedPath),
            };
            const relativeSharedPath = sharedPath.slice(
              sharedRootDir.length + 1,
            );
            const previousOverridePath = join(
              fromTenantDir,
              relativeSharedPath,
            );

            return this.dependencies.workspace.isFile(previousOverridePath)
              ? createCurrentFacadeFile(
                  this.dependencies.workspace,
                  toId,
                  sharedFile,
                  {
                    overrideFile: {
                      path: join(toTenantDir, relativeSharedPath),
                      contents:
                        this.dependencies.workspace.readText(
                          previousOverridePath,
                        ),
                    },
                  },
                )
              : createCurrentFacadeFile(
                  this.dependencies.workspace,
                  toId,
                  sharedFile,
                );
          })
      : [];

    return {
      manifestPath: this.dependencies.workspace.getManifestPath(),
      manifest: {
        ...options.manifest,
        defaults: {
          tenant: isDefaultTenantRename
            ? toId
            : options.manifest.defaults.tenant,
          environment: options.manifest.defaults.environment,
        },
        tenants: nextTenants,
      },
      tenant: {
        previousId: fromId,
        id: toId,
        displayName,
      },
      renamedPaths,
      generatedFiles,
    };
  }

  /**
   * Removes the requested value for the tenant flow.
   */
  remove(options: {
    manifest: RnMtManifest;
    tenant: { id: string };
  }): RnMtTenantRemoveResult {
    const tenantId = options.tenant.id.trim();
    const tenantLayer = options.manifest.tenants[tenantId];

    if (!tenantLayer) {
      throw new Error(`Unknown tenant: ${tenantId}`);
    }

    if (options.manifest.defaults.tenant === tenantId) {
      throw new Error(
        `Cannot remove default tenant: ${tenantId}. Select a different default target first.`,
      );
    }

    const removedPaths: string[] = [];
    const tenantDir = this.dependencies.workspace.getTenantRootDir(tenantId);

    if (this.dependencies.workspace.exists(tenantDir)) {
      removedPaths.push(tenantDir);
    }

    for (const environmentId of Object.keys(options.manifest.environments)) {
      const envFilePath = join(
        this.dependencies.workspace.rootDir,
        `.env.${tenantId}.${environmentId}`,
      );

      if (this.dependencies.workspace.exists(envFilePath)) {
        removedPaths.push(envFilePath);
      }
    }

    const nextTenants = { ...options.manifest.tenants };
    delete nextTenants[tenantId];

    return {
      manifestPath: this.dependencies.workspace.getManifestPath(),
      manifest: {
        ...options.manifest,
        tenants: nextTenants,
      },
      tenant: {
        id: tenantId,
        displayName: tenantLayer.displayName,
      },
      removedPaths: removedPaths.sort((left, right) =>
        left.localeCompare(right),
      ),
    };
  }

  /**
   * Infers display name from tenant id for the tenant flow.
   */
  private inferDisplayNameFromTenantId(tenantId: string) {
    return tenantId
      .split("-")
      .filter(Boolean)
      .map((part) => part[0]?.toUpperCase() + part.slice(1))
      .join(" ");
  }

  /**
   * Validates tenant id for the tenant flow.
   */
  private validateTenantId(tenantId: string) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(tenantId)) {
      return [
        `Invalid tenant id: ${tenantId}`,
        "Tenant ids must use lowercase letters, numbers, and hyphen separators.",
      ].join("\n");
    }

    return null;
  }
}
