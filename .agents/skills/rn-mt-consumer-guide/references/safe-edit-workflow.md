# Safe Edit Workflow

Use this workflow when editing a converted app.

## Before editing

1. Read `rn-mt.config.json`.
2. Identify the target labels and the currently active target.
3. Inspect the host app's `package.json` scripts.
4. Search usages of the relevant component/module from the app surface.
5. Decide whether the behavior is shared or tenant-specific.

## Shared behavior

Edit the matching file under `src/rn-mt/shared`.

Run:

```bash
npx rn-mt sync
```

Then run the host app checks and rn-mt checks.

## Tenant-specific behavior

Prefer the rn-mt override command when creating a new override:

```bash
npx rn-mt override create <path> --tenant <tenant-id>
```

Then edit the file under `src/rn-mt/tenants/<tenant-id>`.

Run:

```bash
npx rn-mt target set <tenant-id>
npx rn-mt sync
```

Validate the feature with the target active. If multiple labels are affected,
switch targets and validate each one.

## Generated file symptom

When a bug appears in `src/rn-mt/current` or `rn-mt.generated.*`:

1. Do not patch the generated file directly.
2. Find the matching source file in `src/rn-mt/shared` or
   `src/rn-mt/tenants/<id>`.
3. Fix the source or config.
4. Run `npx rn-mt sync`.
5. Confirm the generated output changed as expected.

## Label-specific feature check

When adding a feature that should exist in one label but not another:

1. Add the feature in the intended tenant override.
2. Switch to that tenant and verify the feature exists.
3. Switch to the other tenant and verify the feature does not exist.
4. Run `npx rn-mt audit` and `npx rn-mt doctor`.
