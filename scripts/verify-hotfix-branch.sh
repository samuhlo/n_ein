#!/usr/bin/env bash
set -euo pipefail

# [FLOW] RELEASE DE MANTENIMIENTO
# Un tag .hotfix.N debe proceder de la preview publicada, no del tip de main.
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
tag="${1:-}"
if [[ "$tag" =~ ^v([0-9]+\.[0-9]+\.[0-9]+-preview\.[0-9]+)\.hotfix\.([0-9]+)$ ]]; then
  base="v${BASH_REMATCH[1]}"
else
  printf '[ERR] :: HOTFIX_TAG :: expected: v0.1.0-preview.1.hotfix.1\n' >&2
  exit 64
fi
if [[ -n "$(git -C "$repo_dir" status --porcelain)" ]]; then
  printf '[ERR] :: TREE_DIRTY :: commit before building a branch release\n' >&2
  exit 64
fi
if ! git -C "$repo_dir" rev-parse -q --verify "$base^{commit}" > /dev/null; then
  printf '[ERR] :: BASE_MISSING :: tag: %s\n' "$base" >&2
  exit 69
fi
base_commit="$(git -C "$repo_dir" rev-parse "$base^{commit}")"
head_commit="$(git -C "$repo_dir" rev-parse HEAD)"
if ! git -C "$repo_dir" merge-base --is-ancestor "$base_commit" "$head_commit"; then
  printf '[ERR] :: BASE_NOT_ANCESTOR :: tag: %s\n' "$base" >&2
  exit 64
fi
if [[ "$(git -C "$repo_dir" merge-base "$head_commit" origin/main)" != "$base_commit" ]]; then
  printf '[ERR] :: BRANCH_BASE :: hotfix must diverge from %s, not current main\n' "$base" >&2
  exit 64
fi
branch="$(git -C "$repo_dir" branch --show-current)"
if [[ "$branch" != hotfix/* ]] \
  && ! git -C "$repo_dir" branch -r --contains "$head_commit" | rg -q '^  origin/hotfix/'; then
  printf '[ERR] :: HOTFIX_BRANCH :: HEAD must belong to hotfix/*\n' >&2
  exit 64
fi
if git -C "$repo_dir" diff --quiet "$base_commit" "$head_commit" -- brand.json runtime.json bin pi-package go; then
  printf '[ERR] :: HOTFIX_EMPTY :: no runtime change since %s\n' "$base" >&2
  exit 64
fi
printf '// 000 HOTFIX BRANCH · base: %s | commit: %s\n' "$base" "$head_commit"
