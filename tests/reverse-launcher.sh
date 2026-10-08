#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
test_dir="$(mktemp -d)"
trap 'rm -rf "$test_dir"' EXIT
# La versión de Pi la marca runtime.json: el Pi falso la repite para no tocar los tests en cada subida.
export N_EIN_TEST_PI_VERSION="$(bun -e 'console.log((await Bun.file(process.argv[1]).json()).pi.version)' "$repo_dir/runtime.json")"

cat > "$test_dir/claude" <<'FAKE_CLAUDE'
#!/usr/bin/env bash
if [[ "${1:-}" == "--version" ]]; then printf '%s (Claude Code)\n' "${N_EIN_TEST_CLAUDE_VERSION:-2.1.294}"; exit 0; fi
"$N_EIN_ROOT/bin/n-ein-prepare-pi" "Claude confirmó por lectura que parsePort acepta 0; decidir el contrato con Samu."
printf 'claude finished\n' > "$N_EIN_TEST_DONE"
FAKE_CLAUDE
cat > "$test_dir/pi" <<'FAKE_PI'
#!/usr/bin/env bash
if [[ "${1:-}" == "--version" ]]; then printf '%s\n' "$N_EIN_TEST_PI_VERSION"; exit 0; fi
test -f "$N_EIN_TEST_DONE" || exit 1
printf '%s\n' "$PI_CODING_AGENT_DIR" > "$N_EIN_TEST_ENV"
printf '%s\n' "$@" > "$N_EIN_TEST_ARGS"
FAKE_PI
chmod +x "$test_dir/claude" "$test_dir/pi"

git -C "$test_dir" init -b main >/dev/null
git -C "$test_dir" config user.name 'n_ein test'
git -C "$test_dir" config user.email 'test@n-ein.invalid'
printf '# Trabajo\n\n## Objetivo\nRevisar el puerto 0.\n' > "$test_dir/WORK.md"
git -C "$test_dir" add WORK.md
git -C "$test_dir" commit -m 'test: base' >/dev/null

export N_EIN_CLAUDE_DIR="$test_dir/claude-home"
export N_EIN_CLAUDE_BIN="$test_dir/claude"
export N_EIN_AGENT_DIR="$test_dir/pi-home"
export N_EIN_PI_BIN="$test_dir/pi"
export N_EIN_LANG_FILE="$test_dir/lang.json"
export N_EIN_PREFERENCES_FILE="$test_dir/preferences.md"
printf 'Remember the project package manager across runtimes.\n' > "$N_EIN_PREFERENCES_FILE"
printf '#!/bin/sh\nexit 0\n' > "$test_dir/codegraph"
chmod +x "$test_dir/codegraph"
export N_EIN_CODEGRAPH_BIN="$test_dir/codegraph"
export N_EIN_TEST_DONE="$test_dir/claude-done"
export N_EIN_TEST_ENV="$test_dir/pi-env"
export N_EIN_TEST_ARGS="$test_dir/pi-args"

(cd "$test_dir" && "$repo_dir/bin/n-ein-claude-dev") > "$test_dir/output"
test "$(cat "$N_EIN_TEST_ENV")" = "$N_EIN_AGENT_DIR"
rg -q 'Claude confirmó por lectura' "$N_EIN_TEST_ARGS"
rg -q 'WORK.md' "$N_EIN_TEST_ARGS"
rg -q 'Remember the project package manager across runtimes' "$N_EIN_TEST_ARGS"
test -d "$N_EIN_CLAUDE_DIR/handoffs"

printf 'reverse launcher: OK\n'
