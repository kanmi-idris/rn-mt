import { readFileSync } from "node:fs";
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

export function getRnMtPackageVersion() {
  const packageJsonPath = join(
    dirname(fileURLToPath(import.meta.url)),
    "..",
    "..",
    "package.json",
  );
  const packageJson = JSON.parse(
    readFileSync(packageJsonPath, "utf8"),
  ) as {
    version?: string;
  };

  return packageJson.version ?? "0.1.0";
}

export function getLocalRnMtPackagePlan(appKind: RnMtRepoAppKind) {
  const version = getRnMtPackageVersion();
  const localPackages: Array<{
    name: string;
    version: string;
    section: "dependencies" | "devDependencies";
  }> = [
    {
      name: "@rn-mt/runtime",
      version,
      section: "dependencies",
    },
    {
      name: "@rn-mt/cli",
      version,
      section: "devDependencies",
    },
  ];

  if (appKind === "expo-managed" || appKind === "expo-prebuild") {
    localPackages.push({
      name: "@rn-mt/expo-plugin",
      version,
      section: "dependencies",
    });
  }

  return localPackages;
}

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

function createRunHelperScript(command: string, options: { platform?: "ios" | "android" } = {}) {
  return options.platform
    ? `rn-mt run --platform ${options.platform} -- ${command}`
    : `rn-mt run -- ${command}`;
}

function chainPackageScript(
  existingCommand: string | undefined,
  generatedCommand: string,
) {
  if (!existingCommand || existingCommand.trim().length === 0) {
    return generatedCommand;
  }

  return `${existingCommand} && ${generatedCommand}`;
}

export function createConvertedPackageJsonContents(
  packageJsonContents: string,
  appKind: RnMtRepoAppKind,
) {
  const parsedPackageJson = JSON.parse(packageJsonContents) as RnMtPackageJsonLike;
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
        android: createRunHelperScript(hostAndroidScript, { platform: "android" }),
        ios: createRunHelperScript(hostIosScript, { platform: "ios" }),
        prestart: chainPackageScript(existingScripts.prestart, "rn-mt hook prestart"),
        preandroid: chainPackageScript(existingScripts.preandroid, "rn-mt hook preandroid"),
        preios: chainPackageScript(existingScripts.preios, "rn-mt hook preios"),
        postinstall: chainPackageScript(
          existingScripts.postinstall,
          "rn-mt hook postinstall",
        ),
        "rn-mt:sync": "rn-mt sync",
        "rn-mt:sync:android": "rn-mt sync --platform android",
        "rn-mt:sync:ios": "rn-mt sync --platform ios",
        "rn-mt:start": createRunHelperScript(hostStartScript),
        "rn-mt:android": createRunHelperScript(hostAndroidScript, { platform: "android" }),
        "rn-mt:ios": createRunHelperScript(hostIosScript, { platform: "ios" }),
      },
    },
    null,
    2,
  )}\n`;
}

function unwrapRunHelperScript(command: string | undefined) {
  if (!command) {
    return undefined;
  }

  const platformMatch = command.match(/^rn-mt run --platform (android|ios) -- (.+)$/u);

  if (platformMatch) {
    return platformMatch[2];
  }

  const directMatch = command.match(/^rn-mt run -- (.+)$/u);

  return directMatch?.[1] ?? command;
}

function removeGeneratedHookScript(command: string | undefined, generatedCommand: string) {
  if (!command || command.trim().length === 0) {
    return undefined;
  }

  const segments = command
    .split("&&")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && segment !== generatedCommand);

  return segments.length > 0 ? segments.join(" && ") : undefined;
}

export function createStandalonePackageJsonContents(
  packageJsonContents: string,
  appKind: RnMtRepoAppKind,
) {
  const parsedPackageJson = JSON.parse(packageJsonContents) as RnMtPackageJsonLike;
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
    existingScripts["rn-mt:start"] ?? existingScripts.start ?? defaultScripts.start,
  );
  const restoredAndroidScript = unwrapRunHelperScript(
    existingScripts["rn-mt:android"] ?? existingScripts.android ?? defaultScripts.android,
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
  const cleanedPreios = removeGeneratedHookScript(existingScripts.preios, "rn-mt hook preios");
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
