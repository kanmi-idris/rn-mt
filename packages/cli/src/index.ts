#!/usr/bin/env node

import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import {
  canInitializeFromAnalyzeReport,
  coreModuleContracts,
  createBaselineAnalyzeReport,
  createConvertResult,
  createInitResult,
  createSubprocessEnv,
  createSyncResult,
  createTargetSetResult,
  formatBaselineAnalyzeReport,
  getManifestPath,
  getInitBlockedReason,
  milestoneOneScope,
  parseManifest,
  type RnMtRepoAppKind,
  type RnMtTargetPlatform,
} from "@rn-mt/core";

const helpText = `rn-mt

Manifest-driven multitenancy conversion platform for existing React Native and Expo applications.

Initial scaffold status:
- workspace created
- deep module boundaries recorded
- PRD written in docs/issues/0001-rn-mt-prd.md

Milestone 1 includes:
${milestoneOneScope.includes.map((item) => `- ${item}`).join("\n")}

Deferred to milestone 2:
${milestoneOneScope.defers.map((item) => `- ${item}`).join("\n")}

Core deep modules:
${coreModuleContracts.map((item) => `- ${item.name}: ${item.purpose}`).join("\n")}
`;

export interface RnMtCliIo {
  stdout: (text: string) => void;
  stderr: (text: string) => void;
}

interface RnMtCliSubprocessResult {
  status: number | null;
  error?: Error;
  signal?: NodeJS.Signals | null;
}

interface RnMtCliSubprocessRunner {
  (
    command: string,
    args: string[],
    options: {
      cwd: string;
      env: Record<string, string | undefined>;
    },
  ): RnMtCliSubprocessResult;
}

interface RnMtCliAnalyzeBlockResult {
  command: "analyze";
  status: "blocked";
  analyze: ReturnType<typeof createBaselineAnalyzeReport>;
  reason: string;
  remediation: string[];
}

const defaultIo: RnMtCliIo = {
  stdout(text) {
    process.stdout.write(text);
  },
  stderr(text) {
    process.stderr.write(text);
  },
};

function getDefaultExecutionCwd() {
  return process.env.INIT_CWD ?? process.env.PWD ?? process.cwd();
}

function wantsJsonOutput(commandArgsToCheck: string[]) {
  return commandArgsToCheck.includes("--json");
}

function isNonInteractive(commandArgsToCheck: string[]) {
  return commandArgsToCheck.includes("--non-interactive");
}

function getSelectedAppKind(
  commandArgsToCheck: string[],
): RnMtRepoAppKind | null {
  const appKindIndex = commandArgsToCheck.indexOf("--app-kind");

  if (appKindIndex === -1) {
    return null;
  }

  const requestedKind = commandArgsToCheck[appKindIndex + 1];

  if (
    requestedKind === "expo-managed" ||
    requestedKind === "expo-prebuild" ||
    requestedKind === "bare-react-native"
  ) {
    return requestedKind;
  }

  return null;
}

function getRequiredOption(
  commandArgsToCheck: string[],
  optionName: string,
) {
  const optionIndex = commandArgsToCheck.indexOf(optionName);

  if (optionIndex === -1) {
    return null;
  }

  return commandArgsToCheck[optionIndex + 1] ?? null;
}

function getSelectedPlatform(
  commandArgsToCheck: string[],
): RnMtTargetPlatform | null {
  const platform = getRequiredOption(commandArgsToCheck, "--platform");

  if (platform === "ios" || platform === "android") {
    return platform;
  }

  return null;
}

function splitCommandArgs(commandArgsToCheck: string[]) {
  const separatorIndex = commandArgsToCheck.indexOf("--");

  if (separatorIndex === -1) {
    return {
      optionArgs: commandArgsToCheck,
      passthroughArgs: [],
    };
  }

  return {
    optionArgs: commandArgsToCheck.slice(0, separatorIndex),
    passthroughArgs: commandArgsToCheck.slice(separatorIndex + 1),
  };
}

function ensureParentDir(path: string) {
  mkdirSync(dirname(path), { recursive: true });
}

function applyAppKindSelection(
  report: ReturnType<typeof createBaselineAnalyzeReport>,
  selectedAppKind: RnMtRepoAppKind | null,
) {
  if (!selectedAppKind || !report.repo.app.candidates.includes(selectedAppKind)) {
    return report;
  }

  return {
    ...report,
    status: "ok" as const,
    repo: {
      ...report.repo,
      app: {
        ...report.repo.app,
        kind: selectedAppKind,
        candidates: [selectedAppKind],
        remediation: [],
      },
    },
  };
}

function readInteractiveLine() {
  const buffer = Buffer.alloc(1);
  let collected = "";

  while (true) {
    const bytesRead = readSync(process.stdin.fd, buffer, 0, 1, null);

    if (bytesRead === 0) {
      return collected.trim();
    }

    const character = buffer.toString("utf8", 0, bytesRead);

    if (character === "\n") {
      return collected.trim();
    }

    if (character !== "\r") {
      collected += character;
    }
  }
}

function createAnalyzeBlockedResult(
  report: ReturnType<typeof createBaselineAnalyzeReport>,
): RnMtCliAnalyzeBlockResult {
  return {
    command: "analyze",
    status: "blocked",
    analyze: report,
    reason: "Ambiguous repo classification requires an explicit app-kind selection.",
    remediation: report.repo.app.remediation,
  };
}

function promptForAmbiguousAppKind(
  report: ReturnType<typeof createBaselineAnalyzeReport>,
  io: RnMtCliIo,
): RnMtRepoAppKind | null {
  const { candidates } = report.repo.app;

  if (!process.stdin.isTTY) {
    return null;
  }

  io.stdout("Ambiguous repo classification detected.\n");
  io.stdout("Select the intended app kind for this run:\n");

  candidates.forEach((candidate, index) => {
    io.stdout(`${index + 1}. ${candidate}\n`);
  });

  io.stdout("Selection: ");

  while (true) {
    const response = readInteractiveLine();

    if (response.length === 0) {
      return null;
    }

    const selectedIndex = Number.parseInt(response, 10);

    if (
      Number.isInteger(selectedIndex) &&
      selectedIndex >= 1 &&
      selectedIndex <= candidates.length
    ) {
      return candidates[selectedIndex - 1] ?? null;
    }

    if (
      response === "expo-managed" ||
      response === "expo-prebuild" ||
      response === "bare-react-native"
    ) {
      return candidates.includes(response) ? response : null;
    }

    io.stdout("Invalid selection. Choose a number from the list or an exact app kind: ");
  }
}

export function runCli(
  args: string[],
  options: {
    cwd?: string;
    io?: RnMtCliIo;
    analyzeReportFactory?: typeof createBaselineAnalyzeReport;
    env?: Record<string, string | undefined>;
    fileExists?: (path: string) => boolean;
    writeFile?: (path: string, contents: string) => void;
    readFile?: (path: string) => string;
    runSubprocess?: RnMtCliSubprocessRunner;
    promptForAppKind?: (
      report: ReturnType<typeof createBaselineAnalyzeReport>,
      io: RnMtCliIo,
    ) => RnMtRepoAppKind | null;
  } = {},
) {
  const io = options.io ?? defaultIo;
  const cwd = options.cwd ?? getDefaultExecutionCwd();
  const analyzeReportFactory =
    options.analyzeReportFactory ?? createBaselineAnalyzeReport;
  const env = options.env ?? process.env;
  const fileExists = options.fileExists ?? existsSync;
  const writeFile = options.writeFile ?? ((path, contents) => writeFileSync(path, contents));
  const readFile = options.readFile ?? ((path) => readFileSync(path, "utf8"));
  const runSubprocess =
    options.runSubprocess ??
    ((command, subprocessArgs, subprocessOptions) =>
      spawnSync(command, subprocessArgs, {
        cwd: subprocessOptions.cwd,
        env: subprocessOptions.env,
        stdio: "inherit",
      }));
  const promptForAppKind = options.promptForAppKind ?? promptForAmbiguousAppKind;
  const [command, ...commandArgs] = args;

  if (args.includes("--help") || args.includes("-h") || args.length === 0) {
    io.stdout(`${helpText}\n`);
    return 0;
  }

  if (command === "analyze") {
    const selectedAppKind = getSelectedAppKind(commandArgs);
    const initialReport = analyzeReportFactory(cwd);
    let report = applyAppKindSelection(initialReport, selectedAppKind);

    if (report.status === "ambiguous" && isNonInteractive(commandArgs)) {
      const blockedResult = createAnalyzeBlockedResult(report);

      if (wantsJsonOutput(commandArgs)) {
        io.stdout(`${JSON.stringify(blockedResult, null, 2)}\n`);
      } else {
        io.stderr(`${blockedResult.reason}\n`);
        io.stderr(`${formatBaselineAnalyzeReport(report)}\n`);
      }

      return 1;
    }

    if (report.status === "ambiguous" && !selectedAppKind) {
      const promptedAppKind = promptForAppKind(report, io);

      if (!promptedAppKind) {
        const blockedResult = createAnalyzeBlockedResult(report);

        if (wantsJsonOutput(commandArgs)) {
          io.stdout(`${JSON.stringify(blockedResult, null, 2)}\n`);
        } else {
          io.stderr(`${blockedResult.reason}\n`);
          io.stderr(`${formatBaselineAnalyzeReport(report)}\n`);
        }

        return 1;
      }

      report = applyAppKindSelection(report, promptedAppKind);

      if (!wantsJsonOutput(commandArgs)) {
        io.stdout(`Selected app kind for this run: ${promptedAppKind}\n`);
      }
    }

    if (wantsJsonOutput(commandArgs)) {
      io.stdout(`${JSON.stringify(report, null, 2)}\n`);
      return 0;
    }

    io.stdout(`${formatBaselineAnalyzeReport(report)}\n`);
    return 0;
  }

  if (command === "init") {
    const report = analyzeReportFactory(cwd);
    const initBlockedReason = getInitBlockedReason(report);

    if (initBlockedReason) {
      if (wantsJsonOutput(commandArgs)) {
        io.stdout(
          `${JSON.stringify(
            {
              command: "init",
              status: "blocked",
              analyze: report,
              reason: initBlockedReason,
            },
            null,
            2,
          )}\n`,
        );
      } else {
        io.stderr(`${initBlockedReason}\n`);
      }

      return 1;
    }

    const initResult = createInitResult(report);

    if (fileExists(initResult.manifestPath)) {
      const alreadyExistsMessage = `Manifest already exists: ${initResult.manifestPath}`;

      if (wantsJsonOutput(commandArgs)) {
        io.stdout(
          `${JSON.stringify(
            {
              command: "init",
              status: "skipped",
              analyze: report,
              manifestPath: initResult.manifestPath,
              manifest: initResult.manifest,
              reason: alreadyExistsMessage,
            },
            null,
            2,
          )}\n`,
        );
      } else {
        io.stdout(`${alreadyExistsMessage}\n`);
      }

      return 0;
    }

    writeFile(initResult.manifestPath, `${JSON.stringify(initResult.manifest, null, 2)}\n`);

    for (const generatedHostFile of initResult.generatedHostFiles) {
      writeFile(generatedHostFile.path, generatedHostFile.contents);
    }

    if (wantsJsonOutput(commandArgs)) {
      io.stdout(
        `${JSON.stringify(
          {
            command: "init",
            status: "created",
            analyze: report,
            manifestPath: initResult.manifestPath,
            manifest: initResult.manifest,
            generatedHostFiles: initResult.generatedHostFiles.map(
              ({ path, language }) => ({ path, language }),
            ),
          },
          null,
          2,
        )}\n`,
      );
      return 0;
    }

    io.stdout(`Created manifest: ${initResult.manifestPath}\n`);
    io.stdout(`Default tenant: ${initResult.manifest.defaults.tenant}\n`);
    io.stdout(`Default environment: ${initResult.manifest.defaults.environment}\n`);

    for (const generatedHostFile of initResult.generatedHostFiles) {
      io.stdout(`Generated host file: ${generatedHostFile.path}\n`);
    }

    return 0;
  }

  if (command === "convert") {
    const manifestPath = getManifestPath(cwd);

    if (!fileExists(manifestPath)) {
      io.stderr(`Manifest not found: ${manifestPath}\n`);
      return 1;
    }

    try {
      const manifest = parseManifest(readFile(manifestPath));
      const result = createConvertResult(cwd, manifest, {
        fileExists,
        readFile,
      });
      const movedFiles = result.movedFiles.map((file) => {
        const changed =
          !fileExists(file.destinationPath) || readFile(file.destinationPath) !== file.contents;

        if (changed) {
          ensureParentDir(file.destinationPath);
          writeFile(file.destinationPath, file.contents);
        }

        if (file.removeSourcePath && file.sourcePath !== file.destinationPath && fileExists(file.sourcePath)) {
          rmSync(file.sourcePath, { force: true });
        }

        return {
          sourcePath: file.sourcePath,
          destinationPath: file.destinationPath,
          changed,
        };
      });
      const generatedFiles = result.generatedFiles.map((file) => {
        const changed = !fileExists(file.path) || readFile(file.path) !== file.contents;

        if (changed) {
          ensureParentDir(file.path);
          writeFile(file.path, file.contents);
        }

        return {
          path: file.path,
          kind: file.kind,
          changed,
        };
      });
      const status =
        movedFiles.some((file) => file.changed) || generatedFiles.some((file) => file.changed)
          ? "converted"
          : "unchanged";

      if (wantsJsonOutput(commandArgs)) {
        io.stdout(
          `${JSON.stringify(
            {
              command: "convert",
              status,
              movedFiles,
              generatedFiles,
            },
            null,
            2,
          )}\n`,
        );
        return 0;
      }

      io.stdout(`Convert status: ${status}\n`);

      for (const file of movedFiles) {
        if (file.changed) {
          io.stdout(`Moved root source: ${file.sourcePath} -> ${file.destinationPath}\n`);
        }
      }

      for (const file of generatedFiles) {
        if (file.changed) {
          io.stdout(`Generated file: ${file.path}\n`);
        }
      }

      return 0;
    } catch (error) {
      io.stderr(
        `${error instanceof Error ? error.message : "Unable to convert repo structure."}\n`,
      );
      return 1;
    }
  }

  if (command === "sync") {
    const manifestPath = getManifestPath(cwd);

    if (!fileExists(manifestPath)) {
      io.stderr(`Manifest not found: ${manifestPath}\n`);
      return 1;
    }

    try {
      const manifest = parseManifest(readFile(manifestPath));
      const selectedPlatform = getSelectedPlatform(commandArgs);
      const result = createSyncResult(
        cwd,
        manifest,
        selectedPlatform
          ? {
              tenant: manifest.defaults.tenant,
              environment: manifest.defaults.environment,
              platform: selectedPlatform,
            }
          : {
              tenant: manifest.defaults.tenant,
              environment: manifest.defaults.environment,
            },
        {
          env,
        },
      );
      const generatedFiles = result.generatedFiles.map((file) => {
        const changed = !fileExists(file.path) || readFile(file.path) !== file.contents;

        if (changed) {
          writeFile(file.path, file.contents);
        }

        return {
          path: file.path,
          kind: file.kind,
          changed,
        };
      });
      const status = generatedFiles.some((file) => file.changed)
        ? "updated"
        : "unchanged";

      if (wantsJsonOutput(commandArgs)) {
        io.stdout(
          `${JSON.stringify(
            {
              command: "sync",
              status,
              target: result.target,
              resolution: result.resolution,
              runtime: result.runtime,
              generatedFiles,
            },
            null,
            2,
          )}\n`,
        );
        return 0;
      }

      if (status === "unchanged") {
        io.stdout(
          `Sync is up to date for ${result.target.tenant}/${result.target.environment}.\n`,
        );
        io.stdout(`Applied layers: ${result.resolution.appliedLayers.join(" -> ")}\n`);
        return 0;
      }

      io.stdout(`Synced target: ${result.target.tenant}/${result.target.environment}\n`);
      io.stdout(`Applied layers: ${result.resolution.appliedLayers.join(" -> ")}\n`);

      for (const file of generatedFiles) {
        if (file.changed) {
          io.stdout(`Updated file: ${file.path}\n`);
        }
      }

      return 0;
    } catch (error) {
      io.stderr(
        `${error instanceof Error ? error.message : "Unable to sync generated artifacts."}\n`,
      );
      return 1;
    }
  }

  if (command === "run") {
    const { optionArgs, passthroughArgs } = splitCommandArgs(commandArgs);
    const manifestPath = getManifestPath(cwd);

    if (!fileExists(manifestPath)) {
      io.stderr(`Manifest not found: ${manifestPath}\n`);
      return 1;
    }

    if (passthroughArgs.length === 0) {
      io.stderr("run requires a subprocess command after --.\n");
      return 1;
    }

    try {
      const manifest = parseManifest(readFile(manifestPath));
      const selectedPlatform = getSelectedPlatform(optionArgs);
      const target = selectedPlatform
        ? {
            tenant: manifest.defaults.tenant,
            environment: manifest.defaults.environment,
            platform: selectedPlatform,
          }
        : {
            tenant: manifest.defaults.tenant,
            environment: manifest.defaults.environment,
          };
      const resolvedEnv = createSubprocessEnv(cwd, manifest, target, {
        baseEnv: env,
        fileExists,
        readFile,
      });
      const [subprocessCommand, ...subprocessArgs] = passthroughArgs;

      if (!subprocessCommand) {
        io.stderr("run requires a subprocess command after --.\n");
        return 1;
      }

      const subprocessResult = runSubprocess(subprocessCommand, subprocessArgs, {
        cwd,
        env: resolvedEnv.env,
      });

      if (subprocessResult.error) {
        throw subprocessResult.error;
      }

      const exitCode = typeof subprocessResult.status === "number"
        ? subprocessResult.status
        : 1;

      if (wantsJsonOutput(optionArgs)) {
        io.stdout(
          `${JSON.stringify(
            {
              command: "run",
              status: exitCode === 0 ? "ok" : "failed",
              target,
              loadedEnvFiles: resolvedEnv.loadedFiles,
              subprocess: {
                command: subprocessCommand,
                args: subprocessArgs,
                exitCode,
                signal: subprocessResult.signal ?? null,
              },
            },
            null,
            2,
          )}\n`,
        );
      }

      return exitCode;
    } catch (error) {
      io.stderr(
        `${error instanceof Error ? error.message : "Unable to run subprocess."}\n`,
      );
      return 1;
    }
  }

  if (command === "target" && commandArgs[0] === "set") {
    const tenant = getRequiredOption(commandArgs, "--tenant");
    const environment = getRequiredOption(commandArgs, "--environment");

    if (!tenant || !environment) {
      io.stderr("target set requires --tenant <id> and --environment <id>.\n");
      return 1;
    }

    const manifestPath = getManifestPath(cwd);

    if (!fileExists(manifestPath)) {
      io.stderr(`Manifest not found: ${manifestPath}\n`);
      return 1;
    }

    const manifest = parseManifest(readFile(manifestPath));

    try {
      const result = createTargetSetResult(cwd, manifest, {
        tenant,
        environment,
      });

      writeFile(result.manifestPath, `${JSON.stringify(result.manifest, null, 2)}\n`);

      if (wantsJsonOutput(commandArgs)) {
        io.stdout(
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

      io.stdout(`Updated manifest: ${result.manifestPath}\n`);
      io.stdout(`Default tenant: ${result.manifest.defaults.tenant}\n`);
      io.stdout(`Default environment: ${result.manifest.defaults.environment}\n`);
      return 0;
    } catch (error) {
      io.stderr(
        `${error instanceof Error ? error.message : "Unable to update target defaults."}\n`,
      );
      return 1;
    }
  }

  io.stderr(
    "The command surface is not implemented yet. See docs/issues/0001-rn-mt-prd.md and docs/architecture.md for the approved product definition.\n",
  );
  return 1;
}

function isDirectExecution() {
  return process.argv[1]
    ? import.meta.url === pathToFileURL(process.argv[1]).href
    : false;
}

if (isDirectExecution()) {
  process.exit(runCli(process.argv.slice(2)));
}
