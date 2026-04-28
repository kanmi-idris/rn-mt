# Troubleshooting

This page covers the most common developer problems when working with `rn-mt`.

## `analyze` says the repo is ambiguous

Cause:

- the repo shape matches more than one app kind
- the host signals are incomplete

What to do:

```sh
rn-mt analyze --app-kind expo-prebuild
```

If you are in an interactive terminal, the CLI can also prompt for a selection.

## `Manifest not found`

Cause:

- you have not run `rn-mt init`
- you are in the wrong app root
- you need `--app-root` or `--config`

What to do:

```sh
rn-mt init
```

Or run the command with explicit scope if you are in a larger workspace.

## `sync` fails because env values are missing

Cause:

- the manifest defines required env schema entries
- the selected target does not currently provide them

What to do:

- check the selected tenant and environment
- check the canonical env files used for that target
- check the manifest env schema rules

Remember:

- env inputs are validated for workflow use
- secrets should not be expected inside generated runtime JSON

## `convert` or `sync` reports an ownership problem

Cause:

- a generated file was edited manually
- a generated path is colliding with unexpected existing content

What to do:

- inspect the generated ownership metadata
- inspect the path the CLI says is blocked
- decide whether the file should stay generated or become user-owned

Do not blindly delete files until you understand which side owns them.

## A tenant override does not appear in the app

Cause:

- the override was created in the wrong tenant
- the default target is pointing at a different tenant
- `current` has not been regenerated yet

What to do:

```sh
rn-mt target set --tenant northstar --environment dev
rn-mt sync
```

Also verify that app imports read through `src/rn-mt/current`.

## Workflow hooks keep syncing when you expected a skip

Cause:

- manifest contents changed
- env inputs changed
- tracked generated files changed
- hook state is stale

What to check:

- `.rn-mt/hook-state.json`
- generated file hashes
- target defaults in the manifest

## `start` or `run` feels wrong for the repo kind

Cause:

- the selected app kind is wrong
- the repo is near-supported and needs explicit guidance

What to do:

Run `rn-mt analyze` again and inspect the evidence. If needed, pass
`--app-kind` explicitly for the repo.

## The examples verifier fails

Cause:

- a real integration regression
- changed alias behavior
- changed generated ownership behavior
- changed workflow/env behavior

What to do:

- read the failing example name
- inspect `scripts/verify-examples.mjs`
- inspect the example sandbox if it is kept for debugging

Example failures are often the fastest way to catch real-world drift after a
package refactor.
