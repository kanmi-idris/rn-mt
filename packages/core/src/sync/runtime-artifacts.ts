import { join, relative } from "node:path";

import type { RnMtResolvedRuntimeArtifact } from "../manifest/types";
import { RnMtWorkspace } from "../workspace";

import type {
  RnMtOwnershipMetadataFile,
  RnMtSyncGeneratedFile,
} from "./types";

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

export function createOwnershipMetadataFile(
  workspace: RnMtWorkspace,
  trackedFiles: RnMtSyncGeneratedFile[],
  options: {
    fileName?: string;
  } = {},
): RnMtSyncGeneratedFile {
  const metadata: RnMtOwnershipMetadataFile = {
    schemaVersion: 1,
    tool: "rn-mt",
    owner: "cli",
    artifacts: trackedFiles
      .map((file) => ({
        path: relative(workspace.rootDir, file.path),
        kind: file.kind,
        hash: workspace.hashText(file.contents),
      }))
      .sort((left, right) => left.path.localeCompare(right.path)),
  };

  return {
    path: join(workspace.rootDir, options.fileName ?? "rn-mt.generated.ownership.json"),
    kind: "ownership-metadata",
    contents: `${JSON.stringify(metadata, null, 2)}\n`,
  };
}
