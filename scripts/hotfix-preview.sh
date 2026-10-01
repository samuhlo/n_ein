#!/usr/bin/env bash
set -euo pipefail

# [FLOW] HOTFIX DE PREVIEW
# Reutiliza package/update/restore; el paquete publicado queda intacto.
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
mode="${1:-apply}"
case "$mode" in apply|plan|rollback) ;; *) printf '[ERR] :: HOTFIX_MODE :: use: plan, apply, rollback\n' >&2; exit 64 ;; esac
target="${N_EIN_HOTFIX_TARGET:-$HOME/.n_ein/installations/preview}"
hotfix_dir="${N_EIN_HOTFIX_DIR:-$HOME/.n_ein/preview/hotfixes}"
if ! command -v bun >/dev/null 2>&1; then
  printf '[ERR] :: BUN_MISSING :: hotfix requires Bun\n' >&2
  exit 69
fi

if [[ ! -f "$target/install.json" || ! -f "$target/.n-ein-channel" ]]; then
  printf '[ERR] :: PREVIEW_MISSING :: target: %s\n' "$target" >&2
  exit 69
fi
if [[ "$(< "$target/.n-ein-channel")" != preview ]]; then
  printf '[ERR] :: CHANNEL_BAD :: target: %s\n' "$target" >&2
  exit 64
fi

installer="$target/bin/n-ein-install"
if [[ "$mode" == rollback ]]; then
  if [[ ! -x "$installer" ]]; then installer="$repo_dir/dist/n-ein-install"; fi
  if [[ ! -x "$installer" ]]; then
    printf '[ERR] :: INSTALLER_MISSING :: build dist/n-ein-install to restore\n' >&2
    exit 69
  fi
  "$installer" restore --target "$target"
  "$target/bin/n-ein-install" doctor --target "$target" --runtime
  exit 0
fi

read -r installed_version installed_commit < <(bun -e 'const m=await Bun.file(process.argv[1]).json(); console.log(`${m.version}\t${m.commit}`)' "$target/package-manifest.json") || {
  printf '[ERR] :: PREVIEW_BAD :: package manifest unavailable\n' >&2
  exit 69
}
base_version="${installed_version%%+hotfix.*}"
if [[ ! "$base_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+-preview\.[0-9]+$ ]]; then
  printf '[ERR] :: PREVIEW_BAD :: version: %s\n' "$installed_version" >&2
  exit 64
fi
commit="$(git -C "$repo_dir" rev-parse HEAD)"
dirty_suffix=""
expected_commit="$commit"
if [[ -n "$(git -C "$repo_dir" status --porcelain)" ]]; then
  if [[ "${N_EIN_ALLOW_DIRTY:-0}" != 1 ]]; then
    printf '[ERR] :: TREE_DIRTY :: confirma el cambio con un commit antes del hotfix\n' >&2
    exit 64
  fi
  dirty_suffix="-dirty"
  expected_commit+="+dirty"
fi
if [[ "$installed_commit" == "$expected_commit" ]]; then
  printf '// 000 HOTFIX · ya instalado · commit: %s\n' "$commit"
  exit 0
fi
short_commit="${commit:0:12}"
version="$base_version+hotfix.$short_commit"
case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) platform=darwin-arm64 ;;
  Linux-x86_64) platform=linux-amd64 ;;
  *) printf '[ERR] :: PLATFORM_BAD :: hotfix nativo no soportado\n' >&2; exit 69 ;;
esac
mkdir -p "$hotfix_dir"
hotfix_dir="$(cd "$hotfix_dir" && pwd -P)"
candidate="$hotfix_dir/n-ein-$version-$platform$dirty_suffix"
if [[ -d "$candidate" ]]; then
  if [[ ! -f "$candidate.tar.gz" || ! -f "$candidate.tar.gz.sha256" ]]; then
    printf '[ERR] :: HOTFIX_INCOMPLETE :: candidate: %s\n' "$candidate" >&2
    exit 69
  fi
  (cd "$hotfix_dir" && shasum -a 256 -c "$(basename "$candidate").tar.gz.sha256")
else
  "$repo_dir/scripts/check.sh"
  "$repo_dir/scripts/build-preview.sh" "$version" "$hotfix_dir"
fi
bun -e 'const m=await Bun.file(process.argv[1]).json(); if(m.version!==process.argv[2]||m.commit!==process.argv[3]) process.exit(1)' \
  "$candidate/package-manifest.json" "$version" "$expected_commit" || {
  printf '[ERR] :: HOTFIX_MANIFEST :: version or commit mismatch\n' >&2
  exit 69
}
"$candidate/bin/n-ein-install" update --source "$candidate" --target "$target" --channel preview --dry-run
if [[ "$mode" == plan ]]; then
  printf '// 000 HOTFIX · candidato preparado · %s\n' "$candidate"
  exit 0
fi

"$candidate/bin/n-ein-install" update --source "$candidate" --target "$target" --channel preview
if ! "$target/bin/n-ein-install" doctor --target "$target" --runtime; then
  printf '[ERR] :: HOTFIX_VERIFY :: restaurando backup anterior\n' >&2
  "$candidate/bin/n-ein-install" restore --target "$target"
  "$target/bin/n-ein-install" doctor --target "$target" --runtime
  exit 69
fi
printf '// 000 HOTFIX · aplicado · version: %s | commit: %s\n' "$version" "$commit"
