#!/usr/bin/env bash
set -euo pipefail

# [FLOW] PAQUETE INSTALADO
# Comprueba los binarios y las rutas desde una instalación fuera del checkout.
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
test_dir="$(cd "$(mktemp -d)" && pwd -P)"
trap 'rm -rf "$test_dir"' EXIT
export N_EIN_HOME="$test_dir"
export N_EIN_MODELS_FILE="$test_dir/models.json"
export N_EIN_LANG_FILE="$test_dir/lang.json"
export N_EIN_PREFERENCES_FILE="$test_dir/preferences.md"

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
# El revisor instalado arranca y resuelve sus imports; sin orden responde con el uso.
test ! -e "$candidate/tests"
previewer_status=0
"$target/bin/n-ein-previewer" > /dev/null 2> "$test_dir/previewer-usage" || previewer_status=$?
test "$previewer_status" -eq 64
rg -q 'n-ein-previewer handoff' "$test_dir/previewer-usage"
# Su servidor arranca desde la instalación y compila la web con lo que el paquete trae.
bun -e '
  const [target] = process.argv.slice(1);
  const { ensureServer } = await import(target + "/previewer/src/open.ts");
  const state = await ensureServer(target);
  const page = await fetch(`http://127.0.0.1:${state.port}/app.js`);
  process.kill(state.pid, "SIGTERM");
  if (!page.ok || !(await page.text()).includes("previewer-token")) throw new Error("web del revisor sin compilar");
' "$target"

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

pi_version="$(bun -e 'console.log((await Bun.file(process.argv[1]).json()).pi.version)' "$target/runtime.json")"
export N_EIN_TEST_PI_VERSION="$pi_version"
cat > "$test_dir/pi" <<'FAKE_PI'
#!/usr/bin/env bash
if [[ "${1:-}" == "--version" ]]; then printf '%s\n' "$N_EIN_TEST_PI_VERSION"; exit 0; fi
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
rg -Fxq 'arg=nein/auto' "$test_dir/pi-capture"
rg -Fxq 'arg=medium' "$test_dir/pi-capture"
rg -Fxq 'arg=consulta de prueba' "$test_dir/pi-capture"
codegraph_version="$(bun -e 'console.log((await Bun.file(process.argv[1]).json()).codegraph.version)' "$target/runtime.json")"
printf '#!/bin/sh\nprintf "%s\\n"\n' "$codegraph_version" > "$test_dir/codegraph"
chmod +x "$test_dir/codegraph"
# El diagnóstico de dependencias reales se comprueba desde un hogar limpio en installer-e2e.sh.
# Este smoke conserva el arranque simulado y la integridad del paquete sin descargar runtimes.
"$target/bin/n-ein-install" doctor --target "$target" > "$test_dir/runtime-doctor"

printf 'paquete instalado: OK\n'
