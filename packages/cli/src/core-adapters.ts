/**
 * Adapts the module-oriented core API into the CLI-facing command surface.
 */
import {
  type RnMtBaselineAnalyzeReport,
  type RnMtEnvSource,
  type RnMtManifest,
  type RnMtResolvedTarget,
  RnMtAuditModule,
  RnMtConvertModule,
  RnMtDoctorModule,
  RnMtHandoffModule,
  RnMtOverrideModule,
  RnMtSyncModule,
  RnMtTenantModule,
  manifest as manifestNamespace,
} from "@molaidrislabs/core";

import { RnMtCliWorkspaceFactory } from "./shared/workspace";

import type { RnMtCliWorkspaceOverrides } from "./types";

/**
 * Adapts the module-oriented core API into CLI-facing operations.
 */
export class RnMtCliCoreAdapters {
  /**
   * Initializes the core adapters with its shared dependencies.
   */
  constructor(
    private readonly dependencies: {
      rootDir: string;
      workspaceFactory?: RnMtCliWorkspaceFactory;
    },
  ) {}

  /**
   * Rebinds the adapter set to a different root directory while reusing the
   * existing workspace factory.
   */
  forRoot(
    rootDir: string,
    workspaceFactory: RnMtCliWorkspaceFactory = this.getWorkspaceFactory(),
  ) {
    return new RnMtCliCoreAdapters({
      rootDir,
      workspaceFactory,
    });
  }

  /**
   * Runs the core analyze module for the current root.
   */
  createBaselineAnalyzeReport(
    options: {
      scopeToProvidedRoot?: boolean;
    } = {},
  ) {
    return this.getAnalyzeModule().run(options);
  }

  /**
   * Formats an analyze report using an analyze module scoped to the report's
   * root.
   */
  formatBaselineAnalyzeReport(report: RnMtBaselineAnalyzeReport) {
    return this.getAnalyzeModule(report.repo.rootDir).format(report);
  }

  /**
   * Asks the analyze module whether init can proceed for the analyzed repo.
   */
  canInitializeFromAnalyzeReport(report: RnMtBaselineAnalyzeReport) {
    return this.getAnalyzeModule(report.repo.rootDir).canInitialize(report);
  }

  /**
   * Returns the human-readable reason init is blocked for the analyzed repo.
   */
  getInitBlockedReason(report: RnMtBaselineAnalyzeReport) {
    return this.getAnalyzeModule(report.repo.rootDir).getInitBlockedReason(
      report,
    );
  }

  /**
   * Creates the initial manifest result for the analyzed repo.
   */
  createInitResult(report: RnMtBaselineAnalyzeReport) {
    return this.getAnalyzeModule(report.repo.rootDir).createInitResult(report);
  }

  /**
   * Returns the default manifest path for the current root.
   */
  getManifestPath() {
    return this.createWorkspace().getManifestPath();
  }

  /**
   * Parses manifest JSON through the shared core manifest module.
   */
  parseManifest(manifestContents: string) {
    return manifestNamespace.parseManifest(manifestContents);
  }

  /**
   * Runs the core convert module for the current root.
   */
  createConvertResult(
    manifestValue: RnMtManifest,
    options: {
      bridgeConfigModulePath?: string | null;
    } = {},
  ) {
    const runOptions = {
      manifest: manifestValue,
      ...(options.bridgeConfigModulePath !== undefined
        ? { bridgeConfigModulePath: options.bridgeConfigModulePath }
        : {}),
    };

    return new RnMtConvertModule({
      workspace: this.createWorkspace(),
    }).run(runOptions);
  }

  /**
   * Generates the codemod plan that rewrites imports to the generated current
   * facades.
   */
  createCurrentImportsCodemodResult() {
    return new RnMtConvertModule({
      workspace: this.createWorkspace(),
    }).planCurrentImportsCodemod();
  }

  /**
   * Updates manifest defaults for the selected tenant/environment target.
   */
  createTargetSetResult(
    manifestValue: RnMtManifest,
    target: {
      tenant: string;
      environment: string;
    },
  ) {
    return new RnMtTenantModule({
      workspace: this.createWorkspace(),
    }).setDefaultTarget({
      manifest: manifestValue,
      target,
    });
  }

  /**
   * Runs the tenant-add flow through the core tenant module.
   */
  createTenantAddResult(
    manifestValue: RnMtManifest,
    tenant: {
      id: string;
      displayName?: string;
    },
  ) {
    return new RnMtTenantModule({
      workspace: this.createWorkspace(),
    }).add({
      manifest: manifestValue,
      tenant,
    });
  }

  /**
   * Runs the tenant-rename flow through the core tenant module.
   */
  createTenantRenameResult(
    manifestValue: RnMtManifest,
    tenant: {
      fromId: string;
      toId: string;
      displayName?: string;
    },
  ) {
    return new RnMtTenantModule({
      workspace: this.createWorkspace(),
    }).rename({
      manifest: manifestValue,
      tenant,
    });
  }

  /**
   * Runs the tenant-remove flow through the core tenant module.
   */
  createTenantRemoveResult(
    manifestValue: RnMtManifest,
    tenant: {
      id: string;
    },
  ) {
    return new RnMtTenantModule({
      workspace: this.createWorkspace(),
    }).remove({
      manifest: manifestValue,
      tenant,
    });
  }

  /**
   * Runs the override-create flow through the core override module.
   */
  createOverrideCreateResult(
    manifestValue: RnMtManifest,
    selectedPath: string,
  ) {
    return new RnMtOverrideModule({
      workspace: this.createWorkspace(),
    }).create({
      manifest: manifestValue,
      selectedPath,
    });
  }

  /**
   * Runs the override-remove flow through the core override module.
   */
  createOverrideRemoveResult(
    manifestValue: RnMtManifest,
    selectedPath: string,
  ) {
    return new RnMtOverrideModule({
      workspace: this.createWorkspace(),
    }).remove({
      manifest: manifestValue,
      selectedPath,
    });
  }

  /**
   * Runs doctor checks for the current root.
   */
  createDoctorResult(manifestValue: RnMtManifest) {
    return new RnMtDoctorModule({
      workspace: this.createWorkspace(),
    }).run(manifestValue);
  }

  /**
   * Runs audit checks for the current root.
   */
  createAuditResult(manifestValue: RnMtManifest) {
    return new RnMtAuditModule({
      workspace: this.createWorkspace(),
    }).run(manifestValue);
  }

  /**
   * Loads and validates the subprocess environment for a selected target.
   */
  createSubprocessEnv(
    manifestValue: RnMtManifest,
    target: RnMtResolvedTarget = manifestValue.defaults,
    options: {
      baseEnv?: RnMtEnvSource | undefined;
    } = {},
  ) {
    const runOptions = {
      manifest: manifestValue,
      target,
      ...(options.baseEnv ? { baseEnv: options.baseEnv } : {}),
    };

    return new RnMtSyncModule({
      manifest: manifestNamespace,
      workspace: this.createWorkspace(),
    }).createSubprocessEnv(runOptions);
  }

  /**
   * Runs sync for the selected target.
   */
  createSyncResult(
    manifestValue: RnMtManifest,
    target: RnMtResolvedTarget = manifestValue.defaults,
    options: {
      env?: RnMtEnvSource | undefined;
    } = {},
  ) {
    const runOptions = {
      manifest: manifestValue,
      target,
      ...(options.env ? { env: options.env } : {}),
    };

    return new RnMtSyncModule({
      manifest: manifestNamespace,
      workspace: this.createWorkspace(),
    }).run(runOptions);
  }

  /**
   * Runs the handoff preflight checks for a tenant export.
   */
  createHandoffPreflightResult(manifestValue: RnMtManifest, tenantId: string) {
    return this.getHandoffModule().preflight({
      manifest: manifestValue,
      tenantId,
    });
  }

  /**
   * Flattens shared and tenant-selected source into handoff output form.
   */
  createHandoffFlattenResult(manifestValue: RnMtManifest, tenantId: string) {
    return this.getHandoffModule().flatten({
      manifest: manifestValue,
      tenantId,
    });
  }

  /**
   * Removes rn-mt-specific files and scripts from a handoff export.
   */
  createHandoffCleanupResult() {
    return this.getHandoffModule().cleanup();
  }

  /**
   * Sanitizes a handoff export by stripping automation and real env files.
   */
  createHandoffSanitizationResult(
    manifestValue: RnMtManifest,
    tenantId: string,
  ) {
    return this.getHandoffModule().sanitize({
      manifest: manifestValue,
      tenantId,
    });
  }

  /**
   * Runs the final isolation audit against a handoff export.
   */
  createHandoffIsolationAuditResult(
    manifestValue: RnMtManifest,
    tenantId: string,
  ) {
    return this.getHandoffModule().auditIsolation({
      manifest: manifestValue,
      tenantId,
    });
  }

  /**
   * Creates a core workspace instance for the current root, optionally with
   * filesystem overrides for tests.
   */
  private createWorkspace(overrides?: RnMtCliWorkspaceOverrides) {
    return overrides
      ? this.getWorkspaceFactory().create(this.dependencies.rootDir, overrides)
      : this.getWorkspaceFactory().create(this.dependencies.rootDir);
  }

  /**
   * Creates or reuses an analyze module scoped to the requested root.
   */
  private getAnalyzeModule(
    rootDir: string = this.dependencies.rootDir,
    workspaceOverrides?: RnMtCliWorkspaceOverrides,
  ) {
    return workspaceOverrides
      ? this.getWorkspaceFactory().createAnalyzeModule(
          rootDir,
          workspaceOverrides,
        )
      : this.getWorkspaceFactory().createAnalyzeModule(rootDir);
  }

  /**
   * Builds the handoff module with the supporting audit and doctor modules it
   * depends on.
   */
  private getHandoffModule() {
    const workspace = this.createWorkspace();

    return new RnMtHandoffModule({
      audit: new RnMtAuditModule({ workspace }),
      doctor: new RnMtDoctorModule({ workspace }),
      workspace,
    });
  }

  /**
   * Returns the workspace factory used to instantiate core modules for the CLI.
   */
  private getWorkspaceFactory() {
    return this.dependencies.workspaceFactory ?? new RnMtCliWorkspaceFactory();
  }
}
