# Issue Reporting

Use this file whenever an agent working in a converted consumer app finds a
real rn-mt package, CLI, sync, audit, doctor, generated surface, target, or
override issue.

## Automatically leave behind `rn-mt-bugs.md`

At the start of bug work, or as soon as a defect is discovered, create or
refresh an app-root bug file:

```bash
./.agents/skills/rn-mt-consumer-guide/scripts/init-bug-report.sh "Short bug title"
```

That creates:

```text
rn-mt-bugs.md
```

Update it as you work. Do not wait until the end to write the report.

## What to keep in the bug file

Make sure `rn-mt-bugs.md` covers:

- the bug title
- a one-line summary
- exact repro steps
- expected result
- actual result
- app root
- rn-mt package version
- active tenant and other affected tenants
- platform
- commands you ran
- generated artifacts you inspected
- shared source or tenant overrides you inspected
- logs or error output
- whether the suspected owner is rn-mt, the host app, or unclear
- the fix or workaround
- verification commands and outcome

## Publish issues automatically

For every issue found that appears to be caused by rn-mt itself, publish a
GitHub issue automatically once the report is specific enough to be useful:

```bash
./.agents/skills/rn-mt-consumer-guide/scripts/publish-issue.sh rn-mt-bugs.md "Bug: short title"
```

The script will:

- use `gh issue create` when GitHub CLI is available and authenticated
- create the issue in `kanmi-idris/rn-mt`
- print the created issue URL on success

If several independent rn-mt issues are found, create a separate bug report and
GitHub issue for each one. Do not combine unrelated defects into one issue.

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

## When not to publish

Do not publish a GitHub issue for:

- purely host-app bugs unrelated to rn-mt
- local experiments the user explicitly asked not to track
- already-known issues the user is explicitly fixing in the same session
- docs-only copy tweaks that are not bugs

If ownership is unclear, document that uncertainty in `rn-mt-bugs.md`, gather
the smallest reproduction, and publish the issue if rn-mt remains a plausible
owner.
