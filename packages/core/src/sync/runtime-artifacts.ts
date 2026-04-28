/**
 * Builds generated runtime artifacts during sync.
 */
import { join, relative } from "node:path";

import type { RnMtResolvedRuntimeArtifact } from "../manifest/types";
import { RnMtWorkspace } from "../workspace";

import type { RnMtOwnershipMetadataFile, RnMtSyncGeneratedFile } from "./types";

/**
 * Creates runtime artifact file.
 */
export function createRuntimeArtifactFile(
  workspace: RnMtWorkspace,
  runtime: RnMtResolvedRuntimeArtifact,
): RnMtSyncGeneratedFile {
  return {
    path: join(workspace.rootDir, "rn-mt.generated.runtime.json"),
    kind: "runtime-artifact",
    contents: `${JSON.stringify(runtime, null, 2)}\n`,
  };
}

/**
 * Creates ownership metadata file.
 */
export function createOwnershipMetadataFile(
  workspace: RnMtWorkspace,
  trackedFiles: RnMtSyncGeneratedFile[],
  options: {
    fileName?: string;
  } = {},
): RnMtSyncGeneratedFile {
  const ownershipMetadataPath = join(
    workspace.rootDir,
    options.fileName ?? "rn-mt.generated.ownership.json",
  );
  const existingMetadata =
    workspace.readJsonIfPresent<RnMtOwnershipMetadataFile>(ownershipMetadataPath);
  const nextArtifactsByPath = new Map(
    existingMetadata?.artifacts
      .filter((artifact) =>
        workspace.exists(join(workspace.rootDir, artifact.path)),
      )
      .map((artifact) => [artifact.path, artifact]) ?? [],
  );

  for (const file of trackedFiles) {
    nextArtifactsByPath.set(relative(workspace.rootDir, file.path), {
      path: relative(workspace.rootDir, file.path),
      kind: file.kind,
      hash: workspace.hashText(file.contents),
    });
  }

  const metadata: RnMtOwnershipMetadataFile = {
    schemaVersion: 1,
    tool: "rn-mt",
    owner: "cli",
    artifacts: [...nextArtifactsByPath.values()]
      .sort((left, right) => left.path.localeCompare(right.path)),
  };

  return {
    path: ownershipMetadataPath,
    kind: "ownership-metadata",
    contents: `${JSON.stringify(metadata, null, 2)}\n`,
  };
}
