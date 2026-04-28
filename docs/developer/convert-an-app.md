# Convert an App

Run this convert command when you want to turn your existing app into the
multi-tenant app structure:

```bash
rn-mt convert
```

This is the command that changes the repo shape.

## Run these first

Do not jump straight to convert. Start with:

```bash
rn-mt analyze
rn-mt init
```

That way the repo kind is known and the manifest already exists.

## What convert changes

Convert does the structural work:

1. finds the app entry and the app-facing source areas
2. moves shared code into `src/rn-mt/shared`
3. creates `src/rn-mt/current`
4. writes root wrappers or host bridge files
5. rewrites imports so the app can read through `current`
6. writes generated metadata

## What you will usually see after convert

Typical outputs look like this:

- `src/rn-mt/shared/**`
- `src/rn-mt/current/**`
- `rn-mt.generated.convert.ownership.json`
- `rn-mt.generated.reconstruction.json`
- `rn-mt.generated.README.md`

Depending on the app kind, you may also see:

- Expo bridge files
- root entry wrappers
- `package.json` script updates

## What convert does not do for you

Convert does not invent product branding or tenant-specific business content.

After convert, you still need to:

- add tenants
- create overrides where one tenant needs different files
- choose a default target
- run sync

## The import rule that matters

After convert, app code should read from:

```text
src/rn-mt/current
```

Avoid importing directly from:

- `src/rn-mt/shared`
- `src/rn-mt/tenants/<tenant-id>`

`rn-mt` keeps `current` pointed at the active tenant for you.

## If your repo already uses aliases

Convert tries to preserve the import style the app already uses.

That includes:

- relative imports
- supported TypeScript path aliases
- supported Babel module-resolver aliases

If an alias maps cleanly to a converted root, `rn-mt` retargets it to the
generated `current` surface. If it is too broad or unsafe, it leaves it alone.

## Common next commands

This is the normal next step after convert:

```bash
rn-mt tenant add --id northstar
rn-mt override create config/theme.ts
rn-mt target set --tenant northstar --environment dev
rn-mt sync
```

## Use codemod when you want a focused import pass

If you only want to preview or apply `current` import rewrites, run:

```bash
rn-mt codemod current-imports
rn-mt codemod current-imports --write
```

## When convert should stop

If convert stops, that is usually the right behavior.

Stop and inspect the repo when:

- analyze says the repo is ambiguous or unsupported
- convert reports an ownership conflict
- generated wrappers would overwrite a user-owned file unexpectedly

`rn-mt` is built to be explicit. It should stop instead of guessing.
