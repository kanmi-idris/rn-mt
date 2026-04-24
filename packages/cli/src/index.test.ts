import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { RnMtBaselineAnalyzeReport } from "@rn-mt/core";

import { runCli } from "./index";

const tempDirs: string[] = [];

function createTempRepo(prefix: string) {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(directory);
  return directory;
}

afterEach(() => {
  while (tempDirs.length > 0) {
    const directory = tempDirs.pop();
    if (directory) {
      rmSync(directory, { recursive: true, force: true });
    }
  }
});

const ambiguousAnalyzeReport: RnMtBaselineAnalyzeReport = {
  schemaVersion: 1 as const,
  command: "analyze" as const,
  status: "ambiguous" as const,
  repo: {
    rootDir: "/tmp/ambiguous-fixture",
    packageJsonPresent: true,
    gitPresent: true,
    packageManager: {
      name: "npm",
      source: "packageManager-field" as const,
      raw: "npm@10.8.2",
    },
    app: {
      kind: "unknown" as const,
      candidates: ["expo-managed", "expo-prebuild"] as const,
      evidence: ["package.json includes expo dependency", "app.config.ts present"],
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
};

const supportedAnalyzeReport: RnMtBaselineAnalyzeReport = {
  schemaVersion: 1,
  command: "analyze",
  status: "ok",
  repo: {
    rootDir: "/tmp/supported-fixture",
    packageJsonPresent: true,
    gitPresent: true,
    packageManager: {
      name: "pnpm",
      source: "packageManager-field",
      raw: "pnpm@10.25.0",
    },
    app: {
      kind: "expo-managed",
      candidates: ["expo-managed"],
      evidence: ["package.json includes expo dependency", "app.json present"],
      remediation: [],
    },
    support: {
      tier: "supported",
      reasonCodes: ["modern-expo-managed"],
    },
    host: {
      language: "javascript",
      evidence: ["defaulted to javascript host files"],
    },
  },
};

const supportedTypeScriptAnalyzeReport: RnMtBaselineAnalyzeReport = {
  ...supportedAnalyzeReport,
  repo: {
    ...supportedAnalyzeReport.repo,
    host: {
      language: "typescript",
      evidence: ["tsconfig.json present"],
    },
  },
};

const unsupportedAnalyzeReport: RnMtBaselineAnalyzeReport = {
  schemaVersion: 1,
  command: "analyze",
  status: "ok",
  repo: {
    rootDir: "/tmp/unsupported-fixture",
    packageJsonPresent: true,
    gitPresent: true,
    packageManager: {
      name: "unknown",
      source: "none",
      raw: null,
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
};

describe("cli analyze command", () => {
  it("prints a readable baseline analysis report", () => {
    const stdout = vi.fn();
    const stderr = vi.fn();
    const exitCode = runCli(["analyze"], {
      cwd: process.cwd(),
      io: { stdout, stderr },
    });

    expect(stdout).toHaveBeenCalled();
    const output = stdout.mock.calls.map(([chunk]) => chunk).join("");

    expect(output).toContain("rn-mt analyze");
    expect(output).toContain(`App root: ${process.cwd()}`);
    expect(output).toContain("Package manager:");
    expect(output).toContain("App kind:");
    expect(output).toContain("Host language:");
    expect(stderr).not.toHaveBeenCalled();
    expect(exitCode).toBe(0);
  });

  it("prints JSON when --json is passed", () => {
    const stdout = vi.fn();
    const stderr = vi.fn();
    const exitCode = runCli(["analyze", "--json"], {
      cwd: process.cwd(),
      io: { stdout, stderr },
    });

    const output = stdout.mock.calls.map(([chunk]) => chunk).join("");
    const parsed = JSON.parse(output);

    expect(parsed.schemaVersion).toBe(1);
    expect(parsed.command).toBe("analyze");
    expect(parsed.status).toBe("ok");
    expect(parsed.repo.rootDir).toBe(process.cwd());
    expect(["supported", "near-supported", "unsupported"]).toContain(
      parsed.repo.support.tier,
    );
    expect(Array.isArray(parsed.repo.support.reasonCodes)).toBe(true);
    expect(["unknown", "expo-managed", "expo-prebuild", "bare-react-native"]).toContain(
      parsed.repo.app.kind,
    );
    expect(["javascript", "typescript"]).toContain(parsed.repo.host.language);
    expect(Array.isArray(parsed.repo.host.evidence)).toBe(true);
    expect(Array.isArray(parsed.repo.app.evidence)).toBe(true);
    expect(stderr).not.toHaveBeenCalled();
    expect(exitCode).toBe(0);
  });

  it("keeps the app-kind JSON field stable", () => {
    const stdout = vi.fn();
    const stderr = vi.fn();
    const exitCode = runCli(["analyze", "--json"], {
      cwd: process.cwd(),
      io: { stdout, stderr },
    });

    const output = stdout.mock.calls.map(([chunk]) => chunk).join("");
    const parsed = JSON.parse(output);

    expect([
      "unknown",
      "expo-managed",
      "expo-prebuild",
      "bare-react-native",
    ]).toContain(
      parsed.repo.app.kind,
    );
    expect(["supported", "near-supported", "unsupported"]).toContain(
      parsed.repo.support.tier,
    );
    expect(Array.isArray(parsed.repo.app.evidence)).toBe(true);
    expect(stderr).not.toHaveBeenCalled();
    expect(exitCode).toBe(0);
  });

  it("fails in non-interactive mode when classification is ambiguous", () => {
    const stdout = vi.fn();
    const stderr = vi.fn();

    const exitCode = runCli(["analyze", "--non-interactive"], {
      cwd: process.cwd(),
      io: { stdout, stderr },
      analyzeReportFactory: () => ambiguousAnalyzeReport,
    });

    const errorOutput = stderr.mock.calls.map(([chunk]) => chunk).join("");

    expect(exitCode).toBe(1);
    expect(stdout).not.toHaveBeenCalled();
    expect(errorOutput).toContain(
      "Ambiguous repo classification requires an explicit app-kind selection.",
    );
    expect(errorOutput).toContain("Analyze status: ambiguous");
    expect(errorOutput).toContain("Support tier: near-supported");
    expect(errorOutput).toContain("App candidates: expo-managed, expo-prebuild");
  });

  it("returns structured remediation JSON in non-interactive mode when ambiguity remains", () => {
    const stdout = vi.fn();
    const stderr = vi.fn();

    const exitCode = runCli(["analyze", "--json", "--non-interactive"], {
      cwd: process.cwd(),
      io: { stdout, stderr },
      analyzeReportFactory: () => ambiguousAnalyzeReport,
    });

    const output = stdout.mock.calls.map(([chunk]) => chunk).join("");
    const parsed = JSON.parse(output);

    expect(exitCode).toBe(1);
    expect(parsed).toEqual({
      command: "analyze",
      status: "blocked",
      analyze: ambiguousAnalyzeReport,
      reason: "Ambiguous repo classification requires an explicit app-kind selection.",
      remediation: ambiguousAnalyzeReport.repo.app.remediation,
    });
    expect(stderr).not.toHaveBeenCalled();
  });

  it("prompts in interactive mode and records the selected app kind for the current run", () => {
    const stdout = vi.fn();
    const stderr = vi.fn();
    const promptForAppKind = vi.fn<
      (typeof runCli extends (
        args: string[],
        options?: infer TOptions,
      ) => unknown
        ? NonNullable<TOptions extends { promptForAppKind?: infer TPrompt } ? TPrompt : never>
        : never)
    >(() => "expo-prebuild");

    const exitCode = runCli(["analyze", "--json"], {
      cwd: process.cwd(),
      io: { stdout, stderr },
      analyzeReportFactory: () => ambiguousAnalyzeReport,
      promptForAppKind,
    });

    const output = stdout.mock.calls.map(([chunk]) => chunk).join("");
    const parsed = JSON.parse(output);

    expect(exitCode).toBe(0);
    expect(promptForAppKind).toHaveBeenCalledOnce();
    expect(parsed.status).toBe("ok");
    expect(parsed.repo.app.kind).toBe("expo-prebuild");
    expect(parsed.repo.app.candidates).toEqual(["expo-prebuild"]);
    expect(parsed.repo.app.remediation).toEqual([]);
    expect(stderr).not.toHaveBeenCalled();
  });

  it("allows explicit app-kind selection to resolve ambiguity", () => {
    const stdout = vi.fn();
    const stderr = vi.fn();

    const exitCode = runCli(["analyze", "--json", "--app-kind", "expo-managed"], {
      cwd: process.cwd(),
      io: { stdout, stderr },
      analyzeReportFactory: () => ambiguousAnalyzeReport,
    });

    const output = stdout.mock.calls.map(([chunk]) => chunk).join("");
    const parsed = JSON.parse(output);

    expect(exitCode).toBe(0);
    expect(parsed.status).toBe("ok");
    expect(parsed.repo.app.kind).toBe("expo-managed");
    expect(parsed.repo.app.candidates).toEqual(["expo-managed"]);
    expect(parsed.repo.app.remediation).toEqual([]);
    expect(parsed.repo.support).toEqual({
      tier: "near-supported",
      reasonCodes: ["ambiguous-repo-shape"],
    });
    expect(stderr).not.toHaveBeenCalled();
  });

  it("creates a minimal manifest for a supported repo", () => {
    const stdout = vi.fn();
    const stderr = vi.fn();
    const writeFile = vi.fn();

    const exitCode = runCli(["init", "--json"], {
      cwd: "/tmp/supported-fixture",
      io: { stdout, stderr },
      analyzeReportFactory: () => supportedAnalyzeReport,
      fileExists: () => false,
      writeFile,
    });

    const output = stdout.mock.calls.map(([chunk]) => chunk).join("");
    const parsed = JSON.parse(output);

    expect(exitCode).toBe(0);
    expect(parsed.status).toBe("created");
    expect(parsed.manifestPath).toBe("/tmp/supported-fixture/rn-mt.config.json");
    expect(parsed.manifest.schemaVersion).toBe(1);
    expect(parsed.manifest.defaults).toEqual({
      tenant: "default",
      environment: "dev",
    });
    expect(parsed.generatedHostFiles).toEqual([
      {
        path: "/tmp/supported-fixture/rn-mt.generated.js",
        language: "javascript",
      },
    ]);
    expect(writeFile).toHaveBeenCalledTimes(2);
    expect(writeFile).toHaveBeenNthCalledWith(
      1,
      "/tmp/supported-fixture/rn-mt.config.json",
      expect.stringContaining('"schemaVersion": 1'),
    );
    expect(writeFile).toHaveBeenNthCalledWith(
      2,
      "/tmp/supported-fixture/rn-mt.generated.js",
      expect.stringContaining("export const rnMtHostLanguage = 'javascript'"),
    );
    expect(stderr).not.toHaveBeenCalled();
  });

  it("creates a TypeScript host file for a TypeScript repo", () => {
    const stdout = vi.fn();
    const stderr = vi.fn();
    const writeFile = vi.fn();

    const exitCode = runCli(["init", "--json"], {
      cwd: "/tmp/typescript-fixture",
      io: { stdout, stderr },
      analyzeReportFactory: () => ({
        ...supportedTypeScriptAnalyzeReport,
        repo: {
          ...supportedTypeScriptAnalyzeReport.repo,
          rootDir: "/tmp/typescript-fixture",
        },
      }),
      fileExists: () => false,
      writeFile,
    });

    const output = stdout.mock.calls.map(([chunk]) => chunk).join("");
    const parsed = JSON.parse(output);

    expect(exitCode).toBe(0);
    expect(parsed.generatedHostFiles).toEqual([
      {
        path: "/tmp/typescript-fixture/rn-mt.generated.ts",
        language: "typescript",
      },
    ]);
    expect(writeFile).toHaveBeenCalledTimes(2);
    expect(writeFile).toHaveBeenNthCalledWith(
      1,
      "/tmp/typescript-fixture/rn-mt.config.json",
      expect.stringContaining('"schemaVersion": 1'),
    );
    expect(writeFile).toHaveBeenNthCalledWith(
      2,
      "/tmp/typescript-fixture/rn-mt.generated.ts",
      expect.stringContaining("export const rnMtHostLanguage = 'typescript' as const"),
    );
    expect(stderr).not.toHaveBeenCalled();
  });

  it("converts a fixture app into the rn-mt skeleton with CLI-owned wrappers intact", () => {
    const repoDir = createTempRepo("rn-mt-cli-convert-");
    const stdout = vi.fn();
    const stderr = vi.fn();

    mkdirSync(join(repoDir, ".git"));
    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "fixture-app",
        dependencies: { expo: "~52.0.0" },
      }),
    );
    writeFileSync(join(repoDir, "app.json"), JSON.stringify({ expo: { name: "FixtureApp" } }));
    writeFileSync(
      join(repoDir, "rn-mt.config.json"),
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: repoDir },
        defaults: { tenant: "fixture-app", environment: "dev" },
        tenants: {
          "fixture-app": { displayName: "Fixture App" },
        },
        environments: {
          dev: { displayName: "Development" },
        },
      }),
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

    const exitCode = runCli(["convert", "--json"], {
      cwd: repoDir,
      io: { stdout, stderr },
    });

    const output = stdout.mock.calls.map(([chunk]) => chunk).join("");
    const parsed = JSON.parse(output);

    expect(exitCode).toBe(0);
    expect(parsed.command).toBe("convert");
    expect(parsed.status).toBe("converted");
    expect(readFileSync(join(repoDir, "App.tsx"), "utf8")).toContain(
      "CLI-owned wrapper",
    );
    expect(readFileSync(join(repoDir, "index.js"), "utf8")).toContain(
      'import "./src/rn-mt/current/index";',
    );
    expect(readFileSync(join(repoDir, "src", "rn-mt", "shared", "App.tsx"), "utf8")).toContain(
      'import theme from "../current/theme/index";',
    );
    expect(readFileSync(join(repoDir, "src", "rn-mt", "shared", "App.tsx"), "utf8")).toContain(
      'import config from "../current/src/config/index";',
    );
    expect(
      readFileSync(join(repoDir, "src", "rn-mt", "current", "App.tsx"), "utf8"),
    ).toContain('export { default } from "../shared/App";');
    expect(
      readFileSync(join(repoDir, "src", "rn-mt", "current", "theme", "index.ts"), "utf8"),
    ).toContain("../../shared/theme/index");
    expect(
      readFileSync(join(repoDir, "src", "rn-mt", "current", "runtime.ts"), "utf8"),
    ).toContain("createRuntimeAccessors");
    expect(
      readFileSync(join(repoDir, "src", "rn-mt", "shared", "theme", "index.ts"), "utf8"),
    ).toContain("../../current/assets/logo.png");
    expect(
      readFileSync(join(repoDir, "src", "rn-mt", "shared", "src", "config", "index.ts"), "utf8"),
    ).toContain("apiBaseUrl");
    expect(
      readFileSync(join(repoDir, "src", "rn-mt", "shared", "App.test.tsx"), "utf8"),
    ).toContain('import App from "../current/App";');
    expect(
      readFileSync(join(repoDir, "rn-mt.generated.convert.ownership.json"), "utf8"),
    ).toContain('"owner": "cli"');
    expect(existsSync(join(repoDir, "theme", "index.ts"))).toBe(false);
    expect(existsSync(join(repoDir, "assets", "logo.png"))).toBe(false);
    expect(existsSync(join(repoDir, "App.test.tsx"))).toBe(false);
    expect(existsSync(join(repoDir, "src", "config", "index.ts"))).toBe(false);
    expect(stderr).not.toHaveBeenCalled();
  });

  it("rewrites touched imports to canonical relative paths in a no-alias TypeScript fixture", () => {
    const repoDir = createTempRepo("rn-mt-cli-no-alias-convert-");
    const stdout = vi.fn();
    const stderr = vi.fn();

    mkdirSync(join(repoDir, ".git"));
    mkdirSync(join(repoDir, "theme"), { recursive: true });
    mkdirSync(join(repoDir, "src", "config"), { recursive: true });
    mkdirSync(join(repoDir, "node_modules", "@rn-mt", "runtime"), { recursive: true });
    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "fixture-app",
        dependencies: { expo: "~52.0.0" },
      }),
    );
    writeFileSync(join(repoDir, "app.json"), JSON.stringify({ expo: { name: "FixtureApp" } }));
    writeFileSync(
      join(repoDir, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            target: "ES2020",
            module: "ESNext",
            moduleResolution: "Bundler",
            strict: true,
            resolveJsonModule: true,
            allowSyntheticDefaultImports: true,
            esModuleInterop: true,
            skipLibCheck: true,
          },
          include: ["App.ts", "index.ts", "src/**/*.ts"],
        },
        null,
        2,
      ),
    );
    writeFileSync(
      join(repoDir, "node_modules", "@rn-mt", "runtime", "package.json"),
      JSON.stringify({
        name: "@rn-mt/runtime",
        types: "index.d.ts",
      }),
    );
    writeFileSync(
      join(repoDir, "node_modules", "@rn-mt", "runtime", "index.d.ts"),
      [
        "export interface ResolvedTenantRuntime {",
        "  config: Record<string, unknown>;",
        "  tenant: { id: string; displayName: string };",
        "  env: { id: string };",
        "  flags: Record<string, unknown>;",
        "  assets: Record<string, string>;",
        "}",
        "export function createRuntimeAccessors(runtime: ResolvedTenantRuntime): {",
        "  getConfig(): Record<string, unknown>;",
        "  getTenant(): { id: string; displayName: string };",
        "  getEnv(): { id: string };",
        "  getFlags(): Record<string, unknown>;",
        "  getAssets(): Record<string, string>;",
        "};",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(repoDir, "rn-mt.generated.runtime.json"),
      JSON.stringify({
        config: {},
        tenant: { id: "fixture-app", displayName: "Fixture App" },
        env: { id: "dev" },
        flags: {},
        assets: {},
      }),
    );
    writeFileSync(
      join(repoDir, "rn-mt.config.json"),
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: repoDir },
        defaults: { tenant: "fixture-app", environment: "dev" },
        tenants: {
          "fixture-app": { displayName: "Fixture App" },
        },
        environments: {
          dev: { displayName: "Development" },
        },
      }),
    );
    writeFileSync(
      join(repoDir, "App.ts"),
      [
        'import theme from "./theme";',
        'import config from "./src/config";',
        "",
        "const app = { theme, config };",
        "",
        "export default app;",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(repoDir, "index.ts"),
      [
        'import App from "./App";',
        "",
        "export default App;",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(repoDir, "theme", "index.ts"),
      "const theme = { color: 'blue' as const };\nexport default theme;\n",
    );
    writeFileSync(
      join(repoDir, "src", "config", "index.ts"),
      "const config = { apiBaseUrl: 'https://example.com' };\nexport default config;\n",
    );

    const exitCode = runCli(["convert"], {
      cwd: repoDir,
      io: { stdout, stderr },
    });

    expect(exitCode).toBe(0);
    expect(readFileSync(join(repoDir, "src", "rn-mt", "shared", "App.ts"), "utf8")).toContain(
      'import theme from "../current/theme/index";',
    );
    expect(readFileSync(join(repoDir, "src", "rn-mt", "shared", "App.ts"), "utf8")).toContain(
      'import config from "../current/src/config/index";',
    );
    expect(readFileSync(join(repoDir, "src", "rn-mt", "shared", "index.ts"), "utf8")).toContain(
      'import App from "../current/App";',
    );
    expect(readFileSync(join(repoDir, "src", "rn-mt", "shared", "App.ts"), "utf8")).not.toContain(
      'import theme from "./theme";',
    );
    expect(readFileSync(join(repoDir, "src", "rn-mt", "shared", "index.ts"), "utf8")).not.toContain(
      'import App from "./App";',
    );

    try {
      execFileSync(
        process.execPath,
        [join(process.cwd(), "node_modules", "typescript", "bin", "tsc"), "--noEmit", "-p", "tsconfig.json"],
        {
          cwd: repoDir,
          stdio: "pipe",
        },
      );
    } catch (error) {
      throw new Error(
        error instanceof Error && "stderr" in error
          ? `${String((error as { stdout?: Buffer; stderr?: Buffer }).stdout ?? Buffer.from(""))}\n${String((error as { stdout?: Buffer; stderr?: Buffer }).stderr ?? Buffer.from(""))}`
          : "TypeScript fixture check failed.",
      );
    }
    expect(stderr).not.toHaveBeenCalled();
  });

  it("preserves an existing alias convention when rewriting moved imports", () => {
    const repoDir = createTempRepo("rn-mt-cli-alias-convert-");
    const stdout = vi.fn();
    const stderr = vi.fn();

    mkdirSync(join(repoDir, ".git"));
    mkdirSync(join(repoDir, "src", "theme"), { recursive: true });
    mkdirSync(join(repoDir, "src", "config"), { recursive: true });
    mkdirSync(join(repoDir, "node_modules", "@rn-mt", "runtime"), { recursive: true });
    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "fixture-app",
        dependencies: { expo: "~52.0.0" },
      }),
    );
    writeFileSync(join(repoDir, "app.json"), JSON.stringify({ expo: { name: "FixtureApp" } }));
    writeFileSync(
      join(repoDir, "tsconfig.json"),
      JSON.stringify(
        {
          compilerOptions: {
            target: "ES2020",
            module: "ESNext",
            moduleResolution: "Bundler",
            strict: true,
            resolveJsonModule: true,
            allowSyntheticDefaultImports: true,
            esModuleInterop: true,
            skipLibCheck: true,
            baseUrl: ".",
            paths: {
              "@/*": ["src/*"],
            },
          },
          include: ["App.ts", "index.ts", "src/**/*.ts"],
        },
        null,
        2,
      ),
    );
    writeFileSync(
      join(repoDir, "node_modules", "@rn-mt", "runtime", "package.json"),
      JSON.stringify({
        name: "@rn-mt/runtime",
        types: "index.d.ts",
      }),
    );
    writeFileSync(
      join(repoDir, "node_modules", "@rn-mt", "runtime", "index.d.ts"),
      [
        "export interface ResolvedTenantRuntime {",
        "  config: Record<string, unknown>;",
        "  tenant: { id: string; displayName: string };",
        "  env: { id: string };",
        "  flags: Record<string, unknown>;",
        "  assets: Record<string, string>;",
        "}",
        "export function createRuntimeAccessors(runtime: ResolvedTenantRuntime): {",
        "  getConfig(): Record<string, unknown>;",
        "  getTenant(): { id: string; displayName: string };",
        "  getEnv(): { id: string };",
        "  getFlags(): Record<string, unknown>;",
        "  getAssets(): Record<string, string>;",
        "};",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(repoDir, "rn-mt.generated.runtime.json"),
      JSON.stringify({
        config: {},
        tenant: { id: "fixture-app", displayName: "Fixture App" },
        env: { id: "dev" },
        flags: {},
        assets: {},
      }),
    );
    writeFileSync(
      join(repoDir, "rn-mt.config.json"),
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: repoDir },
        defaults: { tenant: "fixture-app", environment: "dev" },
        tenants: {
          "fixture-app": { displayName: "Fixture App" },
        },
        environments: {
          dev: { displayName: "Development" },
        },
      }),
    );
    writeFileSync(
      join(repoDir, "App.ts"),
      [
        'import theme from "@/theme";',
        'import config from "@/config";',
        "",
        "const app = { theme, config };",
        "",
        "export default app;",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(repoDir, "index.ts"),
      [
        'import App from "./App";',
        "",
        "export default App;",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(repoDir, "src", "theme", "index.ts"),
      "const theme = { color: 'blue' as const };\nexport default theme;\n",
    );
    writeFileSync(
      join(repoDir, "src", "config", "index.ts"),
      "const config = { apiBaseUrl: 'https://example.com' };\nexport default config;\n",
    );

    const exitCode = runCli(["convert"], {
      cwd: repoDir,
      io: { stdout, stderr },
    });

    expect(exitCode).toBe(0);
    expect(readFileSync(join(repoDir, "src", "rn-mt", "shared", "App.ts"), "utf8")).toContain(
      'import theme from "@/rn-mt/current/src/theme/index";',
    );
    expect(readFileSync(join(repoDir, "src", "rn-mt", "shared", "App.ts"), "utf8")).toContain(
      'import config from "@/rn-mt/current/src/config/index";',
    );
    expect(readFileSync(join(repoDir, "src", "rn-mt", "shared", "App.ts"), "utf8")).not.toContain(
      'import theme from "../current/theme/index";',
    );

    try {
      execFileSync(
        process.execPath,
        [join(process.cwd(), "node_modules", "typescript", "bin", "tsc"), "--noEmit", "-p", "tsconfig.json"],
        {
          cwd: repoDir,
          stdio: "pipe",
        },
      );
    } catch (error) {
      throw new Error(
        error instanceof Error && "stderr" in error
          ? `${String((error as { stdout?: Buffer; stderr?: Buffer }).stdout ?? Buffer.from(""))}\n${String((error as { stdout?: Buffer; stderr?: Buffer }).stderr ?? Buffer.from(""))}`
          : "TypeScript alias fixture check failed.",
      );
    }

    expect(stderr).not.toHaveBeenCalled();
  });

  it("syncs the base runtime artifact and ownership metadata", () => {
    const stdout = vi.fn();
    const stderr = vi.fn();
    const writeFile = vi.fn();

    const exitCode = runCli(["sync", "--json"], {
      cwd: "/tmp/supported-fixture",
      io: { stdout, stderr },
      fileExists: (path) => path === "/tmp/supported-fixture/rn-mt.config.json",
      readFile: () =>
        JSON.stringify({
          schemaVersion: 1,
          source: { rootDir: "/tmp/supported-fixture" },
          defaults: { tenant: "demo-app", environment: "dev" },
          tenants: {
            "demo-app": { displayName: "Demo App" },
          },
          environments: {
            dev: { displayName: "Development" },
          },
        }),
      writeFile,
    });

    const output = stdout.mock.calls.map(([chunk]) => chunk).join("");
    const parsed = JSON.parse(output);

    expect(exitCode).toBe(0);
    expect(parsed.status).toBe("updated");
    expect(parsed.target).toEqual({
      tenant: "demo-app",
      environment: "dev",
    });
    expect(parsed.resolution).toEqual({
      appliedLayers: ["base", "environment:dev", "tenant:demo-app"],
    });
    expect(parsed.runtime).toEqual({
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
    expect(parsed.generatedFiles).toEqual([
      {
        path: "/tmp/supported-fixture/rn-mt.generated.runtime.json",
        kind: "runtime-artifact",
        changed: true,
      },
      {
        path: "/tmp/supported-fixture/rn-mt.generated.ownership.json",
        kind: "ownership-metadata",
        changed: true,
      },
    ]);
    expect(writeFile).toHaveBeenCalledTimes(2);
    expect(writeFile).toHaveBeenNthCalledWith(
      1,
      "/tmp/supported-fixture/rn-mt.generated.runtime.json",
      expect.stringContaining('"displayName": "Demo App"'),
    );
    expect(writeFile).toHaveBeenNthCalledWith(
      2,
      "/tmp/supported-fixture/rn-mt.generated.ownership.json",
      expect.stringContaining('"owner": "cli"'),
    );
    expect(stderr).not.toHaveBeenCalled();
  });

  it("fails sync with actionable diagnostics when required env inputs are missing", () => {
    const stdout = vi.fn();
    const stderr = vi.fn();
    const writeFile = vi.fn();

    const exitCode = runCli(["sync"], {
      cwd: "/tmp/supported-fixture",
      io: { stdout, stderr },
      env: {},
      fileExists: (path) => path === "/tmp/supported-fixture/rn-mt.config.json",
      readFile: () =>
        JSON.stringify({
          schemaVersion: 1,
          source: { rootDir: "/tmp/supported-fixture" },
          defaults: { tenant: "demo-app", environment: "dev" },
          envSchema: {
            apiBaseUrl: {
              source: "API_BASE_URL",
              required: true,
            },
          },
          tenants: {
            "demo-app": { displayName: "Demo App" },
          },
          environments: {
            dev: { displayName: "Development" },
          },
        }),
      writeFile,
    });

    const errorOutput = stderr.mock.calls.map(([chunk]) => chunk).join("");

    expect(exitCode).toBe(1);
    expect(stdout).not.toHaveBeenCalled();
    expect(errorOutput).toContain(
      "Missing required env inputs for demo-app/dev: apiBaseUrl (API_BASE_URL).",
    );
    expect(errorOutput).toContain(
      "Set these variables in the command environment before running sync.",
    );
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("does not rewrite sync artifacts when inputs are unchanged", () => {
    const files: Record<string, string> = {
      "/tmp/supported-fixture/rn-mt.config.json": JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: "/tmp/supported-fixture" },
        defaults: { tenant: "demo-app", environment: "dev" },
        tenants: {
          "demo-app": { displayName: "Demo App" },
        },
        environments: {
          dev: { displayName: "Development" },
        },
      }),
    };
    const writeFile = vi.fn((path: string, contents: string) => {
      files[path] = contents;
    });
    const readFile = (path: string) => {
      const contents = files[path];

      if (typeof contents !== "string") {
        throw new Error(`Missing test fixture file: ${path}`);
      }

      return contents;
    };

    const firstStdout = vi.fn();
    const firstStderr = vi.fn();
    const firstExitCode = runCli(["sync", "--json"], {
      cwd: "/tmp/supported-fixture",
      io: { stdout: firstStdout, stderr: firstStderr },
      fileExists: (path) => path in files,
      readFile,
      writeFile,
    });

    const secondStdout = vi.fn();
    const secondStderr = vi.fn();
    const secondExitCode = runCli(["sync", "--json"], {
      cwd: "/tmp/supported-fixture",
      io: { stdout: secondStdout, stderr: secondStderr },
      fileExists: (path) => path in files,
      readFile,
      writeFile,
    });

    const secondOutput = secondStdout.mock.calls.map(([chunk]) => chunk).join("");
    const secondParsed = JSON.parse(secondOutput);

    expect(firstExitCode).toBe(0);
    expect(secondExitCode).toBe(0);
    expect(writeFile).toHaveBeenCalledTimes(2);
    expect(secondParsed.status).toBe("unchanged");
    expect(secondParsed.resolution).toEqual({
      appliedLayers: ["base", "environment:dev", "tenant:demo-app"],
    });
    expect(secondParsed.generatedFiles).toEqual([
      {
        path: "/tmp/supported-fixture/rn-mt.generated.runtime.json",
        kind: "runtime-artifact",
        changed: false,
      },
      {
        path: "/tmp/supported-fixture/rn-mt.generated.ownership.json",
        kind: "ownership-metadata",
        changed: false,
      },
    ]);
    expect(firstStderr).not.toHaveBeenCalled();
    expect(secondStderr).not.toHaveBeenCalled();
  });

  it("keeps secret env inputs out of generated sync artifacts", () => {
    const stdout = vi.fn();
    const stderr = vi.fn();
    const writeFile = vi.fn();

    const exitCode = runCli(["sync", "--json"], {
      cwd: "/tmp/supported-fixture",
      io: { stdout, stderr },
      env: {
        API_BASE_URL: "https://api.example.com",
        API_SECRET: "super-secret-token",
      },
      fileExists: (path) => path === "/tmp/supported-fixture/rn-mt.config.json",
      readFile: () =>
        JSON.stringify({
          schemaVersion: 1,
          source: { rootDir: "/tmp/supported-fixture" },
          defaults: { tenant: "demo-app", environment: "dev" },
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
            "demo-app": { displayName: "Demo App" },
          },
          environments: {
            dev: { displayName: "Development" },
          },
        }),
      writeFile,
    });

    const output = stdout.mock.calls.map(([chunk]) => chunk).join("");
    const parsed = JSON.parse(output);
    const runtimeWrite = writeFile.mock.calls.find(
      ([path]) => path === "/tmp/supported-fixture/rn-mt.generated.runtime.json",
    );

    expect(exitCode).toBe(0);
    expect(parsed.status).toBe("updated");
    expect(parsed.runtime.env).toEqual({
      id: "dev",
    });
    expect(runtimeWrite?.[1]).toBeDefined();
    expect(runtimeWrite?.[1]).not.toContain("https://api.example.com");
    expect(runtimeWrite?.[1]).not.toContain("super-secret-token");
    expect(runtimeWrite?.[1]).not.toContain("API_SECRET");
    expect(stderr).not.toHaveBeenCalled();
  });

  it("loads canonical env files and injects the merged values into run subprocesses", () => {
    const stdout = vi.fn();
    const stderr = vi.fn();
    const runSubprocess = vi.fn(() => ({ status: 0 }));
    const files: Record<string, string> = {
      "/tmp/supported-fixture/rn-mt.config.json": JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: "/tmp/supported-fixture" },
        defaults: { tenant: "demo-app", environment: "dev" },
        envSchema: {
          apiBaseUrl: {
            source: "API_BASE_URL",
            required: true,
          },
        },
        tenants: {
          "demo-app": { displayName: "Demo App" },
        },
        environments: {
          dev: { displayName: "Development" },
        },
      }),
      "/tmp/supported-fixture/.env.dev": [
        "API_BASE_URL=https://dev.example.com",
        "SHARED_ONLY=shared",
        "OVERRIDE_ME=environment",
        "",
      ].join("\n"),
      "/tmp/supported-fixture/.env.demo-app.dev": [
        "OVERRIDE_ME=tenant",
        "TENANT_ONLY=tenant",
        "",
      ].join("\n"),
    };

    const exitCode = runCli(["run", "--json", "--", "node", "-e", "console.log('ok')"], {
      cwd: "/tmp/supported-fixture",
      io: { stdout, stderr },
      env: {
        PATH: "/usr/bin",
      },
      fileExists: (path) => path in files,
      readFile: (path) => {
        const contents = files[path];

        if (typeof contents !== "string") {
          throw new Error(`Missing test fixture file: ${path}`);
        }

        return contents;
      },
      runSubprocess,
    });

    const output = stdout.mock.calls.map(([chunk]) => chunk).join("");
    const parsed = JSON.parse(output);

    expect(exitCode).toBe(0);
    expect(runSubprocess).toHaveBeenCalledOnce();
    expect(runSubprocess).toHaveBeenCalledWith(
      "node",
      ["-e", "console.log('ok')"],
      {
        cwd: "/tmp/supported-fixture",
        env: expect.objectContaining({
          PATH: "/usr/bin",
          API_BASE_URL: "https://dev.example.com",
          SHARED_ONLY: "shared",
          TENANT_ONLY: "tenant",
          OVERRIDE_ME: "tenant",
        }),
      },
    );
    expect(parsed.loadedEnvFiles).toEqual([
      {
        path: "/tmp/supported-fixture/.env.dev",
        scope: "environment",
      },
      {
        path: "/tmp/supported-fixture/.env.demo-app.dev",
        scope: "tenant-environment",
      },
    ]);
    expect(stderr).not.toHaveBeenCalled();
  });

  it("fails run when required env inputs remain missing after optional file loading", () => {
    const stdout = vi.fn();
    const stderr = vi.fn();
    const runSubprocess = vi.fn(() => ({ status: 0 }));

    const exitCode = runCli(["run", "--", "node", "-e", "console.log('ok')"], {
      cwd: "/tmp/supported-fixture",
      io: { stdout, stderr },
      env: {},
      fileExists: (path) => path === "/tmp/supported-fixture/rn-mt.config.json",
      readFile: () =>
        JSON.stringify({
          schemaVersion: 1,
          source: { rootDir: "/tmp/supported-fixture" },
          defaults: { tenant: "demo-app", environment: "dev" },
          envSchema: {
            apiBaseUrl: {
              source: "API_BASE_URL",
              required: true,
            },
          },
          tenants: {
            "demo-app": { displayName: "Demo App" },
          },
          environments: {
            dev: { displayName: "Development" },
          },
        }),
      runSubprocess,
    });

    const errorOutput = stderr.mock.calls.map(([chunk]) => chunk).join("");

    expect(exitCode).toBe(1);
    expect(runSubprocess).not.toHaveBeenCalled();
    expect(stdout).not.toHaveBeenCalled();
    expect(errorOutput).toContain(
      "Missing required env inputs for demo-app/dev: apiBaseUrl (API_BASE_URL).",
    );
    expect(errorOutput).toContain(
      "Set these variables in the command environment before running rn-mt run.",
    );
  });

  it("emits derived non-production identity values in sync output", () => {
    const stdout = vi.fn();
    const stderr = vi.fn();
    const writeFile = vi.fn();

    const exitCode = runCli(["sync", "--json"], {
      cwd: "/tmp/supported-fixture",
      io: { stdout, stderr },
      fileExists: (path) => path === "/tmp/supported-fixture/rn-mt.config.json",
      readFile: () =>
        JSON.stringify({
          schemaVersion: 1,
          source: { rootDir: "/tmp/supported-fixture" },
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
        }),
      writeFile,
    });

    const output = stdout.mock.calls.map(([chunk]) => chunk).join("");
    const parsed = JSON.parse(output);

    expect(exitCode).toBe(0);
    expect(parsed.runtime.identity).toEqual({
      displayName: "Keep Nexus (Staging)",
      nativeId: "com.keep.nexus.staging",
    });
    expect(parsed.runtime.config.identity).toEqual({
      appName: "Keep Nexus",
      displayName: "Keep Nexus (Staging)",
      nativeId: "com.keep.nexus.staging",
    });
    expect(stderr).not.toHaveBeenCalled();
  });

  it("applies platform and combination layers during sync when --platform is provided", () => {
    const stdout = vi.fn();
    const stderr = vi.fn();
    const writeFile = vi.fn();

    const exitCode = runCli(["sync", "--json", "--platform", "android"], {
      cwd: "/tmp/supported-fixture",
      io: { stdout, stderr },
      fileExists: (path) => path === "/tmp/supported-fixture/rn-mt.config.json",
      readFile: () =>
        JSON.stringify({
          schemaVersion: 1,
          source: { rootDir: "/tmp/supported-fixture" },
          config: {
            color: "base",
          },
          flags: {
            banner: "base",
          },
          defaults: { tenant: "demo-app", environment: "dev" },
          tenants: {
            "demo-app": {
              displayName: "Demo App",
              config: {
                color: "tenant",
              },
            },
          },
          environments: {
            dev: {
              displayName: "Development",
              config: {
                color: "environment",
              },
            },
          },
          platforms: {
            android: {
              config: {
                color: "platform",
              },
            },
          },
          combinations: {
            "environment:dev+tenant:demo-app+platform:android": {
              config: {
                color: "combo",
              },
              flags: {
                banner: "combo",
              },
            },
          },
        }),
      writeFile,
    });

    const output = stdout.mock.calls.map(([chunk]) => chunk).join("");
    const parsed = JSON.parse(output);

    expect(exitCode).toBe(0);
    expect(parsed.target).toEqual({
      tenant: "demo-app",
      environment: "dev",
      platform: "android",
    });
    expect(parsed.resolution).toEqual({
      appliedLayers: [
        "base",
        "environment:dev",
        "tenant:demo-app",
        "platform:android",
        "combination:environment:dev+tenant:demo-app+platform:android",
      ],
    });
    expect(parsed.runtime.config).toEqual({
      color: "combo",
      identity: {
        displayName: "Demo App (Dev)",
        nativeId: "com.rnmt.demo-app.dev",
      },
    });
    expect(parsed.runtime.flags).toEqual({
      banner: "combo",
    });
    expect(writeFile).toHaveBeenCalledTimes(2);
    expect(stderr).not.toHaveBeenCalled();
  });

  it("blocks init for unsupported repos", () => {
    const stdout = vi.fn();
    const stderr = vi.fn();

    const exitCode = runCli(["init", "--non-interactive"], {
      cwd: "/tmp/unsupported-fixture",
      io: { stdout, stderr },
      analyzeReportFactory: () => unsupportedAnalyzeReport,
    });

    const errorOutput = stderr.mock.calls.map(([chunk]) => chunk).join("");

    expect(exitCode).toBe(1);
    expect(stdout).not.toHaveBeenCalled();
    expect(errorOutput).toContain(
      "Cannot initialize rn-mt.config.json from an unsupported repo shape.",
    );
  });

  it("skips init when the manifest already exists", () => {
    const stdout = vi.fn();
    const stderr = vi.fn();
    const writeFile = vi.fn();

    const exitCode = runCli(["init"], {
      cwd: "/tmp/supported-fixture",
      io: { stdout, stderr },
      analyzeReportFactory: () => supportedAnalyzeReport,
      fileExists: () => true,
      writeFile,
    });

    const output = stdout.mock.calls.map(([chunk]) => chunk).join("");

    expect(exitCode).toBe(0);
    expect(output).toContain(
      "Manifest already exists: /tmp/supported-fixture/rn-mt.config.json",
    );
    expect(writeFile).not.toHaveBeenCalled();
    expect(stderr).not.toHaveBeenCalled();
  });

  it("updates the shared default target in the manifest", () => {
    const stdout = vi.fn();
    const stderr = vi.fn();
    const writeFile = vi.fn();

    const exitCode = runCli(
      ["target", "set", "--tenant", "acme", "--environment", "staging", "--json"],
      {
        cwd: "/tmp/supported-fixture",
        io: { stdout, stderr },
        fileExists: () => true,
        readFile: () =>
          JSON.stringify({
            schemaVersion: 1,
            source: { rootDir: "/tmp/supported-fixture" },
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
        writeFile,
      },
    );

    const output = stdout.mock.calls.map(([chunk]) => chunk).join("");
    const parsed = JSON.parse(output);

    expect(exitCode).toBe(0);
    expect(parsed.status).toBe("updated");
    expect(parsed.defaults).toEqual({
      tenant: "acme",
      environment: "staging",
    });
    expect(writeFile).toHaveBeenCalledOnce();
    expect(stderr).not.toHaveBeenCalled();
  });

  it("rejects target set when the manifest is missing", () => {
    const stdout = vi.fn();
    const stderr = vi.fn();

    const exitCode = runCli(["target", "set", "--tenant", "acme", "--environment", "dev"], {
      cwd: "/tmp/supported-fixture",
      io: { stdout, stderr },
      fileExists: () => false,
    });

    const errorOutput = stderr.mock.calls.map(([chunk]) => chunk).join("");

    expect(exitCode).toBe(1);
    expect(stdout).not.toHaveBeenCalled();
    expect(errorOutput).toContain(
      "Manifest not found: /tmp/supported-fixture/rn-mt.config.json",
    );
  });

  it("rejects target set when the requested target is invalid", () => {
    const stdout = vi.fn();
    const stderr = vi.fn();

    const exitCode = runCli(["target", "set", "--tenant", "acme", "--environment", "dev"], {
      cwd: "/tmp/supported-fixture",
      io: { stdout, stderr },
      fileExists: () => true,
      readFile: () =>
        JSON.stringify({
          schemaVersion: 1,
          source: { rootDir: "/tmp/supported-fixture" },
          defaults: { tenant: "demo-app", environment: "dev" },
          tenants: {
            "demo-app": { displayName: "Demo App" },
          },
          environments: {
            dev: { displayName: "Development" },
          },
        }),
    });

    const errorOutput = stderr.mock.calls.map(([chunk]) => chunk).join("");

    expect(exitCode).toBe(1);
    expect(stdout).not.toHaveBeenCalled();
    expect(errorOutput).toContain("Unknown tenant: acme");
  });
});
