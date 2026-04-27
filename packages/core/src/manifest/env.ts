/**
 * Validates manifest environment schema input and related resolution rules.
 */
import type { RnMtEnvSource, RnMtManifest, RnMtResolvedTarget } from "./types";

import { isPlainObject } from "./merge";

/**
 * Verifies that the optional envSchema section uses the supported manifest
 * shape before any target resolution happens.
 */
export function validateEnvSchemaShape(envSchema: unknown) {
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

/**
 * Returns true when an env input should count as present for required-key
 * validation.
 */
export function hasEnvInputValue(value: string | undefined) {
  return typeof value === "string" && value.trim().length > 0;
}

/**
 * Validates that all required env inputs are present for the selected target
 * before sync or run consumes them.
 */
export function validateEnvInputs(
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
    .filter(
      (entry) => entry.required && !hasEnvInputValue(envSource[entry.source]),
    );

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
