import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

export type RnMtMilestone = "milestone-1" | "milestone-2";

export type RnMtPackageManagerName =
  | "pnpm"
  | "npm"
  | "yarn"
  | "bun"
  | "unknown";

export type RnMtPackageManagerSource =
  | "packageManager-field"
  | "pnpm-lock"
  | "package-lock"
  | "yarn-lock"
  | "bun-lock"
  | "none";

export type RnMtRepoAppKind =
  | "expo-managed"
  | "expo-prebuild"
  | "bare-react-native"
  | "unknown";

export type RnMtAnalyzeStatus = "ok" | "ambiguous";

export type RnMtSupportTier = "supported" | "near-supported" | "unsupported";

export type RnMtSupportReasonCode =
  | "modern-expo-managed"
  | "modern-expo-prebuild"
  | "modern-bare-react-native"
  | "ambiguous-repo-shape"
  | "unrecognized-app-shape";

export type RnMtHostLanguage = "javascript" | "typescript";

export type RnMtTargetPlatform = "ios" | "android";

interface RnMtManifestLayer {
  config?: Record<string, unknown>;
  flags?: Record<string, unknown>;
  assets?: Record<string, string>;
}

export interface RnMtEnvSchemaEntry {
  source?: string;
  required?: boolean;
  secret?: boolean;
}

export type RnMtEnvSource = Record<string, string | undefined>;

interface RnMtResolvedIdentity {
  displayName: string;
  nativeId: string;
}

interface RnMtResolvedTarget {
  tenant: string;
  environment: string;
  platform?: RnMtTargetPlatform;
}

export interface RnMtManifest {
  schemaVersion: 1;
  source: {
    rootDir: string;
  };
  envSchema?: Record<string, RnMtEnvSchemaEntry>;
  config?: Record<string, unknown>;
  flags?: Record<string, unknown>;
  assets?: Record<string, string>;
  defaults: {
    tenant: string;
    environment: string;
  };
  tenants: Record<string, RnMtManifestLayer & { displayName: string }>;
  environments: Record<string, RnMtManifestLayer & { displayName: string }>;
  platforms?: Partial<Record<RnMtTargetPlatform, RnMtManifestLayer>>;
  combinations?: Record<string, RnMtManifestLayer>;
}

export interface RnMtInitResult {
  manifestPath: string;
  manifest: RnMtManifest;
  generatedHostFiles: Array<{
    path: string;
    contents: string;
    language: RnMtHostLanguage;
  }>;
}

export interface RnMtTargetSetResult {
  manifestPath: string;
  manifest: RnMtManifest;
}

export interface RnMtConvertMovedFile {
  sourcePath: string;
  destinationPath: string;
  contents: string;
  removeSourcePath?: boolean;
}

export interface RnMtConvertResult {
  rootDir: string;
  movedFiles: RnMtConvertMovedFile[];
  generatedFiles: RnMtSyncGeneratedFile[];
}

export type RnMtGeneratedArtifactKind =
  | "runtime-artifact"
  | "ownership-metadata"
  | "root-wrapper"
  | "current-facade";

export interface RnMtResolvedRuntimeArtifact {
  config: Record<string, unknown>;
  identity: RnMtResolvedIdentity;
  tenant: {
    id: string;
    displayName: string;
  };
  env: {
    id: string;
  };
  flags: Record<string, unknown>;
  assets: Record<string, string>;
}

export interface RnMtSyncGeneratedFile {
  path: string;
  contents: string;
  kind: RnMtGeneratedArtifactKind;
}

export interface RnMtSyncResult {
  rootDir: string;
  target: {
    tenant: string;
    environment: string;
    platform?: RnMtTargetPlatform;
  };
  resolution: {
    appliedLayers: string[];
  };
  runtime: RnMtResolvedRuntimeArtifact;
  generatedFiles: RnMtSyncGeneratedFile[];
}

export interface RnMtLoadedEnvFile {
  path: string;
  scope: "environment" | "tenant-environment";
}

export interface RnMtSubprocessEnvResult {
  env: RnMtEnvSource;
  loadedFiles: RnMtLoadedEnvFile[];
}

export interface RnMtBaselineAnalyzeReport {
  schemaVersion: 1;
  command: "analyze";
  status: RnMtAnalyzeStatus;
  repo: {
    rootDir: string;
    packageJsonPresent: boolean;
    gitPresent: boolean;
    packageManager: {
      name: RnMtPackageManagerName;
      source: RnMtPackageManagerSource;
      raw: string | null;
    };
    app: {
      kind: RnMtRepoAppKind;
      candidates: RnMtRepoAppKind[];
      evidence: string[];
      remediation: string[];
    };
    support: {
      tier: RnMtSupportTier;
      reasonCodes: RnMtSupportReasonCode[];
    };
    host: {
      language: RnMtHostLanguage;
      evidence: string[];
    };
  };
}

export interface RnMtModuleContract {
  name: string;
  purpose: string;
  whyDeep: string;
  testFocus: string[];
}

export const coreModuleContracts: RnMtModuleContract[] = [
  {
    name: "ManifestSchemaEngine",
    purpose:
      "Validate rn-mt.config.json, enforce schemaVersion, and expose normalized typed configuration.",
    whyDeep:
      "Concentrates schema validation, normalization, and config diagnostics behind a small stable interface used by every other subsystem.",
    testFocus: [
      "invalid schema rejection",
      "strict top-level key behavior",
      "extension namespace preservation",
      "schemaVersion compatibility gates",
    ],
  },
  {
    name: "TargetResolutionEngine",
    purpose:
      "Resolve base, environment, tenant, platform, and combined overrides into one deterministic build target.",
    whyDeep:
      "Hides layered override logic and keeps build-time tenant resolution deterministic across CLI, runtime, and Expo plugin boundaries.",
    testFocus: [
      "merge precedence",
      "deep object merge semantics",
      "array replacement behavior",
      "derived non-production identity rules",
    ],
  },
  {
    name: "RepoAnalysisEngine",
    purpose:
      "Analyze a host repo and classify app type, native state, script topology, package manager, and migration risk areas.",
    whyDeep:
      "Encapsulates repo-shape inference so conversion commands do not rely on brittle assumptions or hardcoded paths.",
    testFocus: [
      "Expo managed detection",
      "Expo prebuild detection",
      "bare RN detection",
      "ambiguous repo classification",
    ],
  },
  {
    name: "PatchPlanningEngine",
    purpose:
      "Produce structured patch plans for AST-first edits, generated include files, and anchored host integration points.",
    whyDeep:
      "Keeps file ownership, drift detection, and repeatable sync behavior in one place instead of scattering patch logic across commands.",
    testFocus: [
      "owned artifact registry generation",
      "minimal patch set calculation",
      "anchor conflict detection",
      "rollback metadata generation",
    ],
  },
  {
    name: "AuditEngine",
    purpose:
      "Run deterministic and heuristic audits with severity, confidence, fixability, and remediation guidance.",
    whyDeep:
      "Encapsulates the product's most nuanced reasoning in a stable behavioral interface used by local workflows, CI, and handoff.",
    testFocus: [
      "P0-P3 scoring",
      "heuristic confidence reporting",
      "override candidate recommendations",
      "tenant isolation residue detection",
    ],
  },
  {
    name: "ReconstructionGraph",
    purpose:
      "Track how conversion changed the host app so tenant handoff can later rebuild a clean single-tenant repo.",
    whyDeep:
      "This module carries the long-lived contract between conversion and handoff without requiring the CLI to guess original structure later.",
    testFocus: [
      "original to converted path mapping",
      "bridge metadata persistence",
      "handoff reconstruction completeness",
      "unsupported handoff state detection",
    ],
  },
  {
    name: "AssetPipeline",
    purpose:
      "Fingerprint source assets and generate deterministic native-ready icons, splash assets, and environment badges.",
    whyDeep:
      "Provides cross-platform asset generation without relying on external system tools, while keeping daily sync incremental.",
    testFocus: [
      "source asset hashing",
      "incremental regeneration triggers",
      "non-production badging defaults",
      "tenant-only asset selection",
    ],
  },
];

export const milestoneOneScope = {
  milestone: "milestone-1" as RnMtMilestone,
  includes: [
    "workspace scaffolding",
    "manifest schema and validation",
    "repo analysis",
    "init",
    "convert",
    "sync",
    "audit",
    "minimal Expo integration",
    "minimal bare RN integration",
    "script wiring",
  ],
  defers: [
    "handoff implementation",
    "advanced codemods",
    "override lifecycle polish",
    "upgrade and rollback polish",
    "advanced route and feature registry helpers",
  ],
};

function parsePackageManagerName(
  packageManagerField: string | undefined,
): RnMtPackageManagerName {
  const rawName = packageManagerField?.split("@")[0];

  if (
    rawName === "pnpm" ||
    rawName === "npm" ||
    rawName === "yarn" ||
    rawName === "bun"
  ) {
    return rawName;
  }

  return "unknown";
}

function detectPackageManager(rootDir: string): RnMtBaselineAnalyzeReport["repo"]["packageManager"] {
  const packageJsonPath = join(rootDir, "package.json");

  if (existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      packageManager?: string;
    };

    if (packageJson.packageManager) {
      return {
        name: parsePackageManagerName(packageJson.packageManager),
        source: "packageManager-field",
        raw: packageJson.packageManager,
      };
    }
  }

  const lockfileDetectors: Array<{
    fileName: string;
    name: RnMtPackageManagerName;
    source: RnMtPackageManagerSource;
  }> = [
    { fileName: "pnpm-lock.yaml", name: "pnpm", source: "pnpm-lock" },
    { fileName: "package-lock.json", name: "npm", source: "package-lock" },
    { fileName: "yarn.lock", name: "yarn", source: "yarn-lock" },
    { fileName: "bun.lockb", name: "bun", source: "bun-lock" },
  ];

  for (const lockfile of lockfileDetectors) {
    if (existsSync(join(rootDir, lockfile.fileName))) {
      return {
        name: lockfile.name,
        source: lockfile.source,
        raw: lockfile.fileName,
      };
    }
  }

  return {
    name: "unknown",
    source: "none",
    raw: null,
  };
}

function detectAppKind(rootDir: string): RnMtBaselineAnalyzeReport["repo"]["app"] {
  const evidence: string[] = [];
  const packageJsonPath = join(rootDir, "package.json");
  const appJsonPath = join(rootDir, "app.json");
  const appConfigJsPath = join(rootDir, "app.config.js");
  const appConfigTsPath = join(rootDir, "app.config.ts");
  const iosPath = join(rootDir, "ios");
  const androidPath = join(rootDir, "android");
  let hasReactNativeDependency = false;

  if (existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    if (packageJson.dependencies?.expo || packageJson.devDependencies?.expo) {
      evidence.push("package.json includes expo dependency");
    }

    if (
      packageJson.dependencies?.["react-native"] ||
      packageJson.devDependencies?.["react-native"]
    ) {
      hasReactNativeDependency = true;
    }
  }

  if (existsSync(appJsonPath)) {
    evidence.push("app.json present");
  }

  if (existsSync(appConfigJsPath)) {
    evidence.push("app.config.js present");
  }

  if (existsSync(appConfigTsPath)) {
    evidence.push("app.config.ts present");
  }

  const hasExpoSignals = evidence.length > 0;
  const hasNativeFolders = existsSync(iosPath) || existsSync(androidPath);
  const expoCandidates: RnMtRepoAppKind[] = [];

  if (hasExpoSignals && !hasNativeFolders) {
    expoCandidates.push("expo-managed");
  }

  if (hasExpoSignals && hasNativeFolders) {
    expoCandidates.push("expo-prebuild");
  }

  if (hasExpoSignals && !existsSync(appJsonPath)) {
    expoCandidates.push("expo-managed");
    expoCandidates.push("expo-prebuild");
  }

  const uniqueExpoCandidates = [...new Set(expoCandidates)];

  if (uniqueExpoCandidates.length > 1) {
    return {
      kind: "unknown",
      candidates: uniqueExpoCandidates,
      evidence,
      remediation: [
        "Run analyze interactively and choose the intended Expo repo shape.",
        "Add or remove ios/android folders so the repo shape is unambiguous.",
        "Add app.json when this repo should be treated as Expo managed.",
      ],
    };
  }

  if (uniqueExpoCandidates[0] === "expo-managed") {
    return {
      kind: "expo-managed",
      candidates: ["expo-managed"],
      evidence,
      remediation: [],
    };
  }

  if (uniqueExpoCandidates[0] === "expo-prebuild") {
    if (existsSync(iosPath)) {
      evidence.push("ios directory present");
    }

    if (existsSync(androidPath)) {
      evidence.push("android directory present");
    }

    return {
      kind: "expo-prebuild",
      candidates: ["expo-prebuild"],
      evidence,
      remediation: [],
    };
  }

  if (hasReactNativeDependency && hasNativeFolders) {
    evidence.push("package.json includes react-native dependency");

    if (existsSync(iosPath)) {
      evidence.push("ios directory present");
    }

    if (existsSync(androidPath)) {
      evidence.push("android directory present");
    }

    return {
      kind: "bare-react-native",
      candidates: ["bare-react-native"],
      evidence,
      remediation: [],
    };
  }

  if (hasReactNativeDependency) {
    evidence.push("package.json includes react-native dependency");
  }

  return {
    kind: "unknown",
    candidates: ["unknown"],
    evidence,
    remediation: [],
  };
}

function resolveAnalyzeRootDir(startDir: string) {
  let currentDir = startDir;
  let gitRoot: string | null = null;

  while (true) {
    if (existsSync(join(currentDir, ".git"))) {
      gitRoot = currentDir;
    }

    const parentDir = dirname(currentDir);

    if (parentDir === currentDir) {
      break;
    }

    currentDir = parentDir;
  }

  return gitRoot ?? startDir;
}

function detectSupportTier(
  app: RnMtBaselineAnalyzeReport["repo"]["app"],
): RnMtBaselineAnalyzeReport["repo"]["support"] {
  if (app.kind === "expo-managed") {
    return {
      tier: "supported",
      reasonCodes: ["modern-expo-managed"],
    };
  }

  if (app.kind === "expo-prebuild") {
    return {
      tier: "supported",
      reasonCodes: ["modern-expo-prebuild"],
    };
  }

  if (app.kind === "bare-react-native") {
    return {
      tier: "supported",
      reasonCodes: ["modern-bare-react-native"],
    };
  }

  if (app.candidates.length > 1) {
    return {
      tier: "near-supported",
      reasonCodes: ["ambiguous-repo-shape"],
    };
  }

  return {
    tier: "unsupported",
    reasonCodes: ["unrecognized-app-shape"],
  };
}

function detectHostLanguage(
  rootDir: string,
): RnMtBaselineAnalyzeReport["repo"]["host"] {
  const candidateFiles = [
    { path: join(rootDir, "tsconfig.json"), language: "typescript" as const, evidence: "tsconfig.json present" },
    { path: join(rootDir, "App.tsx"), language: "typescript" as const, evidence: "App.tsx present" },
    { path: join(rootDir, "index.ts"), language: "typescript" as const, evidence: "index.ts present" },
    { path: join(rootDir, "index.tsx"), language: "typescript" as const, evidence: "index.tsx present" },
  ];

  for (const candidate of candidateFiles) {
    if (existsSync(candidate.path)) {
      return {
        language: candidate.language,
        evidence: [candidate.evidence],
      };
    }
  }

  return {
    language: "javascript",
    evidence: ["defaulted to javascript host files"],
  };
}

function createJavaScriptHostFile(rootDir: string) {
  return {
    path: join(rootDir, "rn-mt.generated.js"),
    language: "javascript" as const,
    contents: [
      "// Generated by rn-mt. Do not edit directly.",
      "// This file gives JavaScript repos a stable host-facing entry point.",
      "",
      "export const rnMtHostLanguage = 'javascript'",
      "",
    ].join("\n"),
  };
}

function createTypeScriptHostFile(rootDir: string) {
  return {
    path: join(rootDir, "rn-mt.generated.ts"),
    language: "typescript" as const,
    contents: [
      "// Generated by rn-mt. Do not edit directly.",
      "// This file gives TypeScript repos a stable host-facing entry point.",
      "",
      "export const rnMtHostLanguage = 'typescript' as const",
      "",
    ].join("\n"),
  };
}

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

const rootWrapperBanner =
  "// Generated by rn-mt. CLI-owned wrapper. Do not edit directly.";
const convertCategoryDirNames = ["config", "theme", "assets", "__tests__", "tests"] as const;

interface RnMtAliasRule {
  specifierPrefix: string;
  targetBasePath: string;
}

function isTestModuleFileName(fileName: string) {
  return /\.(test|spec)\.[^.]+$/u.test(fileName);
}

function walkDirectoryFiles(directoryPath: string): string[] {
  const entries = readdirSync(directoryPath, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkDirectoryFiles(entryPath));
      continue;
    }

    if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

function getConvertCategoryFilePaths(rootDir: string) {
  const categoryFilePaths = new Set<string>();
  const candidateBases = [rootDir, join(rootDir, "src")];

  for (const basePath of candidateBases) {
    if (!existsSync(basePath) || !statSync(basePath).isDirectory()) {
      continue;
    }

    for (const entry of readdirSync(basePath, { withFileTypes: true })) {
      if (basePath.endsWith("/src") && entry.name === "rn-mt") {
        continue;
      }

      const entryPath = join(basePath, entry.name);

      if (entry.isDirectory() && convertCategoryDirNames.includes(entry.name as typeof convertCategoryDirNames[number])) {
        for (const filePath of walkDirectoryFiles(entryPath)) {
          categoryFilePaths.add(filePath);
        }
      }

      if (
        entry.isFile() &&
        (convertCategoryDirNames.some((name) => entry.name === `${name}.ts` || entry.name === `${name}.tsx` || entry.name === `${name}.js` || entry.name === `${name}.jsx` || entry.name === `${name}.json`) ||
          isTestModuleFileName(entry.name))
      ) {
        categoryFilePaths.add(entryPath);
      }
    }
  }

  return [...categoryFilePaths].sort((left, right) => left.localeCompare(right));
}

function getAliasRules(rootDir: string): RnMtAliasRule[] {
  const tsconfigPath = join(rootDir, "tsconfig.json");

  if (!existsSync(tsconfigPath)) {
    return [];
  }

  const tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf8")) as {
    compilerOptions?: {
      baseUrl?: string;
      paths?: Record<string, string[]>;
    };
  };
  const baseUrl = tsconfig.compilerOptions?.baseUrl ?? ".";
  const paths = tsconfig.compilerOptions?.paths ?? {};

  return Object.entries(paths)
    .flatMap(([key, targets]) => {
      const firstTarget = targets[0];

      if (!firstTarget || !key.endsWith("/*") || !firstTarget.endsWith("/*")) {
        return [];
      }

      return [
        {
          specifierPrefix: key.slice(0, -1),
          targetBasePath: join(rootDir, baseUrl, firstTarget.slice(0, -1)),
        },
      ];
    })
    .sort((left, right) => right.specifierPrefix.length - left.specifierPrefix.length);
}

function getConvertibleRootEntryFiles(
  rootDir: string,
  options: {
    fileExists?: (path: string) => boolean;
    readFile?: (path: string) => string;
  } = {},
) {
  const fileExists = options.fileExists ?? existsSync;
  const readFile = options.readFile ?? ((path: string) => readFileSync(path, "utf8"));

  return convertibleRootEntryFiles
    .map((fileName) => {
      const path = join(rootDir, fileName);

      if (!fileExists(path)) {
        return null;
      }

      return {
        fileName,
        path,
        contents: readFile(path),
      };
    })
    .filter((entry): entry is {
      fileName: typeof convertibleRootEntryFiles[number];
      path: string;
      contents: string;
    } => entry !== null);
}

function createRootWrapperContents(fileName: string) {
  if (fileName.startsWith("App.")) {
    return [
      rootWrapperBanner,
      'import App from "./src/rn-mt/current/App";',
      "",
      "export default App;",
      "",
    ].join("\n");
  }

  return [
    rootWrapperBanner,
    'import "./src/rn-mt/current/index";',
    "",
  ].join("\n");
}

function stripSupportedSourceExtension(path: string) {
  return path.replace(/\.(ts|tsx|js|jsx)$/u, "");
}

function normalizeImportPath(path: string) {
  const normalized = path.replace(/\\/gu, "/");
  return normalized.startsWith(".") ? normalized : `./${normalized}`;
}

function hasDefaultExportSyntax(sourceContents: string) {
  return (
    /export\s+default\b/u.test(sourceContents) ||
    /module\.exports\s*=/u.test(sourceContents) ||
    /export\s*=\s*/u.test(sourceContents)
  );
}

function isFacadeSourceFile(path: string) {
  return /\.(ts|tsx|js|jsx)$/u.test(path);
}

function isTestSourcePath(path: string) {
  return /(\.test\.|\.spec\.|\/__tests__\/|\/tests\/)/u.test(path.replace(/\\/gu, "/"));
}

function createCurrentFacadeModuleContents(
  targetImportPath: string,
  sourceContents: string,
  relativeSharedPath: string,
) {
  const header = "// Generated by rn-mt. CLI-owned current facade. Do not edit directly.";

  if (/^index\.(ts|tsx|js|jsx)$/u.test(relativeSharedPath)) {
    return [
      header,
      `import "${targetImportPath}";`,
      "",
    ].join("\n");
  }

  const lines = [header];

  if (hasDefaultExportSyntax(sourceContents)) {
    lines.push(`export { default } from "${targetImportPath}";`);
  }

  lines.push(`export * from "${targetImportPath}";`, "");
  return lines.join("\n");
}

function createRuntimeFacadeContents(hostLanguage: RnMtHostLanguage) {
  const importLine =
    hostLanguage === "typescript"
      ? 'import runtime from "../../../rn-mt.generated.runtime.json";'
      : 'import runtime from "../../../rn-mt.generated.runtime.json";';

  return [
    "// Generated by rn-mt. CLI-owned current runtime facade. Do not edit directly.",
    importLine,
    'import { createRuntimeAccessors } from "@rn-mt/runtime";',
    "",
    "const runtimeAccessors = createRuntimeAccessors(runtime);",
    "",
    "export const getConfig = runtimeAccessors.getConfig;",
    "export const getTenant = runtimeAccessors.getTenant;",
    "export const getEnv = runtimeAccessors.getEnv;",
    "export const getFlags = runtimeAccessors.getFlags;",
    "export const getAssets = runtimeAccessors.getAssets;",
    "",
    "export default runtimeAccessors;",
    "",
  ].join("\n");
}

function createCurrentFacadeFiles(
  rootDir: string,
  tenantId: string,
  sharedFiles: Array<{ path: string; contents: string }>,
) {
  const facadeFiles: RnMtSyncGeneratedFile[] = [];

  for (const sharedFile of sharedFiles) {
    if (isTestSourcePath(sharedFile.path)) {
      continue;
    }

    const relativeSharedPath = sharedFile.path.slice(join(rootDir, "src", "rn-mt", "shared").length + 1);
    const tenantOverridePath = join(
      rootDir,
      "src",
      "rn-mt",
      "tenants",
      tenantId,
      relativeSharedPath,
    );
    const facadePath = join(rootDir, "src", "rn-mt", "current", relativeSharedPath);
    const resolvedSourcePath = existsSync(tenantOverridePath)
      ? tenantOverridePath
      : sharedFile.path;
    const importPath = normalizeImportPath(
      stripSupportedSourceExtension(relative(dirname(facadePath), resolvedSourcePath)),
    );

    facadeFiles.push(
      isFacadeSourceFile(sharedFile.path)
        ? {
            path: facadePath,
            kind: "current-facade",
            contents: createCurrentFacadeModuleContents(
              importPath,
              existsSync(resolvedSourcePath)
                ? readFileSync(resolvedSourcePath, "utf8")
                : sharedFile.contents,
              relativeSharedPath,
            ),
          }
        : {
            path: facadePath,
            kind: "current-facade",
            contents: existsSync(resolvedSourcePath)
              ? readFileSync(resolvedSourcePath, "utf8")
              : sharedFile.contents,
          },
    );
  }

  const hostLanguage = detectHostLanguage(rootDir).language;
  facadeFiles.push({
    path: join(rootDir, "src", "rn-mt", "current", hostLanguage === "typescript" ? "runtime.ts" : "runtime.js"),
    kind: "current-facade",
    contents: createRuntimeFacadeContents(hostLanguage),
  });

  return facadeFiles;
}

function getRelativeImportResolutionCandidates(basePath: string) {
  const directCandidates = [basePath];
  const extensionCandidates = [".ts", ".tsx", ".js", ".jsx", ".json", ".png", ".jpg", ".jpeg", ".svg"];
  const indexCandidates = extensionCandidates.map((extension) => join(basePath, `index${extension}`));

  return [
    ...directCandidates,
    ...extensionCandidates.map((extension) => `${basePath}${extension}`),
    ...indexCandidates,
  ];
}

function resolveImportTarget(
  rootDir: string,
  sourcePath: string,
  specifier: string,
  fileExists: (path: string) => boolean,
  aliasRules: RnMtAliasRule[],
) {
  const resolvedBasePath = specifier.startsWith(".")
    ? join(dirname(sourcePath), specifier)
    : (() => {
        const aliasRule = aliasRules.find((rule) => specifier.startsWith(rule.specifierPrefix));

        if (!aliasRule) {
          return null;
        }

        return join(aliasRule.targetBasePath, specifier.slice(aliasRule.specifierPrefix.length));
      })();

  if (!resolvedBasePath) {
    return null;
  }

  for (const candidate of getRelativeImportResolutionCandidates(resolvedBasePath)) {
    if (fileExists(candidate) && statSync(candidate).isFile()) {
      return {
        resolvedPath: candidate,
        aliasRule: aliasRules.find((rule) => specifier.startsWith(rule.specifierPrefix)) ?? null,
      };
    }
  }

  return null;
}

function rewriteMovedSourceContents(
  rootDir: string,
  sourcePath: string,
  destinationPath: string,
  contents: string,
  currentPathBySourcePath: Map<string, string>,
  fileExists: (path: string) => boolean,
  aliasRules: RnMtAliasRule[],
) {
  const replaceSpecifier = (specifier: string) => {
    if (!specifier.startsWith(".") && !aliasRules.some((rule) => specifier.startsWith(rule.specifierPrefix))) {
      return specifier;
    }

    const resolvedTarget = resolveImportTarget(
      rootDir,
      sourcePath,
      specifier,
      fileExists,
      aliasRules,
    );

    if (!resolvedTarget) {
      return specifier;
    }

    const currentTargetPath = currentPathBySourcePath.get(resolvedTarget.resolvedPath);

    if (!currentTargetPath) {
      return specifier;
    }

    if (
      resolvedTarget.aliasRule &&
      currentTargetPath.startsWith(resolvedTarget.aliasRule.targetBasePath)
    ) {
      const aliasRelativePath = currentTargetPath.slice(resolvedTarget.aliasRule.targetBasePath.length);

      return /\.(png|jpg|jpeg|svg|json)$/u.test(resolvedTarget.resolvedPath)
        ? `${resolvedTarget.aliasRule.specifierPrefix}${aliasRelativePath.replace(/^[/\\]/u, "")}`
        : `${resolvedTarget.aliasRule.specifierPrefix}${stripSupportedSourceExtension(aliasRelativePath).replace(/^[/\\]/u, "")}`;
    }

    const rewrittenSpecifier = normalizeImportPath(
      stripSupportedSourceExtension(relative(dirname(destinationPath), currentTargetPath)),
    );

    return /\.(png|jpg|jpeg|svg|json)$/u.test(resolvedTarget.resolvedPath)
      ? normalizeImportPath(relative(dirname(destinationPath), currentTargetPath))
      : rewrittenSpecifier;
  };

  return contents
    .replace(/(from\s+["'])([^"']+)(["'])/gu, (_, prefix, specifier, suffix) => {
      return `${prefix}${replaceSpecifier(specifier)}${suffix}`;
    })
    .replace(/(import\s+["'])([^"']+)(["'])/gu, (_, prefix, specifier, suffix) => {
      return `${prefix}${replaceSpecifier(specifier)}${suffix}`;
    })
    .replace(/(require\(\s*["'])([^"']+)(["']\s*\))/gu, (_, prefix, specifier, suffix) => {
      return `${prefix}${replaceSpecifier(specifier)}${suffix}`;
    });
}

export function createBaselineAnalyzeReport(
  rootDir: string = process.cwd(),
): RnMtBaselineAnalyzeReport {
  const resolvedRootDir = resolveAnalyzeRootDir(rootDir);
  const app = detectAppKind(resolvedRootDir);
  const support = detectSupportTier(app);
  const host = detectHostLanguage(resolvedRootDir);

  return {
    schemaVersion: 1,
    command: "analyze",
    status: app.candidates.length > 1 ? "ambiguous" : "ok",
    repo: {
      rootDir: resolvedRootDir,
      packageJsonPresent: existsSync(join(resolvedRootDir, "package.json")),
      gitPresent: existsSync(join(resolvedRootDir, ".git")),
      packageManager: detectPackageManager(resolvedRootDir),
      app,
      support,
      host,
    },
  };
}

export function formatBaselineAnalyzeReport(
  report: RnMtBaselineAnalyzeReport,
): string {
  const packageJsonStatus = report.repo.packageJsonPresent ? "yes" : "no";
  const gitStatus = report.repo.gitPresent ? "yes" : "no";
  const rawLine = report.repo.packageManager.raw
    ? `Raw package manager: ${report.repo.packageManager.raw}`
    : null;
  const statusLine = `Analyze status: ${report.status}`;
  const appKindLine = `App kind: ${report.repo.app.kind}`;
  const supportTierLine = `Support tier: ${report.repo.support.tier}`;
  const supportReasonLine = `Support reasons: ${report.repo.support.reasonCodes.join(", ")}`;
  const hostLanguageLine = `Host language: ${report.repo.host.language}`;
  const hostEvidenceLines = report.repo.host.evidence.map(
    (item) => `Host evidence: ${item}`,
  );
  const appCandidatesLine =
    report.repo.app.candidates.length > 1
      ? `App candidates: ${report.repo.app.candidates.join(", ")}`
      : null;
  const appEvidenceLines = report.repo.app.evidence.map(
    (item) => `App evidence: ${item}`,
  );
  const appRemediationLines = report.repo.app.remediation.map(
    (item) => `App remediation: ${item}`,
  );

  return [
    "rn-mt analyze",
    "",
    statusLine,
    `App root: ${report.repo.rootDir}`,
    `package.json present: ${packageJsonStatus}`,
    `Git repo present: ${gitStatus}`,
    `Package manager: ${report.repo.packageManager.name}`,
    `Package manager source: ${report.repo.packageManager.source}`,
    rawLine,
    appKindLine,
    supportTierLine,
    supportReasonLine,
    hostLanguageLine,
    appCandidatesLine,
    ...hostEvidenceLines,
    ...appEvidenceLines,
    ...appRemediationLines,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

function inferInitialTenantId(rootDir: string) {
  const packageJsonPath = join(rootDir, "package.json");

  if (existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
      name?: string;
    };

    if (packageJson.name) {
      return packageJson.name
        .toLowerCase()
        .replace(/^@/, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "default";
    }
  }

  return "default";
}

export function createInitialManifest(
  report: RnMtBaselineAnalyzeReport,
): RnMtManifest {
  const tenantId = inferInitialTenantId(report.repo.rootDir);
  const tenantDisplayName = tenantId
    .split("-")
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");

  return {
    schemaVersion: 1,
    source: {
      rootDir: report.repo.rootDir,
    },
    defaults: {
      tenant: tenantId,
      environment: "dev",
    },
    tenants: {
      [tenantId]: {
        displayName: tenantDisplayName || "Default",
      },
    },
    environments: {
      dev: {
        displayName: "Development",
      },
    },
  };
}

export function canInitializeFromAnalyzeReport(
  report: RnMtBaselineAnalyzeReport,
) {
  return report.repo.support.tier !== "unsupported";
}

export function getInitBlockedReason(report: RnMtBaselineAnalyzeReport) {
  if (canInitializeFromAnalyzeReport(report)) {
    return null;
  }

  return [
    "Cannot initialize rn-mt.config.json from an unsupported repo shape.",
    `Support tier: ${report.repo.support.tier}`,
    `Support reasons: ${report.repo.support.reasonCodes.join(", ")}`,
  ].join("\n");
}

export function createInitResult(
  report: RnMtBaselineAnalyzeReport,
): RnMtInitResult {
  const generatedHostFiles =
    report.repo.host.language === "javascript"
      ? [createJavaScriptHostFile(report.repo.rootDir)]
      : [createTypeScriptHostFile(report.repo.rootDir)];

  return {
    manifestPath: join(report.repo.rootDir, "rn-mt.config.json"),
    manifest: createInitialManifest(report),
    generatedHostFiles,
  };
}

export function createConvertResult(
  rootDir: string,
  manifest: RnMtManifest,
  options: {
    fileExists?: (path: string) => boolean;
    readFile?: (path: string) => string;
  } = {},
): RnMtConvertResult {
  const fileExists = options.fileExists ?? existsSync;
  const readFile = options.readFile ?? ((path: string) => readFileSync(path, "utf8"));
  const aliasRules = getAliasRules(rootDir);
  const entryFiles = getConvertibleRootEntryFiles(rootDir, options);

  if (entryFiles.length === 0) {
    throw new Error(
      "No supported root entry files were found. Expected one of App.[jt]sx?, index.[jt]sx?.",
    );
  }

  if (entryFiles.some((entry) => entry.contents.startsWith(rootWrapperBanner))) {
    throw new Error(
      "Convert has already been applied to this repo. Root entry wrappers are already CLI-owned.",
    );
  }

  const plannedMovedFiles = entryFiles.map((entry) => ({
    sourcePath: entry.path,
    destinationPath: join(rootDir, "src", "rn-mt", "shared", entry.fileName),
    contents: entry.contents,
  }));
  const categoryMovedFiles = getConvertCategoryFilePaths(rootDir)
    .filter((sourcePath) => !entryFiles.some((entry) => entry.path === sourcePath))
    .map((sourcePath) => ({
      sourcePath,
      destinationPath: join(
        rootDir,
        "src",
        "rn-mt",
        "shared",
        sourcePath.startsWith(join(rootDir, "src"))
          ? join("src", sourcePath.slice(join(rootDir, "src").length + 1))
          : sourcePath.slice(rootDir.length + 1),
      ),
      contents: readFile(sourcePath),
      removeSourcePath: true as const,
    }));
  const allMovedFiles = [...plannedMovedFiles, ...categoryMovedFiles];
  const currentPathBySourcePath = new Map(
    allMovedFiles
      .filter((file) => !isTestSourcePath(file.sourcePath))
      .map((file) => [
        file.sourcePath,
        join(
          rootDir,
          "src",
          "rn-mt",
          "current",
          file.destinationPath.slice(join(rootDir, "src", "rn-mt", "shared").length + 1),
        ),
      ]),
  );
  const movedFiles = allMovedFiles.map((file) => ({
    ...file,
    contents: isFacadeSourceFile(file.sourcePath)
      ? rewriteMovedSourceContents(
          rootDir,
          file.sourcePath,
          file.destinationPath,
          file.contents,
          currentPathBySourcePath,
          fileExists,
          aliasRules,
        )
      : file.contents,
  }));
  const generatedFiles: RnMtSyncGeneratedFile[] = entryFiles.map((entry) => ({
    path: entry.path,
    kind: "root-wrapper" as const,
    contents: createRootWrapperContents(entry.fileName),
  }));
  generatedFiles.push(
    ...createCurrentFacadeFiles(
      rootDir,
      manifest.defaults.tenant,
      movedFiles.map((file) => ({
        path: file.destinationPath,
        contents: file.contents,
      })),
    ),
  );
  const ownershipMetadata = createOwnershipMetadataFile(rootDir, generatedFiles, {
    fileName: "rn-mt.generated.convert.ownership.json",
  });

  return {
    rootDir,
    movedFiles,
    generatedFiles: [...generatedFiles, ownershipMetadata],
  };
}

export function getManifestPath(rootDir: string) {
  return join(rootDir, "rn-mt.config.json");
}

function validateEnvSchemaShape(envSchema: unknown) {
  if (envSchema === undefined) {
    return null;
  }

  if (!isPlainObject(envSchema)) {
    return "Invalid envSchema: expected an object keyed by logical env input name.";
  }

  for (const [logicalName, entry] of Object.entries(envSchema)) {
    if (!isPlainObject(entry)) {
      return `Invalid envSchema.${logicalName}: expected an object.`;
    }

    if (
      entry.source !== undefined &&
      (typeof entry.source !== "string" || entry.source.trim().length === 0)
    ) {
      return `Invalid envSchema.${logicalName}.source: expected a non-empty string.`;
    }

    if (entry.required !== undefined && typeof entry.required !== "boolean") {
      return `Invalid envSchema.${logicalName}.required: expected a boolean.`;
    }

    if (entry.secret !== undefined && typeof entry.secret !== "boolean") {
      return `Invalid envSchema.${logicalName}.secret: expected a boolean.`;
    }
  }

  return null;
}

export function parseManifest(manifestContents: string): RnMtManifest {
  const manifest = JSON.parse(manifestContents) as RnMtManifest;
  const envSchemaError = validateEnvSchemaShape(manifest.envSchema);

  if (envSchemaError) {
    throw new Error(envSchemaError);
  }

  return manifest;
}

export function validateTargetSelection(
  manifest: RnMtManifest,
  target: {
    tenant: string;
    environment: string;
  },
) {
  if (!manifest.tenants[target.tenant]) {
    return `Unknown tenant: ${target.tenant}`;
  }

  if (!manifest.environments[target.environment]) {
    return `Unknown environment: ${target.environment}`;
  }

  return null;
}

export function createTargetSetResult(
  rootDir: string,
  manifest: RnMtManifest,
  target: {
    tenant: string;
    environment: string;
  },
): RnMtTargetSetResult {
  const validationError = validateTargetSelection(manifest, target);

  if (validationError) {
    throw new Error(validationError);
  }

  return {
    manifestPath: getManifestPath(rootDir),
    manifest: {
      ...manifest,
      defaults: {
        tenant: target.tenant,
        environment: target.environment,
      },
    },
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeLayerValue(base: unknown, incoming: unknown): unknown {
  if (Array.isArray(incoming)) {
    return [...incoming];
  }

  if (isPlainObject(incoming)) {
    const baseObject = isPlainObject(base) ? base : {};
    const merged: Record<string, unknown> = { ...baseObject };

    for (const [key, value] of Object.entries(incoming)) {
      merged[key] = mergeLayerValue(baseObject[key], value);
    }

    return merged;
  }

  return incoming;
}

function mergeLayerRecord(
  base: Record<string, unknown> | undefined,
  incoming: Record<string, unknown> | undefined,
) {
  if (!incoming) {
    return { ...(base ?? {}) };
  }

  return mergeLayerValue(base ?? {}, incoming) as Record<string, unknown>;
}

function getCombinationKeys(target: RnMtResolvedTarget) {
  if (!target.platform) {
    return [
      `environment:${target.environment}+tenant:${target.tenant}`,
      `tenant:${target.tenant}+environment:${target.environment}`,
    ];
  }

  return [
    `environment:${target.environment}+tenant:${target.tenant}+platform:${target.platform}`,
    `environment:${target.environment}+platform:${target.platform}+tenant:${target.tenant}`,
    `tenant:${target.tenant}+environment:${target.environment}+platform:${target.platform}`,
    `tenant:${target.tenant}+platform:${target.platform}+environment:${target.environment}`,
    `platform:${target.platform}+environment:${target.environment}+tenant:${target.tenant}`,
    `platform:${target.platform}+tenant:${target.tenant}+environment:${target.environment}`,
  ];
}

function resolveManifestLayers(
  manifest: RnMtManifest,
  target: RnMtResolvedTarget,
) {
  const environment = manifest.environments[target.environment];
  const tenant = manifest.tenants[target.tenant];
  const platform = target.platform ? manifest.platforms?.[target.platform] : undefined;
  const combinationEntry = getCombinationKeys(target)
    .map((key) => ({ key, layer: manifest.combinations?.[key] }))
    .find((entry) => entry.layer);
  const combination = combinationEntry?.layer;
  const appliedLayers = [
    "base",
    `environment:${target.environment}`,
    `tenant:${target.tenant}`,
  ];

  if (target.platform) {
    appliedLayers.push(`platform:${target.platform}`);
  }

  if (combinationEntry) {
    appliedLayers.push(`combination:${combinationEntry.key}`);
  }

  return {
    appliedLayers,
    config: mergeLayerRecord(
      mergeLayerRecord(
        mergeLayerRecord(
          mergeLayerRecord(manifest.config, environment?.config),
          tenant?.config,
        ),
        platform?.config,
      ),
      combination?.config,
    ),
    flags: mergeLayerRecord(
      mergeLayerRecord(
        mergeLayerRecord(
          mergeLayerRecord(manifest.flags, environment?.flags),
          tenant?.flags,
        ),
        platform?.flags,
      ),
      combination?.flags,
    ),
    assets: mergeLayerRecord(
      mergeLayerRecord(
        mergeLayerRecord(
          mergeLayerRecord(manifest.assets, environment?.assets),
          tenant?.assets,
        ),
        platform?.assets,
      ),
      combination?.assets,
    ) as Record<string, string>,
  };
}

function toTitleCase(value: string) {
  return value
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(" ");
}

function getStringRecordValue(
  source: Record<string, unknown> | undefined,
  path: string[],
) {
  let current: unknown = source;

  for (const key of path) {
    if (!isPlainObject(current)) {
      return null;
    }

    current = current[key];
  }

  return typeof current === "string" ? current : null;
}

function setStringRecordValue(
  source: Record<string, unknown>,
  path: string[],
  value: string,
) {
  let current: Record<string, unknown> = source;

  for (const key of path.slice(0, -1)) {
    const next = current[key];

    if (!isPlainObject(next)) {
      current[key] = {};
    }

    current = current[key] as Record<string, unknown>;
  }

  const finalKey = path[path.length - 1];

  if (finalKey) {
    current[finalKey] = value;
  }
}

function deriveResolvedIdentity(
  manifest: RnMtManifest,
  resolvedConfig: Record<string, unknown>,
  target: RnMtResolvedTarget,
) {
  const baseDisplaySeed =
    getStringRecordValue(manifest.config, ["identity", "displayName"]) ??
    getStringRecordValue(manifest.config, ["identity", "appName"]) ??
    toTitleCase(target.tenant);
  const baseNativeSeed =
    getStringRecordValue(manifest.config, ["identity", "nativeId"]) ??
    `com.rnmt.${target.tenant}`;
  const explicitDisplayName = getStringRecordValue(resolvedConfig, [
    "identity",
    "displayName",
  ]);
  const resolvedAppName = getStringRecordValue(resolvedConfig, ["identity", "appName"]);
  const resolvedNativeId = getStringRecordValue(resolvedConfig, ["identity", "nativeId"]);
  const displaySeed = explicitDisplayName ?? resolvedAppName ?? baseDisplaySeed;
  const nativeIdSeed = resolvedNativeId ?? baseNativeSeed;
  const isProduction = target.environment === "prod" || target.environment === "production";

  if (isProduction) {
    return {
      displayName: explicitDisplayName ?? displaySeed,
      nativeId: nativeIdSeed,
    };
  }

  const environmentSuffix = ` (${toTitleCase(target.environment)})`;
  const hasDisplayOverride = explicitDisplayName !== null && explicitDisplayName !== baseDisplaySeed;
  const hasNativeIdOverride = resolvedNativeId !== null && resolvedNativeId !== baseNativeSeed;

  return {
    displayName: hasDisplayOverride ? explicitDisplayName : `${displaySeed}${environmentSuffix}`,
    nativeId: hasNativeIdOverride ? nativeIdSeed : `${nativeIdSeed}.${target.environment}`,
  };
}

function createBaseResolvedRuntime(
  manifest: RnMtManifest,
  target: RnMtResolvedTarget,
): RnMtResolvedRuntimeArtifact {
  const validationError = validateTargetSelection(manifest, target);
  const tenant = manifest.tenants[target.tenant];
  const environment = manifest.environments[target.environment];

  if (validationError) {
    throw new Error(validationError);
  }

  if (!tenant) {
    throw new Error(`Unknown tenant: ${target.tenant}`);
  }

  if (!environment) {
    throw new Error(`Unknown environment: ${target.environment}`);
  }

  const resolution = resolveManifestLayers(manifest, target);
  const identity = deriveResolvedIdentity(manifest, resolution.config, target);

  setStringRecordValue(resolution.config, ["identity", "displayName"], identity.displayName);
  setStringRecordValue(resolution.config, ["identity", "nativeId"], identity.nativeId);

  return {
    config: resolution.config,
    identity,
    tenant: {
      id: target.tenant,
      displayName: tenant.displayName,
    },
    env: {
      id: target.environment,
    },
    flags: resolution.flags,
    assets: resolution.assets,
  };
}

function createRuntimeArtifactFile(
  rootDir: string,
  runtime: RnMtResolvedRuntimeArtifact,
): RnMtSyncGeneratedFile {
  return {
    path: join(rootDir, "rn-mt.generated.runtime.json"),
    kind: "runtime-artifact",
    contents: `${JSON.stringify(runtime, null, 2)}\n`,
  };
}

function createOwnershipMetadataFile(
  rootDir: string,
  trackedFiles: RnMtSyncGeneratedFile[],
  options: {
    fileName?: string;
  } = {},
): RnMtSyncGeneratedFile {
  return {
    path: join(rootDir, options.fileName ?? "rn-mt.generated.ownership.json"),
    kind: "ownership-metadata",
    contents: `${JSON.stringify(
      {
        schemaVersion: 1,
        tool: "rn-mt",
        owner: "cli",
        artifacts: trackedFiles
          .map((file) => ({
            path: relative(rootDir, file.path),
            kind: file.kind,
          }))
          .sort((left, right) => left.path.localeCompare(right.path)),
      },
      null,
      2,
    )}\n`,
  };
}

function hasEnvInputValue(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

function validateEnvInputs(
  manifest: RnMtManifest,
  target: RnMtResolvedTarget,
  envSource: RnMtEnvSource,
) {
  if (!manifest.envSchema) {
    return null;
  }

  const missingInputs = Object.entries(manifest.envSchema)
    .map(([logicalName, entry]) => ({
      logicalName,
      source: entry.source ?? logicalName,
      required: entry.required ?? false,
    }))
    .filter((entry) => entry.required && !hasEnvInputValue(envSource[entry.source]));

  if (missingInputs.length === 0) {
    return null;
  }

  const targetLabel = target.platform
    ? `${target.tenant}/${target.environment}/${target.platform}`
    : `${target.tenant}/${target.environment}`;
  const missingDetails = missingInputs
    .map((entry) => `${entry.logicalName} (${entry.source})`)
    .sort((left, right) => left.localeCompare(right));

  return [
    `Missing required env inputs for ${targetLabel}: ${missingDetails.join(", ")}.`,
    "Set these variables in the command environment before running sync.",
  ].join(" ");
}

function parseDotEnvValue(rawValue: string) {
  const trimmedValue = rawValue.trim();

  if (
    (trimmedValue.startsWith("\"") && trimmedValue.endsWith("\"")) ||
    (trimmedValue.startsWith("'") && trimmedValue.endsWith("'"))
  ) {
    const innerValue = trimmedValue.slice(1, -1);

    if (trimmedValue.startsWith("\"")) {
      return innerValue.replace(/\\n/g, "\n");
    }

    return innerValue;
  }

  return trimmedValue;
}

function parseDotEnvContents(contents: string): RnMtEnvSource {
  const parsedEnv: RnMtEnvSource = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const trimmedLine = rawLine.trim();

    if (trimmedLine.length === 0 || trimmedLine.startsWith("#")) {
      continue;
    }

    const normalizedLine = trimmedLine.startsWith("export ")
      ? trimmedLine.slice("export ".length).trim()
      : trimmedLine;
    const separatorIndex = normalizedLine.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = normalizedLine.slice(0, separatorIndex).trim();
    const value = normalizedLine.slice(separatorIndex + 1);

    if (key.length === 0) {
      continue;
    }

    parsedEnv[key] = parseDotEnvValue(value);
  }

  return parsedEnv;
}

export function createSubprocessEnv(
  rootDir: string,
  manifest: RnMtManifest,
  target: RnMtResolvedTarget = manifest.defaults,
  options: {
    baseEnv?: RnMtEnvSource;
    fileExists?: (path: string) => boolean;
    readFile?: (path: string) => string;
  } = {},
): RnMtSubprocessEnvResult {
  const targetValidationError = validateTargetSelection(manifest, target);

  if (targetValidationError) {
    throw new Error(targetValidationError);
  }

  const fileExists = options.fileExists ?? existsSync;
  const readFile = options.readFile ?? ((path: string) => readFileSync(path, "utf8"));
  const mergedEnv: RnMtEnvSource = {
    ...(options.baseEnv ?? process.env),
  };
  const loadedFiles: RnMtLoadedEnvFile[] = [];
  const envFileDescriptors: RnMtLoadedEnvFile[] = [
    {
      path: join(rootDir, `.env.${target.environment}`),
      scope: "environment",
    },
    {
      path: join(rootDir, `.env.${target.tenant}.${target.environment}`),
      scope: "tenant-environment",
    },
  ];

  for (const descriptor of envFileDescriptors) {
    if (!fileExists(descriptor.path)) {
      continue;
    }

    Object.assign(mergedEnv, parseDotEnvContents(readFile(descriptor.path)));
    loadedFiles.push(descriptor);
  }

  const envValidationError = validateEnvInputs(manifest, target, mergedEnv);

  if (envValidationError) {
    throw new Error(
      envValidationError.replace(
        "before running sync.",
        "before running rn-mt run.",
      ),
    );
  }

  return {
    env: mergedEnv,
    loadedFiles,
  };
}

export function createSyncResult(
  rootDir: string,
  manifest: RnMtManifest,
  target: RnMtResolvedTarget = manifest.defaults,
  options: {
    env?: RnMtEnvSource;
  } = {},
): RnMtSyncResult {
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
  const runtime = createBaseResolvedRuntime(manifest, target);
  const runtimeArtifact = createRuntimeArtifactFile(rootDir, runtime);
  const ownershipMetadata = createOwnershipMetadataFile(rootDir, [runtimeArtifact]);

  return {
    rootDir,
    target: target.platform
      ? {
          tenant: target.tenant,
          environment: target.environment,
          platform: target.platform,
        }
      : {
          tenant: target.tenant,
          environment: target.environment,
        },
    resolution: {
      appliedLayers: resolution.appliedLayers,
    },
    runtime,
    generatedFiles: [runtimeArtifact, ownershipMetadata],
  };
}
