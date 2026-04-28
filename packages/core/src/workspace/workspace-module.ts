/**
 * Provides the shared filesystem and path seam used by the core modules.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";

import type { RnMtWorkspaceOptions } from "./types";

/**
 * Wraps root-relative filesystem helpers so core modules share one consistent
 * view of repo layout and file IO.
 */
export class RnMtWorkspace {
  readonly rootDir: string;
  readonly packageVersion: string | undefined;

  /**
   * Initializes the workspace with its shared dependencies.
   */
  constructor(options: RnMtWorkspaceOptions) {
    this.rootDir = options.rootDir;
    this.packageVersion = options.packageVersion;
  }

  /**
   * Resolves the root directory analyze should inspect, optionally walking up
   * to the enclosing git root.
   */
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

  /**
   * Hashes text content for ownership metadata and incremental sync checks.
   */
  hashText(contents: string | Buffer) {
    return createHash("sha256").update(contents).digest("hex");
  }

  /**
   * Returns true when a path exists on disk.
   */
  exists(path: string) {
    return existsSync(path);
  }

  /**
   * Returns true when a path exists and is a file.
   */
  isFile(path: string) {
    return existsSync(path) && statSync(path).isFile();
  }

  /**
   * Returns true when a path exists and is a directory.
   */
  isDirectory(path: string) {
    return existsSync(path) && statSync(path).isDirectory();
  }

  /**
   * Reads a UTF-8 text file from disk.
   */
  readText(path: string) {
    return readFileSync(path, "utf8");
  }

  /**
   * Reads raw file contents from disk without applying a text encoding.
   */
  readBuffer(path: string) {
    return readFileSync(path);
  }

  /**
   * Reads and parses a JSON file from disk.
   */
  readJson<T>(path: string) {
    return this.parseJsonLike<T>(this.readText(path), path);
  }

  /**
   * Reads and parses a JSON file when it exists, otherwise returns null.
   */
  readJsonIfPresent<T>(path: string) {
    if (!this.exists(path)) {
      return null;
    }

    return this.readJson<T>(path);
  }

  /**
   * Recursively lists every file under the provided directory.
   */
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

  /**
   * Returns the canonical manifest path for the current app root.
   */
  getManifestPath() {
    return join(this.rootDir, "rn-mt.config.json");
  }

  /**
   * Returns the root directory for converted shared source files.
   */
  getSharedRootDir() {
    return join(this.rootDir, "src", "rn-mt", "shared");
  }

  /**
   * Returns the root directory for a specific tenant override tree.
   */
  getTenantRootDir(tenantId: string) {
    return join(this.rootDir, "src", "rn-mt", "tenants", tenantId);
  }

  /**
   * Returns the root directory for generated current facades.
   */
  getCurrentRootDir() {
    return join(this.rootDir, "src", "rn-mt", "current");
  }

  /**
   * Returns the root directory for user-owned extension code.
   */
  getExtensionsRootDir() {
    return join(this.rootDir, "src", "rn-mt", "extensions");
  }

  /**
   * Converts an absolute path under the workspace back to a root-relative one.
   */
  toRootRelative(path: string) {
    return relative(this.rootDir, path);
  }

  /**
   * Parses repository-owned JSON-like config files, including JSONC surfaces
   * such as tsconfig.json that commonly contain comments or trailing commas.
   */
  private parseJsonLike<T>(contents: string, path: string) {
    try {
      return JSON.parse(
        this.stripTrailingCommas(this.stripJsonComments(contents)),
      ) as T;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown JSON parse error";
      throw new Error(`${message}\nwhile parsing ${path}`);
    }
  }

  /**
   * Removes line and block comments from JSONC-style config files while
   * keeping string literals intact.
   */
  private stripJsonComments(contents: string) {
    let normalized = "";
    let inString = false;
    let escapeNextCharacter = false;
    let inLineComment = false;
    let inBlockComment = false;

    for (let index = 0; index < contents.length; index += 1) {
      const character = contents[index];
      const nextCharacter = contents[index + 1];

      if (inLineComment) {
        if (character === "\n") {
          inLineComment = false;
          normalized += "\n";
        } else {
          normalized += " ";
        }

        continue;
      }

      if (inBlockComment) {
        if (character === "*" && nextCharacter === "/") {
          inBlockComment = false;
          normalized += "  ";
          index += 1;
        } else {
          normalized += character === "\n" ? "\n" : " ";
        }

        continue;
      }

      if (inString) {
        normalized += character;

        if (escapeNextCharacter) {
          escapeNextCharacter = false;
          continue;
        }

        if (character === "\\") {
          escapeNextCharacter = true;
          continue;
        }

        if (character === '"') {
          inString = false;
        }

        continue;
      }

      if (character === '"') {
        inString = true;
        normalized += character;
        continue;
      }

      if (character === "/" && nextCharacter === "/") {
        inLineComment = true;
        normalized += "  ";
        index += 1;
        continue;
      }

      if (character === "/" && nextCharacter === "*") {
        inBlockComment = true;
        normalized += "  ";
        index += 1;
        continue;
      }

      normalized += character;
    }

    return normalized;
  }

  /**
   * Drops trailing commas before closing braces or brackets so JSONC config
   * can be parsed with the built-in JSON parser.
   */
  private stripTrailingCommas(contents: string) {
    let normalized = "";
    let inString = false;
    let escapeNextCharacter = false;

    for (let index = 0; index < contents.length; index += 1) {
      const character = contents[index];

      if (inString) {
        normalized += character;

        if (escapeNextCharacter) {
          escapeNextCharacter = false;
          continue;
        }

        if (character === "\\") {
          escapeNextCharacter = true;
          continue;
        }

        if (character === '"') {
          inString = false;
        }

        continue;
      }

      if (character === '"') {
        inString = true;
        normalized += character;
        continue;
      }

      if (character === ",") {
        let lookaheadIndex = index + 1;

        while (lookaheadIndex < contents.length) {
          const lookaheadCharacter = contents[lookaheadIndex];

          if (!lookaheadCharacter || !/\s/u.test(lookaheadCharacter)) {
            break;
          }

          lookaheadIndex += 1;
        }

        const nextSignificantCharacter = contents[lookaheadIndex];

        if (
          nextSignificantCharacter === "}" ||
          nextSignificantCharacter === "]"
        ) {
          continue;
        }
      }

      normalized += character;
    }

    return normalized;
  }
}
