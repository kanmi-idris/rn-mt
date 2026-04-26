import { join } from "node:path";

import type { RnMtManifest, RnMtResolvedTarget } from "../manifest/types";
import { validateEnvInputs, validateTargetSelection } from "../manifest";
import { RnMtWorkspace } from "../workspace";

import type { RnMtEnvSource } from "../manifest/types";
import type { RnMtLoadedEnvFile, RnMtSubprocessEnvResult } from "./types";

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

export function parseDotEnvContents(contents: string): RnMtEnvSource {
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
  workspace: RnMtWorkspace,
  manifest: RnMtManifest,
  target: RnMtResolvedTarget = manifest.defaults,
  options: {
    baseEnv?: RnMtEnvSource;
  } = {},
): RnMtSubprocessEnvResult {
  const targetValidationError = validateTargetSelection(manifest, target);

  if (targetValidationError) {
    throw new Error(targetValidationError);
  }

  const mergedEnv: RnMtEnvSource = {
    ...(options.baseEnv ?? process.env),
  };
  const loadedFiles: RnMtLoadedEnvFile[] = [];
  const envFileDescriptors: RnMtLoadedEnvFile[] = [
    {
      path: join(workspace.rootDir, `.env.${target.environment}`),
      scope: "environment",
    },
    {
      path: join(workspace.rootDir, `.env.${target.tenant}.${target.environment}`),
      scope: "tenant-environment",
    },
  ];

  for (const descriptor of envFileDescriptors) {
    if (!workspace.exists(descriptor.path)) {
      continue;
    }

    Object.assign(mergedEnv, parseDotEnvContents(workspace.readText(descriptor.path)));
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
