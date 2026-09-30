#!/usr/bin/env bash
set -euo pipefail

# [FLOW] CANDIDATO PREVIEW
# Compila para esta máquina, instala en temporal y conserva el paquete con su hash.
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
release_version="${1:-}"
output_dir="${2:-$repo_dir/dist/releases}"
if [[ ! "$release_version" =~ ^[0-9]+\.[0-9]+\.[0-9]+-preview\.[0-9]+$ ]]; then
  printf '[ERR] :: VERSION_BAD :: expected: 0.1.0-preview.1\n' >&2
  exit 64
fi

case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) platform=darwin-arm64 ;;
  Linux-x86_64) platform=linux-amd64 ;;
  *) printf '[ERR] :: PLATFORM_BAD :: native build unsupported\n' >&2; exit 69 ;;
esac
go_bin="$(command -v go || true)"
if [[ -z "$go_bin" ]]; then go_bin="$HOME/.n_ein/dev/toolchain/go1.27.1/go/bin/go"; fi
if [[ ! -x "$go_bin" ]] || ! command -v bun >/dev/null 2>&1 || ! command -v pi >/dev/null 2>&1 || ! command -v rg >/dev/null 2>&1; then
  printf '[ERR] :: BUILD_DEPS :: required: Go 1.27.1, Bun, Pi 0.87.1 and ripgrep\n' >&2
  exit 69
fi

dirty_suffix=""
if [[ -n "$(git -C "$repo_dir" status --porcelain)" ]]; then
  if [[ "${N_EIN_ALLOW_DIRTY:-0}" != 1 ]]; then
    printf '[ERR] :: TREE_DIRTY :: commit and verify changes before packaging\n' >&2
    exit 64
  fi
  dirty_suffix="-dirty"
fi
mkdir -p "$output_dir" "$repo_dir/dist"
output_dir="$(cd "$output_dir" && pwd -P)"
candidate="$output_dir/n-ein-$release_version-$platform$dirty_suffix"
archive="$candidate.tar.gz"
if [[ -e "$candidate" || -e "$archive" ]]; then
  printf '[ERR] :: CANDIDATE_EXISTS :: path: %s\n' "$candidate" >&2
  exit 64
fi

(
  cd "$repo_dir/go"
  GOTOOLCHAIN=local "$go_bin" build -trimpath -o ../dist/n-ein ./cmd/n-ein
  GOTOOLCHAIN=local "$go_bin" build -trimpath -ldflags "-X main.version=$release_version" -o ../dist/n-ein-install ./cmd/n-ein-install
)
"$repo_dir/dist/n-ein-install" package --source "$repo_dir" --output "$candidate"

expected_commit="$(git -C "$repo_dir" rev-parse HEAD)"
if [[ -n "$dirty_suffix" ]]; then expected_commit+="+dirty"; fi
bun -e 'const m = await Bun.file(process.argv[1]).json(); if (m.version !== process.argv[2] || m.commit !== process.argv[3]) process.exit(1)' \
  "$candidate/package-manifest.json" "$release_version" "$expected_commit" || {
  printf '[ERR] :: MANIFEST_BAD :: version or commit mismatch\n' >&2
  exit 69
}

smoke_dir="$(mktemp -d)"
trap 'rm -rf "$smoke_dir"' EXIT
mkdir -p "$smoke_dir/project"
"$candidate/bin/n-ein-install" install --source "$candidate" --target "$smoke_dir/preview" --channel preview > /dev/null
"$smoke_dir/preview/bin/n-ein-install" doctor --target "$smoke_dir/preview" --runtime > /dev/null
"$smoke_dir/preview/bin/n-ein" --project "$smoke_dir/project" --view configuracion --once > "$smoke_dir/launcher"
rg -q "$release_version" "$smoke_dir/preview/install.json"
rg -q 'openai-codex/gpt-6-sol' "$smoke_dir/launcher"

tar -czf "$archive" -C "$output_dir" "$(basename "$candidate")"
mkdir -p "$smoke_dir/extracted"
tar -xzf "$archive" -C "$smoke_dir/extracted"
extracted="$smoke_dir/extracted/$(basename "$candidate")"
"$extracted/bin/n-ein-install" install --source "$extracted" --target "$smoke_dir/from-archive" --channel preview > /dev/null
"$smoke_dir/from-archive/bin/n-ein-install" doctor --target "$smoke_dir/from-archive" > /dev/null
(
  cd "$output_dir"
  shasum -a 256 "$(basename "$archive")" > "$(basename "$archive").sha256"
)
printf '// 000 PREVIEW · %s\n' "$archive"
cat "$archive.sha256"
