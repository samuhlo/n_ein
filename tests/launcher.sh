#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
test_dir="$(mktemp -d)"
trap 'rm -rf "$test_dir"' EXIT
# La versión de Pi la marca runtime.json: el Pi falso la repite para no tocar los tests en cada subida.
# El modelo principal por defecto también sale de runtime.json (desde el 5 de octubre, nein/auto).
export N_EIN_TEST_PI_MODEL="$(bun -e 'console.log((await Bun.file(process.argv[1]).json()).pi.model)' "$repo_dir/runtime.json")"
export N_EIN_TEST_PI_THINKING="$(bun -e 'console.log((await Bun.file(process.argv[1]).json()).pi.thinking)' "$repo_dir/runtime.json")"
export N_EIN_TEST_PI_VERSION="$(bun -e 'console.log((await Bun.file(process.argv[1]).json()).pi.version)' "$repo_dir/runtime.json")"

cat > "$test_dir/pi" <<'FAKE_PI'
#!/usr/bin/env bash
if [[ "${1:-}" == "--version" ]]; then
  printf '%s\n' "${N_EIN_FAKE_VERSION:-$N_EIN_TEST_PI_VERSION}"
  exit 0
fi
{
  printf '%s\n' "$PI_CODING_AGENT_DIR" "$PI_CODING_AGENT_SESSION_DIR" "$PWD"
  printf '%s\n' "$@"
} > "$N_EIN_CAPTURE"
printf '%s\n' "${N_EIN_CODEGRAPH_BIN:-}" > "$N_EIN_CAPTURE.codegraph"
FAKE_PI
chmod +x "$test_dir/pi"

# CodeGraph falso: registra cada orden y crea .codegraph/ en init, como el real.
cat > "$test_dir/codegraph" <<'FAKE_CODEGRAPH'
#!/usr/bin/env bash
printf '%s\n' "$*" >> "$N_EIN_CODEGRAPH_LOG"
case "$1" in
  --version) printf '1.6.1\n' ;;
  status) if [[ -d "$3/.codegraph" ]]; then printf '{"initialized":true,"index":{"reindexRecommended":false}}\n'; else printf '{"initialized":false}\n'; fi ;;
  init) mkdir -p "$3/.codegraph" ;;
esac
FAKE_CODEGRAPH
chmod +x "$test_dir/codegraph"
export N_EIN_CODEGRAPH_BIN="$test_dir/codegraph"
export N_EIN_CODEGRAPH_LOG="$test_dir/codegraph.log"

export N_EIN_PI_BIN="$test_dir/pi"
export N_EIN_AGENT_DIR="$test_dir/home with spaces"
export N_EIN_MODELS_FILE="$test_dir/models.json"
export N_EIN_LANG_FILE="$test_dir/lang.json"
export N_EIN_CAPTURE="$test_dir/captured"
mkdir -p "$test_dir/project"
cd "$test_dir/project"
"$repo_dir/bin/n-ein-dev" --print 'cambia este texto'

cat > "$test_dir/expected" <<EOF
$N_EIN_AGENT_DIR
$N_EIN_AGENT_DIR/sessions
$test_dir/project
--no-extensions
--no-skills
--no-prompt-templates
--no-themes
-e
$repo_dir/pi-package
--append-system-prompt
$repo_dir/pi-package/persona.md
--append-system-prompt
$repo_dir/pi-package/pi-only.md
--append-system-prompt
$repo_dir/pi-package/flow.md
--append-system-prompt
Language: talk with the user in Spanish. Write code, comments, identifiers, commit messages, PRs, WORK.md and repository docs in the language the project already uses; in a project with no convention yet, use Spanish.
--use-theme
ein
--model
$N_EIN_TEST_PI_MODEL
--thinking
$N_EIN_TEST_PI_THINKING
--print
cambia este texto
EOF
diff -u "$test_dir/expected" "$N_EIN_CAPTURE"

cat > "$N_EIN_MODELS_FILE" <<'MODELS'
{"schema":1,"agents":{"principal":{"model":"openai-codex/gpt-6-luna","thinking":"medium"}}}
MODELS
"$repo_dir/bin/n-ein-dev" --print 'modelo elegido'
rg -Fxq 'openai-codex/gpt-6-luna' "$N_EIN_CAPTURE"
rg -Fxq 'medium' "$N_EIN_CAPTURE"

printf '%s\n' '{"schema":1,"agents":{"principal":{"model":"bad model","thinking":"high"}}}' > "$N_EIN_MODELS_FILE"
rm -f "$N_EIN_CAPTURE"
if "$repo_dir/bin/n-ein-dev" --print 'no ejecutar' > "$test_dir/out" 2> "$test_dir/err"; then
  printf 'Una selección inválida no debe arrancar Pi.\n' >&2
  exit 1
fi
rg -q 'MODELS_BAD' "$test_dir/err"
test ! -e "$N_EIN_CAPTURE"
rm -f "$N_EIN_MODELS_FILE"

# El idioma del launcher llega a Pi como instrucción; uno ilegible no arranca Pi con un idioma inventado.
printf '{"chat":"en","artifacts":"es"}\n' > "$N_EIN_LANG_FILE"
"$repo_dir/bin/n-ein-dev" --print 'idioma'
rg -Fxq 'Language: talk with the user in English. Write code comments, commit messages, PRs, WORK.md and repository docs in Spanish, whatever the conversation language.' "$N_EIN_CAPTURE"
printf '{"chat":"fr","artifacts":"es"}\n' > "$N_EIN_LANG_FILE"
rm -f "$N_EIN_CAPTURE"
if "$repo_dir/bin/n-ein-dev" --print 'no' 2> "$test_dir/err"; then printf 'Un lang.json inválido no debe arrancar Pi.\n' >&2; exit 1; fi
rg -q 'LANG_BAD' "$test_dir/err"
test ! -e "$N_EIN_CAPTURE"
rm -f "$N_EIN_LANG_FILE"

export N_EIN_FAKE_VERSION=0.88.0
if "$repo_dir/bin/n-ein-dev" > "$test_dir/out" 2> "$test_dir/err"; then
  printf 'Versiones incompatibles deben fallar.\n' >&2
  exit 1
fi
rg -q "PI_VERSION :: expected: $N_EIN_TEST_PI_VERSION" "$test_dir/err"

unset N_EIN_FAKE_VERSION
export N_EIN_AGENT_DIR="$HOME/.pi-ein/agent"
if "$repo_dir/bin/n-ein-dev" > "$test_dir/out" 2> "$test_dir/err"; then
  printf 'El hogar de Ein legado debe rechazarse.\n' >&2
  exit 1
fi
rg -q 'HOME_INVALID' "$test_dir/err"

# [FLOW] El índice se crea en la primera apertura y se sincroniza en la siguiente.
unset N_EIN_AGENT_DIR
export N_EIN_AGENT_DIR="$test_dir/agent"
git init -q "$test_dir/repo"
cd "$test_dir/repo"
rm -f "$N_EIN_CODEGRAPH_LOG"
N_EIN_CODEGRAPH_ALLOW_TEMP=1 "$repo_dir/bin/n-ein-dev" --print 'primera' 2> "$test_dir/err"
rg -q '^init --yes ' "$N_EIN_CODEGRAPH_LOG"
rg -q 'CODEGRAPH · creando índice' "$test_dir/err"
test "$(< "$N_EIN_CAPTURE.codegraph")" == "$N_EIN_CODEGRAPH_BIN"
N_EIN_CODEGRAPH_ALLOW_TEMP=1 "$repo_dir/bin/n-ein-dev" --print 'segunda'
rg -q '^sync --quiet ' "$N_EIN_CODEGRAPH_LOG"
# Sin permiso explícito, un temporal no se indexa, pero Pi arranca igual.
"$repo_dir/bin/n-ein-dev" --print 'temporal' 2> "$test_dir/err"
rg -q 'CODEGRAPH_SKIP :: reason: no se indexan temporales' "$test_dir/err"
rg -Fxq 'temporal' "$N_EIN_CAPTURE"

printf 'launcher: OK\n'
