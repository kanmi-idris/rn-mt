import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import type { RnMtWorkspaceOptions } from "./types";

export class RnMtWorkspace {
  readonly rootDir: string;
  readonly packageVersion: string | undefined;

  constructor(options: RnMtWorkspaceOptions) {
    this.rootDir = options.rootDir;
    this.packageVersion = options.packageVersion;
  }

  resolveAnalyzeRootDir(options: { scopeToProvidedRoot?: boolean } = {}) {
    if (options.scopeToProvidedRoot) {
      return this.rootDir;
    }

    let currentDir = this.rootDir;
    let gitRoot: string | null = null;

    while (true) {
      if (existsSync(join(currentDir, ".git"))) {
        gitRoot = currentDir;
      }

      const parentDir = dirname(currentDir);

      if (parentDir === currentDir) {
        break;
      }

      currentDir = parentDir;
    }

    return gitRoot ?? this.rootDir;
  }

  hashText(contents: string) {
    return createHash("sha256").update(contents).digest("hex");
  }

  exists(path: string) {
    return existsSync(path);
  }

  isFile(path: string) {
    return existsSync(path) && statSync(path).isFile();
  }

  isDirectory(path: string) {
    return existsSync(path) && statSync(path).isDirectory();
  }

  readText(path: string) {
    return readFileSync(path, "utf8");
  }

  readJson<T>(path: string) {
    return JSON.parse(this.readText(path)) as T;
  }

  readJsonIfPresent<T>(path: string) {
    if (!this.exists(path)) {
      return null;
    }

    return this.readJson<T>(path);
  }

  listFiles(directoryPath: string): string[] {
    const entries = readdirSync(directoryPath, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const entryPath = join(directoryPath, entry.name);

      if (entry.isDirectory()) {
        files.push(...this.listFiles(entryPath));
        continue;
      }

      if (entry.isFile()) {
        files.push(entryPath);
      }
    }

    return files;
  }

  getManifestPath() {
    return join(this.rootDir, "rn-mt.config.json");
  }

  getSharedRootDir() {
    return join(this.rootDir, "src", "rn-mt", "shared");
  }

  getTenantRootDir(tenantId: string) {
    return join(this.rootDir, "src", "rn-mt", "tenants", tenantId);
  }

  getCurrentRootDir() {
    return join(this.rootDir, "src", "rn-mt", "current");
  }

  getExtensionsRootDir() {
    return join(this.rootDir, "src", "rn-mt", "extensions");
  }

  toRootRelative(path: string) {
    return relative(this.rootDir, path);
  }
}
