# Verification

Consumer app validation is app-specific. Use the host app's scripts and rn-mt's
consumer checks.

## Start with package scripts

Inspect `package.json` and use the package manager already used by the app.
Prefer lockfile evidence:

- `pnpm-lock.yaml` -> `pnpm`
- `yarn.lock` -> `yarn`
- `package-lock.json` -> `npm`
- `bun.lockb` or `bun.lock` -> `bun`

Useful checks usually include:

```bash
npm test
npm run lint
npm run typecheck
```

Only run scripts that actually exist, unless the user asks you to add them.

## rn-mt checks

Run these in converted apps:

```bash
npx rn-mt audit
npx rn-mt doctor
```

Run `npx rn-mt sync` after target, config, shared source, or tenant override
changes.

## Label validation

For each affected label:

```bash
npx rn-mt target set <tenant-id>
npx rn-mt sync
```

Then run the smallest meaningful host-app checks and any UI/native validation
needed for the changed feature.

For React Native or Expo UI behavior, use the project's existing simulator,
emulator, Expo, Maestro, Detox, or app-specific QA workflow when available.

## What not to run by default

Do not run rn-mt monorepo commands in a consumer app unless you are actually
inside the rn-mt repository changing rn-mt package source:

```bash
pnpm build
pnpm examples:verify
```

Those commands validate rn-mt itself, not a host app that consumes the package.
