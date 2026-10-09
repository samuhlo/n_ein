#!/usr/bin/env bash
set -euo pipefail

# [FLOW] CANDIDATO PREVIEW
# Compila para esta máquina, instala en temporal y conserva el paquete con su hash.
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
release_version="${1:-}"
output_dir="${2:-$repo_dir/dist/releases}"

case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) platform=darwin-arm64 ;;
  Linux-x86_64) platform=linux-amd64 ;;
  *) printf '[ERR] :: PLATFORM_BAD :: native build unsupported\n' >&2; exit 69 ;;
esac
go_bin="$(command -v go || true)"
if [[ -z "$go_bin" ]]; then go_bin="$HOME/.n_ein/dev/toolchain/go1.27.1/go/bin/go"; fi
if [[ ! -x "$go_bin" ]] || ! command -v bun >/dev/null 2>&1 || ! command -v rg >/dev/null 2>&1; then
  printf '[ERR] :: BUILD_DEPS :: required: Go 1.27.1, Bun and ripgrep\n' >&2
  exit 69
fi
expected_pi_version="$(bun -e 'const c=await Bun.file(process.argv[1]).json(); console.log(c.pi.version)' "$repo_dir/runtime.json")"
managed_pi="${N_EIN_HOME:-$HOME/.n_ein}/runtimes/pi/$expected_pi_version/bin/pi"
if [[ -z "${N_EIN_PI_BIN:-}" ]]; then
  if [[ -x "$managed_pi" ]]; then export N_EIN_PI_BIN="$managed_pi"
  else export N_EIN_PI_BIN="$(command -v pi || true)"; fi
fi
if [[ ! -x "$N_EIN_PI_BIN" || "$("$N_EIN_PI_BIN" --version)" != "$expected_pi_version" ]]; then
  printf '[ERR] :: BUILD_DEPS :: required: Pi %s\n' "$expected_pi_version" >&2
  exit 69
fi
# BLINDAJE -> El candidato se verifica con el CodeGraph fijado; el del sistema puede ser otra versión.
expected_codegraph_version="$(bun -e 'const c=await Bun.file(process.argv[1]).json(); console.log(c.codegraph.version)' "$repo_dir/runtime.json")"
export N_EIN_CODEGRAPH_BIN="${N_EIN_CODEGRAPH_BIN:-${N_EIN_HOME:-$HOME/.n_ein}/runtimes/codegraph/$expected_codegraph_version/bin/codegraph}"
if [[ ! -x "$N_EIN_CODEGRAPH_BIN" || "$(DO_NOT_TRACK=1 "$N_EIN_CODEGRAPH_BIN" --version)" != "$expected_codegraph_version" ]]; then
  printf '[ERR] :: BUILD_DEPS :: required: CodeGraph %s | fix: n-ein-install runtime --source %s\n' "$expected_codegraph_version" "$repo_dir" >&2
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
candidate_created=0
finished=0
smoke_dir=""
cleanup_preview_build() {
  if [[ -n "$smoke_dir" ]]; then rm -rf "$smoke_dir"; fi
  if [[ "$candidate_created" == 1 && "$finished" != 1 ]]; then
    rm -rf "$candidate"
    rm -f "$archive" "$archive.sha256"
  fi
}
trap cleanup_preview_build EXIT

(
  cd "$repo_dir/go"
  GOTOOLCHAIN=local "$go_bin" build -trimpath -o ../dist/n-ein ./cmd/n-ein
  GOTOOLCHAIN=local "$go_bin" build -trimpath -ldflags "-X main.version=$release_version" -o ../dist/n-ein-install ./cmd/n-ein-install
)
release_channel="$("$repo_dir/dist/n-ein-install" version "$release_version")"
"$repo_dir/dist/n-ein-install" package --source "$repo_dir" --output "$candidate"
candidate_created=1

expected_commit="$(git -C "$repo_dir" rev-parse HEAD)"
if [[ -n "$dirty_suffix" ]]; then expected_commit+="+dirty"; fi
bun -e 'const m = await Bun.file(process.argv[1]).json(); if (m.version !== process.argv[2] || m.commit !== process.argv[3]) process.exit(1)' \
  "$candidate/package-manifest.json" "$release_version" "$expected_commit" || {
  printf '[ERR] :: MANIFEST_BAD :: version or commit mismatch\n' >&2
  exit 69
}

smoke_dir="$(mktemp -d)"
export N_EIN_MODELS_FILE="$smoke_dir/models.json"
export N_EIN_LANG_FILE="$smoke_dir/lang.json"
export N_EIN_PREFERENCES_FILE="$smoke_dir/preferences.md"
mkdir -p "$smoke_dir/project"
"$candidate/bin/n-ein-install" install --source "$candidate" --target "$smoke_dir/preview" --channel "$release_channel" > /dev/null
"$smoke_dir/preview/bin/n-ein-install" doctor --target "$smoke_dir/preview" --runtime > /dev/null
"$smoke_dir/preview/bin/n-ein" --project "$smoke_dir/project" --view configuracion --once > "$smoke_dir/launcher"
rg -Fq "$release_version" "$smoke_dir/preview/install.json"
rg -q 'openai-codex/gpt-6-sol' "$smoke_dir/launcher"

COPYFILE_DISABLE=1 tar -czf "$archive" -C "$output_dir" "$(basename "$candidate")"
mkdir -p "$smoke_dir/extracted"
tar -xzf "$archive" -C "$smoke_dir/extracted"
extracted="$smoke_dir/extracted/$(basename "$candidate")"
"$extracted/bin/n-ein-install" install --source "$extracted" --target "$smoke_dir/from-archive" --channel "$release_channel" > /dev/null
"$smoke_dir/from-archive/bin/n-ein-install" doctor --target "$smoke_dir/from-archive" > /dev/null
(
  cd "$output_dir"
  shasum -a 256 "$(basename "$archive")" > "$(basename "$archive").sha256"
)
# El bootstrap usa el mismo instalador del paquete ya comprobado.
installer_asset="n-ein-install-$release_version-$platform"
cp "$candidate/bin/n-ein-install" "$output_dir/$installer_asset"
(cd "$output_dir" && shasum -a 256 "$installer_asset" > "$installer_asset.sha256")
sed "s/^bootstrap_tag=.*/bootstrap_tag=\"v$release_version\"/" "$repo_dir/install.sh" > "$output_dir/install.sh"
printf '// 000 PREVIEW · %s\n' "$archive"
cat "$archive.sha256"
finished=1
