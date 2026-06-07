# Bug: examples verifier expects absent committed fixtures

## Summary

`pnpm examples:verify` failed before running fixtures because it required absent committed multitenant fixture directories, then exposed npm-install defects in the converted app package dependency and single-package CLI build.
The external package tarball check also showed that `pnpm pack` did not include a package-local `LICENSE` file. Installing the packed tarball into a cloned app exposed that the public `rn-mt` bin did not execute when launched through npm's `node_modules/.bin` symlink, then exposed that compatibility checks rejected `file:*.tgz` dependency specs, and then exposed duplicate package entries when convert moved an existing devDependency into dependencies.
The two-label external validation then exposed that `rn-mt sync` updated runtime/native identity without regenerating `src/rn-mt/current` facades, so the selected label could report Velocity identity while still rendering Signal Care source. The examples verifier also reused one shared sandbox root, allowing converted lifecycle hooks from a previous copied example to run during later fixture installs.

## Reproduction

1. Run `pnpm build`.
2. Run `pnpm examples:verify`.
3. Observe the verifier abort before source fixture verification starts.
4. After skipping absent committed fixtures, observe the converted sandbox pin `@_molaidrislabs/rn-mt@0.1.0` from the private root package version instead of the public package version.
5. Observe sandbox install fail in the `rn-mt hook postinstall` command after pulling the stale registry package.
6. After aligning the converted dependency version, observe the verifier drive the private internal CLI version `0.1.0` against the public package version `0.1.1`.
7. Run `pnpm --filter @_molaidrislabs/rn-mt pack --pack-destination tests/tmp/npm-pack` and inspect the tarball contents.
8. Install the tarball into an npm app and run `npx rn-mt analyze --json`.
9. Observe compatibility failure against the literal `file:...tgz` spec after the bin executes.
10. Convert an app that already has `@_molaidrislabs/rn-mt` in devDependencies.
11. Convert a real Expo app into two labels, select one label with `rn-mt target set`, and run `rn-mt sync`.
12. Observe `rn-mt.generated.runtime.json` change to the selected label while `src/rn-mt/current/app/(tabs)/*` still re-export the previous label.
13. Run `pnpm examples:verify` across more than one source fixture after a fixture has been converted and installed.

## Expected result

The verifier should run the source fixtures that are present, should run committed multitenant fixtures only when their directories and metadata are committed, should pin converted apps to the public `@_molaidrislabs/rn-mt` package version, and should exercise the public `rn-mt` CLI binary that developers install.
The public tarball should include the license text for downstream consumers.
The installed package bin should execute the CLI through npm's `.bin` symlink.
Tarball installs should compare against the installed package metadata, not the literal `file:` spec.
Convert should place `@_molaidrislabs/rn-mt` in exactly one dependency section.
Sync should regenerate current facades for the selected tenant whenever a converted app switches targets.
The examples verifier should isolate copied sandboxes so one fixture's lifecycle scripts cannot run while installing another fixture.

## Actual result

The verifier first threw before any fixture work:

```text
Error: Expected committed fixture metadata at flippay-managed-legacy/rn-mt.example.json
```

After that verifier issue was fixed, the package install path failed with:

```text
SyntaxError: Invalid or unexpected token
node_modules/@_molaidrislabs/rn-mt/dist/cli.js:2
#!/usr/bin/env node
```

After that package issue was fixed, the verifier failed version compatibility by invoking the private CLI:

```text
Global rn-mt CLI version 0.1.0 is incompatible with repo-local @_molaidrislabs/rn-mt version 0.1.1.
```

The package tarball contents did not list `LICENSE`.

The installed bin exited successfully without output because `process.argv[1]`
pointed at the `.bin/rn-mt` symlink while `import.meta.url` pointed at the real
`dist/cli.js` path.

After the bin fix, the compatibility guard reported:

```text
Global rn-mt CLI version 0.1.1 is incompatible with repo-local @_molaidrislabs/rn-mt version file:../../npm-pack/_molaidrislabs-rn-mt-0.1.1.tgz.
```

After conversion, the external validation app had `@_molaidrislabs/rn-mt` in both `dependencies` and `devDependencies`.

After selecting Velocity, the external validation app had Velocity runtime identity but current facades still pointing to Signal Care:

```text
rn-mt.generated.runtime.json -> Velocity (Dev)
src/rn-mt/current/app/(tabs)/index.tsx -> ../../../tenants/signalcare/app/(tabs)/index
```

After a stale current-facade state existed, the first fixed sync also needed to migrate older convert-owned current facades with stale hashes instead of failing on generated files that still carried the rn-mt current-facade banner.

During the second source fixture, the examples verifier failed with a cross-sandbox hook:

```text
../expo-managed-greenfield postinstall: Manifest not found: /Users/olaidris/Desktop/Code/rn-mt/tests/tmp/examples/expo-prebuild-greenfield/rn-mt.config.json
```

After the sandbox isolation fix, the verifier still allowed temporary sandboxes
under `tests/tmp/examples/*` to participate as pnpm workspace importers, which
mutated the root `pnpm-lock.yaml` during `pnpm examples:verify`.

## Scope

- Package: repository verification harness
- Module or file: `scripts/verify-examples.mjs`, `packages/core/src/convert/package-json.ts`, `packages/core/src/sync/sync-module.ts`, `packages/cli/src/shared/files.ts`, `packages/cli/src/shared/version.ts`, `packages/rn-mt/src/cli.ts`, `packages/rn-mt/tsup.config.ts`, `packages/rn-mt/LICENSE`, repo verification docs
- Command: `pnpm examples:verify`
- Fixture or app root: `examples/`
- Tenant / environment / platform: not reached

## Generated artifacts inspected

- none; failure happened before sandbox generation

## Suspected owner

`scripts/verify-examples.mjs`

## Fix

Changed committed fixture collection so absent future fixture directories are skipped, while existing committed fixture directories still require `rn-mt.example.json` metadata. Updated examples docs to match the current repository contents. Changed conversion package-version discovery to resolve the public `@_molaidrislabs/rn-mt` manifest, including the monorepo path `packages/rn-mt/package.json`, instead of the private root manifest. Changed conversion to remove the package from the old dependency section when moving it into the intended section. Changed CLI compatibility checks to read installed package metadata for packed tarball installs. Resolved npm bin symlinks in the public CLI entrypoint and added regression tests. Removed the global tsup shebang banner from the single-package build so the CLI source shebang is preserved exactly once and library entrypoints are not emitted as executables. Pointed the example verifier and repo guidance at the public built CLI entrypoint. Added a package-local MIT license file for tarball consumers. Changed sync to regenerate current facades for the selected tenant and track them in sync ownership metadata. Added a guarded migration path for older convert-owned generated current facades whose hashes are stale but whose contents still carry rn-mt generated current-facade banners. Cleared the shared examples sandbox before each fixture copy so fixture lifecycle scripts cannot leak across installs. Removed temporary verifier sandboxes from the pnpm workspace and changed sandbox installs to explicit standalone installs with local `link:` package specs so `pnpm examples:verify` does not mutate the root lockfile. Removed unused CJS output from warning-producing private workspace builds so release builds complete without `import.meta`/CJS warnings.

## Verification

- [x] `pnpm test`
- [x] `pnpm typecheck`
- [x] `pnpm build`
- [x] `pnpm examples:verify`
- [x] `pnpm --filter @_molaidrislabs/rn-mt publish --dry-run --report-summary --access public --no-git-checks`
- [x] focused repro rerun against `/Users/olaidris/Desktop/Code/rn-mt/tests/tmp/external-validation/speed-test-labels`

## Issue link

https://github.com/kanmi-idris/rn-mt/issues/64
