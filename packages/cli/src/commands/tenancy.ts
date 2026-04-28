/**
 * Implements the tenancy CLI command module.
 */
import { renameSync, rmSync } from "node:fs";

import type { RnMtCliCommandContext } from "../types";

/**
 * Aggregates related tenancy subcommands behind one seam.
 */
export class RnMtCliTenancyCommands {
  /**
   * Initializes the tenancy with its shared dependencies.
   */
  constructor(private readonly context: RnMtCliCommandContext) {}

  /**
   * Delegates the tenant add command path to its dedicated subcommand module.
   */
  handleTenantAdd() {
    const tenantId = this.context.optionsModule.getRequiredOption("--id");
    const displayName =
      this.context.optionsModule.getSelectedTenantDisplayName();

    if (!tenantId) {
      this.context.io.stderr("tenant add requires --id <tenant-id>.\n");
      return 1;
    }

    const manifestPath = this.context.executionContext.manifestPath;

    if (!this.context.fileExists(manifestPath)) {
      this.context.io.stderr(`Manifest not found: ${manifestPath}\n`);
      return 1;
    }

    try {
      const manifest = this.context.execution.readScopedManifest(
        manifestPath,
        this.context.cwd,
        this.context.readFile,
      );
      const result = this.context.core.createTenantAddResult(manifest, {
        id: tenantId,
        ...(displayName ? { displayName } : {}),
      });

      this.context.writeFile(
        result.manifestPath,
        `${JSON.stringify(result.manifest, null, 2)}\n`,
      );

      const createdFiles = result.createdFiles.map((file) => {
        const changed =
          !this.context.fileExists(file.path) ||
          this.context.readFile(file.path) !== file.contents;

        if (changed) {
          this.context.files.ensureParentDir(file.path);
          this.context.writeFile(file.path, file.contents);
        }

        return {
          path: file.path,
          changed,
        };
      });

      if (this.context.optionsModule.wantsJsonOutput()) {
        this.context.io.stdout(
          `${JSON.stringify(
            {
              command: "tenant add",
              status: "added",
              manifestPath: result.manifestPath,
              tenant: result.tenant,
              createdFiles,
            },
            null,
            2,
          )}\n`,
        );
        return 0;
      }

      this.context.io.stdout(`Updated manifest: ${result.manifestPath}\n`);
      this.context.io.stdout(`Added tenant: ${result.tenant.id}\n`);
      this.context.io.stdout(`Display name: ${result.tenant.displayName}\n`);

      for (const file of createdFiles) {
        if (file.changed) {
          this.context.io.stdout(`Created file: ${file.path}\n`);
        }
      }

      return 0;
    } catch (error) {
      this.context.io.stderr(
        `${error instanceof Error ? error.message : "Unable to add tenant."}\n`,
      );
      return 1;
    }
  }

  /**
   * Delegates the tenant rename command path to its dedicated subcommand module.
   */
  handleTenantRename() {
    const fromId = this.context.optionsModule.getRequiredOption("--from");
    const toId = this.context.optionsModule.getRequiredOption("--to");
    const displayName =
      this.context.optionsModule.getSelectedTenantDisplayName();

    if (!fromId || !toId) {
      this.context.io.stderr(
        "tenant rename requires --from <tenant-id> and --to <tenant-id>.\n",
      );
      return 1;
    }

    const manifestPath = this.context.executionContext.manifestPath;

    if (!this.context.fileExists(manifestPath)) {
      this.context.io.stderr(`Manifest not found: ${manifestPath}\n`);
      return 1;
    }

    try {
      const manifest = this.context.execution.readScopedManifest(
        manifestPath,
        this.context.cwd,
        this.context.readFile,
      );
      const result = this.context.core.createTenantRenameResult(manifest, {
        fromId,
        toId,
        ...(displayName ? { displayName } : {}),
      });

      this.context.writeFile(
        result.manifestPath,
        `${JSON.stringify(result.manifest, null, 2)}\n`,
      );

      const renamedPaths = result.renamedPaths.map((pathChange) => {
        const changed = this.context.fileExists(pathChange.fromPath);

        if (changed) {
          this.context.files.ensureParentDir(pathChange.toPath);
          renameSync(pathChange.fromPath, pathChange.toPath);
        }

        return {
          fromPath: pathChange.fromPath,
          toPath: pathChange.toPath,
          changed,
        };
      });

      const generatedFiles = result.generatedFiles.map((file) => {
        const changed =
          !this.context.fileExists(file.path) ||
          this.context.files.readPathContents(file.path) !== file.contents;

        if (changed) {
          this.context.files.ensureParentDir(file.path);
          this.context.files.writePathContents(file.path, file.contents);
        }

        return {
          path: file.path,
          kind: file.kind,
          changed,
        };
      });

      if (this.context.optionsModule.wantsJsonOutput()) {
        this.context.io.stdout(
          `${JSON.stringify(
            {
              command: "tenant rename",
              status: "renamed",
              manifestPath: result.manifestPath,
              tenant: result.tenant,
              renamedPaths,
              generatedFiles,
            },
            null,
            2,
          )}\n`,
        );
        return 0;
      }

      this.context.io.stdout(`Updated manifest: ${result.manifestPath}\n`);
      this.context.io.stdout(
        `Renamed tenant: ${result.tenant.previousId} -> ${result.tenant.id}\n`,
      );
      this.context.io.stdout(`Display name: ${result.tenant.displayName}\n`);

      for (const pathChange of renamedPaths) {
        if (pathChange.changed) {
          this.context.io.stdout(
            `Renamed path: ${pathChange.fromPath} -> ${pathChange.toPath}\n`,
          );
        }
      }

      for (const file of generatedFiles) {
        if (file.changed) {
          this.context.io.stdout(`Updated file: ${file.path}\n`);
        }
      }

      return 0;
    } catch (error) {
      this.context.io.stderr(
        `${error instanceof Error ? error.message : "Unable to rename tenant."}\n`,
      );
      return 1;
    }
  }

  /**
   * Delegates the tenant remove command path to its dedicated subcommand module.
   */
  handleTenantRemove() {
    const tenantId = this.context.optionsModule.getRequiredOption("--id");

    if (!tenantId) {
      this.context.io.stderr("tenant remove requires --id <tenant-id>.\n");
      return 1;
    }

    const manifestPath = this.context.executionContext.manifestPath;

    if (!this.context.fileExists(manifestPath)) {
      this.context.io.stderr(`Manifest not found: ${manifestPath}\n`);
      return 1;
    }

    try {
      const manifest = this.context.execution.readScopedManifest(
        manifestPath,
        this.context.cwd,
        this.context.readFile,
      );
      const result = this.context.core.createTenantRemoveResult(manifest, {
        id: tenantId,
      });

      this.context.writeFile(
        result.manifestPath,
        `${JSON.stringify(result.manifest, null, 2)}\n`,
      );

      const removedPaths = result.removedPaths.map((path) => {
        const changed = this.context.fileExists(path);

        if (changed) {
          rmSync(path, { recursive: true, force: true });
        }

        return {
          path,
          changed,
        };
      });

      if (this.context.optionsModule.wantsJsonOutput()) {
        this.context.io.stdout(
          `${JSON.stringify(
            {
              command: "tenant remove",
              status: "removed",
              manifestPath: result.manifestPath,
              tenant: result.tenant,
              removedPaths,
            },
            null,
            2,
          )}\n`,
        );
        return 0;
      }

      this.context.io.stdout(`Updated manifest: ${result.manifestPath}\n`);
      this.context.io.stdout(`Removed tenant: ${result.tenant.id}\n`);
      this.context.io.stdout(`Display name: ${result.tenant.displayName}\n`);

      for (const removedPath of removedPaths) {
        if (removedPath.changed) {
          this.context.io.stdout(`Removed path: ${removedPath.path}\n`);
        }
      }

      return 0;
    } catch (error) {
      this.context.io.stderr(
        `${error instanceof Error ? error.message : "Unable to remove tenant."}\n`,
      );
      return 1;
    }
  }

  /**
   * Delegates the target set command path to its dedicated subcommand module.
   */
  handleTargetSet() {
    const tenant = this.context.optionsModule.getRequiredOption("--tenant");
    const environment =
      this.context.optionsModule.getRequiredOption("--environment");

    if (!tenant || !environment) {
      this.context.io.stderr(
        "target set requires --tenant <id> and --environment <id>.\n",
      );
      return 1;
    }

    const manifestPath = this.context.executionContext.manifestPath;

    if (!this.context.fileExists(manifestPath)) {
      this.context.io.stderr(`Manifest not found: ${manifestPath}\n`);
      return 1;
    }

    const manifest = this.context.execution.readScopedManifest(
      manifestPath,
      this.context.cwd,
      this.context.readFile,
    );

    try {
      const result = this.context.core.createTargetSetResult(manifest, {
        tenant,
        environment,
      });

      this.context.writeFile(
        result.manifestPath,
        `${JSON.stringify(result.manifest, null, 2)}\n`,
      );

      if (this.context.optionsModule.wantsJsonOutput()) {
        this.context.io.stdout(
          `${JSON.stringify(
            {
              command: "target set",
              status: "updated",
              manifestPath: result.manifestPath,
              defaults: result.manifest.defaults,
            },
            null,
            2,
          )}\n`,
        );
        return 0;
      }

      this.context.io.stdout(`Updated manifest: ${result.manifestPath}\n`);
      this.context.io.stdout(
        `Default tenant: ${result.manifest.defaults.tenant}\n`,
      );
      this.context.io.stdout(
        `Default environment: ${result.manifest.defaults.environment}\n`,
      );
      return 0;
    } catch (error) {
      this.context.io.stderr(
        `${error instanceof Error ? error.message : "Unable to update target defaults."}\n`,
      );
      return 1;
    }
  }
}
