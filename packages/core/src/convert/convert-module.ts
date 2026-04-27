/**
 * Implements the convert core module.
 */
import { readdirSync, type Dirent } from "node:fs";
import { dirname, join, relative } from "node:path";

import { RnMtAnalyzeModule } from "../analyze";
import type { RnMtHostLanguage } from "../analyze/types";
import type { RnMtManifest } from "../manifest/types";
import { createOwnershipMetadataFile } from "../sync";
import type { RnMtSyncGeneratedFile } from "../sync/types";
import { RnMtWorkspace } from "../workspace";

import {
  createCurrentFacadeFile,
  createCurrentFacadeFiles,
  createRootWrapperContents,
  createBridgeFacadeModuleContents,
  rootWrapperBanner,
} from "./facade-writer";
import {
  createConvertedPackageJsonContents,
  createInstallCommand,
  createStandalonePackageJsonContents,
  getLocalRnMtPackagePlan,
} from "./package-json";
import {
  getAliasRules,
  isFacadeSourceFile,
  isTestSourcePath,
  normalizeImportPath,
  rewriteMovedSourceContents,
  stripSupportedSourceExtension,
} from "./import-rewriter";

import type {
  RnMtAliasRule,
  RnMtCodemodResult,
  RnMtConvertModuleDependencies,
  RnMtConvertMovedFile,
  RnMtConvertResult,
  RnMtConvertRunOptions,
  RnMtReconstructionMetadataFile,
  RnMtReconstructionOriginalPathBehavior,
} from "./types";

const convertibleRootEntryFiles = [
  "App.tsx",
  "App.ts",
  "App.jsx",
  "App.js",
  "index.tsx",
  "index.ts",
  "index.jsx",
  "index.js",
] as const;

const convertCategoryDirNames = [
  "config",
  "theme",
  "assets",
  "__tests__",
  "tests",
] as const;

/**
 * Returns true when a file should be scanned as text during audit and handoff
 * flows.
 */
export function isAuditableTextFile(path: string) {
  return /\.(ts|tsx|js|jsx|json|md|txt)$/u.test(path);
}

/**
 * Lists every file currently living under the converted shared source tree.
 */
export function listSharedFiles(workspace: RnMtWorkspace) {
  const sharedRootDir = workspace.getSharedRootDir();

  if (!workspace.isDirectory(sharedRootDir)) {
    return [];
  }

  return workspace
    .listFiles(sharedRootDir)
    .sort((left, right) => left.localeCompare(right));
}

/**
 * Removes the generated rn-mt guide link section from a README during cleanup
 * or handoff.
 */
export function removeRepoLocalGuideLinkFromReadme(readmeContents: string) {
  const normalizedContents = readmeContents.trimEnd();
  const startMarker = "<!-- rn-mt:guide-link:start -->";
  const endMarker = "<!-- rn-mt:guide-link:end -->";
  const existingStartIndex = normalizedContents.indexOf(startMarker);
  const existingEndIndex = normalizedContents.indexOf(endMarker);

  if (
    existingStartIndex === -1 ||
    existingEndIndex === -1 ||
    existingEndIndex < existingStartIndex
  ) {
    return `${normalizedContents}\n`;
  }

  const before = normalizedContents.slice(0, existingStartIndex).trimEnd();
  const after = normalizedContents
    .slice(existingEndIndex + endMarker.length)
    .trimStart();
  const nextContents = [before, after]
    .filter((segment) => segment.length > 0)
    .join("\n\n");

  return `${nextContents.trimEnd()}\n`;
}

/**
 * Plans and materializes the repo restructuring performed by rn-mt convert.
 */
export class RnMtConvertModule {
  /**
   * Initializes the convert with its shared dependencies.
   */
  constructor(private readonly dependencies: RnMtConvertModuleDependencies) {}

  /**
   * Builds the analyze module used to detect repo shape during conversion.
   */
  private getAnalyzeModule() {
    return new RnMtAnalyzeModule({ workspace: this.dependencies.workspace });
  }

  /**
   * Detects the host language so generated wrappers and extension files use the
   * right syntax.
   */
  private getHostLanguage() {
    return this.getAnalyzeModule().detectHostLanguage(
      this.dependencies.workspace.rootDir,
    ).language;
  }

  /**
   * Runs the convert flow.
   */
  run(options: RnMtConvertRunOptions): RnMtConvertResult {
    const manifest = options.manifest;
    const workspace = this.dependencies.workspace;
    const packageManager = this.getAnalyzeModule().run({
      scopeToProvidedRoot: true,
    }).repo.packageManager;
    const appKind = this.getAnalyzeModule().detectAppKind(
      workspace.rootDir,
    ).kind;
    const localPackages = getLocalRnMtPackagePlan(appKind);
    const aliasRules = getAliasRules(workspace);
    const entryFiles = this.getConvertibleRootEntryFiles();
    const packageJsonPath = join(workspace.rootDir, "package.json");
    const bridgeConfigModulePath = this.resolveBridgeConfigModulePath(
      options.bridgeConfigModulePath,
    );

    if (entryFiles.length === 0) {
      throw new Error(
        "No supported root entry files were found. Expected one of App.[jt]sx?, index.[jt]sx?.",
      );
    }

    if (
      entryFiles.some((entry) => entry.contents.startsWith(rootWrapperBanner))
    ) {
      throw new Error(
        "Convert has already been applied to this repo. Root entry wrappers are already CLI-owned.",
      );
    }

    const plannedMovedFiles = entryFiles.map((entry) => ({
      sourcePath: entry.path,
      destinationPath: join(workspace.getSharedRootDir(), entry.fileName),
      contents: entry.contents,
    }));
    const categoryMovedFiles = this.getConvertCategoryFilePaths()
      .filter(
        (sourcePath) => !entryFiles.some((entry) => entry.path === sourcePath),
      )
      .map((sourcePath) => ({
        sourcePath,
        destinationPath: join(
          workspace.getSharedRootDir(),
          sourcePath.startsWith(join(workspace.rootDir, "src"))
            ? join(
                "src",
                sourcePath.slice(join(workspace.rootDir, "src").length + 1),
              )
            : sourcePath.slice(workspace.rootDir.length + 1),
        ),
        contents: workspace.readText(sourcePath),
        removeSourcePath:
          sourcePath === bridgeConfigModulePath
            ? (false as const)
            : (true as const),
      }));
    const structuralMovedFiles = [...plannedMovedFiles, ...categoryMovedFiles];
    const rootEntrySourcePaths = new Set(entryFiles.map((entry) => entry.path));
    const currentPathBySourcePath = new Map(
      structuralMovedFiles
        .filter((file) => !isTestSourcePath(file.sourcePath))
        .map((file) => [
          file.sourcePath,
          join(
            workspace.getCurrentRootDir(),
            file.destinationPath.slice(workspace.getSharedRootDir().length + 1),
          ),
        ]),
    );
    const movedFiles = structuralMovedFiles.map((file) => ({
      ...file,
      contents: isFacadeSourceFile(file.sourcePath)
        ? rewriteMovedSourceContents(
            workspace,
            file.sourcePath,
            file.destinationPath,
            file.contents,
            currentPathBySourcePath,
            aliasRules,
          )
        : file.contents,
    }));

    if (workspace.isFile(packageJsonPath)) {
      movedFiles.push({
        sourcePath: packageJsonPath,
        destinationPath: packageJsonPath,
        contents: createConvertedPackageJsonContents(
          workspace.readText(packageJsonPath),
          appKind,
        ),
      });
    }

    const rootReadmePath = join(workspace.rootDir, "README.md");

    if (workspace.isFile(rootReadmePath)) {
      movedFiles.push({
        sourcePath: rootReadmePath,
        destinationPath: rootReadmePath,
        contents: this.addRepoLocalGuideLinkToReadme(
          workspace.readText(rootReadmePath),
        ),
      });
    }

    const generatedFiles: RnMtSyncGeneratedFile[] = entryFiles.map((entry) => ({
      path: entry.path,
      kind: "root-wrapper",
      contents: createRootWrapperContents(entry.fileName),
    }));
    generatedFiles.push(
      ...createCurrentFacadeFiles(
        workspace,
        manifest.defaults.tenant,
        structuralMovedFiles.map((file) => ({
          path: file.destinationPath,
          contents: file.contents,
        })),
        this.getHostLanguage(),
      ),
    );

    if (bridgeConfigModulePath) {
      const bridgeMovedFile = movedFiles.find(
        (file) => file.sourcePath === bridgeConfigModulePath,
      );

      if (!bridgeMovedFile) {
        throw new Error(
          `Bridge config module could not be prepared for conversion: ${bridgeConfigModulePath}`,
        );
      }

      generatedFiles.push(
        this.createHostConfigBridgeFile(
          bridgeMovedFile.sourcePath,
          bridgeMovedFile.destinationPath,
          bridgeMovedFile.contents,
        ),
      );
    }

    generatedFiles.push({
      path: join(workspace.rootDir, "rn-mt.generated.README.md"),
      kind: "repo-readme",
      contents: this.createRepoLocalGuideContents(),
    });
    generatedFiles.push(
      this.createReconstructionMetadataFile(
        manifest.defaults.tenant,
        structuralMovedFiles,
        currentPathBySourcePath,
        {
          rootEntrySourcePaths,
          bridgeConfigModulePath,
        },
      ),
    );
    const ownershipMetadata = createOwnershipMetadataFile(
      workspace,
      generatedFiles,
      {
        fileName: "rn-mt.generated.convert.ownership.json",
      },
    );
    const hostLanguage = this.getHostLanguage();
    const userOwnedFiles = [
      {
        path: join(
          workspace.getExtensionsRootDir(),
          hostLanguage === "typescript" ? "index.ts" : "index.js",
        ),
        contents: this.createUserOwnedExtensionContents(hostLanguage),
      },
    ];

    return {
      rootDir: workspace.rootDir,
      movedFiles,
      generatedFiles: [...generatedFiles, ownershipMetadata],
      userOwnedFiles,
      packageManager,
      localPackages,
      installCommand: createInstallCommand(packageManager),
    };
  }

  /**
   * Plans the codemod that rewrites shared-source imports to the generated
   * current surface after conversion.
   */
  planCurrentImportsCodemod(
    options: {
      manifest?: RnMtManifest;
    } = {},
  ): RnMtCodemodResult {
    const workspace = this.dependencies.workspace;
    const aliasRules = getAliasRules(workspace);
    const sharedFiles = listSharedFiles(workspace);
    const sharedRootDir = workspace.getSharedRootDir();
    const currentPathBySourcePath = new Map(
      sharedFiles
        .filter((path) => !isTestSourcePath(path))
        .map((path) => [
          path,
          join(
            workspace.rootDir,
            "src",
            "rn-mt",
            "current",
            path.slice(sharedRootDir.length + 1),
          ),
        ]),
    );

    const changes = sharedFiles
      .filter((path) => isFacadeSourceFile(path))
      .map((path) => {
        const before = workspace.readText(path);
        const after = rewriteMovedSourceContents(
          workspace,
          path,
          path,
          before,
          currentPathBySourcePath,
          aliasRules,
        );

        return {
          path,
          before,
          after,
        };
      })
      .filter((change) => change.before !== change.after);

    return {
      rootDir: workspace.rootDir,
      codemod: "current-imports",
      changes,
    };
  }

  /**
   * Checks whether test module file name for the convert flow.
   */
  private isTestModuleFileName(fileName: string) {
    return /\.(test|spec)\.[^.]+$/u.test(fileName);
  }

  /**
   * Returns convert category file paths for the convert flow.
   */
  private getConvertCategoryFilePaths() {
    const workspace = this.dependencies.workspace;
    const categoryFilePaths = new Set<string>();
    const candidateBases = [workspace.rootDir, join(workspace.rootDir, "src")];

    for (const basePath of candidateBases) {
      if (!workspace.isDirectory(basePath)) {
        continue;
      }

      for (const entry of readdirSync(basePath, {
        withFileTypes: true,
      }) as Dirent[]) {
        if (basePath.endsWith("/src") && entry.name === "rn-mt") {
          continue;
        }

        const entryPath = join(basePath, entry.name);

        if (
          entry.isDirectory() &&
          convertCategoryDirNames.includes(
            entry.name as (typeof convertCategoryDirNames)[number],
          )
        ) {
          for (const filePath of workspace.listFiles(entryPath)) {
            categoryFilePaths.add(filePath);
          }
        }

        if (
          entry.isFile() &&
          (convertCategoryDirNames.some(
            (name) =>
              entry.name === `${name}.ts` ||
              entry.name === `${name}.tsx` ||
              entry.name === `${name}.js` ||
              entry.name === `${name}.jsx` ||
              entry.name === `${name}.json`,
          ) ||
            this.isTestModuleFileName(entry.name))
        ) {
          categoryFilePaths.add(entryPath);
        }
      }
    }

    return [...categoryFilePaths].sort((left, right) =>
      left.localeCompare(right),
    );
  }

  /**
   * Returns convertible root entry files for the convert flow.
   */
  private getConvertibleRootEntryFiles() {
    const workspace = this.dependencies.workspace;

    return convertibleRootEntryFiles
      .map((fileName) => {
        const path = join(workspace.rootDir, fileName);

        if (!workspace.exists(path)) {
          return null;
        }

        return {
          fileName,
          path,
          contents: workspace.readText(path),
        };
      })
      .filter(
        (
          entry,
        ): entry is {
          fileName: (typeof convertibleRootEntryFiles)[number];
          path: string;
          contents: string;
        } => entry !== null,
      );
  }

  /**
   * Checks whether supported bridge config path for the convert flow.
   */
  private isSupportedBridgeConfigPath(sourcePath: string) {
    const relativeSourcePath = relative(
      this.dependencies.workspace.rootDir,
      sourcePath,
    ).replace(/\\/gu, "/");
    const pathSegments = relativeSourcePath.split("/");
    const fileName = pathSegments[pathSegments.length - 1] ?? "";

    return (
      pathSegments.includes("config") ||
      /^config\.(ts|tsx|js|jsx|json)$/u.test(fileName)
    );
  }

  /**
   * Resolves bridge config module path for the convert flow.
   */
  private resolveBridgeConfigModulePath(
    selectedPath: string | null | undefined,
  ) {
    const workspace = this.dependencies.workspace;

    if (!selectedPath) {
      return null;
    }

    const candidatePath = selectedPath.startsWith(workspace.rootDir)
      ? selectedPath
      : join(workspace.rootDir, selectedPath);
    const relativeSelectedPath = relative(workspace.rootDir, candidatePath);

    if (
      relativeSelectedPath.startsWith("..") ||
      !workspace.isFile(candidatePath)
    ) {
      throw new Error(`Bridge config module not found: ${candidatePath}`);
    }

    if (
      !isFacadeSourceFile(candidatePath) ||
      !this.isSupportedBridgeConfigPath(candidatePath)
    ) {
      throw new Error(
        `Bridge mode only supports explicit host config modules. Received: ${candidatePath}`,
      );
    }

    return candidatePath;
  }

  /**
   * Creates host config bridge file for the convert flow.
   */
  private createHostConfigBridgeFile(
    sourcePath: string,
    movedDestinationPath: string,
    sourceContents: string,
  ): RnMtSyncGeneratedFile {
    const workspace = this.dependencies.workspace;
    const sharedRootDir = workspace.getSharedRootDir();
    const relativeSharedPath = movedDestinationPath.slice(
      sharedRootDir.length + 1,
    );
    const currentFacadePath = join(
      workspace.getCurrentRootDir(),
      relativeSharedPath,
    );
    const importPath = normalizeImportPath(
      stripSupportedSourceExtension(
        relative(dirname(sourcePath), currentFacadePath),
      ),
    );

    return {
      path: sourcePath,
      kind: "host-config-bridge",
      contents: createBridgeFacadeModuleContents(importPath, sourceContents),
    };
  }

  /**
   * Creates user owned extension contents for the convert flow.
   */
  private createUserOwnedExtensionContents(hostLanguage: RnMtHostLanguage) {
    return [
      "// User-owned rn-mt extension module. Safe to edit.",
      "// Add custom helpers here instead of editing CLI-owned generated files.",
      hostLanguage === "typescript"
        ? "export const rnMtExtensions = {} as const;"
        : "export const rnMtExtensions = {};",
      "",
    ].join("\n");
  }

  /**
   * Creates repo local guide contents for the convert flow.
   */
  private createRepoLocalGuideContents() {
    return [
      "# rn-mt Ownership and Handoff Guide",
      "",
      "## CLI-owned files",
      "",
      "Do not edit rn-mt generated files directly. Re-run `rn-mt convert`, `rn-mt sync`, or other rn-mt commands instead.",
      "",
      "Common CLI-owned paths in this repo:",
      "",
      "- Root wrapper files such as `App.tsx`, `App.js`, `index.ts`, or `index.js` after conversion",
      "- `src/rn-mt/current/**` current facades",
      "- `rn-mt.generated.convert.ownership.json`",
      "- `rn-mt.generated.reconstruction.json`",
      "- `rn-mt.generated.runtime.json`",
      "- `rn-mt.generated.ownership.json`",
      "- Generated native include files, Expo bridge files, and derived assets written by `rn-mt sync`",
      "",
      "## User-owned files",
      "",
      "Make product changes in the user-owned surfaces:",
      "",
      "- `rn-mt.config.json`",
      "- `src/rn-mt/shared/**`",
      "- `src/rn-mt/tenants/**`",
      "- `src/rn-mt/extensions/**`",
      "",
      "Use `rn-mt override create <path>` when a shared file needs a tenant-specific override.",
      "",
      "## Handoff expectations",
      "",
      "A future `rn-mt handoff --tenant <id>` flow is expected to:",
      "",
      "- Create a new sibling output repo instead of mutating this workspace in place",
      "- Remove rn-mt-specific machinery from the delivered tenant repo",
      "- Strip git history by default and sanitize env files before delivery",
      "- Depend on a healthy repo with clean sync output and a clean audit result",
      "",
    ].join("\n");
  }

  /**
   * Creates repo local guide link section for the convert flow.
   */
  private createRepoLocalGuideLinkSection() {
    return [
      "<!-- rn-mt:guide-link:start -->",
      "## rn-mt",
      "",
      "See [rn-mt ownership and handoff guide](./rn-mt.generated.README.md) for CLI-owned files, user-owned extension points, and handoff expectations.",
      "<!-- rn-mt:guide-link:end -->",
      "",
    ].join("\n");
  }

  /**
   * Injects or refreshes the README section that points developers at the
   * generated rn-mt ownership guide.
   */
  private addRepoLocalGuideLinkToReadme(readmeContents: string) {
    const linkSection = this.createRepoLocalGuideLinkSection();
    const normalizedContents = readmeContents.trimEnd();
    const startMarker = "<!-- rn-mt:guide-link:start -->";
    const endMarker = "<!-- rn-mt:guide-link:end -->";
    const existingStartIndex = normalizedContents.indexOf(startMarker);
    const existingEndIndex = normalizedContents.indexOf(endMarker);

    if (
      existingStartIndex !== -1 &&
      existingEndIndex !== -1 &&
      existingEndIndex > existingStartIndex
    ) {
      return `${normalizedContents.slice(0, existingStartIndex)}${linkSection}${normalizedContents.slice(existingEndIndex + endMarker.length).replace(/^\n*/u, "")}`.replace(
        /\n{3,}/gu,
        "\n\n",
      );
    }

    if (normalizedContents.length === 0) {
      return linkSection;
    }

    return `${normalizedContents}\n\n${linkSection}`;
  }

  /**
   * Creates reconstruction metadata file for the convert flow.
   */
  private createReconstructionMetadataFile(
    defaultTenant: string,
    movedFiles: RnMtConvertMovedFile[],
    currentPathBySourcePath: Map<string, string>,
    options: {
      rootEntrySourcePaths: Set<string>;
      bridgeConfigModulePath?: string | null;
    },
  ): RnMtSyncGeneratedFile {
    const workspace = this.dependencies.workspace;
    const metadata: RnMtReconstructionMetadataFile = {
      schemaVersion: 1,
      tool: "rn-mt",
      defaultTenant,
      sharedRootPath: relative(workspace.rootDir, workspace.getSharedRootDir()),
      currentRootPath: relative(
        workspace.rootDir,
        workspace.getCurrentRootDir(),
      ),
      entries: movedFiles
        .map((file) => {
          const currentPath = currentPathBySourcePath.get(file.sourcePath);
          const originalPathBehavior: RnMtReconstructionOriginalPathBehavior =
            options.rootEntrySourcePaths.has(file.sourcePath)
              ? "replaced-with-root-wrapper"
              : file.sourcePath === options.bridgeConfigModulePath
                ? "replaced-with-host-config-bridge"
                : "removed";

          const entry = {
            originalPath: relative(workspace.rootDir, file.sourcePath),
            sharedPath: relative(workspace.rootDir, file.destinationPath),
            originalPathBehavior,
          };

          return currentPath
            ? {
                ...entry,
                currentPath: relative(workspace.rootDir, currentPath),
              }
            : entry;
        })
        .sort((left, right) =>
          left.originalPath.localeCompare(right.originalPath),
        ),
    };

    return {
      path: join(workspace.rootDir, "rn-mt.generated.reconstruction.json"),
      kind: "reconstruction-metadata",
      contents: `${JSON.stringify(metadata, null, 2)}\n`,
    };
  }
}
