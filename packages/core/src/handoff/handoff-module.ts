/**
 * Prepares single-tenant handoff exports and validates that they are isolated
 * from the source multi-tenant repo.
 */
import { basename, join, relative } from "node:path";

import { RnMtAnalyzeModule } from "../analyze";
import type { RnMtManifest } from "../manifest/types";
import { RnMtWorkspace } from "../workspace";
import { type RnMtOwnershipMetadataFile } from "../sync/types";
import {
  getAliasRules,
  isAuditableTextFile,
  isFacadeSourceFile,
  rewriteHandoffSourceContents,
} from "../convert";
import type { RnMtReconstructionMetadataFile } from "../convert/types";
import { removeRepoLocalGuideLinkFromReadme } from "../convert";
import {
  createStandalonePackageJsonContents,
  getLocalRnMtPackagePlan,
} from "../convert/package-json";
import { parseDotEnvContents } from "../sync";
import { RnMtDoctorModule } from "../doctor";
import type { RnMtAuditResult } from "../audit/types";

import type {
  RnMtHandoffCleanupResult,
  RnMtHandoffFlattenResult,
  RnMtHandoffPreflightCheck,
  RnMtHandoffPreflightResult,
  RnMtHandoffSanitizationResult,
} from "./types";

/**
 * Encapsulates handoff behavior behind a constructor-backed seam.
 */
export class RnMtHandoffModule {
  /**
   * Initializes the handoff with its shared dependencies.
   */
  constructor(
    private readonly dependencies: {
      audit: { run(manifest: RnMtManifest): RnMtAuditResult };
      doctor: RnMtDoctorModule;
      workspace: RnMtWorkspace;
    },
  ) {}

  /**
   * Runs the non-mutating checks that must pass before a handoff export can be
   * created.
   */
  preflight(options: {
    manifest: RnMtManifest;
    tenantId: string;
  }): RnMtHandoffPreflightResult {
    const tenant = options.manifest.tenants[options.tenantId];
    const checks: RnMtHandoffPreflightCheck[] = [];

    if (tenant) {
      checks.push({
        code: "target-tenant",
        status: "ok",
        summary: `Tenant ${options.tenantId} is present in the manifest.`,
        details: [`Display name: ${tenant.displayName}`],
      });
    } else {
      checks.push({
        code: "target-tenant",
        status: "blocked",
        summary: `Tenant ${options.tenantId} is not defined in the manifest.`,
        details: [
          `Add tenant ${options.tenantId} first or choose one of: ${Object.keys(options.manifest.tenants).join(", ") || "(none)"}.`,
        ],
      });
    }

    const convertOwnershipPath = join(
      this.dependencies.workspace.rootDir,
      "rn-mt.generated.convert.ownership.json",
    );
    const convertOwnership =
      this.dependencies.workspace.readJsonIfPresent<RnMtOwnershipMetadataFile>(
        convertOwnershipPath,
      );

    if (
      convertOwnership &&
      convertOwnership.tool === "rn-mt" &&
      convertOwnership.owner === "cli" &&
      Array.isArray(convertOwnership.artifacts) &&
      convertOwnership.artifacts.some(
        (artifact) => artifact.kind === "root-wrapper",
      ) &&
      convertOwnership.artifacts.some(
        (artifact) => artifact.kind === "current-facade",
      )
    ) {
      checks.push({
        code: "converted-repo",
        status: "ok",
        summary: "Converted repo ownership metadata is present.",
        details: [`Found ${convertOwnershipPath}.`],
      });
    } else {
      checks.push({
        code: "converted-repo",
        status: "blocked",
        summary: "Converted repo ownership metadata is missing or incomplete.",
        details: [
          `Expected ${convertOwnershipPath} with tracked root wrappers and current facades.`,
          "Run rn-mt convert before attempting handoff.",
        ],
      });
    }

    const reconstructionPath = join(
      this.dependencies.workspace.rootDir,
      "rn-mt.generated.reconstruction.json",
    );
    const reconstructionMetadata =
      this.dependencies.workspace.readJsonIfPresent<RnMtReconstructionMetadataFile>(
        reconstructionPath,
      );

    if (
      reconstructionMetadata &&
      reconstructionMetadata.tool === "rn-mt" &&
      Array.isArray(reconstructionMetadata.entries) &&
      reconstructionMetadata.entries.length > 0
    ) {
      checks.push({
        code: "reconstruction-metadata",
        status: "ok",
        summary: "Reconstruction metadata is present.",
        details: [
          `Found ${reconstructionPath}.`,
          `Tracked paths: ${reconstructionMetadata.entries.length}.`,
        ],
      });
    } else {
      checks.push({
        code: "reconstruction-metadata",
        status: "blocked",
        summary: "Reconstruction metadata is missing or empty.",
        details: [
          `Expected ${reconstructionPath} with original-to-converted path mappings.`,
          "Re-run rn-mt convert to regenerate reconstruction metadata.",
        ],
      });
    }

    const doctorResult = this.dependencies.doctor.run(options.manifest);
    const doctorWarnings = doctorResult.checks.filter(
      (check) => check.status === "warning",
    );

    if (doctorWarnings.length === 0) {
      checks.push({
        code: "doctor-clean",
        status: "ok",
        summary: "Doctor passed with no warnings.",
        details:
          doctorResult.checks.length > 0
            ? doctorResult.checks.map(
                (check) => `${check.code}: ${check.summary}`,
              )
            : [
                "No applicable doctor checks were required for this repo shape.",
              ],
      });
    } else {
      checks.push({
        code: "doctor-clean",
        status: "blocked",
        summary: "Doctor reported warnings.",
        details: doctorWarnings.flatMap((check) => [
          `${check.code}: ${check.summary}`,
          ...check.details,
        ]),
      });
    }

    return {
      rootDir: this.dependencies.workspace.rootDir,
      tenant: {
        id: options.tenantId,
        displayName: tenant?.displayName ?? options.tenantId,
      },
      status: checks.every((check) => check.status === "ok")
        ? "ready"
        : "blocked",
      checks,
    };
  }

  /**
   * Reconstructs a single-tenant source tree from shared, current, and tenant
   * override inputs.
   */
  flatten(options: {
    manifest: RnMtManifest;
    tenantId: string;
  }): RnMtHandoffFlattenResult {
    const reconstructionPath = join(
      this.dependencies.workspace.rootDir,
      "rn-mt.generated.reconstruction.json",
    );
    const reconstructionMetadata =
      this.dependencies.workspace.readJsonIfPresent<RnMtReconstructionMetadataFile>(
        reconstructionPath,
      );

    if (
      !reconstructionMetadata ||
      reconstructionMetadata.tool !== "rn-mt" ||
      !Array.isArray(reconstructionMetadata.entries) ||
      reconstructionMetadata.entries.length === 0
    ) {
      throw new Error(
        `Reconstruction metadata is missing or empty: ${reconstructionPath}`,
      );
    }

    const tenant = options.manifest.tenants[options.tenantId];

    if (!tenant) {
      throw new Error(`Unknown tenant: ${options.tenantId}`);
    }

    const sharedRootDir = join(
      this.dependencies.workspace.rootDir,
      reconstructionMetadata.sharedRootPath,
    );
    const tenantRootDir = this.dependencies.workspace.getTenantRootDir(
      options.tenantId,
    );
    const aliasRules = getAliasRules(this.dependencies.workspace);
    const originalPathByCurrentPath = new Map<string, string>();

    for (const entry of reconstructionMetadata.entries) {
      if (!entry.currentPath) {
        continue;
      }

      originalPathByCurrentPath.set(
        join(this.dependencies.workspace.rootDir, entry.currentPath),
        join(this.dependencies.workspace.rootDir, entry.originalPath),
      );
    }

    const restoredFiles = reconstructionMetadata.entries.map((entry) => {
      const sharedPath = join(
        this.dependencies.workspace.rootDir,
        entry.sharedPath,
      );
      const relativeSharedPath = relative(sharedRootDir, sharedPath);
      const tenantSourcePath = join(tenantRootDir, relativeSharedPath);
      const selectedSourcePath = this.dependencies.workspace.isFile(
        tenantSourcePath,
      )
        ? tenantSourcePath
        : sharedPath;

      if (!this.dependencies.workspace.isFile(selectedSourcePath)) {
        throw new Error(
          `Unable to reconstruct ${entry.originalPath}. Missing source file: ${selectedSourcePath}`,
        );
      }

      const destinationPath = join(
        this.dependencies.workspace.rootDir,
        entry.originalPath,
      );
      const selectedContents =
        this.dependencies.workspace.readText(selectedSourcePath);
      const rewrittenContents = isFacadeSourceFile(selectedSourcePath)
        ? rewriteHandoffSourceContents(
            this.dependencies.workspace,
            selectedSourcePath,
            destinationPath,
            selectedContents,
            originalPathByCurrentPath,
            aliasRules,
          )
        : selectedContents;

      return {
        sourcePath: selectedSourcePath,
        destinationPath,
        contents: rewrittenContents,
      };
    });

    return {
      rootDir: this.dependencies.workspace.rootDir,
      tenant: {
        id: options.tenantId,
        displayName: tenant.displayName,
      },
      restoredFiles,
    };
  }

  /**
   * Removes rn-mt-specific files and scripts from a flattened handoff export.
   */
  cleanup(
    _options: { manifest?: RnMtManifest } = {},
  ): RnMtHandoffCleanupResult {
    const rewrittenFiles = [];
    const packageJsonPath = join(
      this.dependencies.workspace.rootDir,
      "package.json",
    );
    const appKind = new RnMtAnalyzeModule({
      workspace: this.dependencies.workspace,
    }).detectAppKind(this.dependencies.workspace.rootDir).kind;

    if (this.dependencies.workspace.isFile(packageJsonPath)) {
      rewrittenFiles.push({
        path: packageJsonPath,
        contents: createStandalonePackageJsonContents(
          this.dependencies.workspace.readText(packageJsonPath),
          appKind,
        ),
      });
    }

    const readmePath = join(this.dependencies.workspace.rootDir, "README.md");

    if (this.dependencies.workspace.isFile(readmePath)) {
      rewrittenFiles.push({
        path: readmePath,
        contents: removeRepoLocalGuideLinkFromReadme(
          this.dependencies.workspace.readText(readmePath),
        ),
      });
    }

    const candidateRemovedPaths = [
      join(this.dependencies.workspace.rootDir, "rn-mt.config.json"),
      join(this.dependencies.workspace.rootDir, "rn-mt.generated.README.md"),
      join(
        this.dependencies.workspace.rootDir,
        "rn-mt.generated.convert.ownership.json",
      ),
      join(
        this.dependencies.workspace.rootDir,
        "rn-mt.generated.reconstruction.json",
      ),
      join(
        this.dependencies.workspace.rootDir,
        "rn-mt.generated.ownership.json",
      ),
      join(this.dependencies.workspace.rootDir, "rn-mt.generated.runtime.json"),
      join(this.dependencies.workspace.rootDir, "rn-mt.generated.expo.js"),
      join(
        this.dependencies.workspace.rootDir,
        "rn-mt.generated.asset-fingerprints.json",
      ),
      join(this.dependencies.workspace.rootDir, ".rn-mt"),
      join(this.dependencies.workspace.rootDir, "src", "rn-mt"),
    ];

    return {
      rootDir: this.dependencies.workspace.rootDir,
      rewrittenFiles,
      removedPaths: candidateRemovedPaths
        .filter((path) => this.dependencies.workspace.exists(path))
        .sort((left, right) => left.localeCompare(right)),
    };
  }

  /**
   * Strips automation and real env files from a handoff export while generating
   * sanitized examples.
   */
  sanitize(options: {
    manifest: RnMtManifest;
    tenantId: string;
  }): RnMtHandoffSanitizationResult {
    const generatedFiles = [];
    const removedPaths: string[] = [];
    const automationCandidatePaths = [
      join(this.dependencies.workspace.rootDir, ".github"),
      join(this.dependencies.workspace.rootDir, ".gitlab-ci.yml"),
      join(this.dependencies.workspace.rootDir, ".circleci"),
      join(this.dependencies.workspace.rootDir, ".buildkite"),
      join(this.dependencies.workspace.rootDir, ".husky"),
      join(this.dependencies.workspace.rootDir, "bitrise.yml"),
      join(this.dependencies.workspace.rootDir, "azure-pipelines.yml"),
      join(this.dependencies.workspace.rootDir, "fastlane"),
      join(this.dependencies.workspace.rootDir, "eas.json"),
    ];

    for (const automationPath of automationCandidatePaths) {
      if (this.dependencies.workspace.exists(automationPath)) {
        removedPaths.push(automationPath);
      }
    }

    for (const environmentId of Object.keys(options.manifest.environments).sort(
      (left, right) => left.localeCompare(right),
    )) {
      const envKeySet = new Set<string>();
      const canonicalEnvPaths = [
        join(this.dependencies.workspace.rootDir, `.env.${environmentId}`),
        join(
          this.dependencies.workspace.rootDir,
          `.env.${options.tenantId}.${environmentId}`,
        ),
      ];

      for (const envPath of canonicalEnvPaths) {
        if (!this.dependencies.workspace.exists(envPath)) {
          continue;
        }

        removedPaths.push(envPath);

        for (const envKey of Object.keys(
          parseDotEnvContents(this.dependencies.workspace.readText(envPath)),
        ).sort((left, right) => left.localeCompare(right))) {
          envKeySet.add(envKey);
        }
      }

      for (const schemaEntry of Object.values(
        options.manifest.envSchema ?? {},
      )) {
        if (schemaEntry.source) {
          envKeySet.add(schemaEntry.source);
        }
      }

      if (envKeySet.size === 0) {
        continue;
      }

      const examplePath = join(
        this.dependencies.workspace.rootDir,
        `.env.${environmentId}.example`,
      );
      const envKeys = [...envKeySet].sort((left, right) =>
        left.localeCompare(right),
      );

      generatedFiles.push({
        path: examplePath,
        contents:
          [
            `# Fill in values for ${environmentId}.`,
            "# Real env values were removed from handoff output.",
            "",
            ...envKeys.flatMap((envKey) => {
              const schemaEntry = Object.values(
                options.manifest.envSchema ?? {},
              ).find((entry) => entry.source === envKey);
              const annotations = [
                schemaEntry?.required ? "required" : null,
                schemaEntry?.secret ? "secret" : null,
              ].filter((value): value is string => Boolean(value));

              return [
                annotations.length > 0
                  ? `# ${envKey} (${annotations.join(", ")})`
                  : `# ${envKey}`,
                `${envKey}=`,
                "",
              ];
            }),
          ]
            .join("\n")
            .trimEnd() + "\n",
      });
    }

    const uniqueRemovedPaths = [...new Set(removedPaths)].sort((left, right) =>
      left.localeCompare(right),
    );
    const reviewChecklist = [
      `Review stripped automation paths for the exported repo shape: ${
        uniqueRemovedPaths.filter((path) => !basename(path).startsWith(".env."))
          .length > 0
          ? uniqueRemovedPaths
              .filter((path) => !basename(path).startsWith(".env."))
              .map(
                (path) =>
                  relative(this.dependencies.workspace.rootDir, path) || ".",
              )
              .join(", ")
          : "(none)"
      }.`,
      `Review sanitized env examples: ${
        generatedFiles.length > 0
          ? generatedFiles
              .map(
                (file) =>
                  relative(this.dependencies.workspace.rootDir, file.path) ||
                  ".",
              )
              .join(", ")
          : "(none generated)"
      }.`,
    ];

    return {
      rootDir: this.dependencies.workspace.rootDir,
      generatedFiles,
      removedPaths: uniqueRemovedPaths,
      reviewRequired: true,
      reviewChecklist,
    };
  }

  /**
   * Audits a handoff export for residue from tenants other than the selected
   * one.
   */
  auditIsolation(options: {
    manifest: RnMtManifest;
    tenantId: string;
  }): RnMtAuditResult {
    if (
      !this.dependencies.workspace.isDirectory(
        this.dependencies.workspace.rootDir,
      )
    ) {
      return {
        rootDir: this.dependencies.workspace.rootDir,
        findings: [],
      };
    }

    const residueTerms = Object.entries(options.manifest.tenants)
      .filter(([candidateTenantId]) => candidateTenantId !== options.tenantId)
      .flatMap(([candidateTenantId, tenantLayer]) => [
        { label: `tenant id ${candidateTenantId}`, value: candidateTenantId },
        {
          label: `tenant display name ${tenantLayer.displayName}`,
          value: tenantLayer.displayName,
        },
      ])
      .filter((entry, index, entries) => {
        const normalizedValue = entry.value.trim().toLowerCase();

        if (normalizedValue.length === 0) {
          return false;
        }

        return (
          entries.findIndex(
            (candidate) =>
              candidate.value.trim().toLowerCase() === normalizedValue,
          ) === index
        );
      });

    if (residueTerms.length === 0) {
      return {
        rootDir: this.dependencies.workspace.rootDir,
        findings: [],
      };
    }

    const findings = [];
    const ignoredTopLevelNames = new Set([".git", "node_modules"]);

    for (const path of this.dependencies.workspace.listFiles(
      this.dependencies.workspace.rootDir,
    )) {
      const relativePath = relative(
        this.dependencies.workspace.rootDir,
        path,
      ).replace(/\\/gu, "/");

      if (
        relativePath.length === 0 ||
        relativePath
          .split("/")
          .some((segment: string) => ignoredTopLevelNames.has(segment))
      ) {
        continue;
      }

      if (!isAuditableTextFile(path)) {
        continue;
      }

      const contents = this.dependencies.workspace.readText(path);
      const evidence = residueTerms
        .filter((term) =>
          contents.toLowerCase().includes(term.value.trim().toLowerCase()),
        )
        .map((term) => `Found ${term.label}: ${term.value}`);

      if (evidence.length === 0) {
        continue;
      }

      findings.push({
        code: "other-tenant-residue" as const,
        path,
        severity: "P0" as const,
        confidence: "high" as const,
        evidence,
        summary:
          "Exported handoff repo still contains identifiers from other tenants and is not isolated.",
      });
    }

    return {
      rootDir: this.dependencies.workspace.rootDir,
      findings,
    };
  }
}
