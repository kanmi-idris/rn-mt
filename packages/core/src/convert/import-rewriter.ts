/**
 * Rewrites imports so converted code points at the generated current surface.
 */
import { dirname, join, relative } from "node:path";

import { RnMtWorkspace } from "../workspace";

import type { RnMtAliasRule } from "./types";

/**
 * Removes a supported source extension from an import target before a generated
 * specifier is emitted.
 */
export function stripSupportedSourceExtension(path: string) {
  return path.replace(/\.(d\.)?(ts|tsx|js|jsx)$/u, "");
}

/**
 * Normalizes a generated relative import so it uses forward slashes and an
 * explicit relative prefix.
 */
export function normalizeImportPath(path: string) {
  const normalized = path.replace(/\\/gu, "/");
  return normalized.startsWith(".") ? normalized : `./${normalized}`;
}

/**
 * Detects whether a source file exposes a default-style export that a facade
 * can forward directly.
 */
export function hasDefaultExportSyntax(sourceContents: string) {
  return (
    /export\s+default\b/u.test(sourceContents) ||
    /module\.exports\s*=/u.test(sourceContents) ||
    /export\s*=\s*/u.test(sourceContents)
  );
}

/**
 * Detects whether a source file exposes any module-style export syntax that a
 * generated facade can forward.
 */
export function hasExportSyntax(sourceContents: string) {
  return (
    /^\s*export\s+/mu.test(sourceContents) ||
    /module\.exports\s*=/u.test(sourceContents) ||
    /\bexports\.[A-Za-z0-9_$]+\s*=/u.test(sourceContents)
  );
}

/**
 * Returns true when a path points at a source file that should receive a
 * generated current facade.
 */
export function isFacadeSourceFile(path: string) {
  return /\.(ts|tsx|js|jsx)$/u.test(path);
}

/**
 * Returns true when an app-relative path belongs to test code that should stay
 * out of shared facade generation.
 */
export function isTestSourcePath(path: string) {
  const normalizedPath = path.replace(/\\/gu, "/");
  const pathSegments = normalizedPath.split("/").filter(Boolean);
  const fileName = pathSegments[pathSegments.length - 1] ?? "";

  return (
    /\.(test|spec)\.[^.]+$/u.test(fileName) ||
    pathSegments.includes("__tests__") ||
    pathSegments.includes("tests")
  );
}

/**
 * Creates an exact-match alias rule for a single import specifier.
 */
function createExactAliasRule(
  specifierPrefix: string,
  targetBasePath: string,
  options: {
    preserveOriginalSpecifier?: boolean;
  } = {},
): RnMtAliasRule {
  return {
    specifierPrefix,
    targetBasePath,
    exactMatch: true,
    preserveSpecifierStyle: true,
    preserveOriginalSpecifier: options.preserveOriginalSpecifier ?? false,
  };
}

/**
 * Creates a prefix alias rule whose specifier can continue with nested
 * subpaths.
 */
function createPrefixAliasRule(
  specifierPrefix: string,
  targetBasePath: string,
  options: {
    preserveSpecifierStyle?: boolean;
    preserveOriginalSpecifier?: boolean;
  } = {},
): RnMtAliasRule {
  return {
    specifierPrefix,
    targetBasePath,
    preserveSpecifierStyle: options.preserveSpecifierStyle ?? true,
    preserveOriginalSpecifier: options.preserveOriginalSpecifier ?? false,
  };
}

/**
 * Reads tsconfig path aliases so converted imports can preserve existing alias
 * conventions.
 */
function getTsconfigAliasRules(workspace: RnMtWorkspace): RnMtAliasRule[] {
  const tsconfigPath = join(workspace.rootDir, "tsconfig.json");

  if (!workspace.exists(tsconfigPath)) {
    return [];
  }

  const tsconfig = workspace.readJson<{
    compilerOptions?: {
      baseUrl?: string;
      paths?: Record<string, string[]>;
    };
  }>(tsconfigPath);
  const baseUrl = tsconfig.compilerOptions?.baseUrl ?? ".";
  const paths = tsconfig.compilerOptions?.paths ?? {};

  return Object.entries(paths)
    .flatMap(([key, targets]) => {
      const firstTarget = targets[0];

      if (!firstTarget) {
        return [];
      }

      if (key.endsWith("/*") && firstTarget.endsWith("/*")) {
        return [
          createPrefixAliasRule(
            key.slice(0, -1),
            join(workspace.rootDir, baseUrl, firstTarget.slice(0, -1)),
            {
              preserveOriginalSpecifier: true,
            },
          ),
        ];
      }

      if (key.includes("*") || firstTarget.includes("*")) {
        return [];
      }

      return [
        createExactAliasRule(
          key,
          join(workspace.rootDir, baseUrl, firstTarget),
          {
            preserveOriginalSpecifier: true,
          },
        ),
      ];
    })
    .sort(compareAliasRules);
}

/**
 * Reads `babel-plugin-module-resolver` aliases from a common Babel config so
 * conversion can preserve existing import behavior when tsconfig paths are
 * absent or incomplete.
 */
function getBabelAliasRules(workspace: RnMtWorkspace): RnMtAliasRule[] {
  const babelConfigPath = [
    "babel.config.js",
    "babel.config.cjs",
    "babel.config.mjs",
  ]
    .map((path) => join(workspace.rootDir, path))
    .find((path) => workspace.isFile(path));

  if (!babelConfigPath) {
    return [];
  }

  const aliasMap = readBabelAliasMap(workspace.readText(babelConfigPath));

  return Object.entries(aliasMap)
    .flatMap(([key, target]) => {
      const resolvedTargetPath = join(workspace.rootDir, target);

      if (workspace.isDirectory(resolvedTargetPath)) {
        return [
          createExactAliasRule(key, resolvedTargetPath),
          createPrefixAliasRule(`${key}/`, resolvedTargetPath),
        ];
      }

      return [createExactAliasRule(key, resolvedTargetPath)];
    })
    .sort(compareAliasRules);
}

/**
 * Adds a root-`src/...` absolute import fallback for repos that rely on a
 * source-root import convention instead of a formal alias declaration.
 */
function getRootSourceAliasRules(workspace: RnMtWorkspace): RnMtAliasRule[] {
  const sourceRootDir = join(workspace.rootDir, "src");

  return workspace.isDirectory(sourceRootDir)
    ? [
        createPrefixAliasRule("src/", sourceRootDir, {
          preserveSpecifierStyle: false,
        }),
      ]
    : [];
}

/**
 * Extracts the alias object body from a Babel config file using balanced brace
 * scanning so nested plugin arrays do not confuse the parser.
 */
function getBabelAliasObjectBody(contents: string) {
  const aliasIndex = contents.indexOf("alias");

  if (aliasIndex < 0) {
    return null;
  }

  const objectStartIndex = contents.indexOf("{", aliasIndex);

  if (objectStartIndex < 0) {
    return null;
  }

  let depth = 0;

  for (let index = objectStartIndex; index < contents.length; index += 1) {
    const character = contents[index];

    if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;

      if (depth === 0) {
        return contents.slice(objectStartIndex + 1, index);
      }
    }
  }

  return null;
}

/**
 * Parses simple string-to-string alias entries from a Babel
 * `module-resolver` config block.
 */
function readBabelAliasMap(contents: string) {
  const aliasObjectBody = getBabelAliasObjectBody(contents);

  if (!aliasObjectBody) {
    return {};
  }

  const aliasMap: Record<string, string> = {};
  const aliasEntryPattern =
    /(?:["']([^"']+)["']|([A-Za-z_$][A-Za-z0-9_$-]*))\s*:\s*["']([^"']+)["']/gu;

  for (const match of aliasObjectBody.matchAll(aliasEntryPattern)) {
    const key = match[1] ?? match[2];
    const value = match[3];

    if (!key || !value) {
      continue;
    }

    aliasMap[key] = value;
  }

  return aliasMap;
}

/**
 * Orders alias rules from most-specific to least-specific while preferring
 * exact-match rules when two candidates share the same prefix length.
 */
function compareAliasRules(left: RnMtAliasRule, right: RnMtAliasRule) {
  return (
    Number(right.exactMatch ?? false) - Number(left.exactMatch ?? false) ||
    right.specifierPrefix.length - left.specifierPrefix.length
  );
}

/**
 * Reads alias rules from tsconfig, Babel module-resolver, and common root-src
 * import conventions so converted imports can preserve existing resolution
 * behavior.
 */
export function getAliasRules(workspace: RnMtWorkspace): RnMtAliasRule[] {
  return [
    ...getTsconfigAliasRules(workspace),
    ...getBabelAliasRules(workspace),
    ...getRootSourceAliasRules(workspace),
  ].sort(compareAliasRules);
}

/**
 * Returns the matching alias rule for a specifier, preferring exact matches
 * before broader prefix rules.
 */
function getMatchingAliasRule(
  specifier: string,
  aliasRules: RnMtAliasRule[],
) {
  return (
    aliasRules.find((rule) =>
      rule.exactMatch
        ? specifier === rule.specifierPrefix
        : specifier.startsWith(rule.specifierPrefix),
    ) ?? null
  );
}

/**
 * Enumerates the on-disk path candidates that a relative or aliased import may
 * resolve to.
 */
function getRelativeImportResolutionCandidates(basePath: string) {
  const directCandidates = [basePath];
  const extensionCandidates = [
    ".d.ts",
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".json",
    ".png",
    ".jpg",
    ".jpeg",
    ".svg",
  ];
  const indexCandidates = extensionCandidates.map((extension) =>
    join(basePath, `index${extension}`),
  );

  return [
    ...directCandidates,
    ...extensionCandidates.map((extension) => `${basePath}${extension}`),
    ...indexCandidates,
  ];
}

/**
 * Resolves an import specifier to an on-disk source file using relative paths
 * and configured alias rules.
 */
function resolveImportTarget(
  workspace: RnMtWorkspace,
  sourcePath: string,
  specifier: string,
  aliasRules: RnMtAliasRule[],
) {
  const resolvedBasePath = specifier.startsWith(".")
    ? join(dirname(sourcePath), specifier)
    : (() => {
        const aliasRule = getMatchingAliasRule(specifier, aliasRules);

        if (!aliasRule) {
          return null;
        }

        return join(
          aliasRule.targetBasePath,
          aliasRule.exactMatch
            ? ""
            : specifier.slice(aliasRule.specifierPrefix.length),
        );
      })();

  if (!resolvedBasePath) {
    return null;
  }

  for (const candidate of getRelativeImportResolutionCandidates(
    resolvedBasePath,
  )) {
    if (workspace.isFile(candidate)) {
      return {
        resolvedPath: candidate,
        aliasRule: getMatchingAliasRule(specifier, aliasRules),
      };
    }
  }

  return null;
}

/**
 * Returns true when an alias target points only at files that participate in a
 * source-to-generated mapping, which makes it safe to preserve the original
 * alias specifier style instead of rewriting the import itself.
 */
function isFullyMappedAliasTargetPath(
  workspace: RnMtWorkspace,
  targetBasePath: string,
  mappedPaths: Set<string>,
) {
  if (workspace.isFile(targetBasePath)) {
    return mappedPaths.has(targetBasePath);
  }

  if (!workspace.isDirectory(targetBasePath)) {
    return false;
  }

  const filePaths = workspace.listFiles(targetBasePath);

  return filePaths.length > 0 && filePaths.every((path) => mappedPaths.has(path));
}

/**
 * Memoizes whether a given alias rule can safely keep its original specifier
 * during import rewriting.
 */
function createAliasPreservationDecider(
  workspace: RnMtWorkspace,
  mappedPaths: Set<string>,
) {
  const cache = new Map<string, boolean>();

  return (aliasRule: RnMtAliasRule | null | undefined) => {
    if (!aliasRule?.preserveOriginalSpecifier) {
      return false;
    }

    const cacheKey = `${aliasRule.specifierPrefix}::${aliasRule.targetBasePath}`;
    const cachedResult = cache.get(cacheKey);

    if (cachedResult !== undefined) {
      return cachedResult;
    }

    const result = isFullyMappedAliasTargetPath(
      workspace,
      aliasRule.targetBasePath,
      mappedPaths,
    );

    cache.set(cacheKey, result);

    return result;
  };
}

/**
 * Rewrites relative imports when a source file is copied to a new location so
 * each specifier keeps pointing at the same resolved target from the new path.
 */
export function rebaseRelativeImportSpecifiers(
  workspace: RnMtWorkspace,
  sourcePath: string,
  destinationPath: string,
  contents: string,
) {
  const replaceSpecifier = (specifier: string) => {
    if (!specifier.startsWith(".")) {
      return specifier;
    }

    const resolvedTarget = resolveImportTarget(
      workspace,
      sourcePath,
      specifier,
      [],
    );

    if (!resolvedTarget) {
      return specifier;
    }

    const rewrittenSpecifier = normalizeImportPath(
      stripSupportedSourceExtension(
        relative(dirname(destinationPath), resolvedTarget.resolvedPath),
      ),
    );

    return /\.(png|jpg|jpeg|svg|json)$/u.test(resolvedTarget.resolvedPath)
      ? normalizeImportPath(
          relative(dirname(destinationPath), resolvedTarget.resolvedPath),
        )
      : rewrittenSpecifier;
  };

  return contents
    .replace(
      /(from\s+["'])([^"']+)(["'])/gu,
      (_, prefix, specifier, suffix) => {
        return `${prefix}${replaceSpecifier(specifier)}${suffix}`;
      },
    )
    .replace(
      /(import\s+["'])([^"']+)(["'])/gu,
      (_, prefix, specifier, suffix) => {
        return `${prefix}${replaceSpecifier(specifier)}${suffix}`;
      },
    )
    .replace(
      /(require\(\s*["'])([^"']+)(["']\s*\))/gu,
      (_, prefix, specifier, suffix) => {
        return `${prefix}${replaceSpecifier(specifier)}${suffix}`;
      },
    )
    .replace(
      /(import\(\s*["'])([^"']+)(["']\s*\))/gu,
      (_, prefix, specifier, suffix) => {
        return `${prefix}${replaceSpecifier(specifier)}${suffix}`;
      },
    );
}

/**
 * Rewrites imports inside moved shared files so they point at the generated
 * current surface instead of the pre-conversion layout.
 */
export function rewriteMovedSourceContents(
  workspace: RnMtWorkspace,
  sourcePath: string,
  destinationPath: string,
  contents: string,
  currentPathBySourcePath: Map<string, string>,
  aliasRules: RnMtAliasRule[],
) {
  const shouldPreserveAliasSpecifier = createAliasPreservationDecider(
    workspace,
    new Set(currentPathBySourcePath.keys()),
  );

  const replaceSpecifier = (specifier: string) => {
    if (
      !specifier.startsWith(".") &&
      !aliasRules.some((rule) => specifier.startsWith(rule.specifierPrefix))
    ) {
      return specifier;
    }

    const resolvedTarget = resolveImportTarget(
      workspace,
      sourcePath,
      specifier,
      aliasRules,
    );

    if (!resolvedTarget) {
      return specifier;
    }

    const currentTargetPath = currentPathBySourcePath.get(
      resolvedTarget.resolvedPath,
    );

    if (!currentTargetPath) {
      return specifier;
    }

    if (shouldPreserveAliasSpecifier(resolvedTarget.aliasRule)) {
      return specifier;
    }

    if (
      resolvedTarget.aliasRule &&
      resolvedTarget.aliasRule.preserveSpecifierStyle !== false &&
      currentTargetPath.startsWith(resolvedTarget.aliasRule.targetBasePath)
    ) {
      const aliasRelativePath = currentTargetPath.slice(
        resolvedTarget.aliasRule.targetBasePath.length,
      );

      return /\.(png|jpg|jpeg|svg|json)$/u.test(resolvedTarget.resolvedPath)
        ? `${resolvedTarget.aliasRule.specifierPrefix}${aliasRelativePath.replace(/^[/\\]/u, "")}`
        : `${resolvedTarget.aliasRule.specifierPrefix}${stripSupportedSourceExtension(aliasRelativePath).replace(/^[/\\]/u, "")}`;
    }

    const rewrittenSpecifier = normalizeImportPath(
      stripSupportedSourceExtension(
        relative(dirname(destinationPath), currentTargetPath),
      ),
    );

    return /\.(png|jpg|jpeg|svg|json)$/u.test(resolvedTarget.resolvedPath)
      ? normalizeImportPath(
          relative(dirname(destinationPath), currentTargetPath),
        )
      : rewrittenSpecifier;
  };

  return contents
    .replace(
      /(from\s+["'])([^"']+)(["'])/gu,
      (_, prefix, specifier, suffix) => {
        return `${prefix}${replaceSpecifier(specifier)}${suffix}`;
      },
    )
    .replace(
      /(import\s+["'])([^"']+)(["'])/gu,
      (_, prefix, specifier, suffix) => {
        return `${prefix}${replaceSpecifier(specifier)}${suffix}`;
      },
    )
    .replace(
      /(require\(\s*["'])([^"']+)(["']\s*\))/gu,
      (_, prefix, specifier, suffix) => {
        return `${prefix}${replaceSpecifier(specifier)}${suffix}`;
      },
    )
    .replace(
      /(import\(\s*["'])([^"']+)(["']\s*\))/gu,
      (_, prefix, specifier, suffix) => {
        return `${prefix}${replaceSpecifier(specifier)}${suffix}`;
      },
    );
}

/**
 * Rewrites imports during handoff flattening so files point back to their
 * restored single-tenant locations.
 */
export function rewriteHandoffSourceContents(
  workspace: RnMtWorkspace,
  sourcePath: string,
  destinationPath: string,
  contents: string,
  originalPathByCurrentPath: Map<string, string>,
  aliasRules: RnMtAliasRule[],
) {
  const shouldPreserveAliasSpecifier = createAliasPreservationDecider(
    workspace,
    new Set(originalPathByCurrentPath.keys()),
  );

  const collapseIndexSpecifier = (specifier: string) => {
    return specifier.endsWith("/index")
      ? specifier.slice(0, -"/index".length) || "."
      : specifier;
  };

  const replaceSpecifier = (specifier: string) => {
    if (
      !specifier.startsWith(".") &&
      !aliasRules.some((rule) => specifier.startsWith(rule.specifierPrefix))
    ) {
      return specifier;
    }

    const resolvedTarget = resolveImportTarget(
      workspace,
      sourcePath,
      specifier,
      aliasRules,
    );

    if (!resolvedTarget) {
      return specifier;
    }

    const originalTargetPath = originalPathByCurrentPath.get(
      resolvedTarget.resolvedPath,
    );

    if (!originalTargetPath) {
      return specifier;
    }

    if (shouldPreserveAliasSpecifier(resolvedTarget.aliasRule)) {
      return specifier;
    }

    if (
      resolvedTarget.aliasRule &&
      resolvedTarget.aliasRule.preserveSpecifierStyle !== false &&
      originalTargetPath.startsWith(resolvedTarget.aliasRule.targetBasePath)
    ) {
      const aliasRelativePath = originalTargetPath.slice(
        resolvedTarget.aliasRule.targetBasePath.length,
      );

      return /\.(png|jpg|jpeg|svg|json)$/u.test(originalTargetPath)
        ? `${resolvedTarget.aliasRule.specifierPrefix}${aliasRelativePath.replace(/^[/\\]/u, "")}`
        : `${resolvedTarget.aliasRule.specifierPrefix}${collapseIndexSpecifier(
            stripSupportedSourceExtension(aliasRelativePath).replace(
              /^[/\\]/u,
              "",
            ),
          )}`;
    }

    const rewrittenSpecifier = collapseIndexSpecifier(
      normalizeImportPath(
        stripSupportedSourceExtension(
          relative(dirname(destinationPath), originalTargetPath),
        ),
      ),
    );

    return /\.(png|jpg|jpeg|svg|json)$/u.test(originalTargetPath)
      ? normalizeImportPath(
          relative(dirname(destinationPath), originalTargetPath),
        )
      : rewrittenSpecifier;
  };

  return contents
    .replace(
      /(from\s+["'])([^"']+)(["'])/gu,
      (_, prefix, specifier, suffix) => {
        return `${prefix}${replaceSpecifier(specifier)}${suffix}`;
      },
    )
    .replace(
      /(import\s+["'])([^"']+)(["'])/gu,
      (_, prefix, specifier, suffix) => {
        return `${prefix}${replaceSpecifier(specifier)}${suffix}`;
      },
    )
    .replace(
      /(require\(\s*["'])([^"']+)(["']\s*\))/gu,
      (_, prefix, specifier, suffix) => {
        return `${prefix}${replaceSpecifier(specifier)}${suffix}`;
      },
    )
    .replace(
      /(import\(\s*["'])([^"']+)(["']\s*\))/gu,
      (_, prefix, specifier, suffix) => {
        return `${prefix}${replaceSpecifier(specifier)}${suffix}`;
      },
    );
}
