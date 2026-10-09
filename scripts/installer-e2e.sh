#!/usr/bin/env bash
set -euo pipefail
# [CHECK] Contrato público completo desde los bytes candidatos, sin modelos ni login.
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
assets="$(cd "${1:?directorio de assets}" && pwd -P)"
version="${2:?versión candidata}"
channel=stable
[[ "$version" != *-* ]] || channel=preview
area="$(mktemp -d)"
server_pid=""
cleanup() { [[ -z "$server_pid" ]] || { kill "$server_pid" 2>/dev/null || true; wait "$server_pid" 2>/dev/null || true; }; rm -rf "$area"; }
trap cleanup EXIT
python3 "$repo_dir/tests/installer-server.py" "$assets" "$version" "$area/port" &
server_pid=$!
for ((attempt=0; attempt<100; attempt++)); do [[ ! -s "$area/port" ]] || break; sleep 0.1; done
[[ -s "$area/port" ]]
base="http://127.0.0.1:$(cat "$area/port")"
export N_EIN_BOOTSTRAP_BASE_URL="$base" N_EIN_RELEASE_API="$base"
export N_EIN_HOME="$area/home with spaces" N_EIN_LINK_DIR="$area/links"
unset N_EIN_PI_BIN N_EIN_CODEGRAPH_BIN N_EIN_BUN_BIN N_EIN_MODELS_FILE N_EIN_AGENT_DIR N_EIN_LANG_FILE N_EIN_PREFERENCES_FILE
original_path="$PATH"
# No se dejan Node ni Bun globales disponibles para esconder dependencias ausentes.
mkdir "$area/path"
for tool in bash curl uname mktemp rm chmod shasum sha256sum env dirname readlink git rg mkdir cat tar gzip cp cmp sed grep head; do
  resolved="$(command -v "$tool" || true)"
  [[ -z "$resolved" || "$resolved" != /* ]] || ln -s "$resolved" "$area/path/$tool"
done
export PATH="$area/path"
if command -v node >/dev/null || command -v bun >/dev/null; then echo 'el fixture no está limpio' >&2; exit 1; fi
curl -fsS "$base/install.sh" | bash -s -- --channel "$channel" --dry-run
[[ ! -e "$N_EIN_HOME" ]]
curl -fsS "$base/install.sh" | bash -s -- --channel "$channel"
installer="$N_EIN_HOME/installations/$channel/bin/n-ein-install"
"$installer" doctor --runtime
"$N_EIN_LINK_DIR/nein" --project "$area" --view configuracion --once > "$area/launcher"
grep -q 'nein/auto' "$area/launcher"
# El host instalado carga el paquete con un proveedor determinista y hogares sin credenciales.
export PATH="$("$installer" runtime-path --source "$N_EIN_HOME/installations/$channel")"
(cd "$area" && "$N_EIN_HOME/installations/$channel/bin/n-ein-dev" --mode json --print --session-dir "$area/pi-session" -e "$repo_dir/tests/fixtures/ordinary-provider.ts" --provider nein-test --model cheap 'Report your model and tools') > "$area/pi.jsonl"
grep -q '"role":"assistant"' "$area/pi.jsonl"
grep -q 'codegraph_explore' "$area/pi.jsonl"
printf 'preserve me\n' > "$N_EIN_HOME/$channel/personal-marker"
curl -fsS "$base/install.sh" | bash -s -- --version "$version"
[[ ! -d "$N_EIN_HOME/installations/$channel.backups" ]]
# También se ejercita CodeGraph: ejecutar --version no prueba el binario de indexación.
mkdir "$area/project"
git -C "$area/project" init -q
printf 'export function alphaSmoke() { return 42; }\n' > "$area/project/example.ts"
DO_NOT_TRACK=1 "$N_EIN_HOME/runtimes/codegraph/1.6.1/bin/codegraph" init --yes "$area/project" > "$area/index.log" 2>&1
(cd "$area/project" && DO_NOT_TRACK=1 "$N_EIN_HOME/runtimes/codegraph/1.6.1/bin/codegraph" explore alphaSmoke --max-files 1) > "$area/explore.log"
grep -q 'alphaSmoke' "$area/explore.log"
# Actualizar desde la última preview publicada con los mismos datos de usuario.
export PATH="$("$installer" runtime-path --source "$N_EIN_HOME/installations/$channel"):$original_path"
case "$(uname -s)-$(uname -m)" in Darwin-arm64) platform=darwin-arm64 ;; Linux-x86_64) platform=linux-amd64 ;; esac
old="n-ein-0.1.0-preview.3-$platform"
curl -fsSL --retry 2 --connect-timeout 15 --max-time 180 "https://github.com/samuhlo/n_ein/releases/download/v0.1.0-preview.3/$old.tar.gz" -o "$area/old.tar.gz"
curl -fsSL --retry 2 --connect-timeout 15 --max-time 30 "https://github.com/samuhlo/n_ein/releases/download/v0.1.0-preview.3/$old.tar.gz.sha256" -o "$area/old.sha256"
expected="$(cut -d ' ' -f 1 "$area/old.sha256")"
actual="$(shasum -a 256 "$area/old.tar.gz")"
[[ "${actual%% *}" == "$expected" ]]
tar -xzf "$area/old.tar.gz" -C "$area"
"$area/$old/bin/n-ein-install" update --source "$area/$old" --channel "$channel"
curl -fsS "$base/install.sh" | bash -s -- --channel "$channel"
"$installer" doctor --runtime
grep -q 'preserve me' "$N_EIN_HOME/$channel/personal-marker"
"$installer" restore --channel "$channel"
"$installer" doctor --channel "$channel" | grep -q '0.1.0-preview.3'
"$N_EIN_LINK_DIR/nein" --project "$area" --view configuracion --once > /dev/null
curl -fsS "$base/install.sh" | bash -s -- --channel "$channel"
"$installer" uninstall --channel "$channel"
grep -q 'preserve me' "$N_EIN_HOME/$channel/personal-marker"
printf 'installer E2E: clean curl install, repeat, Pi, CodeGraph, upgrade, restore and data preservation: OK\n'
