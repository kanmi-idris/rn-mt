#!/usr/bin/env bash

set -euo pipefail

repo="${RN_MT_GITHUB_REPO:-kanmi-idris/rn-mt}"
bug_file="${1:-rn-mt-bugs.md}"
title="${2:-}"
issue_url="https://github.com/${repo}/issues/new"

if [[ ! -f "${bug_file}" ]]; then
  echo "Bug file not found: ${bug_file}" >&2
  echo "Create or update rn-mt-bugs.md first." >&2
  exit 1
fi

if [[ -z "${title}" ]]; then
  title="$(sed -n 's/^# //p' "${bug_file}" | head -n 1)"
fi

if [[ -z "${title}" ]]; then
  title="Bug report"
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI is not installed." >&2
  echo "Create the issue manually: ${issue_url}" >&2
  exit 2
fi

if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub CLI is not authenticated for issue creation." >&2
  echo "Create the issue manually: ${issue_url}" >&2
  exit 3
fi

if gh issue create --repo "${repo}" --title "${title}" --body-file "${bug_file}"; then
  exit 0
fi

echo "Issue creation failed. Create the issue manually: ${issue_url}" >&2
exit 4
