import { createHash } from "node:crypto";
import { dirname, join, relative } from "node:path";

import type { RnMtResolvedRuntimeArtifact, RnMtResolvedTarget } from "../manifest/types";
import { RnMtWorkspace } from "../workspace";

import type {
  RnMtDerivedAssetFingerprintMetadata,
  RnMtDerivedAssetFingerprintRecord,
  RnMtSyncGeneratedFile,
} from "./types";

function getDerivedAssetFingerprintMetadata(workspace: RnMtWorkspace) {
  const metadataPath = join(workspace.rootDir, "rn-mt.generated.asset-fingerprints.json");

  if (!workspace.exists(metadataPath)) {
    return null;
  }

  return workspace.readJson<RnMtDerivedAssetFingerprintMetadata>(metadataPath);
}

function getSourceFingerprint(contents: string) {
  return createHash("sha256").update(contents).digest("hex");
}

function createDerivedIconContents(
  environment: string,
  sourceAssetPath: string,
  sourceFingerprint: string,
) {
  const isProduction = environment === "prod" || environment === "production";
  const label = environment.toUpperCase();

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">`,
    `  <!-- source: ${sourceAssetPath} -->`,
    `  <!-- fingerprint: ${sourceFingerprint} -->`,
    `  <image href="${sourceAssetPath}" width="256" height="256" preserveAspectRatio="xMidYMid slice"/>`,
    ...(isProduction
      ? []
      : [
          `  <rect x="24" y="168" width="208" height="48" rx="18" fill="#f59e0b"/>`,
          `  <text x="128" y="201" text-anchor="middle" font-family="system-ui, sans-serif" font-size="24" font-weight="700" fill="#111827">${label}</text>`,
        ]),
    `</svg>`,
    "",
  ].join("\n");
}

export function createAssetFingerprintMetadataFile(
  workspace: RnMtWorkspace,
  records: RnMtDerivedAssetFingerprintRecord[],
): RnMtSyncGeneratedFile {
  const metadata: RnMtDerivedAssetFingerprintMetadata = {
    schemaVersion: 1,
    tool: "rn-mt",
    derivedAssets: records
      .map((record) => ({
        ...record,
        outputPath: relative(workspace.rootDir, record.outputPath),
        sourcePath: relative(workspace.rootDir, record.sourcePath),
      }))
      .sort((left, right) => left.outputPath.localeCompare(right.outputPath)),
  };

  return {
    path: join(workspace.rootDir, "rn-mt.generated.asset-fingerprints.json"),
    kind: "asset-fingerprint-metadata",
    contents: `${JSON.stringify(metadata, null, 2)}\n`,
  };
}

export function createDerivedPlatformAssetFiles(
  workspace: RnMtWorkspace,
  runtime: RnMtResolvedRuntimeArtifact,
  target: RnMtResolvedTarget,
) {
  const sourceAssetPath = runtime.assets.icon ? join(workspace.rootDir, runtime.assets.icon) : null;

  if (!target.platform || target.platform !== "ios" || !sourceAssetPath) {
    return {
      files: [] as RnMtSyncGeneratedFile[],
      fingerprintRecords: [] as RnMtDerivedAssetFingerprintRecord[],
    };
  }

  if (!workspace.exists(sourceAssetPath)) {
    return {
      files: [] as RnMtSyncGeneratedFile[],
      fingerprintRecords: [] as RnMtDerivedAssetFingerprintRecord[],
    };
  }

  const sourceContents = workspace.readText(sourceAssetPath);
  const sourceFingerprint = getSourceFingerprint(sourceContents);
  const outputPath = join(workspace.rootDir, "ios", `rn-mt.generated.icon.${target.environment}.svg`);
  const previousMetadata = getDerivedAssetFingerprintMetadata(workspace);
  const previousRecord = previousMetadata?.derivedAssets.find(
    (record) =>
      join(workspace.rootDir, record.outputPath) === outputPath
      && record.sourceFingerprint === sourceFingerprint
      && record.environment === target.environment
      && record.platform === target.platform
      && join(workspace.rootDir, record.sourcePath) === sourceAssetPath,
  );
  const contents = previousRecord && workspace.exists(outputPath)
    ? workspace.readText(outputPath)
    : createDerivedIconContents(
        target.environment,
        relative(dirname(outputPath), sourceAssetPath).replace(/\\/gu, "/"),
        sourceFingerprint,
      );
  const fingerprintRecord: RnMtDerivedAssetFingerprintRecord = {
    outputPath,
    platform: target.platform,
    environment: target.environment,
    sourcePath: sourceAssetPath,
    sourceFingerprint,
  };

  return {
    files: [
      {
        path: outputPath,
        kind: "derived-asset" as const,
        contents,
      },
    ],
    fingerprintRecords: [fingerprintRecord],
  };
}
