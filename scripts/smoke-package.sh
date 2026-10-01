#!/usr/bin/env bash
set -euo pipefail

# [FLOW] PAQUETE INSTALADO
# Comprueba los binarios y las rutas desde una instalación fuera del checkout.
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
test_dir="$(cd "$(mktemp -d)" && pwd -P)"
trap 'rm -rf "$test_dir"' EXIT

candidate="$test_dir/candidate"
target="$test_dir/installations/preview"
project="$test_dir/project"
mkdir -p "$project"
printf '# Smoke de paquete\n' > "$project/README.md"

"$repo_dir/dist/n-ein-install" package --source "$repo_dir" --output "$candidate" > "$test_dir/package.log"
"$candidate/bin/n-ein-install" install --source "$candidate" --target "$target" --channel preview > "$test_dir/install.log"
"$target/bin/n-ein-install" doctor --target "$target" > "$test_dir/doctor.log"
cmp "$candidate/package-manifest.json" "$target/package-manifest.json"
test ! -e "$candidate/docs"
test ! -e "$candidate/node_modules"

"$target/bin/n-ein" --project "$project" --view configuracion --once > "$test_dir/config-view"
rg -q 'openai-codex/gpt-6-sol' "$test_dir/config-view"
rg -q 'openai-codex/gpt-6-luna' "$test_dir/config-view"
rg -q 'preview' "$test_dir/config-view"
N_EIN_HOME="$test_dir" N_EIN_LINK_DIR="$test_dir/local-bin" \
  "$target/bin/n-ein-install" activate --target "$target" --channel preview --dry-run > "$test_dir/activate-plan"
test ! -e "$test_dir/local-bin/nein"
N_EIN_HOME="$test_dir" N_EIN_LINK_DIR="$test_dir/local-bin" \
  "$target/bin/n-ein-install" activate --target "$target" --channel preview > "$test_dir/activate"
N_EIN_HOME="$test_dir" N_EIN_CHANNEL=dev "$test_dir/local-bin/nein" --project "$project" --view configuracion --once > "$test_dir/nein-view"
rg -q 'preview' "$test_dir/nein-view"

cat > "$test_dir/pi" <<'FAKE_PI'
#!/usr/bin/env bash
if [[ "${1:-}" == "--version" ]]; then printf '0.87.1\n'; exit 0; fi
{
  printf 'cwd=%s\n' "$PWD"
  printf 'home=%s\n' "$PI_CODING_AGENT_DIR"
  printf 'arg=%s\n' "$@"
} > "$N_EIN_CAPTURE"
FAKE_PI
chmod +x "$test_dir/pi"
(
  cd "$project"
  N_EIN_PI_BIN="$test_dir/pi" \
  N_EIN_AGENT_DIR="$test_dir/pi-home" \
  N_EIN_CAPTURE="$test_dir/pi-capture" \
    "$target/bin/n-ein-dev" --print 'consulta de prueba'
)
rg -Fxq "cwd=$project" "$test_dir/pi-capture"
rg -Fxq "home=$test_dir/pi-home" "$test_dir/pi-capture"
rg -Fxq "arg=$target/pi-package" "$test_dir/pi-capture"
rg -Fxq 'arg=openai-codex/gpt-6-sol' "$test_dir/pi-capture"
rg -Fxq 'arg=high' "$test_dir/pi-capture"
rg -Fxq 'arg=consulta de prueba' "$test_dir/pi-capture"
codegraph_version="$(bun -e 'console.log((await Bun.file(process.argv[1]).json()).codegraph.version)' "$target/runtime.json")"
printf '#!/bin/sh\nprintf "%s\\n"\n' "$codegraph_version" > "$test_dir/codegraph"
chmod +x "$test_dir/codegraph"
N_EIN_PI_BIN="$test_dir/pi" N_EIN_CODEGRAPH_BIN="$test_dir/codegraph" "$target/bin/n-ein-install" doctor --target "$target" --runtime > "$test_dir/runtime-doctor"
rg -q 'CODEGRAPH · ' "$test_dir/runtime-doctor"
rg -q 'Pi 0.87.1 · Bun disponible · autenticación no comprobada' "$test_dir/runtime-doctor"

printf 'paquete instalado: OK\n'
