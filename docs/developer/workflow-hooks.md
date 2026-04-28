# Workflow Hooks

Use hooks when you want the app to stay in sync without remembering to run
`rn-mt sync` by hand every time.

## The hooks that exist today

You can run these directly:

```bash
rn-mt hook prestart
rn-mt hook preandroid
rn-mt hook preios
rn-mt hook postinstall
```

## Why they exist

Hooks keep the generated output aligned with the current target before the app
starts or platform commands run.

That helps with:

- stale generated files
- wrong tenant output
- “works on my machine” drift

## What a hook does

The flow is simple:

1. resolve the target
2. load the env files for that target
3. check whether the inputs changed
4. skip if everything still matches
5. run sync if it does not

## Where hook state lives

The skip state is tracked here:

```text
.rn-mt/hook-state.json
```

## Platform hooks

`preandroid` and `preios` use the default tenant and environment from the
manifest, then lock the platform for that hook.

That means:

- `preandroid` syncs the default Android target
- `preios` syncs the default iOS target

## When to run hooks yourself

Run them directly when you want to debug workflow behavior.

Examples:

```bash
rn-mt hook prestart
rn-mt hook preios
```

This is useful when you want to confirm whether `rn-mt` is skipping correctly
or forcing a full sync.
