import { createHash } from "node:crypto";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  type RnMtBaselineAnalyzeReport,
  type RnMtEnvSource,
  type RnMtManifest,
  type RnMtResolvedTarget,
  RnMtAnalyzeModule,
  RnMtAuditModule,
  RnMtConvertModule,
  RnMtDoctorModule,
  RnMtHandoffModule,
  RnMtOverrideModule,
  RnMtSyncModule,
  RnMtTenantModule,
  RnMtWorkspace,
  manifest,
} from "./index";

import { afterEach, describe, expect, it } from "vitest";

const tempDirs: string[] = [];

function asText(contents: string | Buffer | undefined) {
  if (typeof contents === "string") {
    return contents;
  }

  if (contents) {
    return contents.toString("utf8");
  }

  return "null";
}

function getWorkspace(rootDir: string) {
  return new RnMtWorkspace({ rootDir });
}

function getAnalyzeModule(rootDir: string) {
  return new RnMtAnalyzeModule({ workspace: getWorkspace(rootDir) });
}

function createBaselineAnalyzeReport(
  rootDir: string = process.cwd(),
  options: {
    scopeToProvidedRoot?: boolean;
  } = {},
) {
  return getAnalyzeModule(rootDir).run(options);
}

function formatBaselineAnalyzeReport(report: RnMtBaselineAnalyzeReport) {
  return getAnalyzeModule(report.repo.rootDir).format(report);
}

function canInitializeFromAnalyzeReport(report: RnMtBaselineAnalyzeReport) {
  return getAnalyzeModule(report.repo.rootDir).canInitialize(report);
}

function getInitBlockedReason(report: RnMtBaselineAnalyzeReport) {
  return getAnalyzeModule(report.repo.rootDir).getInitBlockedReason(report);
}

function createInitResult(report: RnMtBaselineAnalyzeReport) {
  return getAnalyzeModule(report.repo.rootDir).createInitResult(report);
}

function parseManifest(manifestContents: string) {
  return manifest.parseManifest(manifestContents);
}

function createCurrentImportsCodemodResult(
  rootDir: string,
  _options?: unknown,
) {
  return new RnMtConvertModule({
    workspace: getWorkspace(rootDir),
  }).planCurrentImportsCodemod();
}

function createConvertResult(
  rootDir: string,
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
    workspace: getWorkspace(rootDir),
  }).run(runOptions);
}

function createDoctorResult(
  rootDir: string,
  manifestValue: RnMtManifest,
  _options?: unknown,
) {
  return new RnMtDoctorModule({
    workspace: getWorkspace(rootDir),
  }).run(manifestValue);
}

function createAuditResult(rootDir: string, manifestValue: RnMtManifest) {
  return new RnMtAuditModule({
    workspace: getWorkspace(rootDir),
  }).run(manifestValue);
}

function createTargetSetResult(
  rootDir: string,
  manifestValue: RnMtManifest,
  target: {
    tenant: string;
    environment: string;
  },
) {
  return new RnMtTenantModule({
    workspace: getWorkspace(rootDir),
  }).setDefaultTarget({
    manifest: manifestValue,
    target,
  });
}

function createTenantAddResult(
  rootDir: string,
  manifestValue: RnMtManifest,
  tenant: {
    id: string;
    displayName?: string;
  },
) {
  return new RnMtTenantModule({
    workspace: getWorkspace(rootDir),
  }).add({
    manifest: manifestValue,
    tenant,
  });
}

function createTenantRenameResult(
  rootDir: string,
  manifestValue: RnMtManifest,
  tenant: {
    fromId: string;
    toId: string;
    displayName?: string;
  },
  _options?: unknown,
) {
  return new RnMtTenantModule({
    workspace: getWorkspace(rootDir),
  }).rename({
    manifest: manifestValue,
    tenant,
  });
}

function createTenantRemoveResult(
  rootDir: string,
  manifestValue: RnMtManifest,
  tenant: {
    id: string;
  },
  _options?: unknown,
) {
  return new RnMtTenantModule({
    workspace: getWorkspace(rootDir),
  }).remove({
    manifest: manifestValue,
    tenant,
  });
}

function createOverrideCreateResult(
  rootDir: string,
  manifestValue: RnMtManifest,
  selectedPath: string,
) {
  return new RnMtOverrideModule({
    workspace: getWorkspace(rootDir),
  }).create({
    manifest: manifestValue,
    selectedPath,
  });
}

function createOverrideRemoveResult(
  rootDir: string,
  manifestValue: RnMtManifest,
  selectedPath: string,
) {
  return new RnMtOverrideModule({
    workspace: getWorkspace(rootDir),
  }).remove({
    manifest: manifestValue,
    selectedPath,
  });
}

function createSubprocessEnv(
  rootDir: string,
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
    manifest,
    workspace: getWorkspace(rootDir),
  }).createSubprocessEnv(runOptions);
}

function createSyncResult(
  rootDir: string,
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
    manifest,
    workspace: getWorkspace(rootDir),
  }).run(runOptions);
}

function getHandoffModule(rootDir: string) {
  const workspace = getWorkspace(rootDir);

  return new RnMtHandoffModule({
    audit: new RnMtAuditModule({ workspace }),
    doctor: new RnMtDoctorModule({ workspace }),
    workspace,
  });
}

function createHandoffPreflightResult(
  rootDir: string,
  manifestValue: RnMtManifest,
  tenantId: string,
  _options?: unknown,
) {
  return getHandoffModule(rootDir).preflight({
    manifest: manifestValue,
    tenantId,
  });
}

function createHandoffFlattenResult(
  rootDir: string,
  manifestValue: RnMtManifest,
  tenantId: string,
  _options?: unknown,
) {
  return getHandoffModule(rootDir).flatten({
    manifest: manifestValue,
    tenantId,
  });
}

function createHandoffCleanupResult(rootDir: string, _options?: unknown) {
  return getHandoffModule(rootDir).cleanup();
}

function createHandoffSanitizationResult(
  rootDir: string,
  manifestValue: RnMtManifest,
  tenantId: string,
  _options?: unknown,
) {
  return getHandoffModule(rootDir).sanitize({
    manifest: manifestValue,
    tenantId,
  });
}

function createHandoffIsolationAuditResult(
  rootDir: string,
  manifestValue: RnMtManifest,
  tenantId: string,
  _options?: unknown,
) {
  return getHandoffModule(rootDir).auditIsolation({
    manifest: manifestValue,
    tenantId,
  });
}

function createInitialManifest(report: RnMtBaselineAnalyzeReport) {
  const packageJsonPath = join(report.repo.rootDir, "package.json");
  const packageName = existsSync(packageJsonPath)
    ? (JSON.parse(readFileSync(packageJsonPath, "utf8")) as { name?: string })
        .name
    : undefined;

  return manifest.createInitialManifest(report, {
    ...(packageName ? { packageName } : {}),
  });
}

function validateTargetSelection(
  manifestValue: RnMtManifest,
  target: {
    tenant: string;
    environment: string;
  },
) {
  return manifest.validateTargetSelection(manifestValue, target);
}

function createTempRepo(prefix: string) {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(directory);
  return directory;
}

function createConvertManifest(rootDir: string, tenant: string = "acme") {
  return parseManifest(
    JSON.stringify({
      schemaVersion: 1,
      source: { rootDir },
      defaults: { tenant, environment: "dev" },
      tenants: {
        [tenant]: { displayName: "Acme" },
      },
      environments: {
        dev: { displayName: "Development" },
      },
    }),
  );
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const directory = tempDirs.pop();
    if (directory) {
      rmSync(directory, { recursive: true, force: true });
    }
  }
});

describe("RnMtWorkspace.readJson", () => {
  it("parses JSONC-style config files with comments and trailing commas", () => {
    const repoDir = createTempRepo("rn-mt-core-jsonc-");
    const tsconfigPath = join(repoDir, "tsconfig.json");

    writeFileSync(
      tsconfigPath,
      `{
  // keep existing path aliases
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./*"],
      "@components/*": ["./components/*"],
    },
  },
}`,
    );

    expect(
      getWorkspace(repoDir).readJson<{
        compilerOptions: {
          strict: boolean;
          paths: Record<string, string[]>;
        };
      }>(tsconfigPath),
    ).toEqual({
      compilerOptions: {
        strict: true,
        paths: {
          "@/*": ["./*"],
          "@components/*": ["./components/*"],
        },
      },
    });
  });
});

describe("createBaselineAnalyzeReport", () => {
  it("reports root facts and package manager from packageManager field", () => {
    const repoDir = createTempRepo("rn-mt-core-report-");

    mkdirSync(join(repoDir, ".git"));
    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({ name: "fixture-app", packageManager: "pnpm@10.25.0" }),
    );

    const report = createBaselineAnalyzeReport(repoDir);

    expect(report).toEqual({
      schemaVersion: 1,
      command: "analyze",
      status: "ok",
      repo: {
        rootDir: repoDir,
        packageJsonPresent: true,
        gitPresent: true,
        packageManager: {
          name: "pnpm",
          source: "packageManager-field",
          raw: "pnpm@10.25.0",
        },
        app: {
          kind: "unknown",
          candidates: ["unknown"],
          evidence: [],
          remediation: [],
        },
        support: {
          tier: "unsupported",
          reasonCodes: ["unrecognized-app-shape"],
        },
        host: {
          language: "javascript",
          evidence: ["defaulted to javascript host files"],
        },
      },
    });
  });

  it("falls back to lockfile detection when packageManager field is missing", () => {
    const repoDir = createTempRepo("rn-mt-core-lockfile-");

    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({ name: "fixture-app" }),
    );
    writeFileSync(join(repoDir, "yarn.lock"), "# lockfile");

    const report = createBaselineAnalyzeReport(repoDir);

    expect(report.repo.packageManager).toEqual({
      name: "yarn",
      source: "yarn-lock",
      raw: "yarn.lock",
    });
  });

  it("walks up to the enclosing git repo root", () => {
    const repoDir = createTempRepo("rn-mt-core-git-root-");
    const packageDir = join(repoDir, "packages", "cli");

    mkdirSync(join(repoDir, ".git"));
    mkdirSync(packageDir, { recursive: true });
    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({ name: "fixture-root", packageManager: "pnpm@10.25.0" }),
    );
    writeFileSync(
      join(packageDir, "package.json"),
      JSON.stringify({ name: "fixture-cli" }),
    );

    const report = createBaselineAnalyzeReport(packageDir);

    expect(report.repo.rootDir).toBe(repoDir);
    expect(report.repo.packageManager).toEqual({
      name: "pnpm",
      source: "packageManager-field",
      raw: "pnpm@10.25.0",
    });
  });

  it("keeps analysis scoped to an explicit app root inside a larger workspace", () => {
    const repoDir = createTempRepo("rn-mt-core-scoped-app-root-");
    const appRoot = join(repoDir, "apps", "mobile");

    mkdirSync(join(repoDir, ".git"));
    mkdirSync(appRoot, { recursive: true });
    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "workspace-root",
        packageManager: "pnpm@10.25.0",
        workspaces: ["apps/*"],
      }),
    );
    writeFileSync(
      join(appRoot, "package.json"),
      JSON.stringify({
        name: "mobile-app",
        dependencies: {
          expo: "~55.0.0",
          "react-native": "0.85.0",
        },
      }),
    );
    writeFileSync(
      join(appRoot, "app.json"),
      JSON.stringify({ expo: { name: "Mobile App" } }),
    );

    const report = createBaselineAnalyzeReport(appRoot, {
      scopeToProvidedRoot: true,
    });

    expect(report.repo.rootDir).toBe(appRoot);
    expect(report.repo.app.kind).toBe("expo-managed");
    expect(report.repo.packageManager).toEqual({
      name: "unknown",
      source: "none",
      raw: null,
    });
  });

  it("detects TypeScript host repos from tsconfig.json", () => {
    const repoDir = createTempRepo("rn-mt-core-typescript-host-");

    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({ name: "fixture-app" }),
    );
    writeFileSync(
      join(repoDir, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { strict: true } }),
    );

    const report = createBaselineAnalyzeReport(repoDir);

    expect(report.repo.host).toEqual({
      language: "typescript",
      evidence: ["tsconfig.json present"],
    });
  });

  it("classifies Expo managed repos and reports evidence", () => {
    const repoDir = createTempRepo("rn-mt-core-expo-managed-");

    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "expo-fixture",
        dependencies: { expo: "~52.0.0" },
      }),
    );
    writeFileSync(
      join(repoDir, "app.json"),
      JSON.stringify({ expo: { name: "ExpoFixture" } }),
    );

    const report = createBaselineAnalyzeReport(repoDir);

    expect(report.repo.app).toEqual({
      kind: "expo-managed",
      candidates: ["expo-managed"],
      evidence: ["package.json includes expo dependency", "app.json present"],
      remediation: [],
    });
    expect(report.repo.support).toEqual({
      tier: "supported",
      reasonCodes: ["modern-expo-managed"],
    });
    expect(report.repo.host).toEqual({
      language: "javascript",
      evidence: ["defaulted to javascript host files"],
    });
  });

  it("reports ambiguity when Expo dependency exists without app.json or native folders", () => {
    const repoDir = createTempRepo("rn-mt-core-expo-ambiguous-");

    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "expo-fixture",
        dependencies: { expo: "~52.0.0" },
      }),
    );
    writeFileSync(join(repoDir, "app.config.ts"), "export default {};\n");

    const report = createBaselineAnalyzeReport(repoDir);

    expect(report.status).toBe("ambiguous");
    expect(report.repo.app).toEqual({
      kind: "unknown",
      candidates: ["expo-managed", "expo-prebuild"],
      evidence: [
        "package.json includes expo dependency",
        "app.config.ts present",
      ],
      remediation: [
        "Run analyze interactively and choose the intended Expo repo shape.",
        "Add or remove ios/android folders so the repo shape is unambiguous.",
        "Add app.json when this repo should be treated as Expo managed.",
      ],
    });
    expect(report.repo.support).toEqual({
      tier: "near-supported",
      reasonCodes: ["ambiguous-repo-shape"],
    });
    expect(report.repo.host).toEqual({
      language: "javascript",
      evidence: ["defaulted to javascript host files"],
    });
  });

  it("classifies Expo prebuild repos when Expo signals and native folders are both present", () => {
    const repoDir = createTempRepo("rn-mt-core-expo-false-positive-");

    mkdirSync(join(repoDir, "ios"));
    mkdirSync(join(repoDir, "android"));
    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "expo-fixture",
        dependencies: { expo: "~52.0.0" },
      }),
    );
    writeFileSync(
      join(repoDir, "app.json"),
      JSON.stringify({ expo: { name: "ExpoFixture" } }),
    );

    const report = createBaselineAnalyzeReport(repoDir);

    expect(report.repo.app.kind).toBe("expo-prebuild");
    expect(report.repo.app.evidence).toEqual([
      "package.json includes expo dependency",
      "app.json present",
      "ios directory present",
      "android directory present",
    ]);
    expect(report.repo.app.candidates).toEqual(["expo-prebuild"]);
    expect(report.repo.app.remediation).toEqual([]);
    expect(report.repo.support).toEqual({
      tier: "supported",
      reasonCodes: ["modern-expo-prebuild"],
    });
    expect(report.repo.host).toEqual({
      language: "javascript",
      evidence: ["defaulted to javascript host files"],
    });
  });

  it("surfaces Expo Router entry evidence for router-based Expo repos", () => {
    const repoDir = createTempRepo("rn-mt-core-expo-router-");

    mkdirSync(join(repoDir, "ios"));
    mkdirSync(join(repoDir, "android"));
    mkdirSync(join(repoDir, "app"), { recursive: true });
    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "expo-router-fixture",
        main: "expo-router/entry",
        dependencies: { expo: "~54.0.0" },
      }),
    );
    writeFileSync(
      join(repoDir, "app.json"),
      JSON.stringify({ expo: { name: "RouterFixture" } }),
    );

    const report = createBaselineAnalyzeReport(repoDir);

    expect(report.repo.app.kind).toBe("expo-prebuild");
    expect(report.repo.app.evidence).toEqual([
      "package.json includes expo dependency",
      'package.json main is "expo-router/entry"',
      "app.json present",
      "app directory present",
      "ios directory present",
      "android directory present",
    ]);
  });

  it("does not classify bare native repos without Expo signals as Expo prebuild", () => {
    const repoDir = createTempRepo("rn-mt-core-bare-native-");

    mkdirSync(join(repoDir, "ios"));
    mkdirSync(join(repoDir, "android"));
    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "native-fixture",
        dependencies: { react: "19.0.0", "react-native": "0.76.0" },
      }),
    );

    const report = createBaselineAnalyzeReport(repoDir);

    expect(report.repo.app).toEqual({
      kind: "bare-react-native",
      candidates: ["bare-react-native"],
      evidence: [
        "package.json includes react-native dependency",
        "ios directory present",
        "android directory present",
      ],
      remediation: [],
    });
    expect(report.repo.support).toEqual({
      tier: "supported",
      reasonCodes: ["modern-bare-react-native"],
    });
    expect(report.repo.host).toEqual({
      language: "javascript",
      evidence: ["defaulted to javascript host files"],
    });
  });

  it("does not classify bare React Native without native folders", () => {
    const repoDir = createTempRepo("rn-mt-core-bare-native-no-folders-");

    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "native-fixture",
        dependencies: { react: "19.0.0", "react-native": "0.76.0" },
      }),
    );

    const report = createBaselineAnalyzeReport(repoDir);

    expect(report.repo.app).toEqual({
      kind: "unknown",
      candidates: ["unknown"],
      evidence: ["package.json includes react-native dependency"],
      remediation: [],
    });
    expect(report.repo.support).toEqual({
      tier: "unsupported",
      reasonCodes: ["unrecognized-app-shape"],
    });
    expect(report.repo.host).toEqual({
      language: "javascript",
      evidence: ["defaulted to javascript host files"],
    });
  });

  it("classifies shell-style bare React Native repos when react-native scripts exist without root native folders", () => {
    const repoDir = createTempRepo("rn-mt-core-bare-native-shell-");

    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "native-shell-fixture",
        scripts: {
          start: "react-native start",
          android: "react-native run-android",
          ios: "react-native run-ios",
        },
        dependencies: { react: "19.0.0", "react-native": "0.76.0" },
      }),
    );
    writeFileSync(
      join(repoDir, "app.json"),
      JSON.stringify({ name: "Native Shell Fixture" }),
    );

    const report = createBaselineAnalyzeReport(repoDir);

    expect(report.repo.app).toEqual({
      kind: "bare-react-native",
      candidates: ["bare-react-native"],
      evidence: [
        "app.json present",
        "package.json includes react-native dependency",
        "react-native workflow scripts present",
      ],
      remediation: [
        "Native ios/android folders are absent, so platform-specific sync and doctor checks stay limited until those folders exist.",
      ],
    });
    expect(report.repo.support).toEqual({
      tier: "near-supported",
      reasonCodes: ["shell-bare-react-native"],
    });
    expect(report.repo.host).toEqual({
      language: "javascript",
      evidence: ["defaulted to javascript host files"],
    });
  });
});

describe("formatBaselineAnalyzeReport", () => {
  it("renders a readable baseline analysis summary", () => {
    const output = formatBaselineAnalyzeReport({
      schemaVersion: 1,
      command: "analyze",
      status: "ambiguous",
      repo: {
        rootDir: "/tmp/rn-mt-fixture",
        packageJsonPresent: true,
        gitPresent: false,
        packageManager: {
          name: "npm",
          source: "packageManager-field",
          raw: "npm@10.8.2",
        },
        app: {
          kind: "unknown",
          candidates: ["expo-managed", "expo-prebuild"],
          evidence: [
            "package.json includes expo dependency",
            "app.config.ts present",
          ],
          remediation: [
            "Run analyze interactively and choose the intended Expo repo shape.",
            "Add or remove ios/android folders so the repo shape is unambiguous.",
            "Add app.json when this repo should be treated as Expo managed.",
          ],
        },
        support: {
          tier: "near-supported",
          reasonCodes: ["ambiguous-repo-shape"],
        },
        host: {
          language: "javascript",
          evidence: ["defaulted to javascript host files"],
        },
      },
    });

    expect(output).toContain("rn-mt analyze");
    expect(output).toContain("Analyze status: ambiguous");
    expect(output).toContain("App root: /tmp/rn-mt-fixture");
    expect(output).toContain("package.json present: yes");
    expect(output).toContain("Git repo present: no");
    expect(output).toContain("Package manager: npm");
    expect(output).toContain("Package manager source: packageManager-field");
    expect(output).toContain("Raw package manager: npm@10.8.2");
    expect(output).toContain("App kind: unknown");
    expect(output).toContain("Support tier: near-supported");
    expect(output).toContain("Support reasons: ambiguous-repo-shape");
    expect(output).toContain("Host language: javascript");
    expect(output).toContain(
      "Host evidence: defaulted to javascript host files",
    );
    expect(output).toContain("App candidates: expo-managed, expo-prebuild");
    expect(output).toContain(
      "App evidence: package.json includes expo dependency",
    );
    expect(output).toContain("App evidence: app.config.ts present");
    expect(output).toContain(
      "App remediation: Run analyze interactively and choose the intended Expo repo shape.",
    );
  });
});

describe("init helpers", () => {
  it("seeds a minimal manifest from a supported analyzed repo", () => {
    const repoDir = createTempRepo("rn-mt-core-init-supported-");

    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "demo-app",
        dependencies: { expo: "~52.0.0" },
      }),
    );
    writeFileSync(
      join(repoDir, "app.json"),
      JSON.stringify({ expo: { name: "DemoApp" } }),
    );

    const report = createBaselineAnalyzeReport(repoDir);
    const manifest = createInitialManifest(report);

    expect(canInitializeFromAnalyzeReport(report)).toBe(true);
    expect(manifest).toEqual({
      schemaVersion: 1,
      source: {
        rootDir: repoDir,
      },
      defaults: {
        tenant: "demo-app",
        environment: "dev",
      },
      tenants: {
        "demo-app": {
          displayName: "Demo App",
        },
      },
      environments: {
        dev: {
          displayName: "Development",
        },
      },
    });
  });

  it("blocks manifest init for unsupported repo shapes", () => {
    const repoDir = createTempRepo("rn-mt-core-init-unsupported-");

    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({ name: "plain-app" }),
    );

    const report = createBaselineAnalyzeReport(repoDir);

    expect(canInitializeFromAnalyzeReport(report)).toBe(false);
    expect(getInitBlockedReason(report)).toContain(
      "Cannot initialize rn-mt.config.json from an unsupported repo shape.",
    );
  });

  it("creates a stable manifest path and JavaScript host file for init output", () => {
    const repoDir = createTempRepo("rn-mt-core-init-result-");

    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "demo-app",
        dependencies: { expo: "~52.0.0" },
      }),
    );
    writeFileSync(
      join(repoDir, "app.json"),
      JSON.stringify({ expo: { name: "DemoApp" } }),
    );

    const result = createInitResult(createBaselineAnalyzeReport(repoDir));

    expect(result.manifestPath).toBe(join(repoDir, "rn-mt.config.json"));
    expect(result.manifest.defaults.tenant).toBe("demo-app");
    expect(result.generatedHostFiles).toEqual([
      {
        path: join(repoDir, "rn-mt.generated.js"),
        language: "javascript",
        contents: [
          "// Generated by rn-mt. Do not edit directly.",
          "// This file gives JavaScript repos a stable host-facing entry point.",
          "",
          "export const rnMtHostLanguage = 'javascript'",
          "",
        ].join("\n"),
      },
    ]);
  });

  it("generates a TypeScript host file for TypeScript repos", () => {
    const repoDir = createTempRepo("rn-mt-core-init-typescript-");

    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "demo-app",
        dependencies: { expo: "~52.0.0" },
      }),
    );
    writeFileSync(
      join(repoDir, "app.json"),
      JSON.stringify({ expo: { name: "DemoApp" } }),
    );
    writeFileSync(
      join(repoDir, "tsconfig.json"),
      JSON.stringify({ compilerOptions: { strict: true } }),
    );

    const result = createInitResult(createBaselineAnalyzeReport(repoDir));

    expect(result.generatedHostFiles).toEqual([
      {
        path: join(repoDir, "rn-mt.generated.ts"),
        language: "typescript",
        contents: [
          "// Generated by rn-mt. Do not edit directly.",
          "// This file gives TypeScript repos a stable host-facing entry point.",
          "",
          "export const rnMtHostLanguage = 'typescript' as const",
          "",
        ].join("\n"),
      },
    ]);
  });
});

describe("target set helpers", () => {
  it("updates the shared default target when tenant and environment are valid", () => {
    const manifest = parseManifest(
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: "/tmp/demo-app" },
        defaults: { tenant: "demo-app", environment: "dev" },
        tenants: {
          "demo-app": { displayName: "Demo App" },
          acme: { displayName: "Acme" },
        },
        environments: {
          dev: { displayName: "Development" },
          staging: { displayName: "Staging" },
        },
      }),
    );

    const result = createTargetSetResult("/tmp/demo-app", manifest, {
      tenant: "acme",
      environment: "staging",
    });

    expect(result.manifest.defaults).toEqual({
      tenant: "acme",
      environment: "staging",
    });
  });

  it("rejects unknown tenants and environments", () => {
    const manifest = parseManifest(
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: "/tmp/demo-app" },
        defaults: { tenant: "demo-app", environment: "dev" },
        tenants: {
          "demo-app": { displayName: "Demo App" },
        },
        environments: {
          dev: { displayName: "Development" },
        },
      }),
    );

    expect(
      validateTargetSelection(manifest, { tenant: "acme", environment: "dev" }),
    ).toBe("Unknown tenant: acme");
    expect(
      validateTargetSelection(manifest, {
        tenant: "demo-app",
        environment: "staging",
      }),
    ).toBe("Unknown environment: staging");
  });
});

describe("tenant add helpers", () => {
  it("adds a new tenant, seeds initial structure, and leaves the manifest syncable", () => {
    const manifest = parseManifest(
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: "/tmp/demo-app" },
        defaults: { tenant: "demo-app", environment: "dev" },
        tenants: {
          "demo-app": { displayName: "Demo App" },
        },
        environments: {
          dev: { displayName: "Development" },
        },
      }),
    );

    const result = createTenantAddResult("/tmp/demo-app", manifest, {
      id: "acme-beta",
    });
    const targetResult = createTargetSetResult(
      "/tmp/demo-app",
      result.manifest,
      {
        tenant: "acme-beta",
        environment: "dev",
      },
    );

    expect(result.manifest.tenants["acme-beta"]).toEqual({
      displayName: "Acme Beta",
    });
    expect(result.createdFiles).toEqual([
      {
        path: "/tmp/demo-app/src/rn-mt/tenants/acme-beta/.gitkeep",
        contents: "",
      },
    ]);
    expect(targetResult.manifest.defaults).toEqual({
      tenant: "acme-beta",
      environment: "dev",
    });
    expect(() =>
      createSyncResult("/tmp/demo-app", result.manifest, {
        tenant: "acme-beta",
        environment: "dev",
      }),
    ).not.toThrow();
  });

  it("rejects duplicate tenant ids", () => {
    const manifest = parseManifest(
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: "/tmp/demo-app" },
        defaults: { tenant: "demo-app", environment: "dev" },
        tenants: {
          "demo-app": { displayName: "Demo App" },
        },
        environments: {
          dev: { displayName: "Development" },
        },
      }),
    );

    expect(() =>
      createTenantAddResult("/tmp/demo-app", manifest, {
        id: "demo-app",
      }),
    ).toThrow("Tenant already exists: demo-app");
  });
});

describe("tenant rename helpers", () => {
  it("renames a tenant, rewrites current facades for the default tenant, and updates tenant-scoped paths", () => {
    const repoDir = createTempRepo("rn-mt-core-tenant-rename-");

    mkdirSync(join(repoDir, "src", "rn-mt", "shared", "theme"), {
      recursive: true,
    });
    mkdirSync(join(repoDir, "src", "rn-mt", "tenants", "demo-app", "theme"), {
      recursive: true,
    });
    mkdirSync(
      join(repoDir, "ios", "DemoApp.xcodeproj", "xcshareddata", "xcschemes"),
      {
        recursive: true,
      },
    );
    writeFileSync(
      join(repoDir, "src", "rn-mt", "shared", "theme", "branding.ts"),
      "export default { color: 'shared' };\n",
    );
    writeFileSync(
      join(
        repoDir,
        "src",
        "rn-mt",
        "tenants",
        "demo-app",
        "theme",
        "branding.ts",
      ),
      "export default { color: 'tenant' };\n",
    );
    writeFileSync(
      join(repoDir, ".env.demo-app.dev"),
      "API_BASE_URL=https://demo.example.com\n",
    );
    writeFileSync(
      join(repoDir, "ios", "rn-mt.generated.demo-app-dev.xcconfig"),
      "// generated\n",
    );
    writeFileSync(
      join(
        repoDir,
        "ios",
        "DemoApp.xcodeproj",
        "xcshareddata",
        "xcschemes",
        "DemoApp-Dev.xcscheme",
      ),
      "<Scheme />\n",
    );
    writeFileSync(
      join(repoDir, "rn-mt.generated.reconstruction.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          tool: "rn-mt",
          defaultTenant: "demo-app",
          sharedRootPath: "src/rn-mt/shared",
          currentRootPath: "src/rn-mt/current",
          entries: [],
        },
        null,
        2,
      ) + "\n",
    );

    const manifest = parseManifest(
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: repoDir },
        defaults: { tenant: "demo-app", environment: "dev" },
        tenants: {
          "demo-app": { displayName: "Demo App" },
        },
        environments: {
          dev: { displayName: "Development" },
        },
      }),
    );

    const result = createTenantRenameResult(
      repoDir,
      manifest,
      {
        fromId: "demo-app",
        toId: "acme-beta",
      },
      {
        fileExists: existsSync,
        readFile: (path: string) => readFileSync(path, "utf8"),
      },
    );

    expect(result.manifest.defaults).toEqual({
      tenant: "acme-beta",
      environment: "dev",
    });
    expect(result.manifest.tenants["acme-beta"]).toEqual({
      displayName: "Demo App",
    });
    expect(result.renamedPaths).toEqual(
      expect.arrayContaining([
        {
          fromPath: join(repoDir, "src", "rn-mt", "tenants", "demo-app"),
          toPath: join(repoDir, "src", "rn-mt", "tenants", "acme-beta"),
        },
        {
          fromPath: join(repoDir, ".env.demo-app.dev"),
          toPath: join(repoDir, ".env.acme-beta.dev"),
        },
        {
          fromPath: join(repoDir, "ios", "rn-mt.generated.demo-app-dev.xcconfig"),
          toPath: join(
            repoDir,
            "ios",
            "rn-mt.generated.acme-beta-dev.xcconfig",
          ),
        },
        {
          fromPath: join(
            repoDir,
            "ios",
            "DemoApp.xcodeproj",
            "xcshareddata",
            "xcschemes",
            "DemoApp-Dev.xcscheme",
          ),
          toPath: join(
            repoDir,
            "ios",
            "DemoApp.xcodeproj",
            "xcshareddata",
            "xcschemes",
            "AcmeBeta-Dev.xcscheme",
          ),
        },
      ]),
    );
    expect(result.generatedFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: join(
            repoDir,
            "src",
            "rn-mt",
            "current",
            "theme",
            "branding.ts",
          ),
          kind: "current-facade",
          contents: expect.stringContaining(
            "../../tenants/acme-beta/theme/branding",
          ),
        }),
        expect.objectContaining({
          path: join(repoDir, "rn-mt.generated.reconstruction.json"),
          kind: "reconstruction-metadata",
          contents: expect.stringContaining('"defaultTenant": "acme-beta"'),
        }),
      ]),
    );
  });

  it("rejects tenant rename collisions", () => {
    const manifest = parseManifest(
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: "/tmp/demo-app" },
        defaults: { tenant: "demo-app", environment: "dev" },
        tenants: {
          "demo-app": { displayName: "Demo App" },
          acme: { displayName: "Acme" },
        },
        environments: {
          dev: { displayName: "Development" },
        },
      }),
    );

    expect(() =>
      createTenantRenameResult("/tmp/demo-app", manifest, {
        fromId: "demo-app",
        toId: "acme",
      }),
    ).toThrow("Tenant already exists: acme");
  });
});

describe("tenant remove helpers", () => {
  it("removes a non-default tenant from the manifest and collects tenant-scoped paths", () => {
    const repoDir = createTempRepo("rn-mt-core-tenant-remove-");

    mkdirSync(join(repoDir, "src", "rn-mt", "tenants", "acme"), {
      recursive: true,
    });
    writeFileSync(
      join(repoDir, ".env.acme.dev"),
      "API_BASE_URL=https://acme.example.com\n",
    );

    const manifest = parseManifest(
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: repoDir },
        defaults: { tenant: "demo-app", environment: "dev" },
        tenants: {
          "demo-app": { displayName: "Demo App" },
          acme: { displayName: "Acme" },
        },
        environments: {
          dev: { displayName: "Development" },
        },
      }),
    );

    const result = createTenantRemoveResult(
      repoDir,
      manifest,
      {
        id: "acme",
      },
      {
        fileExists: existsSync,
      },
    );

    expect(result.manifest.tenants).toEqual({
      "demo-app": { displayName: "Demo App" },
    });
    expect(result.removedPaths).toEqual([
      join(repoDir, ".env.acme.dev"),
      join(repoDir, "src", "rn-mt", "tenants", "acme"),
    ]);
    expect(
      validateTargetSelection(result.manifest, {
        tenant: "demo-app",
        environment: "dev",
      }),
    ).toBeNull();
  });

  it("rejects removing the current default tenant", () => {
    const manifest = parseManifest(
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: "/tmp/demo-app" },
        defaults: { tenant: "demo-app", environment: "dev" },
        tenants: {
          "demo-app": { displayName: "Demo App" },
          acme: { displayName: "Acme" },
        },
        environments: {
          dev: { displayName: "Development" },
        },
      }),
    );

    expect(() =>
      createTenantRemoveResult("/tmp/demo-app", manifest, {
        id: "demo-app",
      }),
    ).toThrow(
      "Cannot remove default tenant: demo-app. Select a different default target first.",
    );
  });
});

describe("doctor helpers", () => {
  it("reports positive release integration signals when expected artifacts are present", () => {
    const repoDir = createTempRepo("rn-mt-core-doctor-positive-");

    mkdirSync(join(repoDir, "android", "app"), { recursive: true });
    mkdirSync(
      join(repoDir, "ios", "KeepNexus.xcodeproj", "xcshareddata", "xcschemes"),
      {
        recursive: true,
      },
    );
    writeFileSync(
      join(repoDir, "android", "app", "build.gradle"),
      "android {}\n",
    );
    writeFileSync(
      join(repoDir, "android", "app", "rn-mt.generated.identity.gradle"),
      "// generated\n",
    );
    writeFileSync(
      join(repoDir, "android", "app", "rn-mt.generated.flavors.gradle"),
      "// generated\n",
    );
    writeFileSync(
      join(repoDir, "ios", "rn-mt.generated.current.xcconfig"),
      "// generated\n",
    );
    writeFileSync(
      join(repoDir, "ios", "rn-mt.generated.demo-app-dev.xcconfig"),
      "// generated\n",
    );
    writeFileSync(
      join(
        repoDir,
        "ios",
        "KeepNexus.xcodeproj",
        "xcshareddata",
        "xcschemes",
        "DemoApp-Dev.xcscheme",
      ),
      "<Scheme />\n",
    );

    const manifest = parseManifest(
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: repoDir },
        defaults: { tenant: "demo-app", environment: "dev" },
        tenants: {
          "demo-app": { displayName: "Demo App" },
        },
        environments: {
          dev: { displayName: "Development" },
        },
      }),
    );

    const result = createDoctorResult(repoDir, manifest, {
      fileExists: existsSync,
    });

    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "android-release-integration",
          status: "ok",
        }),
        expect.objectContaining({
          code: "ios-release-integration",
          status: "ok",
        }),
      ]),
    );
  });

  it("reports a warning when Expo distribution wiring is missing", () => {
    const repoDir = createTempRepo("rn-mt-core-doctor-warning-");

    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "expo-fixture",
        dependencies: {
          expo: "~55.0.0",
          "react-native": "0.85.0",
        },
      }),
    );
    writeFileSync(
      join(repoDir, "app.json"),
      JSON.stringify({ expo: { name: "Expo Fixture" } }),
    );

    const manifest = parseManifest(
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: repoDir },
        defaults: { tenant: "demo-app", environment: "dev" },
        tenants: {
          "demo-app": { displayName: "Demo App" },
        },
        environments: {
          dev: { displayName: "Development" },
        },
      }),
    );

    const result = createDoctorResult(repoDir, manifest, {
      fileExists: existsSync,
    });

    expect(result.checks).toEqual([
      expect.objectContaining({
        code: "expo-distribution-config",
        status: "warning",
      }),
    ]);
    expect(result.checks[0]?.details).toContain(
      `Expected ${join(repoDir, "eas.json")} for EAS build and submit workflow wiring.`,
    );
  });
});

describe("handoff preflight helpers", () => {
  it("passes handoff preflight when the repo is converted, doctor-clean, and carries reconstruction metadata", () => {
    const repoDir = createTempRepo("rn-mt-core-handoff-preflight-pass-");
    const manifest = createConvertManifest(repoDir, "fixture-app");

    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "fixture-app",
        dependencies: { expo: "~52.0.0" },
      }),
    );
    writeFileSync(
      join(repoDir, "app.json"),
      JSON.stringify({ expo: { name: "FixtureApp" } }),
    );
    writeFileSync(
      join(repoDir, "eas.json"),
      JSON.stringify({ cli: { version: ">= 1.0.0" } }),
    );
    writeFileSync(
      join(repoDir, "App.tsx"),
      "export default function App() { return null; }\n",
    );
    writeFileSync(
      join(repoDir, "index.js"),
      "import { registerRootComponent } from 'expo';\nregisterRootComponent(App);\n",
    );

    const convertResult = createConvertResult(repoDir, manifest);

    for (const file of convertResult.generatedFiles) {
      mkdirSync(dirname(file.path), { recursive: true });
      writeFileSync(file.path, file.contents);
    }

    const result = createHandoffPreflightResult(
      repoDir,
      manifest,
      "fixture-app",
      {
        fileExists: existsSync,
        readFile: (path: string) => readFileSync(path, "utf8"),
      },
    );

    expect(result.status).toBe("ready");
    expect(result.tenant).toEqual({
      id: "fixture-app",
      displayName: "Acme",
    });
    expect(result.checks).toEqual([
      {
        code: "target-tenant",
        status: "ok",
        summary: "Tenant fixture-app is present in the manifest.",
        details: ["Display name: Acme"],
      },
      {
        code: "converted-repo",
        status: "ok",
        summary: "Converted repo ownership metadata is present.",
        details: [
          expect.stringContaining("rn-mt.generated.convert.ownership.json"),
        ],
      },
      {
        code: "reconstruction-metadata",
        status: "ok",
        summary: "Reconstruction metadata is present.",
        details: [
          expect.stringContaining("rn-mt.generated.reconstruction.json"),
          expect.stringContaining("Tracked paths: 2"),
        ],
      },
      {
        code: "doctor-clean",
        status: "ok",
        summary: "Doctor passed with no warnings.",
        details: [
          "expo-distribution-config: Expo distribution integration detected.",
        ],
      },
    ]);
  });

  it("blocks handoff preflight when reconstruction metadata is missing", () => {
    const repoDir = createTempRepo("rn-mt-core-handoff-preflight-blocked-");
    const manifest = createConvertManifest(repoDir, "fixture-app");

    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "fixture-app",
        dependencies: { expo: "~52.0.0" },
      }),
    );
    writeFileSync(
      join(repoDir, "app.json"),
      JSON.stringify({ expo: { name: "FixtureApp" } }),
    );
    writeFileSync(
      join(repoDir, "eas.json"),
      JSON.stringify({ cli: { version: ">= 1.0.0" } }),
    );
    writeFileSync(
      join(repoDir, "App.tsx"),
      "export default function App() { return null; }\n",
    );
    writeFileSync(
      join(repoDir, "index.js"),
      "import { registerRootComponent } from 'expo';\nregisterRootComponent(App);\n",
    );

    const convertResult = createConvertResult(repoDir, manifest);

    for (const file of convertResult.generatedFiles.filter(
      (generatedFile) => generatedFile.kind !== "reconstruction-metadata",
    )) {
      mkdirSync(dirname(file.path), { recursive: true });
      writeFileSync(file.path, file.contents);
    }

    const result = createHandoffPreflightResult(
      repoDir,
      manifest,
      "fixture-app",
      {
        fileExists: existsSync,
        readFile: (path: string) => readFileSync(path, "utf8"),
      },
    );

    expect(result.status).toBe("blocked");
    expect(result.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "converted-repo",
          status: "ok",
        }),
        expect.objectContaining({
          code: "reconstruction-metadata",
          status: "blocked",
          summary: "Reconstruction metadata is missing or empty.",
        }),
        expect.objectContaining({
          code: "doctor-clean",
          status: "ok",
        }),
      ]),
    );
  });
});

describe("handoff flatten helpers", () => {
  it("reconstructs a native-looking app structure from shared files plus tenant fallback", () => {
    const repoDir = createTempRepo("rn-mt-core-handoff-flatten-");
    const manifest = createConvertManifest(repoDir, "acme");

    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "fixture-app",
        dependencies: { expo: "~52.0.0" },
      }),
    );
    writeFileSync(
      join(repoDir, "rn-mt.config.json"),
      JSON.stringify(manifest, null, 2),
    );
    writeFileSync(join(repoDir, "README.md"), "# Fixture App\n");
    writeFileSync(
      join(repoDir, "app.json"),
      JSON.stringify({ expo: { name: "FixtureApp" } }),
    );
    writeFileSync(
      join(repoDir, "App.tsx"),
      [
        'import theme from "./theme";',
        'import config from "./src/config";',
        "",
        "export default function App() {",
        "  return theme && config ? null : null;",
        "}",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(repoDir, "index.js"),
      "import { registerRootComponent } from 'expo';\nregisterRootComponent(App);\n",
    );
    mkdirSync(join(repoDir, "theme"), { recursive: true });
    mkdirSync(join(repoDir, "assets"), { recursive: true });
    mkdirSync(join(repoDir, "src", "config"), { recursive: true });
    writeFileSync(
      join(repoDir, "theme", "index.ts"),
      [
        'import logo from "../assets/logo.png";',
        "",
        "export default { logo, color: 'shared' };",
        "",
      ].join("\n"),
    );
    writeFileSync(join(repoDir, "assets", "logo.png"), "binary");
    writeFileSync(
      join(repoDir, "App.test.tsx"),
      [
        'import App from "./App";',
        "",
        "describe('App', () => {",
        "  it('renders', () => {",
        "    expect(App).toBeDefined();",
        "  });",
        "});",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(repoDir, "src", "config", "index.ts"),
      "export default { apiBaseUrl: 'https://example.com' };\n",
    );

    const convertResult = createConvertResult(repoDir, manifest);

    for (const file of convertResult.movedFiles) {
      mkdirSync(dirname(file.destinationPath), { recursive: true });
      writeFileSync(file.destinationPath, file.contents);

      if (
        file.removeSourcePath &&
        file.sourcePath !== file.destinationPath &&
        existsSync(file.sourcePath)
      ) {
        rmSync(file.sourcePath, { force: true });
      }
    }

    for (const file of convertResult.generatedFiles) {
      mkdirSync(dirname(file.path), { recursive: true });
      writeFileSync(file.path, file.contents);
    }

    mkdirSync(join(repoDir, "src", "rn-mt", "tenants", "acme", "theme"), {
      recursive: true,
    });
    writeFileSync(
      join(repoDir, "src", "rn-mt", "tenants", "acme", "theme", "index.ts"),
      [
        'import logo from "../../../current/assets/logo.png";',
        "",
        "export default { logo, color: 'tenant' };",
        "",
      ].join("\n"),
    );

    const result = createHandoffFlattenResult(repoDir, manifest, "acme", {
      fileExists: existsSync,
      readFile: (path: string) => readFileSync(path, "utf8"),
    });

    expect(result.tenant).toEqual({
      id: "acme",
      displayName: "Acme",
    });
    expect(result.restoredFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourcePath: join(repoDir, "src", "rn-mt", "shared", "App.tsx"),
          destinationPath: join(repoDir, "App.tsx"),
          contents: [
            'import theme from "./theme";',
            'import config from "./src/config";',
            "",
            "export default function App() {",
            "  return theme && config ? null : null;",
            "}",
            "",
          ].join("\n"),
        }),
        expect.objectContaining({
          sourcePath: join(
            repoDir,
            "src",
            "rn-mt",
            "tenants",
            "acme",
            "theme",
            "index.ts",
          ),
          destinationPath: join(repoDir, "theme", "index.ts"),
          contents: [
            'import logo from "../assets/logo.png";',
            "",
            "export default { logo, color: 'tenant' };",
            "",
          ].join("\n"),
        }),
        expect.objectContaining({
          sourcePath: join(
            repoDir,
            "src",
            "rn-mt",
            "shared",
            "src",
            "config",
            "index.ts",
          ),
          destinationPath: join(repoDir, "src", "config", "index.ts"),
          contents: "export default { apiBaseUrl: 'https://example.com' };\n",
        }),
        expect.objectContaining({
          sourcePath: join(
            repoDir,
            "src",
            "rn-mt",
            "shared",
            "assets",
            "logo.png",
          ),
          destinationPath: join(repoDir, "assets", "logo.png"),
          contents: Buffer.from("binary"),
        }),
        expect.objectContaining({
          sourcePath: join(repoDir, "src", "rn-mt", "shared", "App.test.tsx"),
          destinationPath: join(repoDir, "App.test.tsx"),
          contents: [
            'import App from "./App";',
            "",
            "describe('App', () => {",
            "  it('renders', () => {",
            "    expect(App).toBeDefined();",
            "  });",
            "});",
            "",
          ].join("\n"),
        }),
      ]),
    );
  });
});

describe("handoff cleanup helpers", () => {
  it("rewrites package identity and removes rn-mt machinery from a flattened output", () => {
    const repoDir = createTempRepo("rn-mt-core-handoff-cleanup-");
    const manifest = createConvertManifest(repoDir, "fixture-app");

    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "fixture-app",
        dependencies: { expo: "~52.0.0" },
      }),
    );
    writeFileSync(
      join(repoDir, "rn-mt.config.json"),
      JSON.stringify(manifest, null, 2),
    );
    writeFileSync(join(repoDir, "README.md"), "# Fixture App\n");
    writeFileSync(
      join(repoDir, "app.json"),
      JSON.stringify({ expo: { name: "FixtureApp" } }),
    );
    writeFileSync(
      join(repoDir, "App.tsx"),
      [
        'import theme from "./theme";',
        'import config from "./src/config";',
        "",
        "export default function App() {",
        "  return theme && config ? null : null;",
        "}",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(repoDir, "index.js"),
      "import { registerRootComponent } from 'expo';\nregisterRootComponent(App);\n",
    );
    mkdirSync(join(repoDir, "theme"), { recursive: true });
    mkdirSync(join(repoDir, "assets"), { recursive: true });
    mkdirSync(join(repoDir, "src", "config"), { recursive: true });
    writeFileSync(
      join(repoDir, "theme", "index.ts"),
      [
        'import logo from "../assets/logo.png";',
        "",
        "export default { logo, color: 'shared' };",
        "",
      ].join("\n"),
    );
    writeFileSync(join(repoDir, "assets", "logo.png"), "binary");
    writeFileSync(
      join(repoDir, "App.test.tsx"),
      [
        'import App from "./App";',
        "",
        "describe('App', () => {",
        "  it('renders', () => {",
        "    expect(App).toBeDefined();",
        "  });",
        "});",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(repoDir, "src", "config", "index.ts"),
      "export default { apiBaseUrl: 'https://example.com' };\n",
    );

    const convertResult = createConvertResult(repoDir, manifest);

    for (const file of convertResult.movedFiles) {
      mkdirSync(dirname(file.destinationPath), { recursive: true });
      writeFileSync(file.destinationPath, file.contents);

      if (
        file.removeSourcePath &&
        file.sourcePath !== file.destinationPath &&
        existsSync(file.sourcePath)
      ) {
        rmSync(file.sourcePath, { force: true });
      }
    }

    for (const file of convertResult.generatedFiles) {
      mkdirSync(dirname(file.path), { recursive: true });
      writeFileSync(file.path, file.contents);
    }

    writeFileSync(
      join(repoDir, "rn-mt.generated.runtime.json"),
      JSON.stringify({ tenant: "fixture-app", environment: "dev" }, null, 2),
    );
    writeFileSync(
      join(repoDir, "rn-mt.generated.ownership.json"),
      JSON.stringify({ owner: "cli", tool: "rn-mt", artifacts: [] }, null, 2),
    );
    writeFileSync(
      join(repoDir, "rn-mt.generated.asset-fingerprints.json"),
      JSON.stringify({ tool: "rn-mt", assets: [] }, null, 2),
    );
    mkdirSync(join(repoDir, ".rn-mt"), { recursive: true });
    writeFileSync(join(repoDir, ".rn-mt", "hook-state.json"), "{}\n");

    const flattenResult = createHandoffFlattenResult(
      repoDir,
      manifest,
      "fixture-app",
      {
        fileExists: existsSync,
        readFile: (path: string) => readFileSync(path, "utf8"),
      },
    );

    for (const file of flattenResult.restoredFiles) {
      mkdirSync(dirname(file.destinationPath), { recursive: true });
      writeFileSync(file.destinationPath, file.contents);
    }

    const cleanupResult = createHandoffCleanupResult(repoDir, {
      fileExists: existsSync,
      readFile: (path: string) => readFileSync(path, "utf8"),
    });
    const packageJsonFile = cleanupResult.rewrittenFiles.find(
      (file) => file.path === join(repoDir, "package.json"),
    );
    const readmeFile = cleanupResult.rewrittenFiles.find(
      (file) => file.path === join(repoDir, "README.md"),
    );

    expect(packageJsonFile?.contents).toContain('"start": "expo start"');
    expect(packageJsonFile?.contents).toContain(
      '"android": "expo start --android"',
    );
    expect(packageJsonFile?.contents).toContain('"ios": "expo start --ios"');
    expect(packageJsonFile?.contents).not.toContain("rn-mt:");
    expect(packageJsonFile?.contents).not.toContain("@molaidrislabs/runtime");
    expect(packageJsonFile?.contents).not.toContain("@molaidrislabs/cli");
    expect(packageJsonFile?.contents).not.toContain("@molaidrislabs/expo-plugin");
    expect(readmeFile?.contents).toBe("# Fixture App\n");
    expect(cleanupResult.removedPaths).toEqual(
      expect.arrayContaining([
        join(repoDir, ".rn-mt"),
        join(repoDir, "rn-mt.config.json"),
        join(repoDir, "rn-mt.generated.README.md"),
        join(repoDir, "rn-mt.generated.asset-fingerprints.json"),
        join(repoDir, "rn-mt.generated.convert.ownership.json"),
        join(repoDir, "rn-mt.generated.ownership.json"),
        join(repoDir, "rn-mt.generated.reconstruction.json"),
        join(repoDir, "rn-mt.generated.runtime.json"),
        join(repoDir, "src", "rn-mt"),
      ]),
    );
  });
});

describe("handoff sanitization helpers", () => {
  it("strips automation paths and replaces real env files with sanitized examples", () => {
    const repoDir = createTempRepo("rn-mt-core-handoff-sanitization-");
    const manifest = parseManifest(
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: repoDir },
        defaults: { tenant: "fixture-app", environment: "dev" },
        envSchema: {
          apiBaseUrl: {
            source: "API_BASE_URL",
            required: true,
          },
          sentryDsn: {
            source: "SENTRY_DSN",
            secret: true,
          },
        },
        tenants: {
          "fixture-app": { displayName: "Fixture App" },
        },
        environments: {
          dev: { displayName: "Development" },
          prod: { displayName: "Production" },
        },
      }),
    );

    mkdirSync(join(repoDir, ".github", "workflows"), { recursive: true });
    writeFileSync(
      join(repoDir, ".github", "workflows", "release.yml"),
      "name: release\n",
    );
    writeFileSync(
      join(repoDir, "eas.json"),
      JSON.stringify({ cli: { version: ">= 1.0.0" } }),
    );
    writeFileSync(
      join(repoDir, ".env.dev"),
      "API_BASE_URL=https://dev.example.com\nSENTRY_DSN=https://secret-dev\n",
    );
    writeFileSync(
      join(repoDir, ".env.fixture-app.dev"),
      "TENANT_ONLY=fixture-secret\n",
    );
    writeFileSync(
      join(repoDir, ".env.prod"),
      "API_BASE_URL=https://prod.example.com\n",
    );

    const result = createHandoffSanitizationResult(
      repoDir,
      manifest,
      "fixture-app",
      {
        fileExists: existsSync,
        readFile: (path: string) => readFileSync(path, "utf8"),
      },
    );

    expect(result.reviewRequired).toBe(true);
    expect(result.generatedFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: join(repoDir, ".env.dev.example"),
          contents: expect.stringContaining("API_BASE_URL="),
        }),
        expect.objectContaining({
          path: join(repoDir, ".env.prod.example"),
          contents: expect.stringContaining("SENTRY_DSN="),
        }),
      ]),
    );
    expect(
      result.generatedFiles.find(
        (file) => file.path === join(repoDir, ".env.dev.example"),
      )?.contents,
    ).toContain("TENANT_ONLY=");
    expect(
      result.generatedFiles.find(
        (file) => file.path === join(repoDir, ".env.dev.example"),
      )?.contents,
    ).toContain("# SENTRY_DSN (secret)");
    expect(
      result.generatedFiles.find(
        (file) => file.path === join(repoDir, ".env.dev.example"),
      )?.contents,
    ).not.toContain("https://secret-dev");
    expect(result.removedPaths).toEqual(
      expect.arrayContaining([
        join(repoDir, ".github"),
        join(repoDir, "eas.json"),
        join(repoDir, ".env.dev"),
        join(repoDir, ".env.fixture-app.dev"),
        join(repoDir, ".env.prod"),
      ]),
    );
    expect(result.reviewChecklist).toEqual(
      expect.arrayContaining([
        expect.stringContaining(".github"),
        expect.stringContaining(".env.dev.example"),
      ]),
    );
  });
});

describe("handoff isolation audit helpers", () => {
  it("fails when exported output still contains other-tenant residue", () => {
    const repoDir = createTempRepo("rn-mt-core-handoff-audit-");
    const manifest = parseManifest(
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: repoDir },
        defaults: { tenant: "acme", environment: "dev" },
        tenants: {
          acme: { displayName: "Acme" },
          beta: { displayName: "Beta Corp" },
        },
        environments: {
          dev: { displayName: "Development" },
        },
      }),
    );

    writeFileSync(
      join(repoDir, "README.md"),
      "# Acme App\nInternal note: Beta Corp migration pending.\n",
    );
    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({ name: "acme-app" }),
    );

    const result = createHandoffIsolationAuditResult(
      repoDir,
      manifest,
      "acme",
      {
        fileExists: existsSync,
        readFile: (path: string) => readFileSync(path, "utf8"),
      },
    );

    expect(result.findings).toEqual([
      expect.objectContaining({
        code: "other-tenant-residue",
        path: join(repoDir, "README.md"),
        severity: "P0",
        confidence: "high",
      }),
    ]);
    expect(result.findings[0]?.evidence).toEqual(
      expect.arrayContaining([
        "Found tenant display name Beta Corp: Beta Corp",
      ]),
    );
  });
});

describe("codemod helpers", () => {
  it("previews shared import rewrites back to the current facade surface", () => {
    const repoDir = createTempRepo("rn-mt-core-codemod-current-imports-");
    const manifest = createConvertManifest(repoDir, "fixture-app");

    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "fixture-app",
        dependencies: { expo: "~52.0.0" },
      }),
    );
    writeFileSync(
      join(repoDir, "app.json"),
      JSON.stringify({ expo: { name: "FixtureApp" } }),
    );
    writeFileSync(
      join(repoDir, "App.tsx"),
      [
        'import theme from "./theme";',
        'import config from "./src/config";',
        "",
        "export default function App() {",
        "  return theme && config ? null : null;",
        "}",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(repoDir, "index.js"),
      "import { registerRootComponent } from 'expo';\nregisterRootComponent(App);\n",
    );
    mkdirSync(join(repoDir, "theme"), { recursive: true });
    mkdirSync(join(repoDir, "src", "config"), { recursive: true });
    writeFileSync(join(repoDir, "theme", "index.ts"), "export default {};\n");
    writeFileSync(
      join(repoDir, "src", "config", "index.ts"),
      "export default {};\n",
    );

    const convertResult = createConvertResult(repoDir, manifest);

    for (const file of convertResult.movedFiles) {
      mkdirSync(dirname(file.destinationPath), { recursive: true });
      writeFileSync(file.destinationPath, file.contents);

      if (
        file.removeSourcePath &&
        file.sourcePath !== file.destinationPath &&
        existsSync(file.sourcePath)
      ) {
        rmSync(file.sourcePath, { force: true });
      }
    }

    for (const file of convertResult.generatedFiles) {
      mkdirSync(dirname(file.path), { recursive: true });
      writeFileSync(file.path, file.contents);
    }

    writeFileSync(
      join(repoDir, "src", "rn-mt", "shared", "App.tsx"),
      [
        'import theme from "./theme/index";',
        'import config from "./src/config/index";',
        "",
        "export default function App() {",
        "  return theme && config ? null : null;",
        "}",
        "",
      ].join("\n"),
    );

    const result = createCurrentImportsCodemodResult(repoDir, {
      fileExists: existsSync,
      readFile: (path: string) => readFileSync(path, "utf8"),
    });

    expect(result.codemod).toBe("current-imports");
    expect(result.changes).toEqual([
      expect.objectContaining({
        path: join(repoDir, "src", "rn-mt", "shared", "App.tsx"),
        before: expect.stringContaining('import theme from "./theme/index";'),
        after: expect.stringContaining(
          'import theme from "../current/theme/index";',
        ),
      }),
    ]);
  });
});

describe("manifest parsing", () => {
  it("rejects malformed envSchema entries", () => {
    expect(() =>
      parseManifest(
        JSON.stringify({
          schemaVersion: 1,
          source: { rootDir: "/tmp/demo-app" },
          defaults: { tenant: "demo-app", environment: "dev" },
          tenants: {
            "demo-app": { displayName: "Demo App" },
          },
          environments: {
            dev: { displayName: "Development" },
          },
          envSchema: {
            apiBaseUrl: {
              source: "",
            },
          },
        }),
      ),
    ).toThrow(
      "Invalid envSchema.apiBaseUrl.source: expected a non-empty string.",
    );
  });
});

describe("convert helpers", () => {
  it("creates an rn-mt skeleton with shared sources, current facades, and root wrappers", () => {
    const repoDir = createTempRepo("rn-mt-core-convert-");

    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "fixture-app",
        dependencies: { expo: "~52.0.0" },
      }),
    );
    writeFileSync(join(repoDir, "README.md"), "# Fixture App\n");
    writeFileSync(
      join(repoDir, "app.json"),
      JSON.stringify({ expo: { name: "FixtureApp" } }),
    );
    writeFileSync(
      join(repoDir, "App.tsx"),
      "export default function App() { return null; }\n",
    );
    writeFileSync(
      join(repoDir, "index.js"),
      "import { registerRootComponent } from 'expo';\nregisterRootComponent(App);\n",
    );

    const result = createConvertResult(repoDir, createConvertManifest(repoDir));

    expect(result.movedFiles).toEqual(
      expect.arrayContaining([
        {
          sourcePath: join(repoDir, "App.tsx"),
          destinationPath: join(repoDir, "src", "rn-mt", "shared", "App.tsx"),
          contents: "export default function App() { return null; }\n",
        },
        {
          sourcePath: join(repoDir, "index.js"),
          destinationPath: join(repoDir, "src", "rn-mt", "shared", "index.js"),
          contents:
            "import { registerRootComponent } from 'expo';\nregisterRootComponent(App);\n",
        },
        expect.objectContaining({
          sourcePath: join(repoDir, "package.json"),
          destinationPath: join(repoDir, "package.json"),
          contents: expect.stringContaining(
            '"rn-mt:start": "rn-mt run -- expo start"',
          ),
        }),
      ]),
    );
    expect(result.generatedFiles).toEqual(
      expect.arrayContaining([
        {
          path: join(repoDir, "App.tsx"),
          kind: "root-wrapper",
          contents: [
            "// Generated by rn-mt. CLI-owned wrapper. Do not edit directly.",
            'import App from "./src/rn-mt/current/App";',
            "",
            "export default App;",
            "",
          ].join("\n"),
        },
        {
          path: join(repoDir, "src", "rn-mt", "current", "App.tsx"),
          kind: "current-facade",
          contents: [
            "// Generated by rn-mt. CLI-owned current facade. Do not edit directly.",
            'export { default } from "../shared/App";',
            'export * from "../shared/App";',
            "",
          ].join("\n"),
        },
        {
          path: join(repoDir, "index.js"),
          kind: "root-wrapper",
          contents: [
            "// Generated by rn-mt. CLI-owned wrapper. Do not edit directly.",
            'import "./src/rn-mt/current/index";',
            "",
          ].join("\n"),
        },
        {
          path: join(repoDir, "src", "rn-mt", "current", "index.js"),
          kind: "current-facade",
          contents: [
            "// Generated by rn-mt. CLI-owned current facade. Do not edit directly.",
            'import "../shared/index";',
            "",
          ].join("\n"),
        },
        {
          path: join(repoDir, "src", "rn-mt", "current", "runtime.ts"),
          kind: "current-facade",
          contents: expect.stringContaining("createRuntimeAccessors"),
        },
        {
          path: join(repoDir, "app.config.ts"),
          kind: "expo-config-bridge",
          contents: expect.stringContaining("applyExpoTargetContext"),
        },
        {
          path: join(repoDir, "rn-mt.generated.convert.ownership.json"),
          kind: "ownership-metadata",
          contents: expect.stringContaining('"owner": "cli"'),
        },
        {
          path: join(repoDir, "rn-mt.generated.reconstruction.json"),
          kind: "reconstruction-metadata",
          contents: expect.stringContaining('"defaultTenant": "acme"'),
        },
        {
          path: join(repoDir, "rn-mt.generated.README.md"),
          kind: "repo-readme",
          contents: expect.stringContaining(
            "# rn-mt Ownership and Handoff Guide",
          ),
        },
      ]),
    );
    expect(result.movedFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourcePath: join(repoDir, "README.md"),
          destinationPath: join(repoDir, "README.md"),
          contents: expect.stringContaining(
            "[rn-mt ownership and handoff guide](./rn-mt.generated.README.md)",
          ),
        }),
      ]),
    );
    expect(result.userOwnedFiles).toEqual([
      {
        path: join(repoDir, "src", "rn-mt", "extensions", "index.ts"),
        contents: [
          "// User-owned rn-mt extension module. Safe to edit.",
          "// Add custom helpers here instead of editing CLI-owned generated files.",
          "export const rnMtExtensions = {} as const;",
          "",
        ].join("\n"),
      },
    ]);
  });

  it("converts Expo Router route trees without requiring root App or index entry files", () => {
    const repoDir = createTempRepo("rn-mt-core-convert-router-");

    mkdirSync(join(repoDir, "ios"));
    mkdirSync(join(repoDir, "android"));
    mkdirSync(join(repoDir, "app"), { recursive: true });
    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "router-fixture",
        main: "expo-router/entry",
        dependencies: { expo: "~54.0.0" },
      }),
    );
    writeFileSync(
      join(repoDir, "app.json"),
      JSON.stringify({ expo: { name: "RouterFixture" } }),
    );
    writeFileSync(
      join(repoDir, "app", "_layout.tsx"),
      "export default function Layout() { return null; }\n",
    );
    writeFileSync(
      join(repoDir, "app", "index.tsx"),
      "export default function Index() { return null; }\n",
    );

    const result = createConvertResult(repoDir, createConvertManifest(repoDir));

    expect(result.movedFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourcePath: join(repoDir, "app", "_layout.tsx"),
          destinationPath: join(
            repoDir,
            "src",
            "rn-mt",
            "shared",
            "app",
            "_layout.tsx",
          ),
          removeSourcePath: false,
        }),
        expect.objectContaining({
          sourcePath: join(repoDir, "app", "index.tsx"),
          destinationPath: join(
            repoDir,
            "src",
            "rn-mt",
            "shared",
            "app",
            "index.tsx",
          ),
          removeSourcePath: false,
        }),
      ]),
    );
    expect(result.generatedFiles).toEqual(
      expect.arrayContaining([
        {
          path: join(repoDir, "app", "_layout.tsx"),
          kind: "root-wrapper",
          contents: [
            "// Generated by rn-mt. CLI-owned wrapper. Do not edit directly.",
            'export { default } from "../src/rn-mt/current/app/_layout";',
            'export * from "../src/rn-mt/current/app/_layout";',
            "",
          ].join("\n"),
        },
        {
          path: join(repoDir, "app", "index.tsx"),
          kind: "root-wrapper",
          contents: [
            "// Generated by rn-mt. CLI-owned wrapper. Do not edit directly.",
            'export { default } from "../src/rn-mt/current/app/index";',
            'export * from "../src/rn-mt/current/app/index";',
            "",
          ].join("\n"),
        },
        {
          path: join(repoDir, "src", "rn-mt", "current", "app", "_layout.tsx"),
          kind: "current-facade",
          contents: [
            "// Generated by rn-mt. CLI-owned current facade. Do not edit directly.",
            'export { default } from "../../shared/app/_layout";',
            'export * from "../../shared/app/_layout";',
            "",
          ].join("\n"),
        },
      ]),
    );
  });

  it("still generates current facades when the repo lives under a parent tests directory", () => {
    const tempRoot = createTempRepo("rn-mt-core-convert-parent-tests-");
    const repoDir = join(tempRoot, "tests", "sandbox-app");

    mkdirSync(repoDir, { recursive: true });
    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "fixture-app",
        dependencies: { expo: "~52.0.0" },
      }),
    );
    writeFileSync(
      join(repoDir, "app.json"),
      JSON.stringify({ expo: { name: "FixtureApp" } }),
    );
    writeFileSync(
      join(repoDir, "App.tsx"),
      "export default function App() { return null; }\n",
    );
    writeFileSync(
      join(repoDir, "index.js"),
      "import { registerRootComponent } from 'expo';\nregisterRootComponent(App);\n",
    );

    const result = createConvertResult(repoDir, createConvertManifest(repoDir));

    expect(result.generatedFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: join(repoDir, "src", "rn-mt", "current", "App.tsx"),
          kind: "current-facade",
        }),
        expect.objectContaining({
          path: join(repoDir, "src", "rn-mt", "current", "index.js"),
          kind: "current-facade",
        }),
      ]),
    );
  });

  it("generates import-only current facades for moved files that do not export a module surface", () => {
    const repoDir = createTempRepo("rn-mt-core-convert-side-effect-file-");

    mkdirSync(join(repoDir, "utils"), { recursive: true });
    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "fixture-app",
        dependencies: { expo: "~52.0.0" },
      }),
    );
    writeFileSync(
      join(repoDir, "app.json"),
      JSON.stringify({ expo: { name: "FixtureApp" } }),
    );
    writeFileSync(
      join(repoDir, "App.tsx"),
      "export default function App() { return null; }\n",
    );
    writeFileSync(
      join(repoDir, "index.js"),
      "import { registerRootComponent } from 'expo';\nregisterRootComponent(App);\n",
    );
    writeFileSync(
      join(repoDir, "utils", "api.tsx"),
      [
        "globalThis.__fixtureApiBootstrap = true;",
        'console.log(\"bootstrapped api globals\");',
        "",
      ].join("\n"),
    );

    const result = createConvertResult(repoDir, createConvertManifest(repoDir));
    const facade = result.generatedFiles.find(
      (file) =>
        file.path ===
        join(repoDir, "src", "rn-mt", "current", "utils", "api.tsx"),
    );

    expect(facade).toEqual({
      path: join(repoDir, "src", "rn-mt", "current", "utils", "api.tsx"),
      kind: "current-facade",
      contents: [
        "// Generated by rn-mt. CLI-owned current facade. Do not edit directly.",
        'import "../../shared/utils/api";',
        "",
      ].join("\n"),
    });
  });

  it("retargets fully converted tsconfig path aliases to the current facade surface", () => {
    const repoDir = createTempRepo("rn-mt-core-convert-tsconfig-aliases-");

    mkdirSync(join(repoDir, "config"), { recursive: true });
    mkdirSync(join(repoDir, "theme"), { recursive: true });
    mkdirSync(join(repoDir, "src", "screens"), { recursive: true });
    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "fixture-app",
        dependencies: { expo: "~52.0.0" },
      }),
    );
    writeFileSync(
      join(repoDir, "app.json"),
      JSON.stringify({ expo: { name: "FixtureApp" } }),
    );
    writeFileSync(
      join(repoDir, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            baseUrl: ".",
            paths: {
              "@app/*": ["src/*"],
              "@config/*": ["config/*"],
              "@theme/*": ["theme/*"],
            },
          },
        },
        null,
        2,
      ),
    );
    writeFileSync(
      join(repoDir, "App.tsx"),
      [
        'import { HomeScreen } from "@app/screens/HomeScreen";',
        "",
        "export default function App() {",
        "  return <HomeScreen />;",
        "}",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(repoDir, "index.js"),
      "import { registerRootComponent } from 'expo';\nregisterRootComponent(App);\n",
    );
    writeFileSync(
      join(repoDir, "src", "screens", "HomeScreen.tsx"),
      [
        'import { brandConfig } from "@config/brand";',
        'import { tokens } from "@theme/tokens";',
        "",
        "export function HomeScreen() {",
        "  return brandConfig && tokens ? null : null;",
        "}",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(repoDir, "config", "brand.ts"),
      "export const brandConfig = { displayName: 'Fixture App' };\n",
    );
    writeFileSync(
      join(repoDir, "theme", "tokens.ts"),
      "export const tokens = { colors: { background: '#fff' } };\n",
    );

    const result = createConvertResult(repoDir, createConvertManifest(repoDir));
    const tsconfigFile = result.movedFiles.find(
      (file) => file.destinationPath === join(repoDir, "tsconfig.json"),
    );

    expect(tsconfigFile).toBeDefined();
    expect(JSON.parse(asText(tsconfigFile?.contents))).toEqual({
      compilerOptions: {
        baseUrl: ".",
        paths: {
          "@app/*": ["src/rn-mt/current/src/*"],
          "@config/*": ["src/rn-mt/current/config/*"],
          "@theme/*": ["src/rn-mt/current/theme/*"],
        },
      },
    });
  });

  it("converts common root source directories and retargets their aliases to current", () => {
    const repoDir = createTempRepo("rn-mt-core-convert-root-source-dirs-");

    mkdirSync(join(repoDir, "components"), { recursive: true });
    mkdirSync(join(repoDir, "hooks"), { recursive: true });
    mkdirSync(join(repoDir, "navigators"), { recursive: true });
    mkdirSync(join(repoDir, "screens"), { recursive: true });
    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "fixture-app",
        dependencies: { expo: "~52.0.0" },
      }),
    );
    writeFileSync(
      join(repoDir, "app.json"),
      JSON.stringify({ expo: { name: "FixtureApp" } }),
    );
    writeFileSync(
      join(repoDir, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            baseUrl: ".",
            paths: {
              "@components/*": ["components/*"],
              "@hooks/*": ["hooks/*"],
              "@navigators/*": ["navigators/*"],
              "@screens/*": ["screens/*"],
            },
          },
        },
        null,
        2,
      ),
    );
    writeFileSync(
      join(repoDir, "App.tsx"),
      [
        'import RootNavigator from "@navigators/RootNavigator";',
        "",
        "export default function App() {",
        "  return <RootNavigator />;",
        "}",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(repoDir, "navigators", "RootNavigator.tsx"),
      [
        'import { useBrandTheme } from "@hooks/useBrandTheme";',
        'import { HomeScreen } from "@screens/HomeScreen";',
        "",
        "export default function RootNavigator() {",
        "  return useBrandTheme() ? <HomeScreen /> : <HomeScreen />;",
        "}",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(repoDir, "hooks", "useBrandTheme.ts"),
      [
        'import { BrandBanner } from "@components/BrandBanner";',
        "",
        "export function useBrandTheme() {",
        "  return Boolean(BrandBanner);",
        "}",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(repoDir, "components", "BrandBanner.tsx"),
      "export function BrandBanner() { return null; }\n",
    );
    writeFileSync(
      join(repoDir, "screens", "HomeScreen.tsx"),
      "export function HomeScreen() { return null; }\n",
    );

    const result = createConvertResult(repoDir, createConvertManifest(repoDir));
    const tsconfigFile = result.movedFiles.find(
      (file) => file.destinationPath === join(repoDir, "tsconfig.json"),
    );
    const appSharedFile = result.movedFiles.find(
      (file) =>
        file.destinationPath === join(repoDir, "src", "rn-mt", "shared", "App.tsx"),
    );

    expect(result.movedFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          destinationPath: join(
            repoDir,
            "src",
            "rn-mt",
            "shared",
            "components",
            "BrandBanner.tsx",
          ),
        }),
        expect.objectContaining({
          destinationPath: join(
            repoDir,
            "src",
            "rn-mt",
            "shared",
            "hooks",
            "useBrandTheme.ts",
          ),
        }),
        expect.objectContaining({
          destinationPath: join(
            repoDir,
            "src",
            "rn-mt",
            "shared",
            "navigators",
            "RootNavigator.tsx",
          ),
        }),
        expect.objectContaining({
          destinationPath: join(
            repoDir,
            "src",
            "rn-mt",
            "shared",
            "screens",
            "HomeScreen.tsx",
          ),
        }),
      ]),
    );
    expect(appSharedFile?.contents).toContain(
      'import RootNavigator from "@navigators/RootNavigator";',
    );
    expect(appSharedFile?.contents).not.toContain(
      'import RootNavigator from "../current/navigators/RootNavigator";',
    );
    expect(JSON.parse(asText(tsconfigFile?.contents))).toEqual({
      compilerOptions: {
        baseUrl: ".",
        paths: {
          "@components/*": ["src/rn-mt/current/components/*"],
          "@hooks/*": ["src/rn-mt/current/hooks/*"],
          "@navigators/*": ["src/rn-mt/current/navigators/*"],
          "@screens/*": ["src/rn-mt/current/screens/*"],
        },
      },
    });
  });

  it("rewrites broad root aliases inside moved shared files when the root alias target stays mixed", () => {
    const repoDir = createTempRepo("rn-mt-core-convert-root-alias-rewrite-");

    mkdirSync(join(repoDir, "components"), { recursive: true });
    mkdirSync(join(repoDir, "services"), { recursive: true });
    mkdirSync(join(repoDir, "types"), { recursive: true });
    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "fixture-app",
        dependencies: { expo: "~52.0.0" },
      }),
    );
    writeFileSync(
      join(repoDir, "app.json"),
      JSON.stringify({ expo: { name: "FixtureApp" } }),
    );
    writeFileSync(
      join(repoDir, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            baseUrl: ".",
            paths: {
              "@/*": ["./*"],
            },
          },
        },
        null,
        2,
      ),
    );
    writeFileSync(
      join(repoDir, "App.tsx"),
      [
        'import { BrandBanner } from "@/components/BrandBanner";',
        'import { logger } from "@/services/logger";',
        'import type { IconProps } from "@/types/icon";',
        "",
        "const loadLogger = () => import(\"@/services/logger\");",
        "",
        "export default function App() {",
        "  return BrandBanner && logger && loadLogger && (null as IconProps | null);",
        "}",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(repoDir, "components", "BrandBanner.tsx"),
      "export function BrandBanner() { return null; }\n",
    );
    writeFileSync(
      join(repoDir, "services", "logger.ts"),
      "export const logger = true;\n",
    );
    writeFileSync(
      join(repoDir, "types", "icon.d.ts"),
      "export type IconProps = { size?: number };\n",
    );

    const result = createConvertResult(repoDir, createConvertManifest(repoDir));
    const appSharedFile = result.movedFiles.find(
      (file) =>
        file.destinationPath === join(repoDir, "src", "rn-mt", "shared", "App.tsx"),
    );
    const tsconfigFile = result.movedFiles.find(
      (file) => file.destinationPath === join(repoDir, "tsconfig.json"),
    );

    expect(appSharedFile?.contents).toContain(
      'import { BrandBanner } from "@/src/rn-mt/current/components/BrandBanner";',
    );
    expect(appSharedFile?.contents).toContain(
      'import { logger } from "@/src/rn-mt/current/services/logger";',
    );
    expect(appSharedFile?.contents).toContain(
      'import type { IconProps } from "@/src/rn-mt/current/types/icon";',
    );
    expect(appSharedFile?.contents).toContain(
      'import("@/src/rn-mt/current/services/logger")',
    );
    expect(tsconfigFile).toBeUndefined();
  });

  it("removes TypeScript modules under assets paths while preserving binary assets", () => {
    const repoDir = createTempRepo("rn-mt-core-convert-assets-modules-");

    mkdirSync(join(repoDir, "assets", "icons"), { recursive: true });
    mkdirSync(join(repoDir, "assets", "images"), { recursive: true });
    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "fixture-app",
        dependencies: { expo: "~52.0.0" },
      }),
    );
    writeFileSync(
      join(repoDir, "app.json"),
      JSON.stringify({ expo: { name: "FixtureApp" } }),
    );
    writeFileSync(
      join(repoDir, "App.tsx"),
      "export default function App() { return null; }\n",
    );
    writeFileSync(
      join(repoDir, "assets", "icons", "BrandIcon.tsx"),
      "export function BrandIcon() { return null; }\n",
    );
    writeFileSync(
      join(repoDir, "assets", "images", "icon.png"),
      Buffer.from([0, 1, 2, 3]),
    );

    const result = createConvertResult(repoDir, createConvertManifest(repoDir));
    const iconModule = result.movedFiles.find(
      (file) =>
        file.sourcePath === join(repoDir, "assets", "icons", "BrandIcon.tsx"),
    );
    const binaryAsset = result.movedFiles.find(
      (file) =>
        file.sourcePath === join(repoDir, "assets", "images", "icon.png"),
    );

    expect(iconModule?.removeSourcePath).toBe(true);
    expect(binaryAsset?.removeSourcePath).toBe(false);
  });

  it("converts convex source trees so root aliases can resolve through current", () => {
    const repoDir = createTempRepo("rn-mt-core-convert-convex-");

    mkdirSync(join(repoDir, "convex"), { recursive: true });
    mkdirSync(join(repoDir, "services"), { recursive: true });
    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "fixture-app",
        dependencies: { expo: "~52.0.0" },
      }),
    );
    writeFileSync(
      join(repoDir, "app.json"),
      JSON.stringify({ expo: { name: "FixtureApp" } }),
    );
    writeFileSync(
      join(repoDir, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            baseUrl: ".",
            paths: {
              "@/*": ["./*"],
            },
          },
        },
        null,
        2,
      ),
    );
    writeFileSync(
      join(repoDir, "App.tsx"),
      [
        'import { agentQuery } from "@/convex/agentQuery";',
        "",
        "export default function App() {",
        "  return agentQuery ? null : null;",
        "}",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(repoDir, "convex", "agentQuery.ts"),
      [
        'import { logger } from "@/services/logger";',
        "",
        "export const agentQuery = logger;",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(repoDir, "services", "logger.ts"),
      "export const logger = true;\n",
    );

    const result = createConvertResult(repoDir, createConvertManifest(repoDir));
    const movedConvexFile = result.movedFiles.find(
      (file) =>
        file.destinationPath ===
        join(repoDir, "src", "rn-mt", "shared", "convex", "agentQuery.ts"),
    );

    expect(movedConvexFile).toBeDefined();
    expect(movedConvexFile?.contents).toContain(
      'import { logger } from "@/src/rn-mt/current/services/logger";',
    );
  });

  it("rewrites Babel module-resolver aliases when tsconfig paths are absent", () => {
    const repoDir = createTempRepo("rn-mt-core-convert-babel-aliases-");

    mkdirSync(join(repoDir, "src", "api", "queries"), { recursive: true });
    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "fixture-app",
        dependencies: { expo: "~52.0.0" },
      }),
    );
    writeFileSync(
      join(repoDir, "app.json"),
      JSON.stringify({ expo: { name: "FixtureApp" } }),
    );
    writeFileSync(
      join(repoDir, "babel.config.js"),
      [
        "module.exports = function (api) {",
        "  api.cache(true);",
        "  return {",
        "    plugins: [[\"module-resolver\", {",
        "      alias: {",
        '        "@api": "./src/api",',
        '        "@apiConfig": "./apiConfig.ts",',
        "      },",
        "    }]],",
        "  };",
        "};",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(repoDir, "App.tsx"),
      [
        'import { useProfileQuery } from "@api/queries/userQueries";',
        'import { client } from "@apiConfig";',
        "",
        "export default function App() {",
        "  return useProfileQuery && client ? null : null;",
        "}",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(repoDir, "apiConfig.ts"),
      "export const client = { get() {} };\n",
    );
    writeFileSync(
      join(repoDir, "src", "api", "queries", "userQueries.ts"),
      "export function useProfileQuery() { return true; }\n",
    );

    const result = createConvertResult(repoDir, createConvertManifest(repoDir));
    const appSharedFile = result.movedFiles.find(
      (file) =>
        file.destinationPath === join(repoDir, "src", "rn-mt", "shared", "App.tsx"),
    );

    expect(appSharedFile?.contents).toContain(
      'import { useProfileQuery } from "../current/src/api/queries/userQueries";',
    );
    expect(appSharedFile?.contents).toContain(
      'import { client } from "../current/apiConfig";',
    );
  });

  it("ignores hidden OS metadata files during convert planning", () => {
    const repoDir = createTempRepo("rn-mt-core-convert-hidden-files-");

    mkdirSync(join(repoDir, "src", "config"), { recursive: true });
    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "fixture-app",
        dependencies: { expo: "~52.0.0" },
      }),
    );
    writeFileSync(
      join(repoDir, "app.json"),
      JSON.stringify({ expo: { name: "FixtureApp" } }),
    );
    writeFileSync(
      join(repoDir, "App.tsx"),
      "export default function App() { return null; }\n",
    );
    writeFileSync(join(repoDir, ".DS_Store"), "root-metadata");
    writeFileSync(join(repoDir, "src", "config", ".DS_Store"), "nested-metadata");
    writeFileSync(
      join(repoDir, "src", "config", "index.ts"),
      "export const config = { brand: 'fixture' };\n",
    );

    const result = createConvertResult(repoDir, createConvertManifest(repoDir));

    expect(
      result.movedFiles.some(
        (file) =>
          file.sourcePath.endsWith(".DS_Store") ||
          file.destinationPath.endsWith(".DS_Store"),
      ),
    ).toBe(false);
    expect(
      result.generatedFiles.some((file) => file.path.endsWith(".DS_Store")),
    ).toBe(false);
  });

  it("rewrites exact tsconfig aliases to current facade paths inside moved sources", () => {
    const repoDir = createTempRepo("rn-mt-core-convert-exact-aliases-");

    mkdirSync(join(repoDir, "src", "navigators"), { recursive: true });
    mkdirSync(join(repoDir, "src", "types"), { recursive: true });
    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "fixture-app",
        dependencies: { expo: "~52.0.0" },
      }),
    );
    writeFileSync(
      join(repoDir, "app.json"),
      JSON.stringify({ expo: { name: "FixtureApp" } }),
    );
    writeFileSync(
      join(repoDir, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            baseUrl: ".",
            paths: {
              "@navigatorTypes": ["./src/types/navigatorTypes.ts"],
            },
          },
        },
        null,
        2,
      ),
    );
    writeFileSync(
      join(repoDir, "App.tsx"),
      [
        'import { RootNavigator } from "./src/navigators/RootNavigator";',
        "",
        "export default function App() {",
        "  return RootNavigator ? null : null;",
        "}",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(repoDir, "src", "types", "navigatorTypes.ts"),
      "export type RootStackParamList = { Home: undefined };\n",
    );
    writeFileSync(
      join(repoDir, "src", "navigators", "RootNavigator.tsx"),
      [
        'import type { RootStackParamList } from "@navigatorTypes";',
        "",
        "export const RootNavigator = {} as RootStackParamList;",
        "",
      ].join("\n"),
    );

    const result = createConvertResult(repoDir, createConvertManifest(repoDir));
    const navigatorSharedFile = result.movedFiles.find(
      (file) =>
        file.destinationPath ===
        join(
          repoDir,
          "src",
          "rn-mt",
          "shared",
          "src",
          "navigators",
          "RootNavigator.tsx",
        ),
    );

    expect(navigatorSharedFile?.contents).toContain(
      'import type { RootStackParamList } from "@navigatorTypes";',
    );
  });

  it("rewrites root src absolute imports inside moved nested files", () => {
    const repoDir = createTempRepo("rn-mt-core-convert-root-src-imports-");

    mkdirSync(join(repoDir, "src", "api", "queries"), { recursive: true });
    mkdirSync(join(repoDir, "src", "types"), { recursive: true });
    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "fixture-app",
        dependencies: { expo: "~52.0.0" },
      }),
    );
    writeFileSync(
      join(repoDir, "app.json"),
      JSON.stringify({ expo: { name: "FixtureApp" } }),
    );
    writeFileSync(
      join(repoDir, "App.tsx"),
      [
        'import { useSubjectQuery } from "./src/api/queries/subjectQueries";',
        "",
        "export default function App() {",
        "  return useSubjectQuery ? null : null;",
        "}",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(repoDir, "src", "types", "subjectTypes.ts"),
      "export interface SubjectResponse { id: string; }\n",
    );
    writeFileSync(
      join(repoDir, "src", "api", "queries", "subjectQueries.ts"),
      [
        'import type { SubjectResponse } from "src/types/subjectTypes";',
        "",
        "export function useSubjectQuery(): SubjectResponse | null {",
        "  return null;",
        "}",
        "",
      ].join("\n"),
    );

    const result = createConvertResult(repoDir, createConvertManifest(repoDir));
    const querySharedFile = result.movedFiles.find(
      (file) =>
        file.destinationPath ===
        join(
          repoDir,
          "src",
          "rn-mt",
          "shared",
          "src",
          "api",
          "queries",
          "subjectQueries.ts",
        ),
    );

    expect(querySharedFile?.contents).toContain(
      'import type { SubjectResponse } from "../../../../current/src/types/subjectTypes";',
    );
  });

  it("preserves binary asset bytes when convert moves assets into shared and current", () => {
    const repoDir = createTempRepo("rn-mt-core-convert-binary-assets-");
    const iconBytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 255, 12]);

    mkdirSync(join(repoDir, "assets"), { recursive: true });
    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "fixture-app",
        dependencies: { expo: "~52.0.0" },
      }),
    );
    writeFileSync(
      join(repoDir, "app.json"),
      JSON.stringify({ expo: { name: "FixtureApp", icon: "./assets/icon.png" } }),
    );
    writeFileSync(
      join(repoDir, "App.tsx"),
      "export default function App() { return null; }\n",
    );
    writeFileSync(join(repoDir, "assets", "icon.png"), iconBytes);

    const result = createConvertResult(repoDir, createConvertManifest(repoDir));
    const movedIconFile = result.movedFiles.find(
      (file) =>
        file.destinationPath ===
        join(repoDir, "src", "rn-mt", "shared", "assets", "icon.png"),
    );
    const currentIconFile = result.generatedFiles.find(
      (file) =>
        file.path ===
        join(repoDir, "src", "rn-mt", "current", "assets", "icon.png"),
    );

    expect(Buffer.isBuffer(movedIconFile?.contents)).toBe(true);
    expect(Buffer.isBuffer(currentIconFile?.contents)).toBe(true);
    expect(movedIconFile?.contents).toEqual(iconBytes);
    expect(currentIconFile?.contents).toEqual(iconBytes);
  });

  it("persists reconstruction metadata for moved sources, current facades, and root-wrapper behavior", () => {
    const repoDir = createTempRepo("rn-mt-core-convert-reconstruction-");

    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "fixture-app",
        dependencies: { expo: "~52.0.0" },
      }),
    );
    writeFileSync(join(repoDir, "README.md"), "# Fixture App\n");
    writeFileSync(
      join(repoDir, "app.json"),
      JSON.stringify({ expo: { name: "FixtureApp" } }),
    );
    writeFileSync(
      join(repoDir, "App.tsx"),
      [
        'import theme from "./theme";',
        'import config from "./src/config";',
        "",
        "export default function App() {",
        "  return null;",
        "}",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(repoDir, "index.js"),
      "import { registerRootComponent } from 'expo';\nregisterRootComponent(App);\n",
    );
    mkdirSync(join(repoDir, "theme"), { recursive: true });
    mkdirSync(join(repoDir, "assets"), { recursive: true });
    mkdirSync(join(repoDir, "src", "config"), { recursive: true });
    writeFileSync(
      join(repoDir, "theme", "index.ts"),
      [
        'import logo from "../assets/logo.png";',
        "",
        "export default { logo };",
        "",
      ].join("\n"),
    );
    writeFileSync(join(repoDir, "assets", "logo.png"), "binary");
    writeFileSync(
      join(repoDir, "App.test.tsx"),
      [
        'import App from "./App";',
        "",
        "describe('App', () => {",
        "  it('renders', () => {",
        "    expect(App).toBeDefined();",
        "  });",
        "});",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(repoDir, "src", "config", "index.ts"),
      "export default { apiBaseUrl: 'https://example.com' };\n",
    );

    const result = createConvertResult(repoDir, createConvertManifest(repoDir));
    const reconstructionMetadata = result.generatedFiles.find(
      (file) => file.kind === "reconstruction-metadata",
    );

    expect(reconstructionMetadata).toBeDefined();
    expect(reconstructionMetadata?.path).toBe(
      join(repoDir, "rn-mt.generated.reconstruction.json"),
    );
    expect(JSON.parse(asText(reconstructionMetadata?.contents))).toEqual({
      schemaVersion: 1,
      tool: "rn-mt",
      defaultTenant: "acme",
      sharedRootPath: "src/rn-mt/shared",
      currentRootPath: "src/rn-mt/current",
      entries: [
        {
          originalPath: "App.test.tsx",
          sharedPath: "src/rn-mt/shared/App.test.tsx",
          originalPathBehavior: "removed",
        },
        {
          originalPath: "App.tsx",
          sharedPath: "src/rn-mt/shared/App.tsx",
          currentPath: "src/rn-mt/current/App.tsx",
          originalPathBehavior: "replaced-with-root-wrapper",
        },
        {
          originalPath: "assets/logo.png",
          sharedPath: "src/rn-mt/shared/assets/logo.png",
          currentPath: "src/rn-mt/current/assets/logo.png",
          originalPathBehavior: "preserved",
        },
        {
          originalPath: "index.js",
          sharedPath: "src/rn-mt/shared/index.js",
          currentPath: "src/rn-mt/current/index.js",
          originalPathBehavior: "replaced-with-root-wrapper",
        },
        {
          originalPath: "src/config/index.ts",
          sharedPath: "src/rn-mt/shared/src/config/index.ts",
          currentPath: "src/rn-mt/current/src/config/index.ts",
          originalPathBehavior: "removed",
        },
        {
          originalPath: "theme/index.ts",
          sharedPath: "src/rn-mt/shared/theme/index.ts",
          currentPath: "src/rn-mt/current/theme/index.ts",
          originalPathBehavior: "removed",
        },
      ],
    });
  });

  it("rewrites package scripts to keep familiar entries while adding rn-mt helpers", () => {
    const repoDir = createTempRepo("rn-mt-core-convert-scripts-");

    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "fixture-app",
        packageManager: "pnpm@10.25.0",
        scripts: {
          start: "expo start --clear",
          android: "expo run:android --variant preview",
          ios: "expo run:ios --configuration Debug",
          test: "vitest",
        },
        dependencies: {
          expo: "~52.0.0",
          react: "19.0.0",
        },
        devDependencies: {
          typescript: "^5.7.2",
        },
      }),
    );
    writeFileSync(
      join(repoDir, "app.json"),
      JSON.stringify({ expo: { name: "FixtureApp" } }),
    );
    writeFileSync(
      join(repoDir, "App.tsx"),
      "export default function App() { return null; }\n",
    );

    const result = createConvertResult(repoDir, createConvertManifest(repoDir));
    const packageJsonFile = result.movedFiles.find(
      (file) => file.sourcePath === join(repoDir, "package.json"),
    );

    expect(packageJsonFile?.destinationPath).toBe(
      join(repoDir, "package.json"),
    );
    expect(packageJsonFile?.contents).toContain(
      '"start": "rn-mt run -- expo start --clear"',
    );
    expect(packageJsonFile?.contents).toContain(
      '"android": "rn-mt run --platform android -- expo run:android --variant preview"',
    );
    expect(packageJsonFile?.contents).toContain(
      '"ios": "rn-mt run --platform ios -- expo run:ios --configuration Debug"',
    );
    expect(packageJsonFile?.contents).toContain('"rn-mt:sync": "rn-mt sync"');
    expect(packageJsonFile?.contents).toContain(
      '"rn-mt:sync:android": "rn-mt sync --platform android"',
    );
    expect(packageJsonFile?.contents).toContain(
      '"rn-mt:sync:ios": "rn-mt sync --platform ios"',
    );
    expect(packageJsonFile?.contents).toContain(
      '"rn-mt:start": "rn-mt run -- expo start --clear"',
    );
    expect(packageJsonFile?.contents).toContain(
      '"rn-mt:android": "rn-mt run --platform android -- expo run:android --variant preview"',
    );
    expect(packageJsonFile?.contents).toContain(
      '"rn-mt:ios": "rn-mt run --platform ios -- expo run:ios --configuration Debug"',
    );
    expect(packageJsonFile?.contents).toContain(
      '"prestart": "rn-mt hook prestart"',
    );
    expect(packageJsonFile?.contents).toContain(
      '"preandroid": "rn-mt hook preandroid"',
    );
    expect(packageJsonFile?.contents).toContain(
      '"preios": "rn-mt hook preios"',
    );
    expect(packageJsonFile?.contents).toContain(
      '"postinstall": "rn-mt hook postinstall"',
    );
    expect(packageJsonFile?.contents).toContain('"@molaidrislabs/runtime": "0.1.0"');
    expect(packageJsonFile?.contents).toContain(
      '"@molaidrislabs/expo-plugin": "0.1.0"',
    );
    expect(packageJsonFile?.contents).toContain('"@molaidrislabs/cli": "0.1.0"');
    expect(packageJsonFile?.contents).toContain('"test": "vitest"');
    expect(result.packageManager).toEqual({
      name: "pnpm",
      source: "packageManager-field",
      raw: "pnpm@10.25.0",
    });
    expect(result.localPackages).toEqual([
      {
        name: "@molaidrislabs/runtime",
        version: "0.1.0",
        section: "dependencies",
      },
      {
        name: "@molaidrislabs/cli",
        version: "0.1.0",
        section: "devDependencies",
      },
      {
        name: "@molaidrislabs/expo-plugin",
        version: "0.1.0",
        section: "dependencies",
      },
    ]);
    expect(result.installCommand).toBe("pnpm install");
  });

  it("adds a stable rn-mt guide link to an existing repo README", () => {
    const repoDir = createTempRepo("rn-mt-core-convert-readme-link-");

    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "fixture-app",
        dependencies: {
          expo: "~52.0.0",
        },
      }),
    );
    writeFileSync(
      join(repoDir, "README.md"),
      "# Fixture App\n\nExisting repo notes.\n",
    );
    writeFileSync(
      join(repoDir, "app.json"),
      JSON.stringify({ expo: { name: "FixtureApp" } }),
    );
    writeFileSync(
      join(repoDir, "App.tsx"),
      "export default function App() { return null; }\n",
    );

    const result = createConvertResult(repoDir, createConvertManifest(repoDir));
    const readmeFile = result.movedFiles.find(
      (file) => file.sourcePath === join(repoDir, "README.md"),
    );

    expect(readmeFile?.destinationPath).toBe(join(repoDir, "README.md"));
    expect(readmeFile?.contents).toContain("<!-- rn-mt:guide-link:start -->");
    expect(readmeFile?.contents).toContain(
      "[rn-mt ownership and handoff guide](./rn-mt.generated.README.md)",
    );
    expect(readmeFile?.contents).toContain("Existing repo notes.");
  });

  it("wires local packages for bare react native repos and derives install guidance from lockfiles", () => {
    const repoDir = createTempRepo("rn-mt-core-convert-bare-packages-");

    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "fixture-app",
        dependencies: {
          "react-native": "0.85.0",
        },
      }),
    );
    writeFileSync(join(repoDir, "yarn.lock"), "# yarn lockfile");
    mkdirSync(join(repoDir, "ios"), { recursive: true });
    mkdirSync(join(repoDir, "android"), { recursive: true });
    writeFileSync(
      join(repoDir, "App.tsx"),
      "export default function App() { return null; }\n",
    );

    const result = createConvertResult(repoDir, createConvertManifest(repoDir));
    const packageJsonFile = result.movedFiles.find(
      (file) => file.sourcePath === join(repoDir, "package.json"),
    );

    expect(packageJsonFile?.contents).toContain('"@molaidrislabs/runtime": "0.1.0"');
    expect(packageJsonFile?.contents).toContain('"@molaidrislabs/cli": "0.1.0"');
    expect(packageJsonFile?.contents).not.toContain("@molaidrislabs/expo-plugin");
    expect(result.packageManager).toEqual({
      name: "yarn",
      source: "yarn-lock",
      raw: "yarn.lock",
    });
    expect(result.localPackages).toEqual([
      {
        name: "@molaidrislabs/runtime",
        version: "0.1.0",
        section: "dependencies",
      },
      {
        name: "@molaidrislabs/cli",
        version: "0.1.0",
        section: "devDependencies",
      },
    ]);
    expect(result.installCommand).toBe("yarn install");
  });

  it("rejects convert when root entry wrappers are already CLI-owned", () => {
    const repoDir = createTempRepo("rn-mt-core-convert-already-applied-");

    writeFileSync(
      join(repoDir, "App.js"),
      [
        "// Generated by rn-mt. CLI-owned wrapper. Do not edit directly.",
        'import App from "./src/rn-mt/current/App";',
        "",
        "export default App;",
        "",
      ].join("\n"),
    );

    expect(() =>
      createConvertResult(repoDir, createConvertManifest(repoDir)),
    ).toThrow(
      "Convert has already been applied to this repo. Root entry wrappers are already CLI-owned.",
    );
  });

  it("moves config, theme, assets, and test modules into shared while preserving subtree shape", () => {
    const repoDir = createTempRepo("rn-mt-core-convert-categories-");

    mkdirSync(join(repoDir, "theme"), { recursive: true });
    mkdirSync(join(repoDir, "assets"), { recursive: true });
    mkdirSync(join(repoDir, "src", "config"), { recursive: true });
    writeFileSync(
      join(repoDir, "App.tsx"),
      [
        'import theme from "./theme";',
        'import config from "./src/config";',
        "",
        "export default function App() {",
        "  return null;",
        "}",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(repoDir, "theme", "index.ts"),
      [
        'import logo from "../assets/logo.png";',
        "",
        "export default { logo };",
        "",
      ].join("\n"),
    );
    writeFileSync(join(repoDir, "assets", "logo.png"), "binary");
    writeFileSync(
      join(repoDir, "App.test.tsx"),
      [
        'import App from "./App";',
        "",
        "describe('App', () => {",
        "  it('renders', () => {",
        "    expect(App).toBeDefined();",
        "  });",
        "});",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(repoDir, "src", "config", "index.ts"),
      "export default { apiBaseUrl: 'https://example.com' };\n",
    );

    const result = createConvertResult(repoDir, createConvertManifest(repoDir));

    expect(result.movedFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourcePath: join(repoDir, "theme", "index.ts"),
          destinationPath: join(
            repoDir,
            "src",
            "rn-mt",
            "shared",
            "theme",
            "index.ts",
          ),
          removeSourcePath: true,
        }),
        expect.objectContaining({
          sourcePath: join(repoDir, "assets", "logo.png"),
          destinationPath: join(
            repoDir,
            "src",
            "rn-mt",
            "shared",
            "assets",
            "logo.png",
          ),
          removeSourcePath: false,
        }),
        expect.objectContaining({
          sourcePath: join(repoDir, "App.test.tsx"),
          destinationPath: join(
            repoDir,
            "src",
            "rn-mt",
            "shared",
            "App.test.tsx",
          ),
          removeSourcePath: true,
        }),
        expect.objectContaining({
          sourcePath: join(repoDir, "src", "config", "index.ts"),
          destinationPath: join(
            repoDir,
            "src",
            "rn-mt",
            "shared",
            "src",
            "config",
            "index.ts",
          ),
          removeSourcePath: true,
        }),
      ]),
    );
  });

  it("generates current facades with tenant-first resolution and shared fallback", () => {
    const repoDir = createTempRepo("rn-mt-core-convert-current-facade-");

    mkdirSync(join(repoDir, "theme"), { recursive: true });
    mkdirSync(join(repoDir, "src", "rn-mt", "tenants", "acme", "theme"), {
      recursive: true,
    });
    writeFileSync(
      join(repoDir, "App.tsx"),
      [
        'import theme from "./theme";',
        "",
        "export default function App() {",
        "  return null;",
        "}",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(repoDir, "theme", "index.ts"),
      "export default { color: 'shared' };\n",
    );
    writeFileSync(
      join(repoDir, "src", "rn-mt", "tenants", "acme", "theme", "index.ts"),
      "export default { color: 'tenant' };\n",
    );

    const result = createConvertResult(repoDir, createConvertManifest(repoDir));
    const appShared = result.movedFiles.find((file) =>
      file.destinationPath.endsWith("/src/rn-mt/shared/App.tsx"),
    );
    const themeCurrent = result.generatedFiles.find((file) =>
      file.path.endsWith("/src/rn-mt/current/theme/index.ts"),
    );
    const appCurrent = result.generatedFiles.find((file) =>
      file.path.endsWith("/src/rn-mt/current/App.tsx"),
    );

    expect(appShared?.contents).toContain(
      'import theme from "../current/theme/index";',
    );
    expect(themeCurrent?.contents).toContain("../../tenants/acme/theme/index");
    expect(appCurrent?.contents).toContain("../shared/App");
  });

  it("creates an optional host config bridge for an explicit config module path", () => {
    const repoDir = createTempRepo("rn-mt-core-convert-bridge-config-");

    mkdirSync(join(repoDir, "src", "config"), { recursive: true });
    writeFileSync(
      join(repoDir, "App.tsx"),
      [
        'import config from "./src/config";',
        "",
        "export default function App() {",
        "  return config ? null : null;",
        "}",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(repoDir, "src", "config", "index.ts"),
      "export default { apiBaseUrl: 'https://example.com' };\n",
    );

    const result = createConvertResult(
      repoDir,
      createConvertManifest(repoDir),
      {
        bridgeConfigModulePath: "src/config/index.ts",
      },
    );
    const bridgeFile = result.generatedFiles.find(
      (file) => file.kind === "host-config-bridge",
    );
    const movedConfigFile = result.movedFiles.find(
      (file) => file.sourcePath === join(repoDir, "src", "config", "index.ts"),
    );

    expect(movedConfigFile).toEqual(
      expect.objectContaining({
        sourcePath: join(repoDir, "src", "config", "index.ts"),
        destinationPath: join(
          repoDir,
          "src",
          "rn-mt",
          "shared",
          "src",
          "config",
          "index.ts",
        ),
        removeSourcePath: false,
      }),
    );
    expect(bridgeFile).toEqual({
      path: join(repoDir, "src", "config", "index.ts"),
      kind: "host-config-bridge",
      contents: [
        "// Generated by rn-mt. CLI-owned host config bridge. Optional bridge mode. Do not edit directly.",
        'export { default } from "../rn-mt/current/src/config/index";',
        'export * from "../rn-mt/current/src/config/index";',
        "",
      ].join("\n"),
    });
    expect(
      JSON.parse(
        asText(
          result.generatedFiles.find(
            (file) => file.kind === "reconstruction-metadata",
          )?.contents,
        ),
      ),
    ).toEqual(
      expect.objectContaining({
        entries: expect.arrayContaining([
          expect.objectContaining({
            originalPath: "src/config/index.ts",
            sharedPath: "src/rn-mt/shared/src/config/index.ts",
            currentPath: "src/rn-mt/current/src/config/index.ts",
            originalPathBehavior: "replaced-with-host-config-bridge",
          }),
        ]),
      }),
    );
  });

  it("rejects bridge mode when the selected module is not a host config module", () => {
    const repoDir = createTempRepo("rn-mt-core-convert-bridge-unsupported-");

    mkdirSync(join(repoDir, "theme"), { recursive: true });
    writeFileSync(
      join(repoDir, "App.tsx"),
      "export default function App() { return null; }\n",
    );
    writeFileSync(
      join(repoDir, "theme", "index.ts"),
      "export default { color: 'blue' };\n",
    );

    expect(() =>
      createConvertResult(repoDir, createConvertManifest(repoDir), {
        bridgeConfigModulePath: "theme/index.ts",
      }),
    ).toThrow("Bridge mode only supports explicit host config modules.");
  });

  it("creates a tenant override by copying a shared file into the mirrored tenant path", () => {
    const repoDir = createTempRepo("rn-mt-core-override-create-");

    mkdirSync(join(repoDir, "src", "rn-mt", "shared", "theme"), {
      recursive: true,
    });
    writeFileSync(
      join(repoDir, "src", "rn-mt", "shared", "theme", "index.ts"),
      "export default { color: 'shared' };\n",
    );

    const result = createOverrideCreateResult(
      repoDir,
      createConvertManifest(repoDir),
      "theme/index.ts",
    );

    expect(result.copiedFile).toEqual({
      sourcePath: join(repoDir, "src", "rn-mt", "shared", "theme", "index.ts"),
      destinationPath: join(
        repoDir,
        "src",
        "rn-mt",
        "tenants",
        "acme",
        "theme",
        "index.ts",
      ),
      contents: "export default { color: 'shared' };\n",
    });
    expect(result.generatedFiles).toEqual([
      {
        path: join(repoDir, "src", "rn-mt", "current", "theme", "index.ts"),
        kind: "current-facade",
        contents: [
          "// Generated by rn-mt. CLI-owned current facade. Do not edit directly.",
          'export { default } from "../../tenants/acme/theme/index";',
          'export * from "../../tenants/acme/theme/index";',
          "",
        ].join("\n"),
      },
    ]);
  });

  it("re-bases relative current imports when a shared file is copied into a tenant override", () => {
    const repoDir = createTempRepo("rn-mt-core-override-create-rebased-");

    mkdirSync(join(repoDir, "src", "rn-mt", "shared", "screens", "Home"), {
      recursive: true,
    });
    mkdirSync(join(repoDir, "src", "rn-mt", "current", "assets"), {
      recursive: true,
    });
    writeFileSync(
      join(repoDir, "src", "rn-mt", "current", "assets", "Theme.tsx"),
      "export const colors = {};\n",
    );
    writeFileSync(
      join(repoDir, "src", "rn-mt", "shared", "screens", "Home", "index.tsx"),
      [
        'import { colors } from "../../../current/assets/Theme";',
        "",
        "export default colors;",
        "",
      ].join("\n"),
    );

    const result = createOverrideCreateResult(
      repoDir,
      createConvertManifest(repoDir),
      "screens/Home/index.tsx",
    );

    expect(result.copiedFile.contents).toBe(
      [
        'import { colors } from "../../../../current/assets/Theme";',
        "",
        "export default colors;",
        "",
      ].join("\n"),
    );
    expect(result.generatedFiles).toEqual([
      {
        path: join(
          repoDir,
          "src",
          "rn-mt",
          "current",
          "screens",
          "Home",
          "index.tsx",
        ),
        kind: "current-facade",
        contents: [
          "// Generated by rn-mt. CLI-owned current facade. Do not edit directly.",
          'export { default } from "../../../tenants/acme/screens/Home/index";',
          'export * from "../../../tenants/acme/screens/Home/index";',
          "",
        ].join("\n"),
      },
    ]);
  });

  it("rejects override create when the mirrored tenant file already exists", () => {
    const repoDir = createTempRepo("rn-mt-core-override-create-existing-");

    mkdirSync(join(repoDir, "src", "rn-mt", "shared", "theme"), {
      recursive: true,
    });
    mkdirSync(join(repoDir, "src", "rn-mt", "tenants", "acme", "theme"), {
      recursive: true,
    });
    writeFileSync(
      join(repoDir, "src", "rn-mt", "shared", "theme", "index.ts"),
      "export default { color: 'shared' };\n",
    );
    writeFileSync(
      join(repoDir, "src", "rn-mt", "tenants", "acme", "theme", "index.ts"),
      "export default { color: 'tenant' };\n",
    );

    expect(() =>
      createOverrideCreateResult(
        repoDir,
        createConvertManifest(repoDir),
        "theme/index.ts",
      ),
    ).toThrow(
      `Tenant override already exists: ${join(repoDir, "src", "rn-mt", "tenants", "acme", "theme", "index.ts")}`,
    );
  });

  it("removes a tenant override and repoints the current facade back to shared", () => {
    const repoDir = createTempRepo("rn-mt-core-override-remove-");

    mkdirSync(join(repoDir, "src", "rn-mt", "shared", "theme"), {
      recursive: true,
    });
    mkdirSync(join(repoDir, "src", "rn-mt", "tenants", "acme", "theme"), {
      recursive: true,
    });
    writeFileSync(
      join(repoDir, "src", "rn-mt", "shared", "theme", "index.ts"),
      "export default { color: 'shared' };\n",
    );
    writeFileSync(
      join(repoDir, "src", "rn-mt", "tenants", "acme", "theme", "index.ts"),
      "export default { color: 'tenant' };\n",
    );

    const result = createOverrideRemoveResult(
      repoDir,
      createConvertManifest(repoDir),
      "theme/index.ts",
    );

    expect(result.removedFilePath).toBe(
      join(repoDir, "src", "rn-mt", "tenants", "acme", "theme", "index.ts"),
    );
    expect(result.generatedFiles).toEqual([
      {
        path: join(repoDir, "src", "rn-mt", "current", "theme", "index.ts"),
        kind: "current-facade",
        contents: [
          "// Generated by rn-mt. CLI-owned current facade. Do not edit directly.",
          'export { default } from "../../shared/theme/index";',
          'export * from "../../shared/theme/index";',
          "",
        ].join("\n"),
      },
    ]);
  });

  it("rejects override remove when the tenant override does not exist", () => {
    const repoDir = createTempRepo("rn-mt-core-override-remove-missing-");

    mkdirSync(join(repoDir, "src", "rn-mt", "shared", "theme"), {
      recursive: true,
    });
    writeFileSync(
      join(repoDir, "src", "rn-mt", "shared", "theme", "index.ts"),
      "export default { color: 'shared' };\n",
    );

    expect(() =>
      createOverrideRemoveResult(
        repoDir,
        createConvertManifest(repoDir),
        "theme/index.ts",
      ),
    ).toThrow(
      `Tenant override not found: ${join(repoDir, "src", "rn-mt", "tenants", "acme", "theme", "index.ts")}`,
    );
  });
});

describe("audit helpers", () => {
  it("emits an override-candidate finding when a shared file embeds the default tenant branding", () => {
    const repoDir = createTempRepo("rn-mt-core-audit-override-candidate-");

    mkdirSync(join(repoDir, "src", "rn-mt", "shared", "theme"), {
      recursive: true,
    });
    writeFileSync(
      join(repoDir, "src", "rn-mt", "shared", "theme", "branding.ts"),
      [
        "export default {",
        "  tenantId: 'acme',",
        "  displayName: 'Acme',",
        "};",
        "",
      ].join("\n"),
    );

    const result = createAuditResult(repoDir, createConvertManifest(repoDir));

    expect(result.findings).toEqual([
      {
        code: "override-candidate",
        path: join(repoDir, "src", "rn-mt", "shared", "theme", "branding.ts"),
        severity: "P2",
        confidence: "high",
        evidence: [
          'Matched default tenant id "acme" in shared file contents.',
          'Matched default tenant display name "Acme" in shared file contents.',
        ],
        summary:
          "Shared file appears tenant-specific for the current default tenant and likely wants a mirrored tenant override.",
      },
    ]);
  });

  it("ignores test files and non-triggering shared files during override-candidate audit", () => {
    const repoDir = createTempRepo("rn-mt-core-audit-ignored-");

    mkdirSync(join(repoDir, "src", "rn-mt", "shared", "__tests__"), {
      recursive: true,
    });
    mkdirSync(join(repoDir, "src", "rn-mt", "shared", "theme"), {
      recursive: true,
    });
    writeFileSync(
      join(repoDir, "src", "rn-mt", "shared", "__tests__", "branding.test.ts"),
      "describe('Acme branding', () => expect(true).toBe(true));\n",
    );
    writeFileSync(
      join(repoDir, "src", "rn-mt", "shared", "theme", "palette.ts"),
      "export default { color: 'blue' };\n",
    );

    const result = createAuditResult(repoDir, createConvertManifest(repoDir));

    expect(result.findings).toEqual([]);
  });
});

describe("subprocess env helpers", () => {
  it("loads canonical env files with tenant-environment precedence", () => {
    const repoDir = createTempRepo("rn-mt-core-subprocess-env-");

    writeFileSync(
      join(repoDir, ".env.dev"),
      [
        "API_BASE_URL=https://dev.example.com",
        "SHARED_ONLY=shared",
        "OVERRIDE_ME=environment",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(repoDir, ".env.acme.dev"),
      [
        "API_SECRET=tenant-secret",
        "OVERRIDE_ME=tenant",
        "TENANT_ONLY=tenant",
        "",
      ].join("\n"),
    );

    const manifest = parseManifest(
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: repoDir },
        defaults: { tenant: "acme", environment: "dev" },
        envSchema: {
          apiBaseUrl: {
            source: "API_BASE_URL",
            required: true,
          },
          apiSecret: {
            source: "API_SECRET",
            required: true,
            secret: true,
          },
        },
        tenants: {
          acme: { displayName: "Acme" },
        },
        environments: {
          dev: { displayName: "Development" },
        },
      }),
    );

    const result = createSubprocessEnv(repoDir, manifest, manifest.defaults, {
      baseEnv: {
        PATH: "/usr/bin",
      },
    });

    expect(result.loadedFiles).toEqual([
      {
        path: join(repoDir, ".env.dev"),
        scope: "environment",
      },
      {
        path: join(repoDir, ".env.acme.dev"),
        scope: "tenant-environment",
      },
    ]);
    expect(result.env).toMatchObject({
      PATH: "/usr/bin",
      API_BASE_URL: "https://dev.example.com",
      API_SECRET: "tenant-secret",
      SHARED_ONLY: "shared",
      TENANT_ONLY: "tenant",
      OVERRIDE_ME: "tenant",
    });
  });

  it("treats missing canonical env files as optional", () => {
    const repoDir = createTempRepo("rn-mt-core-subprocess-env-optional-");

    writeFileSync(
      join(repoDir, ".env.dev"),
      ["API_BASE_URL=https://dev.example.com", ""].join("\n"),
    );

    const manifest = parseManifest(
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: repoDir },
        defaults: { tenant: "acme", environment: "dev" },
        envSchema: {
          apiBaseUrl: {
            source: "API_BASE_URL",
            required: true,
          },
        },
        tenants: {
          acme: { displayName: "Acme" },
        },
        environments: {
          dev: { displayName: "Development" },
        },
      }),
    );

    const result = createSubprocessEnv(repoDir, manifest);

    expect(result.loadedFiles).toEqual([
      {
        path: join(repoDir, ".env.dev"),
        scope: "environment",
      },
    ]);
    expect(result.env.API_BASE_URL).toBe("https://dev.example.com");
  });
});

describe("sync helpers", () => {
  it("creates a deterministic runtime artifact and ownership metadata", () => {
    const rootDir = "/tmp/demo-app";
    const manifest = parseManifest(
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir },
        defaults: { tenant: "demo-app", environment: "dev" },
        tenants: {
          "demo-app": { displayName: "Demo App" },
        },
        environments: {
          dev: { displayName: "Development" },
        },
      }),
    );

    const result = createSyncResult(rootDir, manifest);

    expect(result.target).toEqual({
      tenant: "demo-app",
      environment: "dev",
    });
    expect(result.resolution).toEqual({
      appliedLayers: ["base", "environment:dev", "tenant:demo-app"],
    });
    expect(result.runtime).toEqual({
      config: {
        identity: {
          displayName: "Demo App (Dev)",
          nativeId: "com.rnmt.demo-app.dev",
        },
        native: {
          android: {
            applicationId: "com.rnmt.demo-app.dev",
          },
          ios: {
            bundleIdentifier: "com.rnmt.demo-app.dev",
          },
        },
      },
      identity: {
        displayName: "Demo App (Dev)",
        nativeId: "com.rnmt.demo-app.dev",
      },
      tenant: {
        id: "demo-app",
        displayName: "Demo App",
      },
      env: {
        id: "dev",
      },
      flags: {},
      assets: {},
      routes: [],
      features: [],
      menus: [],
      actions: [],
    });
    expect(result.generatedFiles).toHaveLength(2);
    expect(result.generatedFiles[0]).toEqual({
      path: join(rootDir, "rn-mt.generated.runtime.json"),
      kind: "runtime-artifact",
      contents: `${JSON.stringify(result.runtime, null, 2)}\n`,
    });
    const ownershipMetadata = result.generatedFiles[1];

    expect(ownershipMetadata).toBeDefined();
    expect(ownershipMetadata?.path).toBe(
      join(rootDir, "rn-mt.generated.ownership.json"),
    );
    expect(ownershipMetadata?.kind).toBe("ownership-metadata");
    expect(JSON.parse(asText(ownershipMetadata?.contents))).toEqual({
      schemaVersion: 1,
      tool: "rn-mt",
      owner: "cli",
      artifacts: [
        expect.objectContaining({
          path: "rn-mt.generated.runtime.json",
          kind: "runtime-artifact",
          hash: expect.any(String),
        }),
      ],
    });
  });

  it("rejects sync when the manifest default target is invalid", () => {
    const manifest = parseManifest(
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: "/tmp/demo-app" },
        defaults: { tenant: "acme", environment: "dev" },
        tenants: {
          "demo-app": { displayName: "Demo App" },
        },
        environments: {
          dev: { displayName: "Development" },
        },
      }),
    );

    expect(() => createSyncResult("/tmp/demo-app", manifest)).toThrow(
      "Unknown tenant: acme",
    );
  });

  it("rejects sync when a required env input is missing", () => {
    const manifest = parseManifest(
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: "/tmp/demo-app" },
        defaults: { tenant: "acme", environment: "staging" },
        envSchema: {
          apiBaseUrl: {
            source: "API_BASE_URL",
            required: true,
          },
        },
        tenants: {
          acme: { displayName: "Acme" },
        },
        environments: {
          staging: { displayName: "Staging" },
        },
      }),
    );

    expect(() =>
      createSyncResult("/tmp/demo-app", manifest, manifest.defaults, {
        env: {},
      }),
    ).toThrow(
      "Missing required env inputs for acme/staging: apiBaseUrl (API_BASE_URL). Set these variables in the command environment before running sync.",
    );
  });

  it("resolves route registry add, replace, and disable operations by stable id", () => {
    const manifest = parseManifest(
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: "/tmp/demo-app" },
        routes: [
          { id: "home", path: "/", screen: "HomeScreen" },
          { id: "settings", path: "/settings", screen: "SettingsScreen" },
        ],
        defaults: { tenant: "acme", environment: "dev" },
        tenants: {
          acme: {
            displayName: "Acme",
            routes: {
              replace: [
                { id: "home", path: "/acme", screen: "AcmeHomeScreen" },
              ],
            },
          },
        },
        environments: {
          dev: {
            displayName: "Development",
            routes: {
              add: [{ id: "debug", path: "/debug", screen: "DebugScreen" }],
            },
          },
        },
        platforms: {
          android: {},
        },
        combinations: {
          "environment:dev+tenant:acme+platform:android": {
            routes: {
              disable: ["settings"],
            },
          },
        },
      }),
    );

    const result = createSyncResult("/tmp/demo-app", manifest, {
      tenant: "acme",
      environment: "dev",
      platform: "android",
    });

    expect(result.runtime.routes).toEqual([
      { id: "home", path: "/acme", screen: "AcmeHomeScreen" },
      { id: "debug", path: "/debug", screen: "DebugScreen" },
    ]);
  });

  it("resolves feature, menu, and action registries with static flag gating", () => {
    const manifest = parseManifest(
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: "/tmp/demo-app" },
        flags: {
          chatEnabled: false,
          paymentsEnabled: true,
        },
        features: [
          { id: "chat", module: "ChatFeature", enabledByFlag: "chatEnabled" },
          {
            id: "payments",
            module: "PaymentsFeature",
            enabledByFlag: "paymentsEnabled",
          },
        ],
        menus: [{ id: "home-menu", label: "Home", actionId: "open-home" }],
        actions: [
          {
            id: "legacy-support",
            label: "Call Support",
            handler: "callSupport",
          },
          { id: "pay", label: "Pay", handler: "startPay" },
        ],
        defaults: { tenant: "acme", environment: "dev" },
        tenants: {
          acme: {
            displayName: "Acme",
            menus: {
              replace: [
                { id: "home-menu", label: "Acme Home", actionId: "open-home" },
              ],
            },
          },
        },
        environments: {
          dev: {
            displayName: "Development",
            features: {
              add: [{ id: "debug-tools", module: "DebugToolsFeature" }],
            },
          },
        },
        platforms: {
          android: {},
        },
        combinations: {
          "environment:dev+tenant:acme+platform:android": {
            actions: {
              disable: ["legacy-support"],
            },
          },
        },
      }),
    );

    const result = createSyncResult("/tmp/demo-app", manifest, {
      tenant: "acme",
      environment: "dev",
      platform: "android",
    });

    expect(result.runtime.features).toEqual([
      {
        id: "payments",
        module: "PaymentsFeature",
        enabledByFlag: "paymentsEnabled",
      },
      { id: "debug-tools", module: "DebugToolsFeature" },
    ]);
    expect(result.runtime.menus).toEqual([
      { id: "home-menu", label: "Acme Home", actionId: "open-home" },
    ]);
    expect(result.runtime.actions).toEqual([
      { id: "pay", label: "Pay", handler: "startPay" },
    ]);
  });

  it("generates deterministic derived iOS icon badge assets with fingerprint tracking", () => {
    const repoDir = createTempRepo("rn-mt-core-derived-assets-");
    const iconPath = join(repoDir, "assets", "icon.png");

    mkdirSync(join(repoDir, "assets"), { recursive: true });
    writeFileSync(iconPath, "icon-v1");

    const manifest = parseManifest(
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: repoDir },
        assets: {
          icon: "assets/icon.png",
        },
        defaults: { tenant: "acme", environment: "dev" },
        tenants: {
          acme: { displayName: "Acme" },
        },
        environments: {
          dev: { displayName: "Development" },
        },
        platforms: {
          ios: {},
        },
      }),
    );

    const result = createSyncResult(repoDir, manifest, {
      tenant: "acme",
      environment: "dev",
      platform: "ios",
    });
    const derivedAsset = result.generatedFiles.find(
      (file) => file.kind === "derived-asset",
    );
    const fingerprintMetadata = result.generatedFiles.find(
      (file) => file.kind === "asset-fingerprint-metadata",
    );

    expect(derivedAsset?.path).toBe(
      join(repoDir, "ios", "rn-mt.generated.icon.dev.svg"),
    );
    expect(derivedAsset?.contents).toContain(">DEV<");
    expect(derivedAsset?.contents).toContain('href="../assets/icon.png"');
    expect(derivedAsset?.contents).toContain("fingerprint:");
    expect(fingerprintMetadata?.contents).toContain(
      "rn-mt.generated.icon.dev.svg",
    );

    writeFileSync(iconPath, "icon-v2");

    const changedResult = createSyncResult(repoDir, manifest, {
      tenant: "acme",
      environment: "dev",
      platform: "ios",
    });
    const changedDerivedAsset = changedResult.generatedFiles.find(
      (file) => file.kind === "derived-asset",
    );

    expect(changedDerivedAsset?.contents).not.toEqual(derivedAsset?.contents);
  });

  it("reuses existing derived asset contents when stored fingerprints still match", () => {
    const repoDir = createTempRepo("rn-mt-core-derived-assets-reuse-");
    const iconPath = join(repoDir, "assets", "icon.png");
    const derivedAssetPath = join(
      repoDir,
      "ios",
      "rn-mt.generated.icon.dev.svg",
    );

    mkdirSync(join(repoDir, "assets"), { recursive: true });
    mkdirSync(join(repoDir, "ios"), { recursive: true });
    writeFileSync(iconPath, "icon-v1");
    writeFileSync(derivedAssetPath, "cached-derived-asset\n");

    const sourceFingerprint = createHash("sha256")
      .update("icon-v1")
      .digest("hex");
    writeFileSync(
      join(repoDir, "rn-mt.generated.asset-fingerprints.json"),
      JSON.stringify(
        {
          schemaVersion: 1,
          tool: "rn-mt",
          derivedAssets: [
            {
              outputPath: "ios/rn-mt.generated.icon.dev.svg",
              platform: "ios",
              environment: "dev",
              sourcePath: "assets/icon.png",
              sourceFingerprint,
            },
          ],
        },
        null,
        2,
      ),
    );

    const manifest = parseManifest(
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: repoDir },
        assets: {
          icon: "assets/icon.png",
        },
        defaults: { tenant: "acme", environment: "dev" },
        tenants: {
          acme: { displayName: "Acme" },
        },
        environments: {
          dev: { displayName: "Development" },
        },
        platforms: {
          ios: {},
        },
      }),
    );

    const result = createSyncResult(repoDir, manifest, {
      tenant: "acme",
      environment: "dev",
      platform: "ios",
    });
    const derivedAsset = result.generatedFiles.find(
      (file) => file.kind === "derived-asset",
    );

    expect(derivedAsset?.contents).toBe("cached-derived-asset\n");
  });

  it("keeps production derived icons unbadged by default", () => {
    const repoDir = createTempRepo("rn-mt-core-derived-assets-production-");
    const iconPath = join(repoDir, "assets", "icon.png");

    mkdirSync(join(repoDir, "assets"), { recursive: true });
    writeFileSync(iconPath, "icon-prod");

    const manifest = parseManifest(
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: repoDir },
        assets: {
          icon: "assets/icon.png",
        },
        defaults: { tenant: "acme", environment: "prod" },
        tenants: {
          acme: { displayName: "Acme" },
        },
        environments: {
          prod: { displayName: "Production" },
        },
        platforms: {
          ios: {},
        },
      }),
    );

    const result = createSyncResult(repoDir, manifest, {
      tenant: "acme",
      environment: "prod",
      platform: "ios",
    });
    const derivedAsset = result.generatedFiles.find(
      (file) => file.kind === "derived-asset",
    );

    expect(derivedAsset?.path).toBe(
      join(repoDir, "ios", "rn-mt.generated.icon.prod.svg"),
    );
    expect(derivedAsset?.contents).toContain('href="../assets/icon.png"');
    expect(derivedAsset?.contents).not.toContain(">PROD<");
    expect(derivedAsset?.contents).not.toContain('fill="#f59e0b"');
  });

  it("emits an Expo target context bridge when Expo computed config files are present", () => {
    const repoDir = createTempRepo("rn-mt-core-expo-bridge-");
    const iconPath = join(repoDir, "assets", "icon.png");

    mkdirSync(join(repoDir, "assets"), { recursive: true });
    writeFileSync(join(repoDir, "app.config.ts"), "export default {};\n");
    writeFileSync(iconPath, "icon-dev");

    const manifest = parseManifest(
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: repoDir },
        config: {
          identity: {
            appName: "Keep Nexus",
            nativeId: "com.keep.nexus",
          },
        },
        assets: {
          icon: "assets/icon.png",
        },
        defaults: { tenant: "acme", environment: "dev" },
        tenants: {
          acme: { displayName: "Acme" },
        },
        environments: {
          dev: { displayName: "Development" },
        },
        platforms: {
          ios: {},
        },
      }),
    );

    const result = createSyncResult(repoDir, manifest, {
      tenant: "acme",
      environment: "dev",
      platform: "ios",
    });
    const expoTargetContext = result.generatedFiles.find(
      (file) => file.kind === "expo-target-context",
    );

    expect(expoTargetContext?.path).toBe(
      join(repoDir, "rn-mt.generated.expo.js"),
    );
    expect(expoTargetContext?.contents).toContain('"tenant": "acme"');
    expect(expoTargetContext?.contents).toContain('"environment": "dev"');
    expect(expoTargetContext?.contents).toContain('"platform": "ios"');
    expect(expoTargetContext?.contents).toContain(
      '"runtimeConfigPath": "./rn-mt.generated.runtime.json"',
    );
    expect(expoTargetContext?.contents).toContain(
      '"iconPath": "./ios/rn-mt.generated.icon.dev.svg"',
    );
  });

  it("emits Android tenant and environment flavor dimensions for bare RN fixtures", () => {
    const repoDir = createTempRepo("rn-mt-core-android-flavors-");

    mkdirSync(join(repoDir, "android", "app"), { recursive: true });
    writeFileSync(
      join(repoDir, "android", "app", "build.gradle"),
      "android {}\n",
    );

    const manifest = parseManifest(
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: repoDir },
        config: {
          identity: {
            appName: "Keep Nexus",
            nativeId: "com.keep.nexus",
          },
        },
        defaults: { tenant: "demo-app", environment: "staging" },
        tenants: {
          "demo-app": { displayName: "Demo App" },
          whiteLabel: { displayName: "White Label" },
        },
        environments: {
          dev: { displayName: "Development" },
          prod: { displayName: "Production" },
          staging: { displayName: "Staging" },
        },
        platforms: {
          android: {},
        },
      }),
    );

    const result = createSyncResult(repoDir, manifest, {
      tenant: "demo-app",
      environment: "staging",
      platform: "android",
    });
    const flavorConfig = result.generatedFiles.find(
      (file) => file.kind === "android-flavor-config",
    );

    expect(flavorConfig?.path).toBe(
      join(repoDir, "android", "app", "rn-mt.generated.flavors.gradle"),
    );
    expect(flavorConfig?.contents).toContain(
      'flavorDimensions "tenant", "environment"',
    );
    expect(flavorConfig?.contents).toContain("demoApp {");
    expect(flavorConfig?.contents).toContain(
      'resValue "string", "RN_MT_TENANT_ID", "demo-app"',
    );
    expect(flavorConfig?.contents).toContain("whiteLabel {");
    expect(flavorConfig?.contents).toContain("dev {");
    expect(flavorConfig?.contents).toContain('applicationIdSuffix ".dev"');
    expect(flavorConfig?.contents).toContain("prod {");
    expect(flavorConfig?.contents).not.toContain('applicationIdSuffix ".prod"');
    expect(flavorConfig?.contents).toContain(
      "// Selected target: demo-app/staging/android",
    );
    expect(flavorConfig?.contents).toContain(
      "// Selected variant: demoAppStaging",
    );
    expect(flavorConfig?.contents).toContain(
      "// Selected applicationId: com.keep.nexus.staging",
    );
  });

  it("emits iOS tenant-environment schemes and xcconfig includes for bare RN fixtures", () => {
    const repoDir = createTempRepo("rn-mt-core-ios-schemes-");

    mkdirSync(join(repoDir, "ios", "KeepNexus.xcodeproj"), { recursive: true });

    const manifest = parseManifest(
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: repoDir },
        config: {
          identity: {
            appName: "Keep Nexus",
            nativeId: "com.keep.nexus",
          },
        },
        defaults: { tenant: "demo-app", environment: "staging" },
        tenants: {
          "demo-app": { displayName: "Demo App" },
        },
        environments: {
          staging: { displayName: "Staging" },
        },
        platforms: {
          ios: {},
        },
      }),
    );

    const result = createSyncResult(repoDir, manifest, {
      tenant: "demo-app",
      environment: "staging",
      platform: "ios",
    });
    const schemeFile = result.generatedFiles.find(
      (file) => file.kind === "ios-scheme",
    );
    const currentXcconfig = result.generatedFiles.find(
      (file) =>
        file.path === join(repoDir, "ios", "rn-mt.generated.current.xcconfig"),
    );
    const targetXcconfig = result.generatedFiles.find(
      (file) =>
        file.path ===
        join(repoDir, "ios", "rn-mt.generated.demo-app-staging.xcconfig"),
    );

    expect(schemeFile?.path).toBe(
      join(
        repoDir,
        "ios",
        "KeepNexus.xcodeproj",
        "xcshareddata",
        "xcschemes",
        "DemoApp-Staging.xcscheme",
      ),
    );
    expect(schemeFile?.contents).toContain(
      "Selected target: demo-app/staging/ios",
    );
    expect(schemeFile?.contents).toContain(
      "xcconfig include: rn-mt.generated.current.xcconfig",
    );
    expect(currentXcconfig?.contents).toContain(
      '#include "rn-mt.generated.demo-app-staging.xcconfig"',
    );
    expect(targetXcconfig?.contents).toContain(
      "PRODUCT_BUNDLE_IDENTIFIER = com.keep.nexus.staging",
    );
    expect(targetXcconfig?.contents).toContain(
      'INFOPLIST_KEY_CFBundleDisplayName = "Keep Nexus (Staging)"',
    );
    expect(targetXcconfig?.contents).toContain(
      'RN_MT_DISPLAY_NAME = "Keep Nexus (Staging)"',
    );
  });

  it("preserves previously tracked platform artifacts when ownership metadata is regenerated", () => {
    const repoDir = createTempRepo("rn-mt-core-sync-ownership-merge-");

    mkdirSync(join(repoDir, "android", "app"), { recursive: true });
    mkdirSync(join(repoDir, "ios", "KeepNexus.xcodeproj"), { recursive: true });
    writeFileSync(join(repoDir, "android", "app", "build.gradle"), "android {}\n");

    const manifest = parseManifest(
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: repoDir },
        config: {
          identity: {
            appName: "Keep Nexus",
            nativeId: "com.keep.nexus",
          },
        },
        defaults: { tenant: "demo-app", environment: "staging" },
        tenants: {
          "demo-app": { displayName: "Demo App" },
        },
        environments: {
          staging: { displayName: "Staging" },
        },
        platforms: {
          ios: {},
          android: {},
        },
      }),
    );

    const iosResult = createSyncResult(repoDir, manifest, {
      tenant: "demo-app",
      environment: "staging",
      platform: "ios",
    });

    for (const file of iosResult.generatedFiles) {
      mkdirSync(dirname(file.path), { recursive: true });
      writeFileSync(file.path, file.contents);
    }

    const androidResult = createSyncResult(repoDir, manifest, {
      tenant: "demo-app",
      environment: "staging",
      platform: "android",
    });
    const ownershipMetadata = androidResult.generatedFiles.find(
      (file) => file.kind === "ownership-metadata",
    );
    const trackedArtifactPaths = JSON.parse(
      asText(ownershipMetadata?.contents),
    ).artifacts.map((artifact: { path: string }) => artifact.path);

    expect(trackedArtifactPaths).toEqual(
      expect.arrayContaining([
        "ios/rn-mt.generated.current.xcconfig",
        "ios/rn-mt.generated.demo-app-staging.xcconfig",
        "android/app/rn-mt.generated.flavors.gradle",
        "android/app/rn-mt.generated.identity.gradle",
      ]),
    );
  });

  it("materializes derived development identity across bare RN Android and iOS outputs", () => {
    const repoDir = createTempRepo("rn-mt-core-native-identity-dev-");

    mkdirSync(join(repoDir, "android", "app"), { recursive: true });
    mkdirSync(join(repoDir, "ios", "KeepNexus.xcodeproj"), { recursive: true });
    writeFileSync(
      join(repoDir, "android", "app", "build.gradle"),
      "android {}\n",
    );

    const manifest = parseManifest(
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: repoDir },
        config: {
          identity: {
            appName: "Keep Nexus",
            nativeId: "com.keep.nexus",
          },
        },
        defaults: { tenant: "demo-app", environment: "dev" },
        tenants: {
          "demo-app": { displayName: "Demo App" },
        },
        environments: {
          dev: { displayName: "Development" },
        },
        platforms: {
          android: {},
          ios: {},
        },
      }),
    );

    const androidResult = createSyncResult(repoDir, manifest, {
      tenant: "demo-app",
      environment: "dev",
      platform: "android",
    });
    const iosResult = createSyncResult(repoDir, manifest, {
      tenant: "demo-app",
      environment: "dev",
      platform: "ios",
    });
    const androidIdentity = androidResult.generatedFiles.find(
      (file) => file.kind === "android-native-identity",
    );
    const iosXcconfig = iosResult.generatedFiles.find(
      (file) =>
        file.path ===
        join(repoDir, "ios", "rn-mt.generated.demo-app-dev.xcconfig"),
    );

    expect(androidIdentity?.contents).toContain(
      'applicationId "com.keep.nexus.dev"',
    );
    expect(androidIdentity?.contents).toContain(
      'resValue "string", "app_name", "Keep Nexus (Dev)"',
    );
    expect(iosXcconfig?.contents).toContain(
      "PRODUCT_BUNDLE_IDENTIFIER = com.keep.nexus.dev",
    );
    expect(iosXcconfig?.contents).toContain(
      'INFOPLIST_KEY_CFBundleDisplayName = "Keep Nexus (Dev)"',
    );
  });

  it("materializes derived staging identity across bare RN Android and iOS outputs", () => {
    const repoDir = createTempRepo("rn-mt-core-native-identity-staging-");

    mkdirSync(join(repoDir, "android", "app"), { recursive: true });
    mkdirSync(join(repoDir, "ios", "KeepNexus.xcodeproj"), { recursive: true });
    writeFileSync(
      join(repoDir, "android", "app", "build.gradle"),
      "android {}\n",
    );

    const manifest = parseManifest(
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: repoDir },
        config: {
          identity: {
            appName: "Keep Nexus",
            nativeId: "com.keep.nexus",
          },
        },
        defaults: { tenant: "demo-app", environment: "staging" },
        tenants: {
          "demo-app": { displayName: "Demo App" },
        },
        environments: {
          staging: { displayName: "Staging" },
        },
        platforms: {
          android: {},
          ios: {},
        },
      }),
    );

    const androidResult = createSyncResult(repoDir, manifest, {
      tenant: "demo-app",
      environment: "staging",
      platform: "android",
    });
    const iosResult = createSyncResult(repoDir, manifest, {
      tenant: "demo-app",
      environment: "staging",
      platform: "ios",
    });
    const androidIdentity = androidResult.generatedFiles.find(
      (file) => file.kind === "android-native-identity",
    );
    const iosXcconfig = iosResult.generatedFiles.find(
      (file) =>
        file.path ===
        join(repoDir, "ios", "rn-mt.generated.demo-app-staging.xcconfig"),
    );

    expect(androidIdentity?.contents).toContain(
      'applicationId "com.keep.nexus.staging"',
    );
    expect(androidIdentity?.contents).toContain(
      'resValue "string", "app_name", "Keep Nexus (Staging)"',
    );
    expect(iosXcconfig?.contents).toContain(
      "PRODUCT_BUNDLE_IDENTIFIER = com.keep.nexus.staging",
    );
    expect(iosXcconfig?.contents).toContain(
      'INFOPLIST_KEY_CFBundleDisplayName = "Keep Nexus (Staging)"',
    );
  });

  it("materializes production identity across bare RN Android and iOS outputs without suffixes", () => {
    const repoDir = createTempRepo("rn-mt-core-native-identity-prod-");

    mkdirSync(join(repoDir, "android", "app"), { recursive: true });
    mkdirSync(join(repoDir, "ios", "KeepNexus.xcodeproj"), { recursive: true });
    writeFileSync(
      join(repoDir, "android", "app", "build.gradle"),
      "android {}\n",
    );

    const manifest = parseManifest(
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: repoDir },
        config: {
          identity: {
            appName: "Keep Nexus",
            nativeId: "com.keep.nexus",
          },
        },
        defaults: { tenant: "demo-app", environment: "prod" },
        tenants: {
          "demo-app": { displayName: "Demo App" },
        },
        environments: {
          prod: { displayName: "Production" },
        },
        platforms: {
          android: {},
          ios: {},
        },
      }),
    );

    const androidResult = createSyncResult(repoDir, manifest, {
      tenant: "demo-app",
      environment: "prod",
      platform: "android",
    });
    const iosResult = createSyncResult(repoDir, manifest, {
      tenant: "demo-app",
      environment: "prod",
      platform: "ios",
    });
    const androidIdentity = androidResult.generatedFiles.find(
      (file) => file.kind === "android-native-identity",
    );
    const iosXcconfig = iosResult.generatedFiles.find(
      (file) =>
        file.path ===
        join(repoDir, "ios", "rn-mt.generated.demo-app-prod.xcconfig"),
    );

    expect(androidIdentity?.contents).toContain(
      'applicationId "com.keep.nexus"',
    );
    expect(androidIdentity?.contents).toContain(
      'resValue "string", "app_name", "Keep Nexus"',
    );
    expect(iosXcconfig?.contents).toContain(
      "PRODUCT_BUNDLE_IDENTIFIER = com.keep.nexus",
    );
    expect(iosXcconfig?.contents).toContain(
      'INFOPLIST_KEY_CFBundleDisplayName = "Keep Nexus"',
    );
  });

  it("respects explicit native platform identifier overrides over derived defaults", () => {
    const repoDir = createTempRepo("rn-mt-core-native-identity-overrides-");

    mkdirSync(join(repoDir, "android", "app"), { recursive: true });
    mkdirSync(join(repoDir, "ios", "KeepNexus.xcodeproj"), { recursive: true });
    writeFileSync(
      join(repoDir, "android", "app", "build.gradle"),
      "android {}\n",
    );

    const manifest = parseManifest(
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: repoDir },
        config: {
          identity: {
            appName: "Keep Nexus",
            nativeId: "com.keep.nexus",
          },
        },
        defaults: { tenant: "demo-app", environment: "staging" },
        tenants: {
          "demo-app": {
            displayName: "Demo App",
            config: {
              native: {
                android: {
                  applicationId: "com.demo.android.staging",
                },
                ios: {
                  bundleIdentifier: "com.demo.ios.staging",
                },
              },
            },
          },
        },
        environments: {
          staging: { displayName: "Staging" },
        },
        platforms: {
          android: {},
          ios: {},
        },
      }),
    );

    const androidResult = createSyncResult(repoDir, manifest, {
      tenant: "demo-app",
      environment: "staging",
      platform: "android",
    });
    const iosResult = createSyncResult(repoDir, manifest, {
      tenant: "demo-app",
      environment: "staging",
      platform: "ios",
    });
    const androidIdentity = androidResult.generatedFiles.find(
      (file) => file.kind === "android-native-identity",
    );
    const iosXcconfig = iosResult.generatedFiles.find(
      (file) =>
        file.path ===
        join(repoDir, "ios", "rn-mt.generated.demo-app-staging.xcconfig"),
    );

    expect(androidResult.runtime.config).toMatchObject({
      native: {
        android: {
          applicationId: "com.demo.android.staging",
        },
        ios: {
          bundleIdentifier: "com.demo.ios.staging",
        },
      },
    });
    expect(androidIdentity?.contents).toContain(
      'applicationId "com.demo.android.staging"',
    );
    expect(androidIdentity?.contents).toContain(
      'resValue "string", "app_name", "Keep Nexus (Staging)"',
    );
    expect(iosXcconfig?.contents).toContain(
      "PRODUCT_BUNDLE_IDENTIFIER = com.demo.ios.staging",
    );
    expect(iosXcconfig?.contents).toContain(
      'INFOPLIST_KEY_CFBundleDisplayName = "Keep Nexus (Staging)"',
    );
  });

  it("applies environment then tenant layers with deep-merge and replacement semantics", () => {
    const manifest = parseManifest(
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: "/tmp/demo-app" },
        config: {
          identity: {
            appName: "Base App",
            support: {
              email: "base@example.com",
              phone: "+111111111",
            },
          },
          enabledMarkets: ["base"],
          color: "blue",
        },
        flags: {
          sharedFeature: true,
          rollout: {
            beta: false,
            cohort: "base",
          },
        },
        assets: {
          logo: "base/logo.png",
        },
        defaults: { tenant: "acme", environment: "staging" },
        tenants: {
          acme: {
            displayName: "Acme",
            config: {
              identity: {
                support: {
                  phone: "+333333333",
                },
              },
              enabledMarkets: ["tenant"],
              color: "green",
            },
            flags: {
              rollout: {
                cohort: "tenant",
              },
            },
            assets: {
              logo: "tenant/logo.png",
            },
          },
        },
        environments: {
          staging: {
            displayName: "Staging",
            config: {
              identity: {
                support: {
                  email: "staging@example.com",
                },
              },
              enabledMarkets: ["staging"],
              color: "orange",
            },
            flags: {
              rollout: {
                beta: true,
              },
            },
            assets: {
              splash: "staging/splash.png",
            },
          },
        },
      }),
    );

    const result = createSyncResult("/tmp/demo-app", manifest);

    expect(result.resolution).toEqual({
      appliedLayers: ["base", "environment:staging", "tenant:acme"],
    });
    expect(result.runtime.config).toEqual({
      identity: {
        appName: "Base App",
        displayName: "Base App (Staging)",
        nativeId: "com.rnmt.acme.staging",
        support: {
          email: "staging@example.com",
          phone: "+333333333",
        },
      },
      native: {
        android: {
          applicationId: "com.rnmt.acme.staging",
        },
        ios: {
          bundleIdentifier: "com.rnmt.acme.staging",
        },
      },
      enabledMarkets: ["tenant"],
      color: "green",
    });
    expect(result.runtime.flags).toEqual({
      sharedFeature: true,
      rollout: {
        beta: true,
        cohort: "tenant",
      },
    });
    expect(result.runtime.assets).toEqual({
      logo: "tenant/logo.png",
      splash: "staging/splash.png",
    });
  });

  it("applies platform overrides after environment and tenant layers", () => {
    const manifest = parseManifest(
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: "/tmp/demo-app" },
        config: {
          color: "base",
        },
        flags: {
          platformEnabled: false,
        },
        assets: {
          icon: "base/icon.png",
        },
        defaults: { tenant: "acme", environment: "staging" },
        tenants: {
          acme: {
            displayName: "Acme",
            config: {
              color: "tenant",
            },
          },
        },
        environments: {
          staging: {
            displayName: "Staging",
            config: {
              color: "environment",
            },
          },
        },
        platforms: {
          ios: {
            config: {
              color: "ios",
            },
            flags: {
              platformEnabled: true,
            },
            assets: {
              icon: "ios/icon.png",
            },
          },
        },
      }),
    );

    const result = createSyncResult("/tmp/demo-app", manifest, {
      tenant: "acme",
      environment: "staging",
      platform: "ios",
    });

    expect(result.target).toEqual({
      tenant: "acme",
      environment: "staging",
      platform: "ios",
    });
    expect(result.resolution).toEqual({
      appliedLayers: [
        "base",
        "environment:staging",
        "tenant:acme",
        "platform:ios",
      ],
    });
    expect(result.runtime.config).toEqual({
      color: "ios",
      identity: {
        displayName: "Acme (Staging)",
        nativeId: "com.rnmt.acme.staging",
      },
      native: {
        android: {
          applicationId: "com.rnmt.acme.staging",
        },
        ios: {
          bundleIdentifier: "com.rnmt.acme.staging",
        },
      },
    });
    expect(result.runtime.flags).toEqual({
      platformEnabled: true,
    });
    expect(result.runtime.assets).toEqual({
      icon: "ios/icon.png",
    });
  });

  it("applies more specific combination overrides after platform layers", () => {
    const manifest = parseManifest(
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: "/tmp/demo-app" },
        config: {
          identity: {
            appName: "Base",
          },
          color: "base",
        },
        flags: {
          banner: "base",
        },
        assets: {
          logo: "base/logo.png",
        },
        defaults: { tenant: "acme", environment: "staging" },
        tenants: {
          acme: {
            displayName: "Acme",
            config: {
              color: "tenant",
            },
          },
        },
        environments: {
          staging: {
            displayName: "Staging",
            config: {
              color: "environment",
            },
          },
        },
        platforms: {
          android: {
            config: {
              color: "android",
            },
            flags: {
              banner: "android",
            },
          },
        },
        combinations: {
          "environment:staging+tenant:acme+platform:android": {
            config: {
              color: "combo",
            },
            flags: {
              banner: "combo",
            },
            assets: {
              logo: "combo/logo.png",
            },
          },
        },
      }),
    );

    const result = createSyncResult("/tmp/demo-app", manifest, {
      tenant: "acme",
      environment: "staging",
      platform: "android",
    });

    expect(result.resolution).toEqual({
      appliedLayers: [
        "base",
        "environment:staging",
        "tenant:acme",
        "platform:android",
        "combination:environment:staging+tenant:acme+platform:android",
      ],
    });
    expect(result.runtime.config).toEqual({
      identity: {
        appName: "Base",
        displayName: "Base (Staging)",
        nativeId: "com.rnmt.acme.staging",
      },
      native: {
        android: {
          applicationId: "com.rnmt.acme.staging",
        },
        ios: {
          bundleIdentifier: "com.rnmt.acme.staging",
        },
      },
      color: "combo",
    });
    expect(result.runtime.flags).toEqual({
      banner: "combo",
    });
    expect(result.runtime.assets).toEqual({
      logo: "combo/logo.png",
    });
  });

  it("derives non-production identity defaults for staging targets", () => {
    const manifest = parseManifest(
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: "/tmp/demo-app" },
        config: {
          identity: {
            appName: "Keep Nexus",
            nativeId: "com.keep.nexus",
          },
        },
        defaults: { tenant: "acme", environment: "staging" },
        tenants: {
          acme: { displayName: "Acme" },
        },
        environments: {
          staging: { displayName: "Staging" },
        },
      }),
    );

    const result = createSyncResult("/tmp/demo-app", manifest);

    expect(result.runtime.identity).toEqual({
      displayName: "Keep Nexus (Staging)",
      nativeId: "com.keep.nexus.staging",
    });
    expect(result.runtime.config).toEqual({
      identity: {
        appName: "Keep Nexus",
        nativeId: "com.keep.nexus.staging",
        displayName: "Keep Nexus (Staging)",
      },
      native: {
        android: {
          applicationId: "com.keep.nexus.staging",
        },
        ios: {
          bundleIdentifier: "com.keep.nexus.staging",
        },
      },
    });
  });

  it("keeps production identity values unsuffixed by default", () => {
    const manifest = parseManifest(
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: "/tmp/demo-app" },
        config: {
          identity: {
            appName: "Keep Nexus",
            nativeId: "com.keep.nexus",
          },
        },
        defaults: { tenant: "acme", environment: "prod" },
        tenants: {
          acme: { displayName: "Acme" },
        },
        environments: {
          prod: { displayName: "Production" },
        },
      }),
    );

    const result = createSyncResult("/tmp/demo-app", manifest);

    expect(result.runtime.identity).toEqual({
      displayName: "Keep Nexus",
      nativeId: "com.keep.nexus",
    });
  });

  it("respects explicit identity overrides instead of derived non-production defaults", () => {
    const manifest = parseManifest(
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: "/tmp/demo-app" },
        config: {
          identity: {
            appName: "Keep Nexus",
            nativeId: "com.keep.nexus",
          },
        },
        defaults: { tenant: "acme", environment: "staging" },
        tenants: {
          acme: {
            displayName: "Acme",
            config: {
              identity: {
                displayName: "Custom Staging Name",
                nativeId: "com.custom.staging",
              },
            },
          },
        },
        environments: {
          staging: { displayName: "Staging" },
        },
      }),
    );

    const result = createSyncResult("/tmp/demo-app", manifest);

    expect(result.runtime.identity).toEqual({
      displayName: "Custom Staging Name",
      nativeId: "com.custom.staging",
    });
    expect(result.runtime.config).toEqual({
      identity: {
        appName: "Keep Nexus",
        displayName: "Custom Staging Name",
        nativeId: "com.custom.staging",
      },
      native: {
        android: {
          applicationId: "com.custom.staging",
        },
        ios: {
          bundleIdentifier: "com.custom.staging",
        },
      },
    });
  });

  it("accepts required env inputs without serializing secret values into generated artifacts", () => {
    const manifest = parseManifest(
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: "/tmp/demo-app" },
        defaults: { tenant: "acme", environment: "staging" },
        envSchema: {
          apiBaseUrl: {
            source: "API_BASE_URL",
            required: true,
          },
          apiSecret: {
            source: "API_SECRET",
            required: true,
            secret: true,
          },
        },
        tenants: {
          acme: { displayName: "Acme" },
        },
        environments: {
          staging: { displayName: "Staging" },
        },
      }),
    );

    const result = createSyncResult(
      "/tmp/demo-app",
      manifest,
      manifest.defaults,
      {
        env: {
          API_BASE_URL: "https://api.example.com",
          API_SECRET: "super-secret-token",
        },
      },
    );
    const runtimeArtifact = result.generatedFiles.find(
      (file) => file.kind === "runtime-artifact",
    );

    expect(result.runtime.env).toEqual({
      id: "staging",
    });
    expect(runtimeArtifact?.contents).toBeDefined();
    expect(runtimeArtifact?.contents).not.toContain("https://api.example.com");
    expect(runtimeArtifact?.contents).not.toContain("super-secret-token");
    expect(runtimeArtifact?.contents).not.toContain("API_SECRET");
  });
});
