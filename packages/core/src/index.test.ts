import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  canInitializeFromAnalyzeReport,
  createBaselineAnalyzeReport,
  createConvertResult,
  createInitialManifest,
  createInitResult,
  createSubprocessEnv,
  createSyncResult,
  createTargetSetResult,
  formatBaselineAnalyzeReport,
  parseManifest,
  getInitBlockedReason,
  validateTargetSelection,
} from "./index";

import { afterEach, describe, expect, it } from "vitest";

const tempDirs: string[] = [];

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

    writeFileSync(join(repoDir, "package.json"), JSON.stringify({ name: "fixture-app" }));
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

  it("detects TypeScript host repos from tsconfig.json", () => {
    const repoDir = createTempRepo("rn-mt-core-typescript-host-");

    writeFileSync(join(repoDir, "package.json"), JSON.stringify({ name: "fixture-app" }));
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
    writeFileSync(join(repoDir, "app.json"), JSON.stringify({ expo: { name: "ExpoFixture" } }));

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
    writeFileSync(join(repoDir, "app.json"), JSON.stringify({ expo: { name: "ExpoFixture" } }));

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
    expect(output).toContain("Host evidence: defaulted to javascript host files");
    expect(output).toContain("App candidates: expo-managed, expo-prebuild");
    expect(output).toContain("App evidence: package.json includes expo dependency");
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
    writeFileSync(join(repoDir, "app.json"), JSON.stringify({ expo: { name: "DemoApp" } }));

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

    writeFileSync(join(repoDir, "package.json"), JSON.stringify({ name: "plain-app" }));

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
    writeFileSync(join(repoDir, "app.json"), JSON.stringify({ expo: { name: "DemoApp" } }));

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
    writeFileSync(join(repoDir, "app.json"), JSON.stringify({ expo: { name: "DemoApp" } }));
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

    expect(validateTargetSelection(manifest, { tenant: "acme", environment: "dev" })).toBe(
      "Unknown tenant: acme",
    );
    expect(
      validateTargetSelection(manifest, {
        tenant: "demo-app",
        environment: "staging",
      }),
    ).toBe("Unknown environment: staging");
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
    ).toThrow("Invalid envSchema.apiBaseUrl.source: expected a non-empty string.");
  });
});

describe("convert helpers", () => {
  it("creates an rn-mt skeleton with shared sources, current facades, and root wrappers", () => {
    const repoDir = createTempRepo("rn-mt-core-convert-");

    writeFileSync(join(repoDir, "App.tsx"), "export default function App() { return null; }\n");
    writeFileSync(
      join(repoDir, "index.js"),
      "import { registerRootComponent } from 'expo';\nregisterRootComponent(App);\n",
    );

    const result = createConvertResult(repoDir, createConvertManifest(repoDir));

    expect(result.movedFiles).toEqual([
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
    ]);
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
          contents: expect.stringContaining('createRuntimeAccessors'),
        },
        {
          path: join(repoDir, "rn-mt.generated.convert.ownership.json"),
          kind: "ownership-metadata",
          contents: expect.stringContaining('"owner": "cli"'),
        },
      ]),
    );
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

    expect(() => createConvertResult(repoDir, createConvertManifest(repoDir))).toThrow(
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
          destinationPath: join(repoDir, "src", "rn-mt", "shared", "theme", "index.ts"),
          removeSourcePath: true,
        }),
        expect.objectContaining({
          sourcePath: join(repoDir, "assets", "logo.png"),
          destinationPath: join(repoDir, "src", "rn-mt", "shared", "assets", "logo.png"),
          removeSourcePath: true,
        }),
        expect.objectContaining({
          sourcePath: join(repoDir, "App.test.tsx"),
          destinationPath: join(repoDir, "src", "rn-mt", "shared", "App.test.tsx"),
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

    expect(appShared?.contents).toContain('import theme from "../current/theme/index";');
    expect(themeCurrent?.contents).toContain('../../tenants/acme/theme/index');
    expect(appCurrent?.contents).toContain('../shared/App');
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
      [
        "API_BASE_URL=https://dev.example.com",
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
    expect(JSON.parse(ownershipMetadata?.contents ?? "null")).toEqual({
      schemaVersion: 1,
      tool: "rn-mt",
      owner: "cli",
      artifacts: [
        {
          path: "rn-mt.generated.runtime.json",
          kind: "runtime-artifact",
        },
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

    const result = createSyncResult("/tmp/demo-app", manifest, manifest.defaults, {
      env: {
        API_BASE_URL: "https://api.example.com",
        API_SECRET: "super-secret-token",
      },
    });
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
