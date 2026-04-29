/**
 * Builds package.json mutations needed by converted repos.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type { RnMtRepoAppKind } from "../analyze/types";

interface RnMtPackageJsonLike {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  packageManager?: string;
}

/**
 * Reads the current monorepo package version so converted repos pin matching
 * local rn-mt packages.
 */
export function getRnMtPackageVersion() {
  const packageJsonPath = findPackageJsonPath(
    dirname(fileURLToPath(import.meta.url)),
    ["rn-mt", "@_molaidrislabs/rn-mt"],
  );
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    version?: string;
  };

  return packageJson.version ?? "0.1.0";
}

/**
 * Walks upward from the current module until it finds the owning package.json
 * for the expected package name.
 */
function findPackageJsonPath(
  startDir: string,
  expectedPackageNames: string[],
) {
  let currentDir = startDir;

  while (true) {
    const candidatePath = join(currentDir, "package.json");

    if (existsSync(candidatePath)) {
      const candidatePackageJson = JSON.parse(
        readFileSync(candidatePath, "utf8"),
      ) as { name?: string };

      if (
        candidatePackageJson.name &&
        expectedPackageNames.includes(candidatePackageJson.name)
      ) {
        return candidatePath;
      }
    }

    const parentDir = dirname(currentDir);

    if (parentDir === currentDir) {
      throw new Error(
        `Unable to locate package.json for ${expectedPackageNames.join(" or ")}.`,
      );
    }

    currentDir = parentDir;
  }
}

/**
 * Returns the rn-mt packages a converted repo should depend on for its app
 * kind.
 */
export function getLocalRnMtPackagePlan(appKind: RnMtRepoAppKind) {
  const version = getRnMtPackageVersion();
  const localPackages: Array<{
    name: string;
    version: string;
    section: "dependencies" | "devDependencies";
  }> = [
    {
      name: "@_molaidrislabs/rn-mt",
      version,
      section: "dependencies",
    },
  ];

  return localPackages;
}

/**
 * Returns the install command that matches the detected package manager.
 */
export function createInstallCommand(packageManager: {
  name: import("../analyze/types").RnMtPackageManagerName;
}) {
  if (packageManager.name === "pnpm") {
    return "pnpm install";
  }

  if (packageManager.name === "yarn") {
    return "yarn install";
  }

  if (packageManager.name === "bun") {
    return "bun install";
  }

  if (packageManager.name === "npm") {
    return "npm install";
  }

  return null;
}

/**
 * Returns the host workflow script defaults for each supported repo kind.
 */
function getDefaultWorkflowScripts(appKind: RnMtRepoAppKind) {
  if (appKind === "expo-managed") {
    return {
      start: "expo start",
      android: "expo start --android",
      ios: "expo start --ios",
    };
  }

  if (appKind === "expo-prebuild") {
    return {
      start: "expo start --dev-client",
      android: "expo run:android",
      ios: "expo run:ios",
    };
  }

  return {
    start: "react-native start",
    android: "react-native run-android",
    ios: "react-native run-ios",
  };
}

/**
 * Wraps a host workflow command so it executes through rn-mt run.
 */
function createRunHelperScript(
  command: string,
  options: { platform?: "ios" | "android" } = {},
) {
  return options.platform
    ? `rn-mt run --platform ${options.platform} -- ${command}`
    : `rn-mt run -- ${command}`;
}

/**
 * Appends a generated script step without discarding any existing package.json
 * behavior.
 */
function chainPackageScript(
  existingCommand: string | undefined,
  generatedCommand: string,
) {
  if (!existingCommand || existingCommand.trim().length === 0) {
    return generatedCommand;
  }

  return `${existingCommand} && ${generatedCommand}`;
}

/**
 * Rewrites package.json so converted repos use rn-mt scripts and pinned local
 * package dependencies.
 */
export function createConvertedPackageJsonContents(
  packageJsonContents: string,
  appKind: RnMtRepoAppKind,
) {
  const parsedPackageJson = JSON.parse(
    packageJsonContents,
  ) as RnMtPackageJsonLike;
  const existingScripts = parsedPackageJson.scripts ?? {};
  const existingDependencies = parsedPackageJson.dependencies ?? {};
  const existingDevDependencies = parsedPackageJson.devDependencies ?? {};
  const defaultScripts = getDefaultWorkflowScripts(appKind);
  const hostStartScript = existingScripts.start ?? defaultScripts.start;
  const hostAndroidScript = existingScripts.android ?? defaultScripts.android;
  const hostIosScript = existingScripts.ios ?? defaultScripts.ios;
  const localPackages = getLocalRnMtPackagePlan(appKind);
  const dependencies = { ...existingDependencies };
  const devDependencies = { ...existingDevDependencies };

  for (const localPackage of localPackages) {
    if (localPackage.section === "dependencies") {
      dependencies[localPackage.name] = localPackage.version;
    } else {
      devDependencies[localPackage.name] = localPackage.version;
    }
  }

  return `${JSON.stringify(
    {
      ...parsedPackageJson,
      dependencies,
      devDependencies,
      scripts: {
        ...existingScripts,
        start: createRunHelperScript(hostStartScript),
        android: createRunHelperScript(hostAndroidScript, {
          platform: "android",
        }),
        ios: createRunHelperScript(hostIosScript, { platform: "ios" }),
        prestart: chainPackageScript(
          existingScripts.prestart,
          "rn-mt hook prestart",
        ),
        preandroid: chainPackageScript(
          existingScripts.preandroid,
          "rn-mt hook preandroid",
        ),
        preios: chainPackageScript(existingScripts.preios, "rn-mt hook preios"),
        postinstall: chainPackageScript(
          existingScripts.postinstall,
          "rn-mt hook postinstall",
        ),
        "rn-mt:sync": "rn-mt sync",
        "rn-mt:sync:android": "rn-mt sync --platform android",
        "rn-mt:sync:ios": "rn-mt sync --platform ios",
        "rn-mt:start": createRunHelperScript(hostStartScript),
        "rn-mt:android": createRunHelperScript(hostAndroidScript, {
          platform: "android",
        }),
        "rn-mt:ios": createRunHelperScript(hostIosScript, { platform: "ios" }),
      },
    },
    null,
    2,
  )}\n`;
}

/**
 * Removes rn-mt run wrappers when a handoff export restores plain host
 * workflow scripts.
 */
function unwrapRunHelperScript(command: string | undefined) {
  if (!command) {
    return undefined;
  }

  const platformMatch = command.match(
    /^rn-mt run --platform (android|ios) -- (.+)$/u,
  );

  if (platformMatch) {
    return platformMatch[2];
  }

  const directMatch = command.match(/^rn-mt run -- (.+)$/u);

  return directMatch?.[1] ?? command;
}

/**
 * Removes generated hook script.
 */
function removeGeneratedHookScript(
  command: string | undefined,
  generatedCommand: string,
) {
  if (!command || command.trim().length === 0) {
    return undefined;
  }

  const segments = command
    .split("&&")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && segment !== generatedCommand);

  return segments.length > 0 ? segments.join(" && ") : undefined;
}

/**
 * Creates standalone package json contents.
 */
export function createStandalonePackageJsonContents(
  packageJsonContents: string,
  appKind: RnMtRepoAppKind,
) {
  const parsedPackageJson = JSON.parse(
    packageJsonContents,
  ) as RnMtPackageJsonLike;
  const existingScripts = parsedPackageJson.scripts ?? {};
  const defaultScripts = getDefaultWorkflowScripts(appKind);
  const dependencies = { ...(parsedPackageJson.dependencies ?? {}) };
  const devDependencies = { ...(parsedPackageJson.devDependencies ?? {}) };

  for (const localPackage of getLocalRnMtPackagePlan(appKind)) {
    if (localPackage.section === "dependencies") {
      delete dependencies[localPackage.name];
    } else {
      delete devDependencies[localPackage.name];
    }
  }

  const scripts: Record<string, string> = { ...existingScripts };
  const restoredStartScript = unwrapRunHelperScript(
    existingScripts["rn-mt:start"] ??
      existingScripts.start ??
      defaultScripts.start,
  );
  const restoredAndroidScript = unwrapRunHelperScript(
    existingScripts["rn-mt:android"] ??
      existingScripts.android ??
      defaultScripts.android,
  );
  const restoredIosScript = unwrapRunHelperScript(
    existingScripts["rn-mt:ios"] ?? existingScripts.ios ?? defaultScripts.ios,
  );

  if (restoredStartScript) {
    scripts.start = restoredStartScript;
  }

  if (restoredAndroidScript) {
    scripts.android = restoredAndroidScript;
  }

  if (restoredIosScript) {
    scripts.ios = restoredIosScript;
  }

  const cleanedPrestart = removeGeneratedHookScript(
    existingScripts.prestart,
    "rn-mt hook prestart",
  );
  const cleanedPreandroid = removeGeneratedHookScript(
    existingScripts.preandroid,
    "rn-mt hook preandroid",
  );
  const cleanedPreios = removeGeneratedHookScript(
    existingScripts.preios,
    "rn-mt hook preios",
  );
  const cleanedPostinstall = removeGeneratedHookScript(
    existingScripts.postinstall,
    "rn-mt hook postinstall",
  );

  if (cleanedPrestart) {
    scripts.prestart = cleanedPrestart;
  } else {
    delete scripts.prestart;
  }

  if (cleanedPreandroid) {
    scripts.preandroid = cleanedPreandroid;
  } else {
    delete scripts.preandroid;
  }

  if (cleanedPreios) {
    scripts.preios = cleanedPreios;
  } else {
    delete scripts.preios;
  }

  if (cleanedPostinstall) {
    scripts.postinstall = cleanedPostinstall;
  } else {
    delete scripts.postinstall;
  }

  delete scripts["rn-mt:sync"];
  delete scripts["rn-mt:sync:android"];
  delete scripts["rn-mt:sync:ios"];
  delete scripts["rn-mt:start"];
  delete scripts["rn-mt:android"];
  delete scripts["rn-mt:ios"];

  const nextPackageJson: RnMtPackageJsonLike = {
    ...parsedPackageJson,
    scripts,
  };

  if (Object.keys(dependencies).length > 0) {
    nextPackageJson.dependencies = dependencies;
  } else {
    delete nextPackageJson.dependencies;
  }

  if (Object.keys(devDependencies).length > 0) {
    nextPackageJson.devDependencies = devDependencies;
  } else {
    delete nextPackageJson.devDependencies;
  }

  return `${JSON.stringify(nextPackageJson, null, 2)}\n`;
}
