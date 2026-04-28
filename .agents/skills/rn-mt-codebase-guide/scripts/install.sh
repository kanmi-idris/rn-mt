#!/usr/bin/env bash

set -euo pipefail

mode="symlink"
target_root="${HOME}/.agents/skills"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --copy)
      mode="copy"
      shift
      ;;
    --symlink)
      mode="symlink"
      shift
      ;;
    --target)
      target_root="${2:?Missing value for --target}"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      echo "Usage: install.sh [--copy|--symlink] [--target <dir>]" >&2
      exit 1
      ;;
  esac
done

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
skill_dir="$(cd "${script_dir}/.." && pwd)"
target_dir="${target_root}/rn-mt-codebase-guide"

mkdir -p "${target_root}"
rm -rf "${target_dir}"

if [[ "${mode}" == "copy" ]]; then
  cp -R "${skill_dir}" "${target_dir}"
else
  ln -s "${skill_dir}" "${target_dir}"
fi

echo "Installed rn-mt-codebase-guide to ${target_dir}"
echo "Mode: ${mode}"
