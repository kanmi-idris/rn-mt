#!/usr/bin/env bash

set -euo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skill_dir="$(cd "${script_dir}/.." && pwd)"
template_path="${skill_dir}/assets/rn-mt-bugs.template.md"
output_path="${PWD}/rn-mt-bugs.md"
title="${1:-Bug report}"

if [[ ! -f "${template_path}" ]]; then
  echo "Bug report template not found at ${template_path}" >&2
  exit 1
fi

{
  printf '# %s\n' "${title}"
  tail -n +2 "${template_path}"
} > "${output_path}"

echo "Wrote ${output_path}"
