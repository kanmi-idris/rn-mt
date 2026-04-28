# Bug Reporting

Use this file when the task is debugging, fixing, or triaging a real `rn-mt`
bug.

## Always leave behind `rn-mt-bugs.md`

At the start of bug work, create or refresh a repo-root bug file:

```bash
./.agents/skills/rn-mt-codebase-guide/scripts/init-bug-report.sh "Short bug title"
```

That creates:

```text
rn-mt-bugs.md
```

Update it as you work. Do not treat it as a final summary you write at the end.

## What to keep in the bug file

Make sure `rn-mt-bugs.md` covers:

- the bug title
- a one-line summary
- exact repro steps
- expected result
- actual result
- affected package or module
- commands you ran
- fixture or app root, if relevant
- generated artifacts you inspected
- logs or error output
- the fix you applied or plan to apply
- the verification commands and outcome

## Publish the issue automatically when possible

After the bug is understood well enough to report, try:

```bash
./.agents/skills/rn-mt-codebase-guide/scripts/publish-issue.sh rn-mt-bugs.md "Bug: short title"
```

The script will:

- use `gh issue create` when GitHub CLI is available and authenticated
- create the issue in `kanmi-idris/rn-mt`
- print the created issue URL on success

## If issue creation fails

If the publish script fails:

1. tell the user why it failed
2. keep `rn-mt-bugs.md` ready to paste
3. point the user to:

```text
https://github.com/kanmi-idris/rn-mt/issues/new
```

Common failure cases:

- `gh` is not installed
- `gh auth status` fails
- the current token cannot create issues in the repo
- network or GitHub API errors

## When to skip issue creation

Do not publish a GitHub issue for:

- purely local experiments the user asked not to track
- already-known issues the user is explicitly fixing in the same session
- docs-only copy tweaks that are not bugs
