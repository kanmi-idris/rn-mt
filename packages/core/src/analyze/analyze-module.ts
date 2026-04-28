/**
 * Implements the analyze core module.
 */
import { join } from "node:path";

import { createInitialManifest } from "../manifest";
import { RnMtWorkspace } from "../workspace";

import type {
  RnMtBaselineAnalyzeReport,
  RnMtHostLanguage,
  RnMtInitGeneratedHostFile,
  RnMtInitResult,
  RnMtPackageManagerName,
  RnMtPackageManagerSource,
  RnMtRepoAppKind,
} from "./types";

/**
 * Encapsulates analyze behavior behind a constructor-backed seam.
 */
export class RnMtAnalyzeModule {
  /**
   * Initializes the analyze with its shared dependencies.
   */
  constructor(
    private readonly dependencies: {
      workspace: RnMtWorkspace;
    },
  ) {}

  /**
   * Detects package manager for the analyze flow.
   */
  private detectPackageManager(
    rootDir: string,
  ): RnMtBaselineAnalyzeReport["repo"]["packageManager"] {
    const packageJsonPath = join(rootDir, "package.json");

    if (this.dependencies.workspace.exists(packageJsonPath)) {
      const packageJson = this.dependencies.workspace.readJson<{
        packageManager?: string;
      }>(packageJsonPath);

      if (packageJson.packageManager) {
        return {
          name: this.parsePackageManagerName(packageJson.packageManager),
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
      if (
        this.dependencies.workspace.exists(join(rootDir, lockfile.fileName))
      ) {
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

  /**
   * Detects whether package scripts point at the React Native CLI even when
   * native folders are not present at the repo root.
   */
  private hasReactNativeWorkflowScripts(
    scripts: Record<string, string> | undefined,
  ) {
    if (!scripts) {
      return false;
    }

    return ["start", "android", "ios"].some((scriptName) =>
      scripts[scriptName]?.includes("react-native"),
    );
  }

  /**
   * Detects app kind for the analyze flow.
   */
  detectAppKind(rootDir: string): RnMtBaselineAnalyzeReport["repo"]["app"] {
    const evidence: string[] = [];
    const packageJsonPath = join(rootDir, "package.json");
    const appJsonPath = join(rootDir, "app.json");
    const appConfigJsPath = join(rootDir, "app.config.js");
    const appConfigTsPath = join(rootDir, "app.config.ts");
    const appRoutesPath = join(rootDir, "app");
    const iosPath = join(rootDir, "ios");
    const androidPath = join(rootDir, "android");
    let hasExpoDependency = false;
    let hasExpoRouterEntry = false;
    let hasReactNativeDependency = false;
    let hasReactNativeWorkflowScripts = false;

    if (this.dependencies.workspace.exists(packageJsonPath)) {
      const packageJson = this.dependencies.workspace.readJson<{
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
        name?: string;
        main?: string;
        scripts?: Record<string, string>;
      }>(packageJsonPath);

      if (packageJson.dependencies?.expo || packageJson.devDependencies?.expo) {
        hasExpoDependency = true;
        evidence.push("package.json includes expo dependency");
      }

      if (packageJson.main === "expo-router/entry") {
        hasExpoRouterEntry = true;
        evidence.push('package.json main is "expo-router/entry"');
      }

      if (
        packageJson.dependencies?.["react-native"] ||
        packageJson.devDependencies?.["react-native"]
      ) {
        hasReactNativeDependency = true;
      }

      hasReactNativeWorkflowScripts = this.hasReactNativeWorkflowScripts(
        packageJson.scripts,
      );
    }

    if (this.dependencies.workspace.exists(appJsonPath)) {
      evidence.push("app.json present");
    }

    if (this.dependencies.workspace.exists(appConfigJsPath)) {
      evidence.push("app.config.js present");
    }

    if (this.dependencies.workspace.exists(appConfigTsPath)) {
      evidence.push("app.config.ts present");
    }

    if (this.dependencies.workspace.exists(appRoutesPath)) {
      evidence.push("app directory present");
    }

    const hasExpoSignals = hasExpoDependency || hasExpoRouterEntry;
    const hasNativeFolders =
      this.dependencies.workspace.exists(iosPath) ||
      this.dependencies.workspace.exists(androidPath);
    const expoCandidates: RnMtRepoAppKind[] = [];

    if (hasExpoSignals && !hasNativeFolders) {
      expoCandidates.push("expo-managed");
    }

    if (hasExpoSignals && hasNativeFolders) {
      expoCandidates.push("expo-prebuild");
    }

    if (hasExpoSignals && !this.dependencies.workspace.exists(appJsonPath)) {
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
      if (this.dependencies.workspace.exists(iosPath)) {
        evidence.push("ios directory present");
      }

      if (this.dependencies.workspace.exists(androidPath)) {
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

      if (this.dependencies.workspace.exists(iosPath)) {
        evidence.push("ios directory present");
      }

      if (this.dependencies.workspace.exists(androidPath)) {
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

    if (hasReactNativeDependency && hasReactNativeWorkflowScripts) {
      evidence.push("react-native workflow scripts present");

      return {
        kind: "bare-react-native",
        candidates: ["bare-react-native"],
        evidence,
        remediation: [
          "Native ios/android folders are absent, so platform-specific sync and doctor checks stay limited until those folders exist.",
        ],
      };
    }

    return {
      kind: "unknown",
      candidates: ["unknown"],
      evidence,
      remediation: [],
    };
  }

  /**
   * Detects support tier for the analyze flow.
   */
  private detectSupportTier(
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
      if (app.remediation.length > 0) {
        return {
          tier: "near-supported",
          reasonCodes: ["shell-bare-react-native"],
        };
      }

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

  /**
   * Detects host language for the analyze flow.
   */
  detectHostLanguage(
    rootDir: string,
  ): RnMtBaselineAnalyzeReport["repo"]["host"] {
    const candidateFiles = [
      {
        path: join(rootDir, "tsconfig.json"),
        language: "typescript" as const,
        evidence: "tsconfig.json present",
      },
      {
        path: join(rootDir, "App.tsx"),
        language: "typescript" as const,
        evidence: "App.tsx present",
      },
      {
        path: join(rootDir, "index.ts"),
        language: "typescript" as const,
        evidence: "index.ts present",
      },
      {
        path: join(rootDir, "index.tsx"),
        language: "typescript" as const,
        evidence: "index.tsx present",
      },
    ];

    for (const candidate of candidateFiles) {
      if (this.dependencies.workspace.exists(candidate.path)) {
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

  /**
   * Runs the analyze flow.
   */
  run(
    options: { scopeToProvidedRoot?: boolean } = {},
  ): RnMtBaselineAnalyzeReport {
    const resolvedRootDir =
      this.dependencies.workspace.resolveAnalyzeRootDir(options);
    const app = this.detectAppKind(resolvedRootDir);
    const support = this.detectSupportTier(app);
    const host = this.detectHostLanguage(resolvedRootDir);

    return {
      schemaVersion: 1,
      command: "analyze",
      status: app.candidates.length > 1 ? "ambiguous" : "ok",
      repo: {
        rootDir: resolvedRootDir,
        packageJsonPresent: this.dependencies.workspace.exists(
          join(resolvedRootDir, "package.json"),
        ),
        gitPresent: this.dependencies.workspace.exists(
          join(resolvedRootDir, ".git"),
        ),
        packageManager: this.detectPackageManager(resolvedRootDir),
        app,
        support,
        host,
      },
    };
  }

  /**
   * Formats the requested value for the analyze flow.
   */
  format(report: RnMtBaselineAnalyzeReport) {
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

  /**
   * Checks whether it can initialize for the analyze flow.
   */
  canInitialize(report: RnMtBaselineAnalyzeReport) {
    return report.repo.support.tier !== "unsupported";
  }

  /**
   * Returns init blocked reason for the analyze flow.
   */
  getInitBlockedReason(report: RnMtBaselineAnalyzeReport) {
    if (this.canInitialize(report)) {
      return null;
    }

    return [
      "Cannot initialize rn-mt.config.json from an unsupported repo shape.",
      `Support tier: ${report.repo.support.tier}`,
      `Support reasons: ${report.repo.support.reasonCodes.join(", ")}`,
    ].join("\n");
  }

  /**
   * Creates the init payload, including the seeded manifest and generated host
   * bridge file, for a supported repo.
   */
  createInitResult(report: RnMtBaselineAnalyzeReport): RnMtInitResult {
    const generatedHostFiles =
      report.repo.host.language === "javascript"
        ? [this.createJavaScriptHostFile(report.repo.rootDir)]
        : [this.createTypeScriptHostFile(report.repo.rootDir)];
    const packageName = this.dependencies.workspace.exists(
      join(report.repo.rootDir, "package.json"),
    )
      ? this.dependencies.workspace.readJson<{ name?: string }>(
          join(report.repo.rootDir, "package.json"),
        ).name
      : undefined;
    const manifest = createInitialManifest(report, {
      ...(packageName ? { packageName } : {}),
    });

    return {
      manifestPath: join(report.repo.rootDir, "rn-mt.config.json"),
      manifest,
      generatedHostFiles,
    };
  }

  /**
   * Parses package manager name for the analyze flow.
   */
  private parsePackageManagerName(
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

  /**
   * Creates java script host file for the analyze flow.
   */
  private createJavaScriptHostFile(rootDir: string): RnMtInitGeneratedHostFile {
    return {
      path: join(rootDir, "rn-mt.generated.js"),
      language: "javascript",
      contents: [
        "// Generated by rn-mt. Do not edit directly.",
        "// This file gives JavaScript repos a stable host-facing entry point.",
        "",
        "export const rnMtHostLanguage = 'javascript'",
        "",
      ].join("\n"),
    };
  }

  /**
   * Creates type script host file for the analyze flow.
   */
  private createTypeScriptHostFile(rootDir: string): RnMtInitGeneratedHostFile {
    return {
      path: join(rootDir, "rn-mt.generated.ts"),
      language: "typescript",
      contents: [
        "// Generated by rn-mt. Do not edit directly.",
        "// This file gives TypeScript repos a stable host-facing entry point.",
        "",
        "export const rnMtHostLanguage = 'typescript' as const",
        "",
      ].join("\n"),
    };
  }
}
