import { createHash } from "node:crypto";
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
import { basename, dirname, join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { RnMtBaselineAnalyzeReport } from "@_molaidrislabs/core";

import { runCli } from "./index";

const tempDirs: string[] = [];

function createTempRepo(prefix: string) {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(directory);
  return directory;
}

function createWorkflowFixtureRepo(
  prefix: string,
  appKind: "expo-managed" | "bare-react-native",
  options: {
    environment?: string;
    includeTenantEnv?: boolean;
  } = {},
) {
  const repoDir = createTempRepo(prefix);
  const environment = options.environment ?? "dev";

  if (appKind === "expo-managed") {
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
  } else {
    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "rn-fixture",
        dependencies: {
          "react-native": "0.85.0",
        },
      }),
    );
    mkdirSync(join(repoDir, "ios"), { recursive: true });
    mkdirSync(join(repoDir, "android"), { recursive: true });
  }

  writeFileSync(
    join(repoDir, "rn-mt.config.json"),
    JSON.stringify({
      schemaVersion: 1,
      source: { rootDir: repoDir },
      defaults: { tenant: "demo-app", environment },
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
        [environment]: { displayName: environment },
      },
    }),
  );
  writeFileSync(
    join(repoDir, `.env.${environment}`),
    `API_BASE_URL=https://${environment}.example.com\n`,
  );

  if (options.includeTenantEnv) {
    writeFileSync(
      join(repoDir, `.env.demo-app.${environment}`),
      "TENANT_ONLY=tenant\n",
    );
  }

  return repoDir;
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
    expect([
      "unknown",
      "expo-managed",
      "expo-prebuild",
      "bare-react-native",
    ]).toContain(parsed.repo.app.kind);
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
    ]).toContain(parsed.repo.app.kind);
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
    expect(errorOutput).toContain(
      "App candidates: expo-managed, expo-prebuild",
    );
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
      reason:
        "Ambiguous repo classification requires an explicit app-kind selection.",
      remediation: ambiguousAnalyzeReport.repo.app.remediation,
    });
    expect(stderr).not.toHaveBeenCalled();
  });

  it("prompts in interactive mode and records the selected app kind for the current run", () => {
    const stdout = vi.fn();
    const stderr = vi.fn();
    const promptForAppKind = vi.fn<
      typeof runCli extends (
        args: string[],
        options?: infer TOptions,
      ) => unknown
        ? NonNullable<
            TOptions extends { promptForAppKind?: infer TPrompt }
              ? TPrompt
              : never
          >
        : never
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

    const exitCode = runCli(
      ["analyze", "--json", "--app-kind", "expo-managed"],
      {
        cwd: process.cwd(),
        io: { stdout, stderr },
        analyzeReportFactory: () => ambiguousAnalyzeReport,
      },
    );

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
    expect(parsed.manifestPath).toBe(
      "/tmp/supported-fixture/rn-mt.config.json",
    );
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
      expect.stringContaining(
        "export const rnMtHostLanguage = 'typescript' as const",
      ),
    );
    expect(stderr).not.toHaveBeenCalled();
  });

  it("analyzes an explicit app root inside a larger workspace", () => {
    const repoDir = createTempRepo("rn-mt-cli-app-root-analyze-");
    const appRoot = join(repoDir, "apps", "mobile");
    const stdout = vi.fn();
    const stderr = vi.fn();

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

    const exitCode = runCli(
      ["analyze", "--json", "--app-root", "apps/mobile"],
      {
        cwd: repoDir,
        io: { stdout, stderr },
      },
    );
    const parsed = JSON.parse(
      stdout.mock.calls.map(([chunk]) => chunk).join(""),
    );

    expect(exitCode).toBe(0);
    expect(parsed.repo.rootDir).toBe(appRoot);
    expect(parsed.repo.app.kind).toBe("expo-managed");
    expect(stderr).not.toHaveBeenCalled();
  });

  it("initializes a manifest inside an explicit app root from the workspace root", () => {
    const repoDir = createTempRepo("rn-mt-cli-app-root-init-");
    const appRoot = join(repoDir, "apps", "mobile");
    const stdout = vi.fn();
    const stderr = vi.fn();

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

    const exitCode = runCli(["init", "--json", "--app-root", "apps/mobile"], {
      cwd: repoDir,
      io: { stdout, stderr },
    });
    const parsed = JSON.parse(
      stdout.mock.calls.map(([chunk]) => chunk).join(""),
    );

    expect(exitCode).toBe(0);
    expect(parsed.manifestPath).toBe(join(appRoot, "rn-mt.config.json"));
    expect(parsed.manifest.source.rootDir).toBe(appRoot);
    expect(parsed.generatedHostFiles).toEqual([
      {
        path: join(appRoot, "rn-mt.generated.js"),
        language: "javascript",
      },
    ]);
    expect(existsSync(join(appRoot, "rn-mt.config.json"))).toBe(true);
    expect(existsSync(join(repoDir, "rn-mt.config.json"))).toBe(false);
    expect(stderr).not.toHaveBeenCalled();
  });

  it("rejects cross-root config leakage when app-root and config scope disagree", () => {
    const repoDir = createTempRepo("rn-mt-cli-app-root-guard-");
    const mobileRoot = join(repoDir, "apps", "mobile");
    const adminRoot = join(repoDir, "apps", "admin");
    const stdout = vi.fn();
    const stderr = vi.fn();

    mkdirSync(mobileRoot, { recursive: true });
    mkdirSync(adminRoot, { recursive: true });
    writeFileSync(
      join(mobileRoot, "rn-mt.config.json"),
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: mobileRoot },
        defaults: { tenant: "mobile-app", environment: "dev" },
        tenants: {
          "mobile-app": { displayName: "Mobile App" },
        },
        environments: {
          dev: { displayName: "Development" },
        },
      }),
    );

    const exitCode = runCli(
      [
        "sync",
        "--json",
        "--app-root",
        "apps/admin",
        "--config",
        "apps/mobile/rn-mt.config.json",
      ],
      {
        cwd: repoDir,
        io: { stdout, stderr },
      },
    );
    const errorOutput = stderr.mock.calls.map(([chunk]) => chunk).join("");

    expect(exitCode).toBe(1);
    expect(stdout).not.toHaveBeenCalled();
    expect(errorOutput).toContain("Cross-root config usage is not allowed.");
  });

  it("syncs from a workspace root when an explicit config path selects the app root", () => {
    const repoDir = createTempRepo("rn-mt-cli-config-path-sync-");
    const appRoot = join(repoDir, "apps", "mobile");
    const stdout = vi.fn();
    const stderr = vi.fn();

    mkdirSync(appRoot, { recursive: true });
    writeFileSync(
      join(appRoot, "rn-mt.config.json"),
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: appRoot },
        defaults: { tenant: "mobile-app", environment: "dev" },
        tenants: {
          "mobile-app": { displayName: "Mobile App" },
        },
        environments: {
          dev: { displayName: "Development" },
        },
      }),
    );

    const exitCode = runCli(
      ["sync", "--json", "--config", "apps/mobile/rn-mt.config.json"],
      {
        cwd: repoDir,
        io: { stdout, stderr },
      },
    );
    const parsed = JSON.parse(
      stdout.mock.calls.map(([chunk]) => chunk).join(""),
    );

    expect(exitCode).toBe(0);
    expect(parsed.command).toBe("sync");
    expect(parsed.target).toEqual({
      tenant: "mobile-app",
      environment: "dev",
    });
    expect(existsSync(join(appRoot, "rn-mt.generated.runtime.json"))).toBe(
      true,
    );
    expect(existsSync(join(repoDir, "rn-mt.generated.runtime.json"))).toBe(
      false,
    );
    expect(stderr).not.toHaveBeenCalled();
  });

  it("allows repo commands to proceed when global and local rn-mt cli versions match", () => {
    const repoDir = createTempRepo("rn-mt-cli-version-compatible-");
    const stdout = vi.fn();
    const stderr = vi.fn();
    const writeFile = vi.fn();

    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "fixture-app",
        packageManager: "pnpm@10.25.0",
        devDependencies: {
      "@_molaidrislabs/rn-mt": "0.1.0",
        },
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

    const exitCode = runCli(["sync", "--json"], {
      cwd: repoDir,
      io: { stdout, stderr },
      writeFile,
    });

    const output = stdout.mock.calls.map(([chunk]) => chunk).join("");
    const parsed = JSON.parse(output);

    expect(exitCode).toBe(0);
    expect(parsed.command).toBe("sync");
    expect(parsed.status).toBe("updated");
    expect(stderr).not.toHaveBeenCalled();
    expect(writeFile).toHaveBeenCalled();
  });

  it("allows repo commands to proceed when the repo-local rn-mt cli is linked from the workspace package", () => {
    const repoDir = createTempRepo("rn-mt-cli-version-linked-compatible-");
    const linkedCliDir = createTempRepo("rn-mt-cli-linked-package-");
    const stdout = vi.fn();
    const stderr = vi.fn();
    const writeFile = vi.fn();

    writeFileSync(
      join(linkedCliDir, "package.json"),
      JSON.stringify({
      name: "@_molaidrislabs/rn-mt",
        version: "0.1.0",
      }),
    );
    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "fixture-app",
        packageManager: "pnpm@10.25.0",
        devDependencies: {
      "@_molaidrislabs/rn-mt": `link:${linkedCliDir}`,
        },
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

    const exitCode = runCli(["sync", "--json"], {
      cwd: repoDir,
      io: { stdout, stderr },
      writeFile,
    });

    const output = stdout.mock.calls.map(([chunk]) => chunk).join("");
    const parsed = JSON.parse(output);

    expect(exitCode).toBe(0);
    expect(parsed.command).toBe("sync");
    expect(parsed.status).toBe("updated");
    expect(stderr).not.toHaveBeenCalled();
    expect(writeFile).toHaveBeenCalled();
  });

  it("fails fast with upgrade guidance when global and local rn-mt cli versions drift", () => {
    const repoDir = createTempRepo("rn-mt-cli-version-incompatible-");
    const stdout = vi.fn();
    const stderr = vi.fn();
    const writeFile = vi.fn();

    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "fixture-app",
        packageManager: "pnpm@10.25.0",
        devDependencies: {
      "@_molaidrislabs/rn-mt": "0.2.0",
        },
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

    const exitCode = runCli(["sync", "--json"], {
      cwd: repoDir,
      io: { stdout, stderr },
      writeFile,
    });

    const output = stdout.mock.calls.map(([chunk]) => chunk).join("");
    const parsed = JSON.parse(output);

    expect(exitCode).toBe(1);
    expect(parsed.command).toBe("sync");
    expect(parsed.status).toBe("blocked");
    expect(parsed.reason).toContain(
      "Global rn-mt CLI version 0.1.0 is incompatible with repo-local @_molaidrislabs/rn-mt version 0.2.0.",
    );
    expect(parsed.compatibility).toEqual({
      globalVersion: "0.1.0",
      localVersion: "0.2.0",
      installCommand: "pnpm install",
    });
    expect(parsed.remediation).toEqual([
      "Upgrade or reinstall the global rn-mt CLI to version 0.2.0.",
      "Run pnpm install after aligning the repo-local rn-mt package versions.",
    ]);
    expect(stderr).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
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
        packageManager: "pnpm@10.25.0",
        dependencies: { expo: "~52.0.0" },
      }),
    );
    writeFileSync(join(repoDir, "README.md"), "# Fixture App\n");
    writeFileSync(
      join(repoDir, "app.json"),
      JSON.stringify({ expo: { name: "FixtureApp" } }),
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
    mkdirSync(join(repoDir, ".github", "workflows"), { recursive: true });
    writeFileSync(
      join(repoDir, ".github", "workflows", "release.yml"),
      "name: release\n",
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
    expect(parsed.packageManager).toEqual({
      name: "pnpm",
      source: "packageManager-field",
      raw: "pnpm@10.25.0",
    });
    expect(parsed.installCommand).toBe("pnpm install");
    expect(parsed.localPackages).toEqual([
      {
      name: "@_molaidrislabs/rn-mt",
        version: "0.1.0",
        section: "dependencies",
      },
    ]);
    expect(parsed.userOwnedFiles).toEqual([
      {
        path: join(repoDir, "src", "rn-mt", "extensions", "index.ts"),
        changed: true,
      },
    ]);
    expect(readFileSync(join(repoDir, "App.tsx"), "utf8")).toContain(
      "CLI-owned wrapper",
    );
    expect(readFileSync(join(repoDir, "index.js"), "utf8")).toContain(
      'import "./src/rn-mt/current/index";',
    );
    expect(
      readFileSync(join(repoDir, "src", "rn-mt", "shared", "App.tsx"), "utf8"),
    ).toContain('import theme from "../current/theme/index";');
    expect(
      readFileSync(join(repoDir, "src", "rn-mt", "shared", "App.tsx"), "utf8"),
    ).toContain('import config from "../current/src/config/index";');
    expect(
      readFileSync(join(repoDir, "src", "rn-mt", "current", "App.tsx"), "utf8"),
    ).toContain('export { default } from "../shared/App";');
    expect(
      readFileSync(
        join(repoDir, "src", "rn-mt", "current", "theme", "index.ts"),
        "utf8",
      ),
    ).toContain("../../shared/theme/index");
    expect(
      readFileSync(
        join(repoDir, "src", "rn-mt", "current", "runtime.ts"),
        "utf8",
      ),
    ).toContain("createRuntimeAccessors");
    expect(
      readFileSync(
        join(repoDir, "src", "rn-mt", "shared", "theme", "index.ts"),
        "utf8",
      ),
    ).toContain("../../current/assets/logo.png");
    expect(
      readFileSync(
        join(repoDir, "src", "rn-mt", "shared", "src", "config", "index.ts"),
        "utf8",
      ),
    ).toContain("apiBaseUrl");
    expect(
      readFileSync(
        join(repoDir, "src", "rn-mt", "shared", "App.test.tsx"),
        "utf8",
      ),
    ).toContain('import App from "../current/App";');
    expect(
      readFileSync(
        join(repoDir, "rn-mt.generated.convert.ownership.json"),
        "utf8",
      ),
    ).toContain('"owner": "cli"');
    expect(
      readFileSync(join(repoDir, "rn-mt.generated.README.md"), "utf8"),
    ).toContain("# rn-mt Ownership and Handoff Guide");
    expect(
      readFileSync(join(repoDir, "rn-mt.generated.README.md"), "utf8"),
    ).toContain("## CLI-owned files");
    expect(
      readFileSync(join(repoDir, "rn-mt.generated.README.md"), "utf8"),
    ).toContain("## User-owned files");
    expect(
      readFileSync(join(repoDir, "rn-mt.generated.README.md"), "utf8"),
    ).toContain("## Handoff expectations");
    expect(readFileSync(join(repoDir, "README.md"), "utf8")).toContain(
      "[rn-mt ownership and handoff guide](./rn-mt.generated.README.md)",
    );
    expect(readFileSync(join(repoDir, "package.json"), "utf8")).toContain(
      '"start": "rn-mt run -- expo start"',
    );
    expect(readFileSync(join(repoDir, "package.json"), "utf8")).toContain(
      '"android": "rn-mt run --platform android -- expo start --android"',
    );
    expect(readFileSync(join(repoDir, "package.json"), "utf8")).toContain(
      '"ios": "rn-mt run --platform ios -- expo start --ios"',
    );
    expect(readFileSync(join(repoDir, "package.json"), "utf8")).toContain(
      '"rn-mt:sync": "rn-mt sync"',
    );
    expect(readFileSync(join(repoDir, "package.json"), "utf8")).toContain(
      '"prestart": "rn-mt hook prestart"',
    );
    expect(readFileSync(join(repoDir, "package.json"), "utf8")).toContain(
      '"preandroid": "rn-mt hook preandroid"',
    );
    expect(readFileSync(join(repoDir, "package.json"), "utf8")).toContain(
      '"preios": "rn-mt hook preios"',
    );
    expect(readFileSync(join(repoDir, "package.json"), "utf8")).toContain(
      '"postinstall": "rn-mt hook postinstall"',
    );
    expect(readFileSync(join(repoDir, "package.json"), "utf8")).toContain(
      '"rn-mt:start": "rn-mt run -- expo start"',
    );
    expect(readFileSync(join(repoDir, "package.json"), "utf8")).toContain(
      '"@_molaidrislabs/rn-mt": "0.1.0"',
    );
    expect(
      readFileSync(
        join(repoDir, "src", "rn-mt", "extensions", "index.ts"),
        "utf8",
      ),
    ).toContain("User-owned rn-mt extension module");
    expect(parsed.movedFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourcePath: join(repoDir, "package.json"),
          destinationPath: join(repoDir, "package.json"),
          changed: true,
        }),
      ]),
    );
    expect(existsSync(join(repoDir, "theme", "index.ts"))).toBe(false);
    expect(existsSync(join(repoDir, "assets", "logo.png"))).toBe(true);
    expect(existsSync(join(repoDir, "App.test.tsx"))).toBe(false);
    expect(existsSync(join(repoDir, "src", "config", "index.ts"))).toBe(false);
    expect(existsSync(join(repoDir, "app.config.ts"))).toBe(true);
    expect(parsed.generatedFiles).toEqual(
      expect.arrayContaining([
        {
          path: join(repoDir, "app.config.ts"),
          kind: "expo-config-bridge",
          changed: true,
        },
        {
          path: join(repoDir, "rn-mt.generated.reconstruction.json"),
          kind: "reconstruction-metadata",
          changed: true,
        },
      ]),
    );
    expect(
      JSON.parse(
        readFileSync(
          join(repoDir, "rn-mt.generated.reconstruction.json"),
          "utf8",
        ),
      ),
    ).toEqual(
      expect.objectContaining({
        entries: expect.arrayContaining([
          expect.objectContaining({
            originalPath: "App.tsx",
            sharedPath: "src/rn-mt/shared/App.tsx",
            currentPath: "src/rn-mt/current/App.tsx",
            originalPathBehavior: "replaced-with-root-wrapper",
          }),
        ]),
      }),
    );
    expect(stderr).not.toHaveBeenCalled();
  });

  it("runs a no-op upgrade flow when packages, metadata, sync output, and audit are already current", () => {
    const repoDir = createTempRepo("rn-mt-cli-upgrade-noop-");
    const stdout = vi.fn();
    const stderr = vi.fn();

    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "fixture-app",
        packageManager: "pnpm@10.25.0",
        dependencies: {
          expo: "~52.0.0",
      "@_molaidrislabs/rn-mt": "0.1.0",
        },
      }),
    );
    writeFileSync(
      join(repoDir, "app.json"),
      JSON.stringify({ expo: { name: "FixtureApp" } }),
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
      join(repoDir, "App.tsx"),
      "export default function App() { return null; }\n",
    );
    writeFileSync(
      join(repoDir, "index.js"),
      "import { registerRootComponent } from 'expo';\nregisterRootComponent(App);\n",
    );
    mkdirSync(join(repoDir, ".rn-mt"), { recursive: true });
    writeFileSync(
      join(repoDir, ".rn-mt", "hook-state.json"),
      JSON.stringify({
        schemaVersion: 1,
        tool: "rn-mt",
        hooks: {},
      }),
    );

    expect(
      runCli(["sync", "--json"], {
        cwd: repoDir,
        io: { stdout: vi.fn(), stderr: vi.fn() },
      }),
    ).toBe(0);

    const exitCode = runCli(["upgrade", "--json"], {
      cwd: repoDir,
      io: { stdout, stderr },
      runSubprocess(command) {
        return {
          status: 1,
          error: new Error(`Unexpected subprocess: ${command}`),
        };
      },
    });
    const parsed = JSON.parse(
      stdout.mock.calls.map(([chunk]) => chunk).join(""),
    );

    expect(exitCode).toBe(0);
    expect(parsed.command).toBe("upgrade");
    expect(parsed.status).toBe("unchanged");
    expect(parsed.stages).toEqual([
      expect.objectContaining({
        name: "packages",
        status: "unchanged",
      }),
      expect.objectContaining({
        name: "metadata",
        status: "unchanged",
      }),
      expect.objectContaining({
        name: "sync",
        status: "unchanged",
      }),
      expect.objectContaining({
        name: "audit",
        status: "passed",
      }),
    ]);
    expect(parsed.audit.findings).toEqual([]);
    expect(stderr).not.toHaveBeenCalled();
  });

  it("upgrades package versions and migrates legacy hook metadata before sync and audit", () => {
    const repoDir = createTempRepo("rn-mt-cli-upgrade-migrate-");
    const stdout = vi.fn();
    const stderr = vi.fn();

    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "fixture-app",
        packageManager: "pnpm@10.25.0",
        dependencies: {
          expo: "~52.0.0",
      "@_molaidrislabs/rn-mt": "0.0.1",
        },
      }),
    );
    writeFileSync(
      join(repoDir, "app.json"),
      JSON.stringify({ expo: { name: "FixtureApp" } }),
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
      join(repoDir, "App.tsx"),
      "export default function App() { return null; }\n",
    );
    writeFileSync(
      join(repoDir, "index.js"),
      "import { registerRootComponent } from 'expo';\nregisterRootComponent(App);\n",
    );
    mkdirSync(join(repoDir, ".rn-mt"), { recursive: true });
    writeFileSync(
      join(repoDir, ".rn-mt", "hook-state.json"),
      JSON.stringify({
        schemaVersion: 0,
        hooks: {},
      }),
    );

    const exitCode = runCli(["upgrade", "--json"], {
      cwd: repoDir,
      io: { stdout, stderr },
      runSubprocess(command, args) {
        if (command === "pnpm" && args[0] === "install") {
          return { status: 0 };
        }

        return {
          status: 1,
          error: new Error(`Unexpected subprocess: ${command}`),
        };
      },
    });
    const parsed = JSON.parse(
      stdout.mock.calls.map(([chunk]) => chunk).join(""),
    );
    const upgradedPackageJson = JSON.parse(
      readFileSync(join(repoDir, "package.json"), "utf8"),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const migratedHookState = JSON.parse(
      readFileSync(join(repoDir, ".rn-mt", "hook-state.json"), "utf8"),
    ) as {
      schemaVersion: number;
      tool?: string;
      hooks: Record<string, unknown>;
    };

    expect(exitCode).toBe(0);
    expect(parsed.command).toBe("upgrade");
    expect(parsed.status).toBe("updated");
    expect(parsed.compatibility).toEqual(
      expect.objectContaining({
        status: "incompatible",
        globalVersion: "0.1.0",
        localVersion: "0.0.1",
      }),
    );
    expect(parsed.stages).toEqual([
      expect.objectContaining({
        name: "packages",
        status: "updated",
      }),
      expect.objectContaining({
        name: "metadata",
        status: "updated",
      }),
      expect.objectContaining({
        name: "sync",
        status: "updated",
      }),
      expect.objectContaining({
        name: "audit",
        status: "passed",
      }),
    ]);
    expect(upgradedPackageJson.dependencies?.["@_molaidrislabs/rn-mt"]).toBe("0.1.0");
    expect(migratedHookState.schemaVersion).toBe(1);
    expect(migratedHookState.tool).toBe("rn-mt");
    expect(parsed.audit.findings).toEqual([]);
    expect(stderr).not.toHaveBeenCalled();
  });

  it("previews codemod changes without mutating files by default", () => {
    const repoDir = createTempRepo("rn-mt-cli-codemod-preview-");
    const stdout = vi.fn();
    const stderr = vi.fn();

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

    expect(
      runCli(["convert", "--json"], {
        cwd: repoDir,
        io: { stdout: vi.fn(), stderr: vi.fn() },
      }),
    ).toBe(0);

    const regressedContents = [
      'import theme from "./theme/index";',
      'import config from "./src/config/index";',
      "",
      "export default function App() {",
      "  return theme && config ? null : null;",
      "}",
      "",
    ].join("\n");
    writeFileSync(
      join(repoDir, "src", "rn-mt", "shared", "App.tsx"),
      regressedContents,
    );

    const exitCode = runCli(["codemod", "current-imports", "--json"], {
      cwd: repoDir,
      io: { stdout, stderr },
    });
    const parsed = JSON.parse(
      stdout.mock.calls.map(([chunk]) => chunk).join(""),
    );

    expect(exitCode).toBe(0);
    expect(parsed.command).toBe("codemod");
    expect(parsed.codemod).toBe("current-imports");
    expect(parsed.status).toBe("preview");
    expect(parsed.write).toBe(false);
    expect(parsed.changes).toEqual([
      expect.objectContaining({
        path: join(repoDir, "src", "rn-mt", "shared", "App.tsx"),
        before: regressedContents,
        after: expect.stringContaining(
          'import theme from "../current/theme/index";',
        ),
      }),
    ]);
    expect(
      readFileSync(join(repoDir, "src", "rn-mt", "shared", "App.tsx"), "utf8"),
    ).toBe(regressedContents);
    expect(stderr).not.toHaveBeenCalled();
  });

  it("applies the same codemod changes only when --write is passed", () => {
    const repoDir = createTempRepo("rn-mt-cli-codemod-write-");
    const stdout = vi.fn();
    const stderr = vi.fn();

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

    expect(
      runCli(["convert", "--json"], {
        cwd: repoDir,
        io: { stdout: vi.fn(), stderr: vi.fn() },
      }),
    ).toBe(0);

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

    const exitCode = runCli(
      ["codemod", "current-imports", "--write", "--json"],
      {
        cwd: repoDir,
        io: { stdout, stderr },
      },
    );
    const parsed = JSON.parse(
      stdout.mock.calls.map(([chunk]) => chunk).join(""),
    );

    expect(exitCode).toBe(0);
    expect(parsed.command).toBe("codemod");
    expect(parsed.status).toBe("written");
    expect(parsed.write).toBe(true);
    expect(
      readFileSync(join(repoDir, "src", "rn-mt", "shared", "App.tsx"), "utf8"),
    ).toContain('import theme from "../current/theme/index";');
    expect(
      readFileSync(join(repoDir, "src", "rn-mt", "shared", "App.tsx"), "utf8"),
    ).toContain('import config from "../current/src/config/index";');
    expect(stderr).not.toHaveBeenCalled();
  });

  it("preserves reconstruction metadata across later sync runs", () => {
    const repoDir = createTempRepo("rn-mt-cli-convert-reconstruction-persist-");
    const convertStdout = vi.fn();
    const convertStderr = vi.fn();
    const syncStdout = vi.fn();
    const syncStderr = vi.fn();

    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "fixture-app",
        packageManager: "pnpm@10.25.0",
        dependencies: { expo: "~52.0.0" },
      }),
    );
    writeFileSync(
      join(repoDir, "app.json"),
      JSON.stringify({ expo: { name: "FixtureApp" } }),
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
      join(repoDir, "App.tsx"),
      "export default function App() { return null; }\n",
    );
    writeFileSync(
      join(repoDir, "index.js"),
      "import { registerRootComponent } from 'expo';\nregisterRootComponent(App);\n",
    );

    expect(
      runCli(["convert", "--json"], {
        cwd: repoDir,
        io: { stdout: convertStdout, stderr: convertStderr },
      }),
    ).toBe(0);

    const reconstructionPath = join(
      repoDir,
      "rn-mt.generated.reconstruction.json",
    );
    const reconstructionContentsBeforeSync = readFileSync(
      reconstructionPath,
      "utf8",
    );
    const reconstructionHashBeforeSync = createHash("sha256")
      .update(reconstructionContentsBeforeSync)
      .digest("hex");

    expect(
      runCli(["sync", "--json"], {
        cwd: repoDir,
        io: { stdout: syncStdout, stderr: syncStderr },
      }),
    ).toBe(0);

    const reconstructionContentsAfterSync = readFileSync(
      reconstructionPath,
      "utf8",
    );
    const reconstructionHashAfterSync = createHash("sha256")
      .update(reconstructionContentsAfterSync)
      .digest("hex");

    expect(reconstructionHashAfterSync).toBe(reconstructionHashBeforeSync);
    expect(JSON.parse(reconstructionContentsAfterSync)).toEqual(
      expect.objectContaining({
        entries: expect.arrayContaining([
          expect.objectContaining({
            originalPath: "App.tsx",
            sharedPath: "src/rn-mt/shared/App.tsx",
          }),
          expect.objectContaining({
            originalPath: "index.js",
            sharedPath: "src/rn-mt/shared/index.js",
          }),
        ]),
      }),
    );
    expect(convertStderr).not.toHaveBeenCalled();
    expect(syncStderr).not.toHaveBeenCalled();
  });

  it("fails convert when a generated facade target already exists without CLI ownership metadata", () => {
    const repoDir = createTempRepo("rn-mt-cli-convert-ownership-conflict-");
    const stdout = vi.fn();
    const stderr = vi.fn();

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
      "export default function App() { return null; }\n",
    );
    mkdirSync(join(repoDir, "theme"), { recursive: true });
    writeFileSync(
      join(repoDir, "theme", "index.ts"),
      "export default { color: 'shared' };\n",
    );
    mkdirSync(join(repoDir, "src", "rn-mt", "current", "theme"), {
      recursive: true,
    });
    writeFileSync(
      join(repoDir, "src", "rn-mt", "current", "theme", "index.ts"),
      "// user-owned conflict\n",
    );

    const exitCode = runCli(["convert"], {
      cwd: repoDir,
      io: { stdout, stderr },
    });
    const errorOutput = stderr.mock.calls.map(([chunk]) => chunk).join("");

    expect(exitCode).toBe(1);
    expect(errorOutput).toContain(
      "Refusing to overwrite generated artifact without CLI ownership metadata",
    );
    expect(errorOutput).toContain("src/rn-mt/current/theme/index.ts");
    expect(stdout).not.toHaveBeenCalled();
  });

  it("preserves an existing user-owned extension file during convert", () => {
    const repoDir = createTempRepo("rn-mt-cli-convert-extension-preserve-");
    const stdout = vi.fn();
    const stderr = vi.fn();

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
      "export default function App() { return null; }\n",
    );
    mkdirSync(join(repoDir, "src", "rn-mt", "extensions"), { recursive: true });
    writeFileSync(
      join(repoDir, "src", "rn-mt", "extensions", "index.ts"),
      "export const rnMtExtensions = { custom: true };\n",
    );

    const exitCode = runCli(["convert", "--json"], {
      cwd: repoDir,
      io: { stdout, stderr },
    });
    const output = stdout.mock.calls.map(([chunk]) => chunk).join("");
    const parsed = JSON.parse(output);

    expect(exitCode).toBe(0);
    expect(parsed.userOwnedFiles).toEqual([
      {
        path: join(repoDir, "src", "rn-mt", "extensions", "index.ts"),
        changed: false,
      },
    ]);
    expect(
      readFileSync(
        join(repoDir, "src", "rn-mt", "extensions", "index.ts"),
        "utf8",
      ),
    ).toBe("export const rnMtExtensions = { custom: true };\n");
    expect(stderr).not.toHaveBeenCalled();
  });

  it("bridges an explicit host config module through an optional convert path", () => {
    const repoDir = createTempRepo("rn-mt-cli-convert-bridge-config-");
    const stdout = vi.fn();
    const stderr = vi.fn();

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

    const exitCode = runCli(
      ["convert", "--json", "--bridge-config", "src/config/index.ts"],
      {
        cwd: repoDir,
        io: { stdout, stderr },
      },
    );
    const output = stdout.mock.calls.map(([chunk]) => chunk).join("");
    const parsed = JSON.parse(output);

    expect(exitCode).toBe(0);
    expect(parsed.generatedFiles).toEqual(
      expect.arrayContaining([
        {
          path: join(repoDir, "src", "config", "index.ts"),
          kind: "host-config-bridge",
          changed: true,
        },
      ]),
    );
    expect(
      readFileSync(join(repoDir, "src", "config", "index.ts"), "utf8"),
    ).toContain("CLI-owned host config bridge");
    expect(
      readFileSync(
        join(repoDir, "src", "rn-mt", "shared", "src", "config", "index.ts"),
        "utf8",
      ),
    ).toContain("apiBaseUrl");
    expect(stderr).not.toHaveBeenCalled();
  });

  it("rejects unsupported bridge module paths during convert", () => {
    const repoDir = createTempRepo("rn-mt-cli-convert-bridge-reject-");
    const stdout = vi.fn();
    const stderr = vi.fn();

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
    mkdirSync(join(repoDir, "theme"), { recursive: true });
    writeFileSync(
      join(repoDir, "App.tsx"),
      "export default function App() { return null; }\n",
    );
    writeFileSync(
      join(repoDir, "theme", "index.ts"),
      "export default { color: 'shared' };\n",
    );

    const exitCode = runCli(["convert", "--bridge-config", "theme/index.ts"], {
      cwd: repoDir,
      io: { stdout, stderr },
    });
    const errorOutput = stderr.mock.calls.map(([chunk]) => chunk).join("");

    expect(exitCode).toBe(1);
    expect(errorOutput).toContain(
      "Bridge mode only supports explicit host config modules.",
    );
    expect(stdout).not.toHaveBeenCalled();
  });

  it("reports detected package-manager install guidance during convert", () => {
    const repoDir = createTempRepo("rn-mt-cli-convert-install-guidance-");
    const stdout = vi.fn();
    const stderr = vi.fn();

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
      "export default function App() { return null; }\n",
    );

    const exitCode = runCli(["convert"], {
      cwd: repoDir,
      io: { stdout, stderr },
    });
    const output = stdout.mock.calls.map(([chunk]) => chunk).join("");

    expect(exitCode).toBe(0);
    expect(output).toContain("Detected package manager: yarn (yarn-lock)");
    expect(output).toContain("Install local rn-mt packages: yarn install");
    expect(readFileSync(join(repoDir, "package.json"), "utf8")).toContain(
      '"@_molaidrislabs/rn-mt": "0.1.0"',
    );
    expect(stderr).not.toHaveBeenCalled();
  });

  it("runs hook-driven sync incrementally and prints a visible target banner", () => {
    const repoDir = createTempRepo("rn-mt-cli-hook-");
    const firstStdout = vi.fn();
    const firstStderr = vi.fn();
    const secondStdout = vi.fn();
    const secondStderr = vi.fn();

    mkdirSync(join(repoDir, "ios", "KeepNexus.xcodeproj"), { recursive: true });
    writeFileSync(
      join(repoDir, "app.json"),
      JSON.stringify({ expo: { name: "FixtureApp" } }),
    );
    writeFileSync(
      join(repoDir, "rn-mt.config.json"),
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: repoDir },
        config: {
          identity: {
            appName: "Keep Nexus",
            nativeId: "com.keep.nexus",
          },
        },
        defaults: { tenant: "fixture-app", environment: "staging" },
        tenants: {
          "fixture-app": { displayName: "Fixture App" },
        },
        environments: {
          staging: { displayName: "Staging" },
        },
        platforms: {
          ios: {},
        },
      }),
    );

    const firstExitCode = runCli(["hook", "preios"], {
      cwd: repoDir,
      io: { stdout: firstStdout, stderr: firstStderr },
    });
    const secondExitCode = runCli(["hook", "preios"], {
      cwd: repoDir,
      io: { stdout: secondStdout, stderr: secondStderr },
    });
    const firstOutput = firstStdout.mock.calls.map(([chunk]) => chunk).join("");
    const secondOutput = secondStdout.mock.calls
      .map(([chunk]) => chunk)
      .join("");

    expect(firstExitCode).toBe(0);
    expect(secondExitCode).toBe(0);
    expect(firstOutput).toContain("[rn-mt]");
    expect(firstOutput).toContain("target=fixture-app/staging/ios");
    expect(firstOutput).toContain('identity="Keep Nexus (Staging)"');
    expect(firstOutput).toContain("nativeId=com.keep.nexus.staging");
    expect(firstOutput).toContain("config=rn-mt.config.json");
    expect(firstOutput).toContain("sync=updated");
    expect(secondOutput).toContain("sync=up-to-date");
    expect(
      readFileSync(join(repoDir, ".rn-mt", "hook-state.json"), "utf8"),
    ).toContain('"preios"');
    expect(firstStderr).not.toHaveBeenCalled();
    expect(secondStderr).not.toHaveBeenCalled();
  });

  it("converts repos whose tsconfig uses JSONC comments and trailing commas", () => {
    const repoDir = createTempRepo("rn-mt-cli-jsonc-convert-");
    const stdout = vi.fn();
    const stderr = vi.fn();

    mkdirSync(join(repoDir, ".git"));
    mkdirSync(join(repoDir, "components"), { recursive: true });
    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "fixture-app",
        dependencies: { expo: "~54.0.0" },
      }),
    );
    writeFileSync(
      join(repoDir, "app.json"),
      JSON.stringify({ expo: { name: "FixtureApp" } }),
    );
    writeFileSync(
      join(repoDir, "tsconfig.json"),
      `{
  // preserve alias style during convert
  "compilerOptions": {
    "paths": {
      "@components/*": ["./components/*"],
    },
  },
}`,
    );
    writeFileSync(
      join(repoDir, "App.tsx"),
      [
        'import { BrandButton } from "@components/BrandButton";',
        "",
        "export default function App() {",
        "  return BrandButton();",
        "}",
        "",
      ].join("\n"),
    );
    writeFileSync(
      join(repoDir, "components", "BrandButton.tsx"),
      [
        "export function BrandButton() {",
        '  return "brand";',
        "}",
        "",
      ].join("\n"),
    );

    expect(
      runCli(["init"], {
        cwd: repoDir,
        io: { stdout, stderr },
      }),
    ).toBe(0);
    expect(
      runCli(["convert"], {
        cwd: repoDir,
        io: { stdout, stderr },
      }),
    ).toBe(0);
    const rewrittenTsconfig = readFileSync(join(repoDir, "tsconfig.json"), "utf8");
    expect(rewrittenTsconfig).toContain('"baseUrl": "."');
    expect(rewrittenTsconfig).toContain("src/rn-mt/current/components/*");
    expect(stderr).not.toHaveBeenCalled();
  });

  it("rewrites touched imports to canonical relative paths in a no-alias TypeScript fixture", () => {
    const repoDir = createTempRepo("rn-mt-cli-no-alias-convert-");
    const stdout = vi.fn();
    const stderr = vi.fn();

    mkdirSync(join(repoDir, ".git"));
    mkdirSync(join(repoDir, "theme"), { recursive: true });
    mkdirSync(join(repoDir, "src", "config"), { recursive: true });
    mkdirSync(join(repoDir, "node_modules", "@_molaidrislabs", "runtime"), {
      recursive: true,
    });
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
    mkdirSync(
      join(repoDir, "node_modules", "@_molaidrislabs", "rn-mt", "runtime"),
      {
        recursive: true,
      },
    );
    writeFileSync(
      join(repoDir, "node_modules", "@_molaidrislabs", "rn-mt", "runtime", "package.json"),
      JSON.stringify({
        name: "@_molaidrislabs/rn-mt/runtime",
        types: "index.d.ts",
      }),
    );
    writeFileSync(
      join(repoDir, "node_modules", "@_molaidrislabs", "rn-mt", "runtime", "index.d.ts"),
      [
        "export interface ResolvedTenantRuntime {",
        "  config: Record<string, unknown>;",
        "  tenant: { id: string; displayName: string };",
        "  env: { id: string };",
        "  flags: Record<string, unknown>;",
        "  assets: Record<string, string>;",
        "  routes: Array<{ id: string; path: string; screen: string }>;",
        "  features: Array<{ id: string; module: string; enabledByFlag?: string }>;",
        "  menus: Array<{ id: string; label: string; actionId: string; enabledByFlag?: string }>;",
        "  actions: Array<{ id: string; label: string; handler: string; enabledByFlag?: string }>;",
        "}",
        "export function createRuntimeAccessors(runtime: ResolvedTenantRuntime): {",
        "  getConfig(): Record<string, unknown>;",
        "  getTenant(): { id: string; displayName: string };",
        "  getEnv(): { id: string };",
        "  getFlags(): Record<string, unknown>;",
        "  getAssets(): Record<string, string>;",
        "  getRoutes(): Array<{ id: string; path: string; screen: string }>;",
        "  getFeatures(): Array<{ id: string; module: string; enabledByFlag?: string }>;",
        "  getMenus(): Array<{ id: string; label: string; actionId: string; enabledByFlag?: string }>;",
        "  getActions(): Array<{ id: string; label: string; handler: string; enabledByFlag?: string }>;",
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
        routes: [],
        features: [],
        menus: [],
        actions: [],
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
      ['import App from "./App";', "", "export default App;", ""].join("\n"),
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
    expect(
      readFileSync(join(repoDir, "src", "rn-mt", "shared", "App.ts"), "utf8"),
    ).toContain('import theme from "../current/theme/index";');
    expect(
      readFileSync(join(repoDir, "src", "rn-mt", "shared", "App.ts"), "utf8"),
    ).toContain('import config from "../current/src/config/index";');
    expect(
      readFileSync(join(repoDir, "src", "rn-mt", "shared", "index.ts"), "utf8"),
    ).toContain('import App from "../current/App";');
    expect(
      readFileSync(join(repoDir, "src", "rn-mt", "shared", "App.ts"), "utf8"),
    ).not.toContain('import theme from "./theme";');
    expect(
      readFileSync(join(repoDir, "src", "rn-mt", "shared", "index.ts"), "utf8"),
    ).not.toContain('import App from "./App";');

    try {
      execFileSync(
        process.execPath,
        [
          join(process.cwd(), "node_modules", "typescript", "bin", "tsc"),
          "--noEmit",
          "-p",
          "tsconfig.json",
        ],
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
    mkdirSync(join(repoDir, "node_modules", "@_molaidrislabs", "runtime"), {
      recursive: true,
    });
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
    mkdirSync(
      join(repoDir, "node_modules", "@_molaidrislabs", "rn-mt", "runtime"),
      {
        recursive: true,
      },
    );
    writeFileSync(
      join(repoDir, "node_modules", "@_molaidrislabs", "rn-mt", "runtime", "package.json"),
      JSON.stringify({
        name: "@_molaidrislabs/rn-mt/runtime",
        types: "index.d.ts",
      }),
    );
    writeFileSync(
      join(repoDir, "node_modules", "@_molaidrislabs", "rn-mt", "runtime", "index.d.ts"),
      [
        "export interface ResolvedTenantRuntime {",
        "  config: Record<string, unknown>;",
        "  tenant: { id: string; displayName: string };",
        "  env: { id: string };",
        "  flags: Record<string, unknown>;",
        "  assets: Record<string, string>;",
        "  routes: Array<{ id: string; path: string; screen: string }>;",
        "  features: Array<{ id: string; module: string; enabledByFlag?: string }>;",
        "  menus: Array<{ id: string; label: string; actionId: string; enabledByFlag?: string }>;",
        "  actions: Array<{ id: string; label: string; handler: string; enabledByFlag?: string }>;",
        "}",
        "export function createRuntimeAccessors(runtime: ResolvedTenantRuntime): {",
        "  getConfig(): Record<string, unknown>;",
        "  getTenant(): { id: string; displayName: string };",
        "  getEnv(): { id: string };",
        "  getFlags(): Record<string, unknown>;",
        "  getAssets(): Record<string, string>;",
        "  getRoutes(): Array<{ id: string; path: string; screen: string }>;",
        "  getFeatures(): Array<{ id: string; module: string; enabledByFlag?: string }>;",
        "  getMenus(): Array<{ id: string; label: string; actionId: string; enabledByFlag?: string }>;",
        "  getActions(): Array<{ id: string; label: string; handler: string; enabledByFlag?: string }>;",
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
        routes: [],
        features: [],
        menus: [],
        actions: [],
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
      ['import App from "./App";', "", "export default App;", ""].join("\n"),
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
    expect(
      readFileSync(join(repoDir, "src", "rn-mt", "shared", "App.ts"), "utf8"),
    ).toContain('import theme from "@/theme";');
    expect(
      readFileSync(join(repoDir, "src", "rn-mt", "shared", "App.ts"), "utf8"),
    ).toContain('import config from "@/config";');
    expect(
      readFileSync(join(repoDir, "src", "rn-mt", "shared", "App.ts"), "utf8"),
    ).not.toContain('import theme from "../current/theme/index";');

    try {
      execFileSync(
        process.execPath,
        [
          join(process.cwd(), "node_modules", "typescript", "bin", "tsc"),
          "--noEmit",
          "-p",
          "tsconfig.json",
        ],
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

  it("preserves binary asset bytes when convert writes shared and current files", () => {
    const repoDir = createTempRepo("rn-mt-cli-binary-convert-");
    const stdout = vi.fn();
    const stderr = vi.fn();
    const iconBytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 255, 12]);

    mkdirSync(join(repoDir, ".git"));
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
      "export default function App() { return null; }\n",
    );
    writeFileSync(join(repoDir, "assets", "icon.png"), iconBytes);

    const exitCode = runCli(["convert"], {
      cwd: repoDir,
      io: { stdout, stderr },
    });

    expect(exitCode).toBe(0);
    expect(
      readFileSync(
        join(repoDir, "src", "rn-mt", "shared", "assets", "icon.png"),
      ),
    ).toEqual(iconBytes);
    expect(
      readFileSync(
        join(repoDir, "src", "rn-mt", "current", "assets", "icon.png"),
      ),
    ).toEqual(iconBytes);
    expect(stderr).not.toHaveBeenCalled();
  });

  it("creates a mirrored tenant override and repoints the current facade to it", () => {
    const repoDir = createTempRepo("rn-mt-cli-override-create-");
    const stdout = vi.fn();
    const stderr = vi.fn();

    mkdirSync(join(repoDir, "src", "rn-mt", "shared", "theme"), {
      recursive: true,
    });
    mkdirSync(join(repoDir, "src", "rn-mt", "current", "theme"), {
      recursive: true,
    });
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
      join(repoDir, "src", "rn-mt", "shared", "theme", "index.ts"),
      "export default { color: 'shared' };\n",
    );
    writeFileSync(
      join(repoDir, "src", "rn-mt", "current", "theme", "index.ts"),
      [
        "// Generated by rn-mt. CLI-owned current facade. Do not edit directly.",
        'export { default } from "../../shared/theme/index";',
        'export * from "../../shared/theme/index";',
        "",
      ].join("\n"),
    );

    const exitCode = runCli(
      ["override", "create", "theme/index.ts", "--json"],
      {
        cwd: repoDir,
        io: { stdout, stderr },
      },
    );

    const output = stdout.mock.calls.map(([chunk]) => chunk).join("");
    const parsed = JSON.parse(output);

    expect(exitCode).toBe(0);
    expect(parsed.command).toBe("override create");
    expect(parsed.status).toBe("created");
    expect(parsed.copiedFile).toEqual({
      sourcePath: join(repoDir, "src", "rn-mt", "shared", "theme", "index.ts"),
      destinationPath: join(
        repoDir,
        "src",
        "rn-mt",
        "tenants",
        "fixture-app",
        "theme",
        "index.ts",
      ),
      changed: true,
    });
    expect(
      readFileSync(
        join(
          repoDir,
          "src",
          "rn-mt",
          "tenants",
          "fixture-app",
          "theme",
          "index.ts",
        ),
        "utf8",
      ),
    ).toBe("export default { color: 'shared' };\n");
    expect(
      readFileSync(
        join(repoDir, "src", "rn-mt", "current", "theme", "index.ts"),
        "utf8",
      ),
    ).toContain("../../tenants/fixture-app/theme/index");
    expect(stderr).not.toHaveBeenCalled();
  });

  it("guards override create when the tenant override already exists", () => {
    const repoDir = createTempRepo("rn-mt-cli-override-create-existing-");
    const stdout = vi.fn();
    const stderr = vi.fn();

    mkdirSync(join(repoDir, "src", "rn-mt", "shared", "theme"), {
      recursive: true,
    });
    mkdirSync(
      join(repoDir, "src", "rn-mt", "tenants", "fixture-app", "theme"),
      {
        recursive: true,
      },
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
      join(repoDir, "src", "rn-mt", "shared", "theme", "index.ts"),
      "export default { color: 'shared' };\n",
    );
    writeFileSync(
      join(
        repoDir,
        "src",
        "rn-mt",
        "tenants",
        "fixture-app",
        "theme",
        "index.ts",
      ),
      "export default { color: 'tenant' };\n",
    );

    const exitCode = runCli(["override", "create", "theme/index.ts"], {
      cwd: repoDir,
      io: { stdout, stderr },
    });

    const errorOutput = stderr.mock.calls.map(([chunk]) => chunk).join("");

    expect(exitCode).toBe(1);
    expect(stdout).not.toHaveBeenCalled();
    expect(errorOutput).toContain("Tenant override already exists:");
  });

  it("removes a tenant override and restores shared current-facade resolution", () => {
    const repoDir = createTempRepo("rn-mt-cli-override-remove-");
    const stdout = vi.fn();
    const stderr = vi.fn();

    mkdirSync(join(repoDir, "src", "rn-mt", "shared", "theme"), {
      recursive: true,
    });
    mkdirSync(join(repoDir, "src", "rn-mt", "current", "theme"), {
      recursive: true,
    });
    mkdirSync(
      join(repoDir, "src", "rn-mt", "tenants", "fixture-app", "theme"),
      {
        recursive: true,
      },
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
      join(repoDir, "src", "rn-mt", "shared", "theme", "index.ts"),
      "export default { color: 'shared' };\n",
    );
    writeFileSync(
      join(
        repoDir,
        "src",
        "rn-mt",
        "tenants",
        "fixture-app",
        "theme",
        "index.ts",
      ),
      "export default { color: 'tenant' };\n",
    );
    writeFileSync(
      join(repoDir, "src", "rn-mt", "current", "theme", "index.ts"),
      [
        "// Generated by rn-mt. CLI-owned current facade. Do not edit directly.",
        'export { default } from "../../tenants/fixture-app/theme/index";',
        'export * from "../../tenants/fixture-app/theme/index";',
        "",
      ].join("\n"),
    );

    const exitCode = runCli(
      ["override", "remove", "theme/index.ts", "--json"],
      {
        cwd: repoDir,
        io: { stdout, stderr },
      },
    );

    const output = stdout.mock.calls.map(([chunk]) => chunk).join("");
    const parsed = JSON.parse(output);

    expect(exitCode).toBe(0);
    expect(parsed.command).toBe("override remove");
    expect(parsed.status).toBe("removed");
    expect(parsed.removedFilePath).toBe(
      join(
        repoDir,
        "src",
        "rn-mt",
        "tenants",
        "fixture-app",
        "theme",
        "index.ts",
      ),
    );
    expect(
      existsSync(
        join(
          repoDir,
          "src",
          "rn-mt",
          "tenants",
          "fixture-app",
          "theme",
          "index.ts",
        ),
      ),
    ).toBe(false);
    expect(
      readFileSync(
        join(repoDir, "src", "rn-mt", "current", "theme", "index.ts"),
        "utf8",
      ),
    ).toContain("../../shared/theme/index");
    expect(stderr).not.toHaveBeenCalled();
  });

  it("guards override remove when the tenant override is missing", () => {
    const repoDir = createTempRepo("rn-mt-cli-override-remove-missing-");
    const stdout = vi.fn();
    const stderr = vi.fn();

    mkdirSync(join(repoDir, "src", "rn-mt", "shared", "theme"), {
      recursive: true,
    });
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
      join(repoDir, "src", "rn-mt", "shared", "theme", "index.ts"),
      "export default { color: 'shared' };\n",
    );

    const exitCode = runCli(["override", "remove", "theme/index.ts"], {
      cwd: repoDir,
      io: { stdout, stderr },
    });

    const errorOutput = stderr.mock.calls.map(([chunk]) => chunk).join("");

    expect(exitCode).toBe(1);
    expect(stdout).not.toHaveBeenCalled();
    expect(errorOutput).toContain("Tenant override not found:");
  });

  it("emits override-candidate findings from audit in JSON mode", () => {
    const repoDir = createTempRepo("rn-mt-cli-audit-findings-");
    const stdout = vi.fn();
    const stderr = vi.fn();

    mkdirSync(join(repoDir, "src", "rn-mt", "shared", "theme"), {
      recursive: true,
    });
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
      join(repoDir, "src", "rn-mt", "shared", "theme", "branding.ts"),
      "export default { tenantId: 'fixture-app', displayName: 'Fixture App' };\n",
    );

    const exitCode = runCli(["audit", "--json"], {
      cwd: repoDir,
      io: { stdout, stderr },
    });

    const output = stdout.mock.calls.map(([chunk]) => chunk).join("");
    const parsed = JSON.parse(output);

    expect(exitCode).toBe(1);
    expect(parsed.command).toBe("audit");
    expect(parsed.status).toBe("findings");
    expect(parsed.failOn).toBeNull();
    expect(parsed.ignores).toEqual([]);
    expect(parsed.summary).toEqual({
      totalFindings: 1,
      ignoredFindings: 0,
      reportedFindings: 1,
      failingFindings: 1,
    });
    expect(parsed.findings).toEqual([
      expect.objectContaining({
        code: "override-candidate",
        severity: "P2",
        confidence: "high",
        path: join(repoDir, "src", "rn-mt", "shared", "theme", "branding.ts"),
      }),
    ]);
    expect(parsed.findings[0].summary).toContain(
      "likely wants a mirrored tenant override",
    );
    expect(parsed.findings[0].evidence).toEqual([
      'Matched default tenant id "fixture-app" in shared file contents.',
      'Matched default tenant display name "Fixture App" in shared file contents.',
    ]);
    expect(stderr).not.toHaveBeenCalled();
  });

  it("suppresses matching audit findings via ignore rules in JSON mode", () => {
    const repoDir = createTempRepo("rn-mt-cli-audit-ignored-json-");
    const stdout = vi.fn();
    const stderr = vi.fn();

    mkdirSync(join(repoDir, "src", "rn-mt", "shared", "theme"), {
      recursive: true,
    });
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
      join(repoDir, "src", "rn-mt", "shared", "theme", "branding.ts"),
      "export default { tenantId: 'fixture-app', displayName: 'Fixture App' };\n",
    );

    const exitCode = runCli(
      ["audit", "--json", "--ignore", "src/rn-mt/shared/theme/branding.ts"],
      {
        cwd: repoDir,
        io: { stdout, stderr },
      },
    );

    const parsed = JSON.parse(
      stdout.mock.calls.map(([chunk]) => chunk).join(""),
    );

    expect(exitCode).toBe(0);
    expect(parsed.status).toBe("passed");
    expect(parsed.ignores).toEqual(["src/rn-mt/shared/theme/branding.ts"]);
    expect(parsed.summary).toEqual({
      totalFindings: 1,
      ignoredFindings: 1,
      reportedFindings: 0,
      failingFindings: 0,
    });
    expect(parsed.findings).toEqual([]);
    expect(stderr).not.toHaveBeenCalled();
  });

  it("does not fail audit when findings fall below the requested threshold", () => {
    const repoDir = createTempRepo("rn-mt-cli-audit-threshold-pass-");
    const stdout = vi.fn();
    const stderr = vi.fn();

    mkdirSync(join(repoDir, "src", "rn-mt", "shared", "theme"), {
      recursive: true,
    });
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
      join(repoDir, "src", "rn-mt", "shared", "theme", "branding.ts"),
      "export default { tenantId: 'fixture-app', displayName: 'Fixture App' };\n",
    );

    const exitCode = runCli(["audit", "--fail-on", "P1"], {
      cwd: repoDir,
      io: { stdout, stderr },
    });

    const output = stdout.mock.calls.map(([chunk]) => chunk).join("");

    expect(exitCode).toBe(0);
    expect(output).toContain("Audit status: findings");
    expect(output).toContain("Fail threshold: P1");
    expect(output).toContain(
      "No findings met fail threshold P1. Audit will exit successfully.",
    );
    expect(stderr).not.toHaveBeenCalled();
  });

  it("fails audit when findings meet the requested threshold", () => {
    const repoDir = createTempRepo("rn-mt-cli-audit-threshold-fail-");
    const stdout = vi.fn();
    const stderr = vi.fn();

    mkdirSync(join(repoDir, "src", "rn-mt", "shared", "theme"), {
      recursive: true,
    });
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
      join(repoDir, "src", "rn-mt", "shared", "theme", "branding.ts"),
      "export default { tenantId: 'fixture-app', displayName: 'Fixture App' };\n",
    );

    const exitCode = runCli(["audit", "--fail-on", "P2"], {
      cwd: repoDir,
      io: { stdout, stderr },
    });

    const output = stdout.mock.calls.map(([chunk]) => chunk).join("");

    expect(exitCode).toBe(1);
    expect(output).toContain("Fail threshold: P2");
    expect(stderr).not.toHaveBeenCalled();
  });

  it("passes audit when shared files do not trigger the heuristic", () => {
    const repoDir = createTempRepo("rn-mt-cli-audit-passed-");
    const stdout = vi.fn();
    const stderr = vi.fn();

    mkdirSync(join(repoDir, "src", "rn-mt", "shared", "theme"), {
      recursive: true,
    });
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
      join(repoDir, "src", "rn-mt", "shared", "theme", "palette.ts"),
      "export default { color: 'blue' };\n",
    );

    const exitCode = runCli(["audit"], {
      cwd: repoDir,
      io: { stdout, stderr },
    });

    const output = stdout.mock.calls.map(([chunk]) => chunk).join("");

    expect(exitCode).toBe(0);
    expect(output).toContain("Audit passed with no findings.");
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

  it("overwrites tracked CLI-owned sync artifacts when ownership metadata matches", () => {
    const repoDir = createTempRepo("rn-mt-cli-sync-owned-overwrite-");
    const firstStdout = vi.fn();
    const firstStderr = vi.fn();
    const secondStdout = vi.fn();
    const secondStderr = vi.fn();

    writeFileSync(
      join(repoDir, "rn-mt.config.json"),
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
      }),
    );

    const firstExitCode = runCli(["sync"], {
      cwd: repoDir,
      io: { stdout: firstStdout, stderr: firstStderr },
    });

    writeFileSync(
      join(repoDir, "rn-mt.config.json"),
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: repoDir },
        config: {
          identity: {
            appName: "Keep Atlas",
            nativeId: "com.keep.atlas",
          },
        },
        defaults: { tenant: "demo-app", environment: "dev" },
        tenants: {
          "demo-app": { displayName: "Demo App" },
        },
        environments: {
          dev: { displayName: "Development" },
        },
      }),
    );

    const secondExitCode = runCli(["sync", "--json"], {
      cwd: repoDir,
      io: { stdout: secondStdout, stderr: secondStderr },
    });
    const parsed = JSON.parse(
      secondStdout.mock.calls.map(([chunk]) => chunk).join(""),
    );
    const runtimeContents = readFileSync(
      join(repoDir, "rn-mt.generated.runtime.json"),
      "utf8",
    );

    expect(firstExitCode).toBe(0);
    expect(secondExitCode).toBe(0);
    expect(parsed.status).toBe("updated");
    expect(runtimeContents).toContain('"displayName": "Keep Atlas (Dev)"');
    expect(firstStderr).not.toHaveBeenCalled();
    expect(secondStderr).not.toHaveBeenCalled();
  });

  it("fails sync when a tracked CLI-owned artifact has manual drift", () => {
    const repoDir = createTempRepo("rn-mt-cli-sync-drift-conflict-");
    const stdout = vi.fn();
    const stderr = vi.fn();
    const runtimePath = join(repoDir, "rn-mt.generated.runtime.json");
    const ownershipPath = join(repoDir, "rn-mt.generated.ownership.json");

    writeFileSync(
      join(repoDir, "rn-mt.config.json"),
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
    writeFileSync(runtimePath, '{ "manual": true }\n');
    writeFileSync(
      ownershipPath,
      JSON.stringify(
        {
          schemaVersion: 1,
          tool: "rn-mt",
          owner: "cli",
          artifacts: [
            {
              path: "rn-mt.generated.runtime.json",
              kind: "runtime-artifact",
              hash: "deadbeef",
            },
          ],
        },
        null,
        2,
      ),
    );

    const exitCode = runCli(["sync"], {
      cwd: repoDir,
      io: { stdout, stderr },
    });
    const errorOutput = stderr.mock.calls.map(([chunk]) => chunk).join("");

    expect(exitCode).toBe(1);
    expect(errorOutput).toContain("Generated artifact drift detected");
    expect(errorOutput).toContain("rn-mt.generated.runtime.json");
    expect(readFileSync(runtimePath, "utf8")).toBe('{ "manual": true }\n');
    expect(stdout).not.toHaveBeenCalled();
  });

  it("leaves user-owned extension files untouched during sync", () => {
    const repoDir = createTempRepo("rn-mt-cli-sync-extension-preserve-");
    const stdout = vi.fn();
    const stderr = vi.fn();

    writeFileSync(
      join(repoDir, "rn-mt.config.json"),
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
    mkdirSync(join(repoDir, "src", "rn-mt", "extensions"), { recursive: true });
    writeFileSync(
      join(repoDir, "src", "rn-mt", "extensions", "index.ts"),
      "export const rnMtExtensions = { custom: true };\n",
    );

    const exitCode = runCli(["sync", "--json"], {
      cwd: repoDir,
      io: { stdout, stderr },
    });
    const parsed = JSON.parse(
      stdout.mock.calls.map(([chunk]) => chunk).join(""),
    );

    expect(exitCode).toBe(0);
    expect(parsed.status).toBe("updated");
    expect(
      readFileSync(
        join(repoDir, "src", "rn-mt", "extensions", "index.ts"),
        "utf8",
      ),
    ).toBe("export const rnMtExtensions = { custom: true };\n");
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

    const secondOutput = secondStdout.mock.calls
      .map(([chunk]) => chunk)
      .join("");
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

  it("skips rewriting derived iOS icon badge assets when stored fingerprints still match", () => {
    const files: Record<string, string> = {
      "/tmp/supported-fixture/rn-mt.config.json": JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: "/tmp/supported-fixture" },
        assets: {
          icon: "assets/icon.png",
        },
        defaults: { tenant: "demo-app", environment: "dev" },
        tenants: {
          "demo-app": { displayName: "Demo App" },
        },
        environments: {
          dev: { displayName: "Development" },
        },
        platforms: {
          ios: {},
        },
      }),
      "/tmp/supported-fixture/assets/icon.png": "icon-v1",
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
    const firstExitCode = runCli(["sync", "--json", "--platform", "ios"], {
      cwd: "/tmp/supported-fixture",
      io: { stdout: firstStdout, stderr: firstStderr },
      fileExists: (path) => path in files,
      readFile,
      writeFile,
    });

    const secondStdout = vi.fn();
    const secondStderr = vi.fn();
    const secondExitCode = runCli(["sync", "--json", "--platform", "ios"], {
      cwd: "/tmp/supported-fixture",
      io: { stdout: secondStdout, stderr: secondStderr },
      fileExists: (path) => path in files,
      readFile,
      writeFile,
    });

    const secondOutput = secondStdout.mock.calls
      .map(([chunk]) => chunk)
      .join("");
    const secondParsed = JSON.parse(secondOutput);

    expect(firstExitCode).toBe(0);
    expect(secondExitCode).toBe(0);
    expect(writeFile).toHaveBeenCalledTimes(4);
    expect(secondParsed.status).toBe("unchanged");
    expect(secondParsed.generatedFiles).toEqual([
      {
        path: "/tmp/supported-fixture/rn-mt.generated.runtime.json",
        kind: "runtime-artifact",
        changed: false,
      },
      {
        path: "/tmp/supported-fixture/ios/rn-mt.generated.icon.dev.svg",
        kind: "derived-asset",
        changed: false,
      },
      {
        path: "/tmp/supported-fixture/rn-mt.generated.asset-fingerprints.json",
        kind: "asset-fingerprint-metadata",
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

  it("produces an unbadged production derived icon during sync", () => {
    const stdout = vi.fn();
    const stderr = vi.fn();
    const writeFile = vi.fn();

    const exitCode = runCli(["sync", "--json", "--platform", "ios"], {
      cwd: "/tmp/supported-fixture",
      io: { stdout, stderr },
      fileExists: (path) =>
        path === "/tmp/supported-fixture/rn-mt.config.json" ||
        path === "/tmp/supported-fixture/assets/icon.png",
      readFile: (path) => {
        if (path === "/tmp/supported-fixture/assets/icon.png") {
          return "icon-prod";
        }

        return JSON.stringify({
          schemaVersion: 1,
          source: { rootDir: "/tmp/supported-fixture" },
          assets: {
            icon: "assets/icon.png",
          },
          defaults: { tenant: "demo-app", environment: "prod" },
          tenants: {
            "demo-app": { displayName: "Demo App" },
          },
          environments: {
            prod: { displayName: "Production" },
          },
          platforms: {
            ios: {},
          },
        });
      },
      writeFile,
    });

    const output = stdout.mock.calls.map(([chunk]) => chunk).join("");
    const parsed = JSON.parse(output);
    const derivedWrite = writeFile.mock.calls.find(
      ([path]) =>
        path === "/tmp/supported-fixture/ios/rn-mt.generated.icon.prod.svg",
    );

    expect(exitCode).toBe(0);
    expect(parsed.generatedFiles).toEqual(
      expect.arrayContaining([
        {
          path: "/tmp/supported-fixture/ios/rn-mt.generated.icon.prod.svg",
          kind: "derived-asset",
          changed: true,
        },
      ]),
    );
    expect(derivedWrite?.[1]).toContain('href="../assets/icon.png"');
    expect(derivedWrite?.[1]).not.toContain(">PROD<");
    expect(derivedWrite?.[1]).not.toContain('fill="#f59e0b"');
    expect(stderr).not.toHaveBeenCalled();
  });

  it("bridges explicit target context into Expo app.config.ts end to end", () => {
    const repoDir = createTempRepo("rn-mt-cli-expo-bridge-");
    const stdout = vi.fn();
    const stderr = vi.fn();
    const expoPluginModulePath = JSON.stringify(
      join(process.cwd(), "packages", "expo-plugin", "src", "index.ts"),
    );

    mkdirSync(join(repoDir, "assets"), { recursive: true });
    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "expo-fixture",
        dependencies: { expo: "~52.0.0" },
      }),
    );
    writeFileSync(
      join(repoDir, "app.config.ts"),
      [
        `import { applyExpoTargetContext } from ${expoPluginModulePath};`,
        'import targetContext from "./rn-mt.generated.expo.js";',
        "",
        "export default applyExpoTargetContext(",
        "  {",
        '    slug: "expo-fixture",',
        "  },",
        "  targetContext,",
        ");",
        "",
      ].join("\n"),
    );
    writeFileSync(join(repoDir, "assets", "icon.png"), "icon-dev");
    writeFileSync(
      join(repoDir, "rn-mt.config.json"),
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
        defaults: { tenant: "demo-app", environment: "dev" },
        tenants: {
          "demo-app": { displayName: "Demo App" },
        },
        environments: {
          dev: { displayName: "Development" },
        },
        platforms: {
          ios: {},
        },
      }),
    );

    const exitCode = runCli(["sync", "--platform", "ios"], {
      cwd: repoDir,
      io: { stdout, stderr },
    });

    expect(exitCode).toBe(0);

    const evaluatedConfig = execFileSync(
      join(process.cwd(), "node_modules", ".bin", "tsx"),
      [
        "-e",
        "import config from './app.config.ts'; console.log(JSON.stringify(config));",
      ],
      {
        cwd: repoDir,
        stdio: "pipe",
      },
    ).toString("utf8");
    const parsedConfig = JSON.parse(evaluatedConfig);
    const humanOutput = stdout.mock.calls.map(([chunk]) => chunk).join("");

    expect(humanOutput).toContain("Synced target: demo-app/dev");
    expect(humanOutput).toContain("Updated file:");
    expect(
      readFileSync(join(repoDir, "rn-mt.generated.expo.js"), "utf8"),
    ).toContain('"tenant": "demo-app"');
    expect(parsedConfig).toEqual({
      slug: "expo-fixture",
      name: "Keep Nexus (Dev)",
      icon: "./ios/rn-mt.generated.icon.dev.svg",
      ios: {
        bundleIdentifier: "com.keep.nexus.dev",
      },
      android: {
        package: "com.keep.nexus.dev",
      },
      extra: {
        rnMt: {
          target: {
            tenant: "demo-app",
            environment: "dev",
            platform: "ios",
          },
          runtimeConfigPath: "./rn-mt.generated.runtime.json",
        },
      },
    });
    expect(stderr).not.toHaveBeenCalled();
  });

  it("preserves Expo app.json layering while applying derived non-production naming", () => {
    const repoDir = createTempRepo("rn-mt-cli-expo-app-json-layering-");
    const stdout = vi.fn();
    const stderr = vi.fn();
    const expoPluginModulePath = JSON.stringify(
      join(process.cwd(), "packages", "expo-plugin", "src", "index.ts"),
    );

    mkdirSync(join(repoDir, "assets"), { recursive: true });
    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "expo-fixture",
        dependencies: { expo: "~52.0.0" },
      }),
    );
    writeFileSync(
      join(repoDir, "app.json"),
      JSON.stringify({
        expo: {
          name: "Keep Nexus",
          slug: "expo-fixture",
          owner: "acme",
          scheme: "keepnexus",
          extra: {
            appJsonLayer: true,
          },
        },
      }),
    );
    writeFileSync(
      join(repoDir, "app.config.ts"),
      [
        'import appJson from "./app.json";',
        `import { applyExpoTargetContext } from ${expoPluginModulePath};`,
        'import targetContext from "./rn-mt.generated.expo.js";',
        "",
        "export default applyExpoTargetContext(appJson.expo, targetContext);",
        "",
      ].join("\n"),
    );
    writeFileSync(join(repoDir, "assets", "icon.png"), "icon-dev");
    writeFileSync(
      join(repoDir, "rn-mt.config.json"),
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

    const exitCode = runCli(["sync", "--platform", "ios"], {
      cwd: repoDir,
      io: { stdout, stderr },
    });

    expect(exitCode).toBe(0);

    const evaluatedConfig = execFileSync(
      join(process.cwd(), "node_modules", ".bin", "tsx"),
      [
        "-e",
        "import config from './app.config.ts'; console.log(JSON.stringify(config));",
      ],
      {
        cwd: repoDir,
        stdio: "pipe",
      },
    ).toString("utf8");
    const parsedConfig = JSON.parse(evaluatedConfig);

    expect(parsedConfig).toEqual({
      name: "Keep Nexus (Staging)",
      slug: "expo-fixture",
      owner: "acme",
      scheme: "keepnexus",
      icon: "./ios/rn-mt.generated.icon.staging.svg",
      ios: {
        bundleIdentifier: "com.keep.nexus.staging",
      },
      android: {
        package: "com.keep.nexus.staging",
      },
      extra: {
        appJsonLayer: true,
        rnMt: {
          target: {
            tenant: "demo-app",
            environment: "staging",
            platform: "ios",
          },
          runtimeConfigPath: "./rn-mt.generated.runtime.json",
        },
      },
    });
    expect(stderr).not.toHaveBeenCalled();
  });

  it("allows Expo computed config to override derived non-production naming explicitly", () => {
    const repoDir = createTempRepo("rn-mt-cli-expo-explicit-name-override-");
    const stdout = vi.fn();
    const stderr = vi.fn();
    const expoPluginModulePath = JSON.stringify(
      join(process.cwd(), "packages", "expo-plugin", "src", "index.ts"),
    );

    mkdirSync(join(repoDir, "assets"), { recursive: true });
    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "expo-fixture",
        dependencies: { expo: "~52.0.0" },
      }),
    );
    writeFileSync(
      join(repoDir, "app.json"),
      JSON.stringify({
        expo: {
          name: "Keep Nexus",
          slug: "expo-fixture",
        },
      }),
    );
    writeFileSync(
      join(repoDir, "app.config.ts"),
      [
        'import appJson from "./app.json";',
        `import { applyExpoTargetContext } from ${expoPluginModulePath};`,
        'import targetContext from "./rn-mt.generated.expo.js";',
        "",
        "const resolved = applyExpoTargetContext(appJson.expo, targetContext);",
        "",
        "export default {",
        "  ...resolved,",
        '  name: "Keep Nexus QA",',
        "};",
        "",
      ].join("\n"),
    );
    writeFileSync(join(repoDir, "assets", "icon.png"), "icon-dev");
    writeFileSync(
      join(repoDir, "rn-mt.config.json"),
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

    const exitCode = runCli(["sync", "--platform", "ios"], {
      cwd: repoDir,
      io: { stdout, stderr },
    });

    expect(exitCode).toBe(0);

    const evaluatedConfig = execFileSync(
      join(process.cwd(), "node_modules", ".bin", "tsx"),
      [
        "-e",
        "import config from './app.config.ts'; console.log(JSON.stringify(config));",
      ],
      {
        cwd: repoDir,
        stdio: "pipe",
      },
    ).toString("utf8");
    const parsedConfig = JSON.parse(evaluatedConfig);

    expect(parsedConfig.name).toBe("Keep Nexus QA");
    expect(parsedConfig.slug).toBe("expo-fixture");
    expect(parsedConfig.ios).toEqual({
      bundleIdentifier: "com.keep.nexus.staging",
    });
    expect(parsedConfig.android).toEqual({
      package: "com.keep.nexus.staging",
    });
    expect(parsedConfig.extra).toEqual({
      rnMt: {
        target: {
          tenant: "demo-app",
          environment: "staging",
          platform: "ios",
        },
        runtimeConfigPath: "./rn-mt.generated.runtime.json",
      },
    });
    expect(stderr).not.toHaveBeenCalled();
  });

  it("sync emits reviewable Android flavor config for bare RN selected targets", () => {
    const repoDir = createTempRepo("rn-mt-cli-android-flavors-");
    const stdout = vi.fn();
    const stderr = vi.fn();

    mkdirSync(join(repoDir, "android", "app"), { recursive: true });
    writeFileSync(
      join(repoDir, "android", "app", "build.gradle"),
      "android {}\n",
    );
    writeFileSync(
      join(repoDir, "rn-mt.config.json"),
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

    const exitCode = runCli(["sync", "--json", "--platform", "android"], {
      cwd: repoDir,
      io: { stdout, stderr },
    });

    expect(exitCode).toBe(0);

    const parsed = JSON.parse(
      stdout.mock.calls.map(([chunk]) => chunk).join(""),
    );
    const identityConfigPath = join(
      repoDir,
      "android",
      "app",
      "rn-mt.generated.identity.gradle",
    );
    const flavorConfigPath = join(
      repoDir,
      "android",
      "app",
      "rn-mt.generated.flavors.gradle",
    );
    const identityConfigContents = readFileSync(identityConfigPath, "utf8");
    const flavorConfigContents = readFileSync(flavorConfigPath, "utf8");
    const ownership = JSON.parse(
      readFileSync(join(repoDir, "rn-mt.generated.ownership.json"), "utf8"),
    );

    expect(parsed.generatedFiles).toEqual(
      expect.arrayContaining([
        {
          path: identityConfigPath,
          kind: "android-native-identity",
          changed: true,
        },
        {
          path: flavorConfigPath,
          kind: "android-flavor-config",
          changed: true,
        },
      ]),
    );
    expect(identityConfigContents).toContain(
      'applicationId "com.keep.nexus.staging"',
    );
    expect(identityConfigContents).toContain(
      'resValue "string", "app_name", "Keep Nexus (Staging)"',
    );
    expect(flavorConfigContents).toContain(
      'flavorDimensions "tenant", "environment"',
    );
    expect(flavorConfigContents).toContain(
      "// Selected target: demo-app/staging/android",
    );
    expect(flavorConfigContents).toContain(
      "// Selected applicationId: com.keep.nexus.staging",
    );
    expect(ownership.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "android/app/rn-mt.generated.identity.gradle",
          kind: "android-native-identity",
          hash: expect.any(String),
        }),
        expect.objectContaining({
          path: "android/app/rn-mt.generated.flavors.gradle",
          kind: "android-flavor-config",
          hash: expect.any(String),
        }),
      ]),
    );
    expect(stderr).not.toHaveBeenCalled();
  });

  it("sync emits reviewable iOS schemes and xcconfig wiring for bare RN selected targets", () => {
    const repoDir = createTempRepo("rn-mt-cli-ios-schemes-");
    const stdout = vi.fn();
    const stderr = vi.fn();

    mkdirSync(join(repoDir, "ios", "KeepNexus.xcodeproj"), { recursive: true });
    writeFileSync(
      join(repoDir, "rn-mt.config.json"),
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

    const exitCode = runCli(["sync", "--json", "--platform", "ios"], {
      cwd: repoDir,
      io: { stdout, stderr },
    });

    expect(exitCode).toBe(0);

    const parsed = JSON.parse(
      stdout.mock.calls.map(([chunk]) => chunk).join(""),
    );
    const schemePath = join(
      repoDir,
      "ios",
      "KeepNexus.xcodeproj",
      "xcshareddata",
      "xcschemes",
      "DemoApp-Staging.xcscheme",
    );
    const currentXcconfigPath = join(
      repoDir,
      "ios",
      "rn-mt.generated.current.xcconfig",
    );
    const targetXcconfigPath = join(
      repoDir,
      "ios",
      "rn-mt.generated.demo-app-staging.xcconfig",
    );
    const ownership = JSON.parse(
      readFileSync(join(repoDir, "rn-mt.generated.ownership.json"), "utf8"),
    );

    expect(parsed.generatedFiles).toEqual(
      expect.arrayContaining([
        {
          path: schemePath,
          kind: "ios-scheme",
          changed: true,
        },
        {
          path: currentXcconfigPath,
          kind: "ios-xcconfig",
          changed: true,
        },
        {
          path: targetXcconfigPath,
          kind: "ios-xcconfig",
          changed: true,
        },
      ]),
    );
    expect(readFileSync(schemePath, "utf8")).toContain(
      "Selected target: demo-app/staging/ios",
    );
    expect(readFileSync(currentXcconfigPath, "utf8")).toContain(
      '#include "rn-mt.generated.demo-app-staging.xcconfig"',
    );
    expect(readFileSync(targetXcconfigPath, "utf8")).toContain(
      "PRODUCT_BUNDLE_IDENTIFIER = com.keep.nexus.staging",
    );
    expect(readFileSync(targetXcconfigPath, "utf8")).toContain(
      'INFOPLIST_KEY_CFBundleDisplayName = "Keep Nexus (Staging)"',
    );
    expect(ownership.artifacts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "ios/rn-mt.generated.current.xcconfig",
          kind: "ios-xcconfig",
          hash: expect.any(String),
        }),
        expect.objectContaining({
          path: "ios/rn-mt.generated.demo-app-staging.xcconfig",
          kind: "ios-xcconfig",
          hash: expect.any(String),
        }),
      ]),
    );
    expect(stderr).not.toHaveBeenCalled();
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
      ([path]) =>
        path === "/tmp/supported-fixture/rn-mt.generated.runtime.json",
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

    const exitCode = runCli(
      ["run", "--json", "--", "node", "-e", "console.log('ok')"],
      {
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
      },
    );

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
          PATH: expect.stringContaining("/usr/bin"),
          API_BASE_URL: "https://dev.example.com",
          SHARED_ONLY: "shared",
          TENANT_ONLY: "tenant",
          OVERRIDE_ME: "tenant",
          EXPO_NO_TELEMETRY: "1",
          DO_NOT_TRACK: "1",
          RN_MT_NETWORK_MODE: "local-first",
        }),
      },
    );
    const subprocessCall = runSubprocess.mock.calls[0] as
      | [
          string,
          string[],
          { cwd: string; env: Record<string, string | undefined> },
        ]
      | undefined;
    const subprocessEnv = subprocessCall?.[2].env;

    expect(subprocessEnv?.PATH).toMatch(
      /^\/tmp\/supported-fixture\/node_modules\/\.bin:/,
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

  it("dispatches the unified start surface for Expo managed repos", () => {
    const repoDir = createWorkflowFixtureRepo(
      "rn-mt-cli-workflow-expo-start-",
      "expo-managed",
    );
    const stdout = vi.fn();
    const stderr = vi.fn();
    const runSubprocess = vi.fn(() => ({ status: 0 }));

    const exitCode = runCli(["start", "--json"], {
      cwd: repoDir,
      io: { stdout, stderr },
      env: {
        PATH: "/usr/bin",
      },
      runSubprocess,
    });

    const output = stdout.mock.calls.map(([chunk]) => chunk).join("");
    const parsed = JSON.parse(output);
    const subprocessCall = runSubprocess.mock.calls[0] as
      | [
          string,
          string[],
          { cwd: string; env: Record<string, string | undefined> },
        ]
      | undefined;
    const subprocessEnv = subprocessCall?.[2].env;

    expect(exitCode).toBe(0);
    expect(parsed.command).toBe("start");
    expect(parsed.repoAppKind).toBe("expo-managed");
    expect(parsed.target).toEqual({
      tenant: "demo-app",
      environment: "dev",
    });
    expect(parsed.loadedEnvFiles).toEqual([
      {
        path: join(repoDir, ".env.dev"),
        scope: "environment",
      },
    ]);
    expect(runSubprocess).toHaveBeenCalledWith("expo", ["start"], {
      cwd: repoDir,
      env: expect.objectContaining({
        API_BASE_URL: "https://dev.example.com",
        EXPO_NO_TELEMETRY: "1",
        DO_NOT_TRACK: "1",
        RN_MT_NETWORK_MODE: "local-first",
      }),
    });
    expect(subprocessEnv?.PATH).toMatch(
      new RegExp(`^${repoDir}/node_modules/\\.bin:`),
    );
    expect(stderr).not.toHaveBeenCalled();
  });

  it("dispatches the unified run surface for bare React Native repos", () => {
    const repoDir = createWorkflowFixtureRepo(
      "rn-mt-cli-workflow-bare-run-",
      "bare-react-native",
      {
        environment: "staging",
        includeTenantEnv: true,
      },
    );
    const stdout = vi.fn();
    const stderr = vi.fn();
    const runSubprocess = vi.fn(() => ({ status: 0 }));

    const exitCode = runCli(["run", "--json", "--platform", "android"], {
      cwd: repoDir,
      io: { stdout, stderr },
      env: {
        PATH: "/usr/bin",
      },
      runSubprocess,
    });

    const output = stdout.mock.calls.map(([chunk]) => chunk).join("");
    const parsed = JSON.parse(output);

    expect(exitCode).toBe(0);
    expect(parsed.command).toBe("run");
    expect(parsed.repoAppKind).toBe("bare-react-native");
    expect(parsed.target).toEqual({
      tenant: "demo-app",
      environment: "staging",
      platform: "android",
    });
    expect(parsed.loadedEnvFiles).toEqual([
      {
        path: join(repoDir, ".env.staging"),
        scope: "environment",
      },
      {
        path: join(repoDir, ".env.demo-app.staging"),
        scope: "tenant-environment",
      },
    ]);
    expect(runSubprocess).toHaveBeenCalledWith(
      "react-native",
      ["run-android"],
      {
        cwd: repoDir,
        env: expect.objectContaining({
          API_BASE_URL: "https://staging.example.com",
          TENANT_ONLY: "tenant",
          EXPO_NO_TELEMETRY: "1",
          DO_NOT_TRACK: "1",
          RN_MT_NETWORK_MODE: "local-first",
        }),
      },
    );
    expect(stderr).not.toHaveBeenCalled();
  });

  it("dispatches the unified start surface for shell-style bare React Native repos without root native folders", () => {
    const repoDir = createTempRepo("rn-mt-cli-workflow-bare-shell-start-");
    const stdout = vi.fn();
    const stderr = vi.fn();
    const runSubprocess = vi.fn(() => ({ status: 0 }));

    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "rn-shell-fixture",
        scripts: {
          start: "react-native start",
          android: "react-native run-android",
          ios: "react-native run-ios",
        },
        dependencies: {
          "react-native": "0.85.0",
        },
      }),
    );
    writeFileSync(
      join(repoDir, "app.json"),
      JSON.stringify({ name: "RN Shell Fixture" }),
    );
    writeFileSync(
      join(repoDir, "rn-mt.config.json"),
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: repoDir },
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
          dev: { displayName: "dev" },
        },
      }),
    );
    writeFileSync(
      join(repoDir, ".env.dev"),
      "API_BASE_URL=https://dev.example.com\n",
    );

    const exitCode = runCli(["start", "--json"], {
      cwd: repoDir,
      io: { stdout, stderr },
      env: {
        PATH: "/usr/bin",
      },
      runSubprocess,
    });

    const output = stdout.mock.calls.map(([chunk]) => chunk).join("");
    const parsed = JSON.parse(output);

    expect(exitCode).toBe(0);
    expect(parsed.command).toBe("start");
    expect(parsed.repoAppKind).toBe("bare-react-native");
    expect(runSubprocess).toHaveBeenCalledWith("react-native", ["start"], {
      cwd: repoDir,
      env: expect.objectContaining({
        API_BASE_URL: "https://dev.example.com",
        EXPO_NO_TELEMETRY: "1",
        DO_NOT_TRACK: "1",
        RN_MT_NETWORK_MODE: "local-first",
      }),
    });
    expect(stderr).not.toHaveBeenCalled();
  });

  it("dispatches the unified build surface for Expo managed repos", () => {
    const repoDir = createWorkflowFixtureRepo(
      "rn-mt-cli-workflow-expo-build-",
      "expo-managed",
    );
    const stdout = vi.fn();
    const stderr = vi.fn();
    const runSubprocess = vi.fn(() => ({ status: 0 }));

    const exitCode = runCli(["build", "--json", "--platform", "ios"], {
      cwd: repoDir,
      io: { stdout, stderr },
      env: {
        PATH: "/usr/bin",
      },
      runSubprocess,
    });

    const output = stdout.mock.calls.map(([chunk]) => chunk).join("");
    const parsed = JSON.parse(output);

    expect(exitCode).toBe(0);
    expect(parsed.command).toBe("build");
    expect(parsed.repoAppKind).toBe("expo-managed");
    expect(parsed.target).toEqual({
      tenant: "demo-app",
      environment: "dev",
      platform: "ios",
    });
    expect(runSubprocess).toHaveBeenCalledWith("expo", ["run:ios"], {
      cwd: repoDir,
      env: expect.objectContaining({
        API_BASE_URL: "https://dev.example.com",
      }),
    });
    expect(stderr).not.toHaveBeenCalled();
  });

  it("prints the local-first and telemetry-free policy in help output", () => {
    const stdout = vi.fn();
    const stderr = vi.fn();

    const exitCode = runCli(["--help"], {
      io: { stdout, stderr },
    });

    const output = stdout.mock.calls.map(([chunk]) => chunk).join("");

    expect(exitCode).toBe(0);
    expect(output).toContain("Local-first policy:");
    expect(output).toContain(
      "Normal rn-mt commands operate from the installed package set and local repo state only.",
    );
    expect(output).toContain(
      "Explicit exceptions: package installation and future upgrade checks may require network access",
    );
    expect(stderr).not.toHaveBeenCalled();
  });

  it("completes sync in steady state even when network-related env vars are disabled or invalid", () => {
    const repoDir = createTempRepo("rn-mt-cli-local-first-sync-");
    const stdout = vi.fn();
    const stderr = vi.fn();

    writeFileSync(
      join(repoDir, "rn-mt.config.json"),
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

    const exitCode = runCli(["sync", "--json"], {
      cwd: repoDir,
      io: { stdout, stderr },
      env: {
        PATH: "/usr/bin",
        HTTP_PROXY: "http://127.0.0.1:9",
        HTTPS_PROXY: "http://127.0.0.1:9",
        ALL_PROXY: "http://127.0.0.1:9",
        NO_PROXY: "*",
      },
    });
    const parsed = JSON.parse(
      stdout.mock.calls.map(([chunk]) => chunk).join(""),
    );

    expect(exitCode).toBe(0);
    expect(parsed.command).toBe("sync");
    expect(parsed.target).toEqual({
      tenant: "demo-app",
      environment: "dev",
    });
    expect(stderr).not.toHaveBeenCalled();
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
            chatEnabled: false,
            paymentsEnabled: true,
          },
          features: [
            {
              id: "chat",
              module: "ChatFeature",
              enabledByFlag: "chatEnabled",
            },
            {
              id: "payments",
              module: "PaymentsFeature",
              enabledByFlag: "paymentsEnabled",
            },
          ],
          menus: [
            {
              id: "home-menu",
              label: "Home",
              actionId: "open-home",
            },
          ],
          actions: [
            {
              id: "legacy-support",
              label: "Call Support",
              handler: "callSupport",
            },
            {
              id: "pay",
              label: "Pay",
              handler: "startPay",
            },
          ],
          defaults: { tenant: "demo-app", environment: "dev" },
          tenants: {
            "demo-app": {
              displayName: "Demo App",
              config: {
                color: "tenant",
              },
              routes: {
                replace: [
                  {
                    id: "home",
                    path: "/tenant-home",
                    screen: "TenantHomeScreen",
                  },
                ],
              },
              menus: {
                replace: [
                  {
                    id: "home-menu",
                    label: "Tenant Home",
                    actionId: "open-home",
                  },
                ],
              },
            },
          },
          environments: {
            dev: {
              displayName: "Development",
              config: {
                color: "environment",
              },
              routes: {
                add: [
                  {
                    id: "debug",
                    path: "/debug",
                    screen: "DebugScreen",
                  },
                ],
              },
              features: {
                add: [
                  {
                    id: "debug-tools",
                    module: "DebugToolsFeature",
                  },
                ],
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
              routes: {
                disable: ["settings"],
              },
              actions: {
                disable: ["legacy-support"],
              },
            },
          },
          routes: [
            {
              id: "home",
              path: "/",
              screen: "HomeScreen",
            },
            {
              id: "settings",
              path: "/settings",
              screen: "SettingsScreen",
            },
          ],
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
      native: {
        android: {
          applicationId: "com.rnmt.demo-app.dev",
        },
        ios: {
          bundleIdentifier: "com.rnmt.demo-app.dev",
        },
      },
    });
    expect(parsed.runtime.flags).toEqual({
      banner: "combo",
      chatEnabled: false,
      paymentsEnabled: true,
    });
    expect(parsed.runtime.routes).toEqual([
      {
        id: "home",
        path: "/tenant-home",
        screen: "TenantHomeScreen",
      },
      {
        id: "debug",
        path: "/debug",
        screen: "DebugScreen",
      },
    ]);
    expect(parsed.runtime.features).toEqual([
      {
        id: "payments",
        module: "PaymentsFeature",
        enabledByFlag: "paymentsEnabled",
      },
      {
        id: "debug-tools",
        module: "DebugToolsFeature",
      },
    ]);
    expect(parsed.runtime.menus).toEqual([
      {
        id: "home-menu",
        label: "Tenant Home",
        actionId: "open-home",
      },
    ]);
    expect(parsed.runtime.actions).toEqual([
      {
        id: "pay",
        label: "Pay",
        handler: "startPay",
      },
    ]);
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
      [
        "target",
        "set",
        "--tenant",
        "acme",
        "--environment",
        "staging",
        "--json",
      ],
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

    const exitCode = runCli(
      ["target", "set", "--tenant", "acme", "--environment", "dev"],
      {
        cwd: "/tmp/supported-fixture",
        io: { stdout, stderr },
        fileExists: () => false,
      },
    );

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

    const exitCode = runCli(
      ["target", "set", "--tenant", "acme", "--environment", "dev"],
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
            },
            environments: {
              dev: { displayName: "Development" },
            },
          }),
      },
    );

    const errorOutput = stderr.mock.calls.map(([chunk]) => chunk).join("");

    expect(exitCode).toBe(1);
    expect(stdout).not.toHaveBeenCalled();
    expect(errorOutput).toContain("Unknown tenant: acme");
  });

  it("adds a tenant through the CLI and leaves the repo syncable through target set and sync", () => {
    const repoDir = createTempRepo("rn-mt-cli-tenant-add-");
    const stdout = vi.fn();
    const stderr = vi.fn();

    writeFileSync(
      join(repoDir, "rn-mt.config.json"),
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

    const addExitCode = runCli(
      [
        "tenant",
        "add",
        "--id",
        "acme-beta",
        "--display-name",
        "Acme Beta",
        "--json",
      ],
      {
        cwd: repoDir,
        io: { stdout, stderr },
      },
    );
    const addOutput = stdout.mock.calls.map(([chunk]) => chunk).join("");
    const addParsed = JSON.parse(addOutput);

    expect(addExitCode).toBe(0);
    expect(addParsed.command).toBe("tenant add");
    expect(addParsed.tenant).toEqual({
      id: "acme-beta",
      displayName: "Acme Beta",
    });
    expect(
      existsSync(
        join(repoDir, "src", "rn-mt", "tenants", "acme-beta", ".gitkeep"),
      ),
    ).toBe(true);
    expect(
      JSON.parse(readFileSync(join(repoDir, "rn-mt.config.json"), "utf8"))
        .tenants["acme-beta"],
    ).toEqual({
      displayName: "Acme Beta",
    });

    stdout.mockClear();
    stderr.mockClear();

    const targetExitCode = runCli(
      [
        "target",
        "set",
        "--tenant",
        "acme-beta",
        "--environment",
        "dev",
        "--json",
      ],
      {
        cwd: repoDir,
        io: { stdout, stderr },
      },
    );
    const targetParsed = JSON.parse(
      stdout.mock.calls.map(([chunk]) => chunk).join(""),
    );

    expect(targetExitCode).toBe(0);
    expect(targetParsed.defaults).toEqual({
      tenant: "acme-beta",
      environment: "dev",
    });

    stdout.mockClear();
    stderr.mockClear();

    const syncExitCode = runCli(["sync", "--json"], {
      cwd: repoDir,
      io: { stdout, stderr },
    });
    const syncParsed = JSON.parse(
      stdout.mock.calls.map(([chunk]) => chunk).join(""),
    );

    expect(syncExitCode).toBe(0);
    expect(syncParsed.target).toEqual({
      tenant: "acme-beta",
      environment: "dev",
    });
    expect(stderr).not.toHaveBeenCalled();
  });

  it("rejects duplicate tenant ids through the CLI", () => {
    const repoDir = createTempRepo("rn-mt-cli-tenant-add-duplicate-");
    const stdout = vi.fn();
    const stderr = vi.fn();

    writeFileSync(
      join(repoDir, "rn-mt.config.json"),
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

    const exitCode = runCli(["tenant", "add", "--id", "demo-app"], {
      cwd: repoDir,
      io: { stdout, stderr },
    });
    const errorOutput = stderr.mock.calls.map(([chunk]) => chunk).join("");

    expect(exitCode).toBe(1);
    expect(stdout).not.toHaveBeenCalled();
    expect(errorOutput).toContain("Tenant already exists: demo-app");
  });

  it("renames a tenant end to end and keeps the renamed default tenant syncable", () => {
    const repoDir = createTempRepo("rn-mt-cli-tenant-rename-");
    const stdout = vi.fn();
    const stderr = vi.fn();

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
      join(repoDir, "rn-mt.config.json"),
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

    const renameExitCode = runCli(
      ["tenant", "rename", "--from", "demo-app", "--to", "acme-beta", "--json"],
      {
        cwd: repoDir,
        io: { stdout, stderr },
      },
    );
    const renameParsed = JSON.parse(
      stdout.mock.calls.map(([chunk]) => chunk).join(""),
    );

    expect(renameExitCode).toBe(0);
    expect(renameParsed.command).toBe("tenant rename");
    expect(renameParsed.tenant).toEqual({
      previousId: "demo-app",
      id: "acme-beta",
      displayName: "Demo App",
    });
    expect(
      JSON.parse(readFileSync(join(repoDir, "rn-mt.config.json"), "utf8"))
        .defaults,
    ).toEqual({
      tenant: "acme-beta",
      environment: "dev",
    });
    expect(
      existsSync(
        join(
          repoDir,
          "src",
          "rn-mt",
          "tenants",
          "acme-beta",
          "theme",
          "branding.ts",
        ),
      ),
    ).toBe(true);
    expect(
      existsSync(join(repoDir, "src", "rn-mt", "tenants", "demo-app")),
    ).toBe(false);
    expect(existsSync(join(repoDir, ".env.acme-beta.dev"))).toBe(true);
    expect(existsSync(join(repoDir, ".env.demo-app.dev"))).toBe(false);
    expect(
      existsSync(join(repoDir, "ios", "rn-mt.generated.acme-beta-dev.xcconfig")),
    ).toBe(true);
    expect(
      existsSync(join(repoDir, "ios", "rn-mt.generated.demo-app-dev.xcconfig")),
    ).toBe(false);
    expect(
      existsSync(
        join(
          repoDir,
          "ios",
          "DemoApp.xcodeproj",
          "xcshareddata",
          "xcschemes",
          "AcmeBeta-Dev.xcscheme",
        ),
      ),
    ).toBe(true);
    expect(
      existsSync(
        join(
          repoDir,
          "ios",
          "DemoApp.xcodeproj",
          "xcshareddata",
          "xcschemes",
          "DemoApp-Dev.xcscheme",
        ),
      ),
    ).toBe(false);
    expect(
      readFileSync(
        join(repoDir, "src", "rn-mt", "current", "theme", "branding.ts"),
        "utf8",
      ),
    ).toContain("../../tenants/acme-beta/theme/branding");
    expect(
      JSON.parse(
        readFileSync(join(repoDir, "rn-mt.generated.reconstruction.json"), "utf8"),
      ).defaultTenant,
    ).toBe("acme-beta");

    stdout.mockClear();
    stderr.mockClear();

    const syncExitCode = runCli(["sync", "--json"], {
      cwd: repoDir,
      io: { stdout, stderr },
    });
    const syncParsed = JSON.parse(
      stdout.mock.calls.map(([chunk]) => chunk).join(""),
    );

    expect(syncExitCode).toBe(0);
    expect(syncParsed.target).toEqual({
      tenant: "acme-beta",
      environment: "dev",
    });
    expect(stderr).not.toHaveBeenCalled();
  });

  it("rejects tenant rename collisions through the CLI", () => {
    const repoDir = createTempRepo("rn-mt-cli-tenant-rename-collision-");
    const stdout = vi.fn();
    const stderr = vi.fn();

    writeFileSync(
      join(repoDir, "rn-mt.config.json"),
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

    const exitCode = runCli(
      ["tenant", "rename", "--from", "demo-app", "--to", "acme"],
      {
        cwd: repoDir,
        io: { stdout, stderr },
      },
    );
    const errorOutput = stderr.mock.calls.map(([chunk]) => chunk).join("");

    expect(exitCode).toBe(1);
    expect(stdout).not.toHaveBeenCalled();
    expect(errorOutput).toContain("Tenant already exists: acme");
  });

  it("removes a non-default tenant end to end and leaves sync plus audit on the remaining default tenant", () => {
    const repoDir = createTempRepo("rn-mt-cli-tenant-remove-");
    const stdout = vi.fn();
    const stderr = vi.fn();

    mkdirSync(join(repoDir, "src", "rn-mt", "tenants", "acme", "theme"), {
      recursive: true,
    });
    mkdirSync(join(repoDir, "src", "rn-mt", "shared", "theme"), {
      recursive: true,
    });
    writeFileSync(
      join(repoDir, "rn-mt.config.json"),
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
    writeFileSync(
      join(repoDir, "src", "rn-mt", "shared", "theme", "branding.ts"),
      "export default { tenantId: 'demo-app', displayName: 'Demo App' };\n",
    );
    writeFileSync(
      join(repoDir, "src", "rn-mt", "tenants", "acme", "theme", "branding.ts"),
      "export default { tenantId: 'acme', displayName: 'Acme' };\n",
    );
    writeFileSync(
      join(repoDir, ".env.acme.dev"),
      "API_BASE_URL=https://acme.example.com\n",
    );

    const removeExitCode = runCli(
      ["tenant", "remove", "--id", "acme", "--json"],
      {
        cwd: repoDir,
        io: { stdout, stderr },
      },
    );
    const removeParsed = JSON.parse(
      stdout.mock.calls.map(([chunk]) => chunk).join(""),
    );

    expect(removeExitCode).toBe(0);
    expect(removeParsed.command).toBe("tenant remove");
    expect(removeParsed.tenant).toEqual({
      id: "acme",
      displayName: "Acme",
    });
    expect(
      JSON.parse(readFileSync(join(repoDir, "rn-mt.config.json"), "utf8"))
        .tenants,
    ).toEqual({
      "demo-app": { displayName: "Demo App" },
    });
    expect(existsSync(join(repoDir, "src", "rn-mt", "tenants", "acme"))).toBe(
      false,
    );
    expect(existsSync(join(repoDir, ".env.acme.dev"))).toBe(false);

    stdout.mockClear();
    stderr.mockClear();

    const syncExitCode = runCli(["sync", "--json"], {
      cwd: repoDir,
      io: { stdout, stderr },
    });
    const syncParsed = JSON.parse(
      stdout.mock.calls.map(([chunk]) => chunk).join(""),
    );

    expect(syncExitCode).toBe(0);
    expect(syncParsed.target).toEqual({
      tenant: "demo-app",
      environment: "dev",
    });

    stdout.mockClear();
    stderr.mockClear();

    const auditExitCode = runCli(["audit", "--json"], {
      cwd: repoDir,
      io: { stdout, stderr },
    });
    const auditParsed = JSON.parse(
      stdout.mock.calls.map(([chunk]) => chunk).join(""),
    );

    expect(auditExitCode).toBe(1);
    expect(auditParsed.command).toBe("audit");
    expect(auditParsed.findings).toEqual([
      expect.objectContaining({
        code: "override-candidate",
        path: join(repoDir, "src", "rn-mt", "shared", "theme", "branding.ts"),
      }),
    ]);
    expect(auditParsed.findings[0].evidence).toEqual([
      'Matched default tenant id "demo-app" in shared file contents.',
      'Matched default tenant display name "Demo App" in shared file contents.',
    ]);
    expect(stderr).not.toHaveBeenCalled();
  });

  it("guards against removing the current default tenant through the CLI", () => {
    const repoDir = createTempRepo("rn-mt-cli-tenant-remove-default-");
    const stdout = vi.fn();
    const stderr = vi.fn();

    writeFileSync(
      join(repoDir, "rn-mt.config.json"),
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

    const exitCode = runCli(["tenant", "remove", "--id", "demo-app"], {
      cwd: repoDir,
      io: { stdout, stderr },
    });
    const errorOutput = stderr.mock.calls.map(([chunk]) => chunk).join("");

    expect(exitCode).toBe(1);
    expect(stdout).not.toHaveBeenCalled();
    expect(errorOutput).toContain(
      "Cannot remove default tenant: demo-app. Select a different default target first.",
    );
  });

  it("doctor reports positive release integration signals in JSON mode", () => {
    const repoDir = createTempRepo("rn-mt-cli-doctor-positive-");
    const stdout = vi.fn();
    const stderr = vi.fn();

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
    writeFileSync(
      join(repoDir, "rn-mt.config.json"),
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

    const exitCode = runCli(["doctor", "--json"], {
      cwd: repoDir,
      io: { stdout, stderr },
    });
    const parsed = JSON.parse(
      stdout.mock.calls.map(([chunk]) => chunk).join(""),
    );

    expect(exitCode).toBe(0);
    expect(parsed.command).toBe("doctor");
    expect(parsed.status).toBe("passed");
    expect(parsed.summary).toEqual({
      totalChecks: 2,
      warningChecks: 0,
    });
    expect(parsed.checks).toEqual(
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
    expect(stderr).not.toHaveBeenCalled();
  });

  it("doctor reports missing Expo distribution wiring as a warning", () => {
    const repoDir = createTempRepo("rn-mt-cli-doctor-warning-");
    const stdout = vi.fn();
    const stderr = vi.fn();

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
    writeFileSync(
      join(repoDir, "rn-mt.config.json"),
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

    const exitCode = runCli(["doctor", "--json"], {
      cwd: repoDir,
      io: { stdout, stderr },
    });
    const parsed = JSON.parse(
      stdout.mock.calls.map(([chunk]) => chunk).join(""),
    );

    expect(exitCode).toBe(1);
    expect(parsed.command).toBe("doctor");
    expect(parsed.status).toBe("warnings");
    expect(parsed.summary).toEqual({
      totalChecks: 1,
      warningChecks: 1,
    });
    expect(parsed.checks).toEqual([
      expect.objectContaining({
        code: "expo-distribution-config",
        status: "warning",
      }),
    ]);
    expect(parsed.checks[0].details).toContain(
      `Expected ${join(repoDir, "eas.json")} for EAS build and submit workflow wiring.`,
    );
    expect(stderr).not.toHaveBeenCalled();
  });

  it("handoff preflight passes when the repo is converted, doctor-clean, and has reconstruction metadata", () => {
    const repoDir = createTempRepo("rn-mt-cli-handoff-preflight-pass-");
    const stdout = vi.fn();
    const stderr = vi.fn();
    const outputDir = join(
      dirname(repoDir),
      `${basename(repoDir)}-handoff-fixture-app`,
    );

    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "fixture-app",
        packageManager: "pnpm@10.25.0",
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
      join(repoDir, "rn-mt.config.json"),
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
        },
      }),
    );
    mkdirSync(join(repoDir, ".github", "workflows"), { recursive: true });
    writeFileSync(
      join(repoDir, ".github", "workflows", "release.yml"),
      "name: release\n",
    );
    writeFileSync(
      join(repoDir, ".env.dev"),
      "API_BASE_URL=https://dev.example.com\nSENTRY_DSN=https://secret-dev\n",
    );
    writeFileSync(
      join(repoDir, ".env.fixture-app.dev"),
      "TENANT_ONLY=fixture-secret\n",
    );
    writeFileSync(join(repoDir, "README.md"), "# Fixture App\n");
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

    expect(
      runCli(["convert", "--json"], {
        cwd: repoDir,
        io: { stdout: vi.fn(), stderr: vi.fn() },
      }),
    ).toBe(0);

    mkdirSync(
      join(repoDir, "src", "rn-mt", "tenants", "fixture-app", "theme"),
      {
        recursive: true,
      },
    );
    writeFileSync(
      join(
        repoDir,
        "src",
        "rn-mt",
        "tenants",
        "fixture-app",
        "theme",
        "index.ts",
      ),
      [
        'import logo from "../../../current/assets/logo.png";',
        "",
        "export default { logo, color: 'tenant' };",
        "",
      ].join("\n"),
    );

    const exitCode = runCli(["handoff", "--tenant", "fixture-app", "--json"], {
      cwd: repoDir,
      io: { stdout, stderr },
      runSubprocess(command, args, options) {
        if (command === "git" && args[0] === "init") {
          mkdirSync(join(options.cwd, ".git"), { recursive: true });
          writeFileSync(
            join(options.cwd, ".git", "HEAD"),
            "ref: refs/heads/main\n",
          );
          return { status: 0 };
        }

        return {
          status: 1,
          error: new Error(`Unexpected subprocess: ${command}`),
        };
      },
    });
    const parsed = JSON.parse(
      stdout.mock.calls.map(([chunk]) => chunk).join(""),
    );

    expect(exitCode).toBe(0);
    expect(parsed.command).toBe("handoff");
    expect(parsed.status).toBe("initialized");
    expect(parsed.tenant).toEqual({
      id: "fixture-app",
      displayName: "Fixture App",
    });
    expect(parsed.output).toEqual({
      path: outputDir,
      replacedExisting: false,
      gitInitialized: true,
    });
    expect(parsed.package).toEqual({
      enabled: false,
      path: null,
      created: false,
    });
    expect(parsed.cleanup).toEqual(
      expect.objectContaining({
        rewrittenFiles: expect.arrayContaining([
          join(outputDir, "package.json"),
          join(outputDir, "README.md"),
        ]),
        removedPaths: expect.arrayContaining([
          join(outputDir, "rn-mt.config.json"),
          join(outputDir, "rn-mt.generated.README.md"),
          join(outputDir, "rn-mt.generated.convert.ownership.json"),
          join(outputDir, "rn-mt.generated.reconstruction.json"),
          join(outputDir, "src", "rn-mt"),
        ]),
      }),
    );
    expect(parsed.sanitization).toEqual(
      expect.objectContaining({
        generatedFiles: expect.arrayContaining([
          join(outputDir, ".env.dev.example"),
        ]),
        removedPaths: expect.arrayContaining([
          join(outputDir, ".github"),
          join(outputDir, "eas.json"),
          join(outputDir, ".env.dev"),
          join(outputDir, ".env.fixture-app.dev"),
        ]),
        reviewRequired: true,
        reviewChecklist: expect.arrayContaining([
          expect.stringContaining(".github"),
          expect.stringContaining(".env.dev.example"),
        ]),
      }),
    );
    expect(parsed.restoredFiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourcePath: join(outputDir, "src", "rn-mt", "shared", "App.tsx"),
          destinationPath: join(outputDir, "App.tsx"),
        }),
        expect.objectContaining({
          sourcePath: join(
            outputDir,
            "src",
            "rn-mt",
            "tenants",
            "fixture-app",
            "theme",
            "index.ts",
          ),
          destinationPath: join(outputDir, "theme", "index.ts"),
        }),
        expect.objectContaining({
          sourcePath: join(
            outputDir,
            "src",
            "rn-mt",
            "shared",
            "src",
            "config",
            "index.ts",
          ),
          destinationPath: join(outputDir, "src", "config", "index.ts"),
        }),
      ]),
    );
    expect(parsed.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "target-tenant",
          status: "ok",
        }),
        expect.objectContaining({
          code: "converted-repo",
          status: "ok",
        }),
        expect.objectContaining({
          code: "reconstruction-metadata",
          status: "ok",
        }),
        expect.objectContaining({
          code: "doctor-clean",
          status: "ok",
        }),
      ]),
    );
    expect(readFileSync(join(outputDir, "App.tsx"), "utf8")).toBe(
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
    expect(readFileSync(join(outputDir, "theme", "index.ts"), "utf8")).toBe(
      [
        'import logo from "../assets/logo.png";',
        "",
        "export default { logo, color: 'tenant' };",
        "",
      ].join("\n"),
    );
    expect(
      readFileSync(join(outputDir, "src", "config", "index.ts"), "utf8"),
    ).toBe("export default { apiBaseUrl: 'https://example.com' };\n");
    expect(readFileSync(join(outputDir, "assets", "logo.png"), "utf8")).toBe(
      "binary",
    );
    expect(readFileSync(join(outputDir, "App.test.tsx"), "utf8")).toBe(
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
    const outputPackageJson = JSON.parse(
      readFileSync(join(outputDir, "package.json"), "utf8"),
    ) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    expect(outputPackageJson.scripts).toEqual(
      expect.objectContaining({
        start: "expo start",
        android: "expo start --android",
        ios: "expo start --ios",
      }),
    );
    expect(outputPackageJson.scripts?.prestart).toBeUndefined();
    expect(outputPackageJson.scripts?.preandroid).toBeUndefined();
    expect(outputPackageJson.scripts?.preios).toBeUndefined();
    expect(outputPackageJson.scripts?.postinstall).toBeUndefined();
    expect(outputPackageJson.scripts?.["rn-mt:sync"]).toBeUndefined();
    expect(outputPackageJson.scripts?.["rn-mt:start"]).toBeUndefined();
    expect(outputPackageJson.dependencies?.["@_molaidrislabs/rn-mt"]).toBeUndefined();
    expect(readFileSync(join(outputDir, "README.md"), "utf8")).toBe(
      "# Fixture App\n",
    );
    expect(readFileSync(join(outputDir, ".env.dev.example"), "utf8")).toContain(
      "API_BASE_URL=",
    );
    expect(readFileSync(join(outputDir, ".env.dev.example"), "utf8")).toContain(
      "SENTRY_DSN=",
    );
    expect(readFileSync(join(outputDir, ".env.dev.example"), "utf8")).toContain(
      "TENANT_ONLY=",
    );
    expect(
      readFileSync(join(outputDir, ".env.dev.example"), "utf8"),
    ).not.toContain("https://secret-dev");
    expect(existsSync(join(outputDir, ".git", "HEAD"))).toBe(true);
    expect(existsSync(join(outputDir, ".github"))).toBe(false);
    expect(existsSync(join(outputDir, "eas.json"))).toBe(false);
    expect(existsSync(join(outputDir, ".env.dev"))).toBe(false);
    expect(existsSync(join(outputDir, ".env.fixture-app.dev"))).toBe(false);
    expect(existsSync(join(outputDir, "rn-mt.config.json"))).toBe(false);
    expect(existsSync(join(outputDir, "rn-mt.generated.README.md"))).toBe(
      false,
    );
    expect(
      existsSync(join(outputDir, "rn-mt.generated.convert.ownership.json")),
    ).toBe(false);
    expect(
      existsSync(join(outputDir, "rn-mt.generated.reconstruction.json")),
    ).toBe(false);
    expect(existsSync(join(outputDir, "src", "rn-mt"))).toBe(false);
    expect(stderr).not.toHaveBeenCalled();
  });

  it("handoff optionally packages the sanitized single-tenant output as a zip", () => {
    const repoDir = createTempRepo("rn-mt-cli-handoff-zip-");
    const stdout = vi.fn();
    const stderr = vi.fn();
    const outputDir = join(
      dirname(repoDir),
      `${basename(repoDir)}-handoff-fixture-app`,
    );
    const archivePath = `${outputDir}.zip`;

    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "fixture-app",
        packageManager: "pnpm@10.25.0",
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
      join(repoDir, "rn-mt.config.json"),
      JSON.stringify({
        schemaVersion: 1,
        source: { rootDir: repoDir },
        defaults: { tenant: "fixture-app", environment: "dev" },
        envSchema: {
          apiBaseUrl: {
            source: "API_BASE_URL",
            required: true,
          },
        },
        tenants: {
          "fixture-app": { displayName: "Fixture App" },
        },
        environments: {
          dev: { displayName: "Development" },
        },
      }),
    );
    writeFileSync(join(repoDir, "README.md"), "# Fixture App\n");
    writeFileSync(
      join(repoDir, ".env.dev"),
      "API_BASE_URL=https://dev.example.com\n",
    );
    writeFileSync(
      join(repoDir, "App.tsx"),
      "export default function App() { return null; }\n",
    );
    writeFileSync(
      join(repoDir, "index.js"),
      "import { registerRootComponent } from 'expo';\nregisterRootComponent(App);\n",
    );

    expect(
      runCli(["convert", "--json"], {
        cwd: repoDir,
        io: { stdout: vi.fn(), stderr: vi.fn() },
      }),
    ).toBe(0);

    const exitCode = runCli(
      ["handoff", "--tenant", "fixture-app", "--zip", "--json"],
      {
        cwd: repoDir,
        io: { stdout, stderr },
        runSubprocess(command, args, options) {
          if (command === "git" && args[0] === "init") {
            mkdirSync(join(options.cwd, ".git"), { recursive: true });
            writeFileSync(
              join(options.cwd, ".git", "HEAD"),
              "ref: refs/heads/main\n",
            );
            return { status: 0 };
          }

          if (command === "zip") {
            expect(args).toEqual(["-qr", archivePath, basename(outputDir)]);
            expect(options.cwd).toBe(dirname(outputDir));
            writeFileSync(archivePath, `zip:${basename(outputDir)}\n`);
            return { status: 0 };
          }

          return {
            status: 1,
            error: new Error(`Unexpected subprocess: ${command}`),
          };
        },
      },
    );
    const parsed = JSON.parse(
      stdout.mock.calls.map(([chunk]) => chunk).join(""),
    );

    expect(exitCode).toBe(0);
    expect(parsed.command).toBe("handoff");
    expect(parsed.status).toBe("initialized");
    expect(parsed.output).toEqual({
      path: outputDir,
      replacedExisting: false,
      gitInitialized: true,
    });
    expect(parsed.package).toEqual({
      enabled: true,
      path: archivePath,
      created: true,
    });
    expect(existsSync(outputDir)).toBe(true);
    expect(readFileSync(archivePath, "utf8")).toBe(
      `zip:${basename(outputDir)}\n`,
    );
    expect(readFileSync(join(outputDir, ".env.dev.example"), "utf8")).toContain(
      "API_BASE_URL=",
    );
    expect(existsSync(join(outputDir, "rn-mt.config.json"))).toBe(false);
    expect(stderr).not.toHaveBeenCalled();
  });

  it("handoff preflight blocks clearly when reconstruction metadata is missing", () => {
    const repoDir = createTempRepo("rn-mt-cli-handoff-preflight-blocked-");
    const stdout = vi.fn();
    const stderr = vi.fn();

    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "fixture-app",
        packageManager: "pnpm@10.25.0",
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
      "export default function App() { return null; }\n",
    );
    writeFileSync(
      join(repoDir, "index.js"),
      "import { registerRootComponent } from 'expo';\nregisterRootComponent(App);\n",
    );

    expect(
      runCli(["convert", "--json"], {
        cwd: repoDir,
        io: { stdout: vi.fn(), stderr: vi.fn() },
      }),
    ).toBe(0);

    rmSync(join(repoDir, "rn-mt.generated.reconstruction.json"));

    const exitCode = runCli(["handoff", "--tenant", "fixture-app", "--json"], {
      cwd: repoDir,
      io: { stdout, stderr },
    });
    const parsed = JSON.parse(
      stdout.mock.calls.map(([chunk]) => chunk).join(""),
    );

    expect(exitCode).toBe(1);
    expect(parsed.command).toBe("handoff");
    expect(parsed.status).toBe("blocked");
    expect(parsed.checks).toEqual(
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
      ]),
    );
    expect(stderr).not.toHaveBeenCalled();
  });

  it("handoff preserves failed output when final isolation audit finds other-tenant residue", () => {
    const repoDir = createTempRepo("rn-mt-cli-handoff-audit-failure-");
    const stdout = vi.fn();
    const stderr = vi.fn();
    const outputDir = join(
      dirname(repoDir),
      `${basename(repoDir)}-handoff-acme`,
    );

    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "fixture-app",
        packageManager: "pnpm@10.25.0",
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
      join(repoDir, "rn-mt.config.json"),
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
      "# Fixture App\n\nInternal note: Beta Corp rollout still pending.\n",
    );
    writeFileSync(
      join(repoDir, "App.tsx"),
      "export default function App() { return null; }\n",
    );
    writeFileSync(
      join(repoDir, "index.js"),
      "import { registerRootComponent } from 'expo';\nregisterRootComponent(App);\n",
    );

    expect(
      runCli(["convert", "--json"], {
        cwd: repoDir,
        io: { stdout: vi.fn(), stderr: vi.fn() },
      }),
    ).toBe(0);

    const exitCode = runCli(["handoff", "--tenant", "acme", "--json"], {
      cwd: repoDir,
      io: { stdout, stderr },
      runSubprocess(command) {
        return {
          status: 1,
          error: new Error(`Unexpected subprocess: ${command}`),
        };
      },
    });
    const parsed = JSON.parse(
      stdout.mock.calls.map(([chunk]) => chunk).join(""),
    );

    expect(exitCode).toBe(1);
    expect(parsed.command).toBe("handoff");
    expect(parsed.status).toBe("blocked");
    expect(parsed.reason).toBe("Final handoff isolation audit failed.");
    expect(parsed.output).toEqual({
      path: outputDir,
      replacedExisting: false,
      gitInitialized: false,
    });
    expect(parsed.audit.findings).toEqual([
      expect.objectContaining({
        code: "other-tenant-residue",
        path: join(outputDir, "README.md"),
        severity: "P0",
        confidence: "high",
      }),
    ]);
    expect(existsSync(outputDir)).toBe(true);
    expect(readFileSync(join(outputDir, "README.md"), "utf8")).toContain(
      "Beta Corp",
    );
    expect(existsSync(join(outputDir, ".git"))).toBe(false);
    expect(stderr).not.toHaveBeenCalled();
  });

  it("handoff refuses to overwrite an existing sibling output unless forced", () => {
    const repoDir = createTempRepo("rn-mt-cli-handoff-overwrite-guard-");
    const stdout = vi.fn();
    const stderr = vi.fn();
    const outputDir = join(
      dirname(repoDir),
      `${basename(repoDir)}-handoff-fixture-app`,
    );

    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "fixture-app",
        packageManager: "pnpm@10.25.0",
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
      "export default function App() { return null; }\n",
    );
    writeFileSync(
      join(repoDir, "index.js"),
      "import { registerRootComponent } from 'expo';\nregisterRootComponent(App);\n",
    );

    expect(
      runCli(["convert", "--json"], {
        cwd: repoDir,
        io: { stdout: vi.fn(), stderr: vi.fn() },
      }),
    ).toBe(0);

    mkdirSync(outputDir, { recursive: true });
    writeFileSync(join(outputDir, "existing.txt"), "keep me\n");

    const exitCode = runCli(["handoff", "--tenant", "fixture-app", "--json"], {
      cwd: repoDir,
      io: { stdout, stderr },
      runSubprocess(command) {
        return {
          status: 1,
          error: new Error(`Unexpected subprocess: ${command}`),
        };
      },
    });
    const parsed = JSON.parse(
      stdout.mock.calls.map(([chunk]) => chunk).join(""),
    );

    expect(exitCode).toBe(1);
    expect(parsed.command).toBe("handoff");
    expect(parsed.status).toBe("blocked");
    expect(parsed.reason).toBe(
      `Handoff output already exists: ${outputDir}. Re-run with --force to replace it.`,
    );
    expect(parsed.output).toEqual({
      path: outputDir,
      replacedExisting: false,
      gitInitialized: false,
    });
    expect(readFileSync(join(outputDir, "existing.txt"), "utf8")).toBe(
      "keep me\n",
    );
    expect(stderr).not.toHaveBeenCalled();
  });

  it("handoff replaces an existing sibling output when forced", () => {
    const repoDir = createTempRepo("rn-mt-cli-handoff-force-");
    const stdout = vi.fn();
    const stderr = vi.fn();
    const outputDir = join(
      dirname(repoDir),
      `${basename(repoDir)}-handoff-fixture-app`,
    );

    writeFileSync(
      join(repoDir, "package.json"),
      JSON.stringify({
        name: "fixture-app",
        packageManager: "pnpm@10.25.0",
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
      "export default function App() { return null; }\n",
    );
    writeFileSync(
      join(repoDir, "index.js"),
      "import { registerRootComponent } from 'expo';\nregisterRootComponent(App);\n",
    );

    expect(
      runCli(["convert", "--json"], {
        cwd: repoDir,
        io: { stdout: vi.fn(), stderr: vi.fn() },
      }),
    ).toBe(0);

    mkdirSync(outputDir, { recursive: true });
    writeFileSync(join(outputDir, "existing.txt"), "stale\n");

    const exitCode = runCli(
      ["handoff", "--tenant", "fixture-app", "--force", "--json"],
      {
        cwd: repoDir,
        io: { stdout, stderr },
        runSubprocess(command, args, options) {
          if (command === "git" && args[0] === "init") {
            mkdirSync(join(options.cwd, ".git"), { recursive: true });
            writeFileSync(
              join(options.cwd, ".git", "HEAD"),
              "ref: refs/heads/main\n",
            );
            return { status: 0 };
          }

          return {
            status: 1,
            error: new Error(`Unexpected subprocess: ${command}`),
          };
        },
      },
    );
    const parsed = JSON.parse(
      stdout.mock.calls.map(([chunk]) => chunk).join(""),
    );

    expect(exitCode).toBe(0);
    expect(parsed.status).toBe("initialized");
    expect(parsed.output).toEqual({
      path: outputDir,
      replacedExisting: true,
      gitInitialized: true,
    });
    expect(existsSync(join(outputDir, ".git", "HEAD"))).toBe(true);
    expect(existsSync(join(outputDir, "existing.txt"))).toBe(false);
    expect(stderr).not.toHaveBeenCalled();
  });
});
