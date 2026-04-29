# Debug Playbooks

Use the playbook that matches the symptom. Start narrow. Expand only if needed.

Before you start, create or refresh `rn-mt-bugs.md` in the repo root and keep
it current while you debug:

```bash
./.agents/skills/rn-mt-codebase-guide/scripts/init-bug-report.sh "Short bug title"
```

## 1. Analyze/classification bug

Symptom examples:

- wrong app kind
- ambiguous when it should be clear
- bad support tier or reason code

Start here:

- `packages/core/src/analyze/analyze-module.ts`
- `packages/core/src/analyze/types.ts`
- `packages/cli/src/commands/project-analyze.ts`

Reproduce with:

```bash
node packages/cli/dist/index.js analyze --app-root . --json
```

If fixture-specific, compare with the relevant example metadata in
`examples/*/rn-mt.example.json`.

## 2. Manifest or target resolution bug

Symptom examples:

- wrong tenant/environment config
- bad layer ordering
- env schema mismatch
- wrong runtime flags/assets/routes

Start here:

- `packages/core/src/manifest/manifest-module.ts`
- `packages/core/src/manifest/merge.ts`
- `packages/core/src/manifest/registry.ts`
- `packages/core/src/manifest/env.ts`

Reproduce with:

```bash
node packages/cli/dist/index.js target set --tenant northstar --environment dev --app-root .
node packages/cli/dist/index.js sync --json --app-root .
```

Inspect:

- `rn-mt.config.json`
- `rn-mt.generated.runtime.json`

## 3. Convert or import rewrite bug

Symptom examples:

- files moved to the wrong place
- current facades wrong
- alias rewrite broken
- package.json scripts wrong after convert

Start here:

- `packages/core/src/convert/convert-module.ts`
- `packages/core/src/convert/import-rewriter.ts`
- `packages/core/src/convert/facade-writer.ts`
- `packages/core/src/convert/package-json.ts`

Best repro:

- use a source fixture from `examples/`
- copy/convert path via `pnpm examples:verify`

Inspect:

- `src/rn-mt/shared`
- `src/rn-mt/current`
- `rn-mt.generated.reconstruction.json`

## 4. Sync, generated artifact, or env bug

Symptom examples:

- sync writes the wrong files
- platform output wrong
- hooks or run/start fail due to env
- runtime artifact contains wrong values

Start here:

- `packages/core/src/sync/sync-module.ts`
- `packages/core/src/sync/runtime-artifacts.ts`
- `packages/core/src/sync/native-artifacts.ts`
- `packages/core/src/sync/asset-artifacts.ts`
- `packages/core/src/sync/subprocess-env.ts`

Inspect:

- `rn-mt.generated.runtime.json`
- `rn-mt.generated.ownership.json`
- `rn-mt.generated.asset-fingerprints.json`
- `.rn-mt/hook-state.json`

## 5. Workflow, start/run, or hook bug

Symptom examples:

- `rn-mt start` launches the wrong host flow
- hooks re-sync forever
- run/build/start ignore app-root or config scope

Start here:

- `packages/cli/src/shared/workflow.ts`
- `packages/cli/src/shared/hooks.ts`
- `packages/cli/src/shared/execution.ts`
- `packages/cli/src/shared/options.ts`
- `packages/cli/src/commands/workflow-*.ts`

Reproduce with:

```bash
node packages/cli/dist/index.js hook prestart --app-root .
node packages/cli/dist/index.js start --app-root .
```

If the issue only happens in examples, inspect the start smoke in
`scripts/verify-examples.mjs`.

## 6. Audit or doctor bug

Start here:

- `packages/core/src/audit/audit-module.ts`
- `packages/core/src/doctor/doctor-module.ts`
- `packages/cli/src/commands/quality.ts`

Reproduce with:

```bash
node packages/cli/dist/index.js audit --app-root . --json
node packages/cli/dist/index.js doctor --app-root . --json
```

## 7. Handoff bug

Symptom examples:

- flattening wrong
- generated files remain in export
- tenant residue remains
- zip/export behavior wrong

Start here:

- `packages/core/src/handoff/handoff-module.ts`
- `packages/cli/src/commands/handoff.ts`

Inspect:

- `rn-mt.generated.reconstruction.json`
- generated ownership metadata
- sanitization and isolation audit outputs

## 8. Docs app or GitHub Pages bug

Start here:

- `apps/docs/lib/docs.ts`
- `apps/docs/lib/page-route.tsx`
- `apps/docs/components/docs-shell.tsx`
- `apps/docs/app/globals.css`
- `apps/docs/next.config.mjs`
- `.github/workflows/docs-pages.yml`

Run:

```bash
pnpm --filter @_molaidrislabs/docs typecheck
pnpm --filter @_molaidrislabs/docs build
```

Remember:

- local `.next` does not matter to CI deploys
- Pages deploys on pushes to `main` that touch the watched docs paths
- current production URL is project-site style, not apex-style

## 9. Example verifier regression

If the repo-level tests pass but `examples:verify` fails:

1. identify the exact fixture
2. check whether it is source or committed multitenant
3. inspect the sandbox logic in `scripts/verify-examples.mjs`
4. rerun the narrowest repro you can from the verifier sequence

Use `examples/README.md` to understand the fixture’s intended mode.
