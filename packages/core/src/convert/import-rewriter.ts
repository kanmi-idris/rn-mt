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
  return path.replace(/\.(ts|tsx|js|jsx)$/u, "");
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
 * Returns true when a path points at a source file that should receive a
 * generated current facade.
 */
export function isFacadeSourceFile(path: string) {
  return /\.(ts|tsx|js|jsx)$/u.test(path);
}

/**
 * Returns true when a path belongs to test code that should stay out of shared
 * facade generation.
 */
export function isTestSourcePath(path: string) {
  return /(\.test\.|\.spec\.|\/__tests__\/|\/tests\/)/u.test(
    path.replace(/\\/gu, "/"),
  );
}

/**
 * Reads tsconfig path aliases so converted imports can preserve existing alias
 * conventions.
 */
export function getAliasRules(workspace: RnMtWorkspace): RnMtAliasRule[] {
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

      if (!firstTarget || !key.endsWith("/*") || !firstTarget.endsWith("/*")) {
        return [];
      }

      return [
        {
          specifierPrefix: key.slice(0, -1),
          targetBasePath: join(
            workspace.rootDir,
            baseUrl,
            firstTarget.slice(0, -1),
          ),
        },
      ];
    })
    .sort(
      (left, right) =>
        right.specifierPrefix.length - left.specifierPrefix.length,
    );
}

/**
 * Enumerates the on-disk path candidates that a relative or aliased import may
 * resolve to.
 */
function getRelativeImportResolutionCandidates(basePath: string) {
  const directCandidates = [basePath];
  const extensionCandidates = [
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
        const aliasRule = aliasRules.find((rule) =>
          specifier.startsWith(rule.specifierPrefix),
        );

        if (!aliasRule) {
          return null;
        }

        return join(
          aliasRule.targetBasePath,
          specifier.slice(aliasRule.specifierPrefix.length),
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
        aliasRule:
          aliasRules.find((rule) =>
            specifier.startsWith(rule.specifierPrefix),
          ) ?? null,
      };
    }
  }

  return null;
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

    if (
      resolvedTarget.aliasRule &&
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

    if (
      resolvedTarget.aliasRule &&
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
    );
}
