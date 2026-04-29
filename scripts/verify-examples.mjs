import { spawn, spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  readdirSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = dirname(scriptDir);
const examplesRoot = join(repoRoot, 'examples');
const sandboxRoot = join(repoRoot, 'tests', 'tmp', 'examples');
const cliEntry = join(repoRoot, 'packages', 'cli', 'dist', 'index.js');

const sourceFixtures = [
  {
    name: 'expo-managed-greenfield',
    fixtureMode: 'source',
    kind: 'expo',
    typecheck: true,
    syncPlatforms: [null],
    startPort: 18081,
  },
  {
    name: 'expo-prebuild-greenfield',
    fixtureMode: 'source',
    kind: 'expo',
    typecheck: false,
    syncPlatforms: [null, 'ios', 'android'],
    startPort: 18082,
  },
  {
    name: 'bare-react-native-greenfield',
    fixtureMode: 'source',
    kind: 'bare-react-native',
    typecheck: true,
    syncPlatforms: [null, 'ios', 'android'],
    startPort: 18083,
  },
  {
    name: 'expo-managed-brownfield',
    fixtureMode: 'source',
    kind: 'expo',
    typecheck: true,
    syncPlatforms: [null],
    startPort: 18084,
  },
];

const committedFixtureOrder = [
  'flippay-managed-legacy',
  'mmuta-managed-legacy',
  'elias-router-prebuild',
  'kena-router-hybrid',
  'keep-rn-shell',
];

function log(message) {
  process.stdout.write(`${message}\n`);
}

function run(command, args, options = {}) {
  const resolvedCwd = options.cwd ?? repoRoot;
  const result = spawnSync(command, args, {
    cwd: resolvedCwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      INIT_CWD: resolvedCwd,
      PWD: resolvedCwd,
      CI: '1',
      DO_NOT_TRACK: '1',
      EXPO_NO_TELEMETRY: '1',
      ...options.env,
    },
    stdio: 'pipe',
  });

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
    throw new Error(
      [`Command failed: ${command} ${args.join(' ')}`, output].join('\n\n'),
    );
  }

  return result;
}

function createCommandEnv(cwd, extraEnv = {}) {
  return {
    ...process.env,
    INIT_CWD: cwd,
    PWD: cwd,
    CI: '1',
    DO_NOT_TRACK: '1',
    EXPO_NO_TELEMETRY: '1',
    ...extraEnv,
  };
}

function parseJsonFromOutput(output) {
  const firstBraceIndex = output.indexOf('{');

  if (firstBraceIndex === -1) {
    throw new Error(`Expected JSON output but none was found:\n\n${output}`);
  }

  return JSON.parse(output.slice(firstBraceIndex));
}

function ensureBuiltCli() {
  if (!existsSync(cliEntry)) {
    throw new Error(
      `Built CLI entrypoint not found at ${cliEntry}. Run pnpm build first.`,
    );
  }
}

function readExampleMetadata(exampleName) {
  const metadataPath = join(examplesRoot, exampleName, 'rn-mt.example.json');

  if (!existsSync(metadataPath)) {
    return null;
  }

  return JSON.parse(readFileSync(metadataPath, 'utf8'));
}

function collectCommittedFixtures() {
  return committedFixtureOrder
    .map((name) => {
      const metadata = readExampleMetadata(name);

      if (!metadata) {
        throw new Error(`Expected committed fixture metadata at ${name}/rn-mt.example.json`);
      }

      return {
        name,
        fixtureMode: metadata.fixtureMode,
        kind:
          metadata.expectedKind === 'bare-react-native'
            ? 'bare-react-native'
            : 'expo',
        expectedKind: metadata.expectedKind,
        typecheckCommand: metadata.typecheckCommand,
        syncPlatforms: [null, ...metadata.availablePlatforms],
        startPort: metadata.startPort,
        tenantProfiles: metadata.tenantProfiles,
      };
    })
    .filter(Boolean);
}

function collectExamples(filters) {
  const allExamples = [...sourceFixtures, ...collectCommittedFixtures()];

  if (filters.length === 0) {
    return allExamples;
  }

  const requested = new Set(filters);
  const filteredExamples = allExamples.filter((example) => requested.has(example.name));

  if (filteredExamples.length !== requested.size) {
    const available = allExamples.map((example) => example.name).join(', ');
    const missing = [...requested].filter(
      (name) => !filteredExamples.some((example) => example.name === name),
    );
    throw new Error(
      `Unknown example filter(s): ${missing.join(', ')}. Available examples: ${available}`,
    );
  }

  return filteredExamples;
}

function toLinkSpec(fromDir, packageDir) {
  return `link:${relative(fromDir, packageDir).replaceAll('\\', '/')}`;
}

function rewriteRnMtPackageLinks(targetDir) {
  const packageJsonPath = join(targetDir, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  const packageNames = ['@_molaidrislabs/rn-mt'];
  const dependencyMaps = [packageJson.dependencies, packageJson.devDependencies].filter(Boolean);

  for (const dependencyMap of dependencyMaps) {
    for (const packageName of packageNames) {
      if (dependencyMap[packageName]) {
        dependencyMap[packageName] = toLinkSpec(
          targetDir,
          join(repoRoot, 'packages', packageName.split('/')[1]),
        );
      }
    }
  }

  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
}

function rewriteCommittedManifestRootDir(targetDir) {
  const manifestPath = join(targetDir, 'rn-mt.config.json');

  if (!existsSync(manifestPath)) {
    return;
  }

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

  if (!manifest.source || typeof manifest.source !== 'object') {
    manifest.source = {};
  }

  manifest.source.rootDir = targetDir;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function copyTemplateToSandbox(exampleName) {
  const sourceDir = join(examplesRoot, exampleName);
  const targetDir = join(sandboxRoot, exampleName);

  rmSync(targetDir, { recursive: true, force: true });
  mkdirSync(sandboxRoot, { recursive: true });
  cpSync(sourceDir, targetDir, {
    recursive: true,
    filter(sourcePath) {
      const skippedNames = new Set([
        'node_modules',
        '.expo',
        '.verify',
        'Pods',
        'build',
      ]);
      return !skippedNames.has(sourcePath.split('/').at(-1));
    },
  });

  const packageJsonPath = join(targetDir, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  packageJson.name = `${packageJson.name}-sandbox`;
  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);

  return targetDir;
}

function prepareSandboxFixture(example, sandboxDir) {
  if (example.fixtureMode !== 'committed-multitenant') {
    return;
  }

  rewriteRnMtPackageLinks(sandboxDir);
  rewriteCommittedManifestRootDir(sandboxDir);
}

function assertExpoAssetPath(cwd, candidatePath) {
  if (!candidatePath || typeof candidatePath !== 'string') {
    return;
  }

  const absolutePath = join(cwd, candidatePath);

  if (!existsSync(absolutePath)) {
    throw new Error(`Expected Expo asset path to exist: ${candidatePath}`);
  }
}

function assertExpoConfig(cwd) {
  const output = run(
    'pnpm',
    ['exec', 'expo', 'config', '--type', 'public', '--json'],
    { cwd },
  ).stdout;
  const expoConfig = parseJsonFromOutput(output);

  assertExpoAssetPath(cwd, expoConfig.icon);
  assertExpoAssetPath(cwd, expoConfig.android?.adaptiveIcon?.foregroundImage);
  assertExpoAssetPath(cwd, expoConfig.android?.adaptiveIcon?.backgroundImage);
  assertExpoAssetPath(cwd, expoConfig.android?.adaptiveIcon?.monochromeImage);
  assertExpoAssetPath(cwd, expoConfig.web?.favicon);
}

function assertBareReactNativeConfig(cwd) {
  run('pnpm', ['exec', 'react-native', 'config'], { cwd });
}

function runStaticSmokeCheck(example, cwd) {
  if (example.kind === 'expo') {
    assertExpoConfig(cwd);
    return;
  }

  assertBareReactNativeConfig(cwd);
}

function runRnMt(cwd, args) {
  run('node', [cliEntry, ...args, '--app-root', '.'], { cwd });
}

function killProcessTree(pid, signal = 'SIGTERM') {
  if (!pid) {
    return;
  }

  try {
    process.kill(-pid, signal);
  } catch {}

  try {
    process.kill(pid, signal);
  } catch {}
}

async function runWorkflowStartSmoke(example, cwd, startPort = example.startPort) {
  const cliArgs = ['start', '--app-root', '.'];

  if (typeof startPort === 'number') {
    cliArgs.push('--', '--port', String(startPort));
  }

  const expectedPatterns =
    example.kind === 'expo'
      ? [/Starting project at/i, /Metro waiting on/i, /Waiting on/i]
      : [/Welcome to Metro/i, /Metro waiting on/i, /Server ready/i];
  const child = spawn(process.execPath, [cliEntry, ...cliArgs], {
    cwd,
    env: createCommandEnv(cwd, {
      RN_MT_NETWORK_MODE: 'local-first',
    }),
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });

  let stdout = '';
  let stderr = '';
  let timedOut = false;

  child.stdout?.on('data', (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr?.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      timedOut = true;
      killProcessTree(child.pid, 'SIGTERM');
      setTimeout(() => {
        killProcessTree(child.pid, 'SIGKILL');
      }, 500);
    }, 8000);

    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      const output = [stdout, stderr].filter(Boolean).join('\n');

      if (timedOut) {
        if (expectedPatterns.some((pattern) => pattern.test(output))) {
          resolve();
          return;
        }

        reject(
          new Error(
            [`Timed rn-mt start smoke did not reach the expected ready state.`, output].join(
              '\n\n',
            ),
          ),
        );
        return;
      }

      if (code === 0 || expectedPatterns.some((pattern) => pattern.test(output))) {
        resolve();
        return;
      }

      reject(
        new Error([`rn-mt start smoke failed for ${example.name}.`, output].join('\n\n')),
      );
    });
  });
}

function runCommittedTypecheck(example, cwd) {
  if (!example.typecheckCommand) {
    return;
  }

  const result = spawnSync(example.typecheckCommand, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      INIT_CWD: cwd,
      PWD: cwd,
      CI: '1',
      DO_NOT_TRACK: '1',
      EXPO_NO_TELEMETRY: '1',
    },
    stdio: 'pipe',
    shell: true,
  });

  if (result.status !== 0) {
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n');
    throw new Error(
      [`Typecheck command failed: ${example.typecheckCommand}`, output].join('\n\n'),
    );
  }
}

async function verifySourceFixture(example) {
  const sandboxDir = copyTemplateToSandbox(example.name);

  run(
    'pnpm',
    ['install', '--no-frozen-lockfile', '--link-workspace-packages'],
    { cwd: sandboxDir },
  );
  runStaticSmokeCheck(example, sandboxDir);

  runRnMt(sandboxDir, ['analyze', '--json']);
  runRnMt(sandboxDir, ['init', '--json']);
  runRnMt(sandboxDir, ['convert', '--json']);

  run(
    'pnpm',
    ['install', '--no-frozen-lockfile', '--link-workspace-packages'],
    { cwd: sandboxDir },
  );

  for (const platform of example.syncPlatforms) {
    runRnMt(
      sandboxDir,
      platform === null ? ['sync', '--json'] : ['sync', '--json', '--platform', platform],
    );
  }

  if (example.typecheck) {
    run('pnpm', ['typecheck'], { cwd: sandboxDir });
  }

  runStaticSmokeCheck(example, sandboxDir);
  await runWorkflowStartSmoke(example, sandboxDir);
  runRnMt(sandboxDir, ['audit', '--json', '--fail-on', 'P0']);
}

async function verifyCommittedFixture(example) {
  const sandboxDir = copyTemplateToSandbox(example.name);
  prepareSandboxFixture(example, sandboxDir);

  run(
    'pnpm',
    [
      'install',
      '--ignore-workspace',
      '--no-frozen-lockfile',
      '--config.link-workspace-packages=false',
    ],
    { cwd: sandboxDir },
  );

  runRnMt(sandboxDir, ['analyze', '--json']);

  for (const [tenantIndex, tenantProfile] of example.tenantProfiles.entries()) {
    runRnMt(sandboxDir, [
      'target',
      'set',
      '--json',
      '--tenant',
      tenantProfile.id,
      '--environment',
      'dev',
    ]);
    runRnMt(sandboxDir, ['sync', '--json']);
    runCommittedTypecheck(example, sandboxDir);
    runStaticSmokeCheck(example, sandboxDir);
    await runWorkflowStartSmoke(example, sandboxDir, example.startPort + tenantIndex);
    runRnMt(sandboxDir, ['audit', '--json', '--fail-on', 'P0']);

    for (const platform of example.syncPlatforms.filter(Boolean)) {
      runRnMt(sandboxDir, ['sync', '--json', '--platform', platform]);
      runStaticSmokeCheck(example, sandboxDir);
    }
  }
}

async function verifyExample(example) {
  log(`\n==> verifying ${example.name}`);

  if (example.fixtureMode === 'committed-multitenant') {
    await verifyCommittedFixture(example);
    return;
  }

  await verifySourceFixture(example);
}

async function main() {
  ensureBuiltCli();
  mkdirSync(sandboxRoot, { recursive: true });

  for (const example of collectExamples(process.argv.slice(2))) {
    await verifyExample(example);
  }

  rmSync(sandboxRoot, { recursive: true, force: true });
  log('\nExample verification finished cleanly.');
}

await main();
