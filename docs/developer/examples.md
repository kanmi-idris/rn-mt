# Examples

The repository includes example apps used to verify that `rn-mt` works across
different host shapes.

## Where the examples live

Look in:

```text
examples/
```

The repo includes both:

- source fixtures that model pre-conversion apps
- committed multitenant fixtures that model already-converted apps

## Why the examples matter

The examples are not just demos.

They are part of the package verification strategy:

- different app kinds
- different entry models
- different alias setups
- different tenant shapes

## Example verification

Run the full example matrix from the repo root:

```sh
pnpm examples:verify
```

The verifier copies fixtures into temporary sandboxes and checks the real
package workflow there.

Typical steps include:

- install
- analyze
- init
- convert
- tenant switching
- sync
- typecheck
- start smoke
- audit

## What to read when an example fails

Start with:

- `scripts/verify-examples.mjs`
- the failing example folder under `examples/`
- the generated sandbox under `tests/tmp/examples/` if the verifier kept it for
  inspection

## When to add or change an example

Update or add fixtures when:

- the package gains support for a new repo shape
- a regression only reproduces in a real-world host app layout
- convert or sync behavior changes and needs stronger integration coverage

Examples are especially useful for catching the kinds of issues unit tests miss:

- alias rewriting
- generated-file ownership drift
- env-file loading
- Expo bridge output
- native identity materialization
