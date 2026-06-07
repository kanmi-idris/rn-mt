# Agent Skills

Use these paths when you want an agent to work with `rn-mt` without guessing.

There are two different skills:

- `rn-mt-codebase-guide` for contributing to the rn-mt monorepo itself
- `rn-mt-consumer-guide` for working inside apps that consume rn-mt after
  conversion

## Pick the right skill

Use `rn-mt-codebase-guide` when the agent is changing, reviewing, debugging, or
understanding this repository:

- `packages/core`
- `packages/cli`
- `packages/runtime`
- `packages/expo-plugin`
- the docs app
- examples and `examples:verify`
- convert, sync, audit, doctor, hooks, handoff, or generated artifact behavior

Use `rn-mt-consumer-guide` when the agent is working inside a converted React
Native or Expo app that has:

- `src/rn-mt/shared`
- `src/rn-mt/tenants/<id>`
- `src/rn-mt/current`
- `rn-mt.config.json`
- `rn-mt.generated.*`

In consumer apps, `src/rn-mt/shared` and `src/rn-mt/tenants/<id>` are
user-owned. `src/rn-mt/current` and `rn-mt.generated.*` are generated surfaces,
so durable edits should happen through shared source, tenant overrides,
`rn-mt sync`, or target changes.

## Install the monorepo skill

Use the same install pattern used by `skills.sh`:

```bash
npx skills add https://github.com/kanmi-idris/rn-mt --skill rn-mt-codebase-guide
```

If you want to target Codex explicitly:

```bash
npx skills add https://github.com/kanmi-idris/rn-mt --skill rn-mt-codebase-guide -a codex
```

If you want a global install instead of a project-local install:

```bash
npx skills add https://github.com/kanmi-idris/rn-mt --skill rn-mt-codebase-guide -g -a codex
```

That follows the normal `skills.sh` flow:

- the skill is pulled from this GitHub repo
- the selected skill bundle is `rn-mt-codebase-guide`
- the Skills CLI installs it into the right agent skill directory
- symlink install is the normal default, copy install is available through the
  Skills CLI flags

If you need a repo-local fallback because the Skills CLI is unavailable, run:

```bash
./skills/rn-mt-codebase-guide/scripts/install.sh
```

If you want a copied fallback install instead, run:

```bash
./skills/rn-mt-codebase-guide/scripts/install.sh --copy
```

## Install the consumer app skill

Use this when the agent is working inside a host app that consumes rn-mt:

```bash
npx skills add https://github.com/kanmi-idris/rn-mt --skill rn-mt-consumer-guide
```

If you want to target Codex explicitly:

```bash
npx skills add https://github.com/kanmi-idris/rn-mt --skill rn-mt-consumer-guide -a codex
```

If you want a global install instead of a project-local install:

```bash
npx skills add https://github.com/kanmi-idris/rn-mt --skill rn-mt-consumer-guide -g -a codex
```

If you need a repo-local fallback because the Skills CLI is unavailable, run:

```bash
./skills/rn-mt-consumer-guide/scripts/install.sh
```

## Tell the agent which one to use

Once the skill is installed, name the skill in the request.

Examples:

```bash
Use rn-mt-codebase-guide and debug why rn-mt sync is generating the wrong runtime file.
Use rn-mt-codebase-guide and fix the docs build failure.
Use rn-mt-codebase-guide and trace why examples:verify is failing on keep-rn-shell.
Use rn-mt-consumer-guide and add a feature only to the partner label.
Use rn-mt-consumer-guide and switch this app to the staging label before running checks.
Use rn-mt-consumer-guide and fix this generated current import without editing generated files.
```

## What the monorepo skill does

The skill is opinionated on purpose. It tells the agent to:

- read `docs/design-decisions-handbook.md` before changing behavior
- compare against the local `opensrc/` Expo and React Native mirrors when
  integration behavior is involved
- use the best local file discovery and grep tools available, and prefer the
  `fff` MCP server when it is available
- pick the smallest useful verification loop before running commands
- debug the owning package instead of only patching the symptom layer

## What the consumer skill does

The consumer skill tells the agent to:

- read `rn-mt.config.json` before deciding which labels exist
- treat `src/rn-mt/shared` as shared user-owned source
- treat `src/rn-mt/tenants/<id>` as label-specific full-file overrides
- avoid direct durable edits to `src/rn-mt/current` and `rn-mt.generated.*`
- use `npx rn-mt sync`, `npx rn-mt target set`, and
  `npx rn-mt override create` for generated surfaces and overrides
- validate consumer apps with the host app's Jest, lint, TypeScript, native, or
  UI checks plus `npx rn-mt audit` and `npx rn-mt doctor`
- create `rn-mt-bugs.md` and publish a GitHub issue to `kanmi-idris/rn-mt`
  automatically for every rn-mt-owned or plausibly rn-mt-owned issue found

The consumer skill deliberately does not default to rn-mt monorepo checks such
as `pnpm build` or `pnpm examples:verify`. Those validate rn-mt package source,
not a host app that consumes the package.

## Bug reports are part of the workflow

When the agent is debugging a real bug, the skill tells it to always leave
behind:

```text
rn-mt-bugs.md
```

That file becomes the working bug report while the agent reproduces the issue,
inspects generated artifacts, narrows the owner, and verifies the fix.

If the file does not exist yet, the skill can initialize it with:

```bash
./.agents/skills/rn-mt-codebase-guide/scripts/init-bug-report.sh "Short bug title"
```

## GitHub issue creation

When the bug is ready to report, the skill tells the agent to try:

```bash
./.agents/skills/rn-mt-codebase-guide/scripts/publish-issue.sh rn-mt-bugs.md "Bug: short title"
```

If GitHub CLI is installed and authenticated, that creates an issue in:

```text
kanmi-idris/rn-mt
```

If issue creation fails because `gh` is missing, unauthenticated, or denied
access, the agent should tell you that clearly and leave `rn-mt-bugs.md` ready
to paste into:

```text
https://github.com/kanmi-idris/rn-mt/issues/new
```

## When this path is better than manual CLI work

Use the skill when:

- you want the agent to respect repo-specific debugging rules
- you want the agent to know where behavior lives before it edits anything
- you want bug reports and issue creation handled as part of the workflow
- you are touching `convert`, `sync`, `handoff`, `workflow hooks`, the docs app,
  or the example verifier

Use the manual path when you just want to run the commands yourself and move
fast without the extra reporting flow.
