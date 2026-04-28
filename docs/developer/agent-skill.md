# Agent Skill

Use this path when you want an agent to work inside `rn-mt` without guessing.

## Install the skill

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

## Tell the agent to use it

Once the skill is installed, ask the agent to use `rn-mt-codebase-guide` when
you want repo-specific help.

Examples:

```bash
Use rn-mt-codebase-guide and debug why rn-mt sync is generating the wrong runtime file.
Use rn-mt-codebase-guide and fix the docs build failure.
Use rn-mt-codebase-guide and trace why examples:verify is failing on keep-rn-shell.
```

## What the skill does

The skill is opinionated on purpose. It tells the agent to:

- read `docs/design-decisions-handbook.md` before changing behavior
- compare against the local `opensrc/` Expo and React Native mirrors when
  integration behavior is involved
- use the best local file discovery and grep tools available, and prefer the
  `fff` MCP server when it is available
- pick the smallest useful verification loop before running commands
- debug the owning package instead of only patching the symptom layer

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
