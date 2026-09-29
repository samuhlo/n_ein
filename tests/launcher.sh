#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
test_dir="$(mktemp -d)"
trap 'rm -rf "$test_dir"' EXIT

cat > "$test_dir/pi" <<'FAKE_PI'
#!/usr/bin/env bash
if [[ "${1:-}" == "--version" ]]; then
  printf '%s\n' "${N_EIN_FAKE_VERSION:-0.87.1}"
  exit 0
fi
{
  printf '%s\n' "$PI_CODING_AGENT_DIR" "$PI_CODING_AGENT_SESSION_DIR" "$PWD"
  printf '%s\n' "$@"
} > "$N_EIN_CAPTURE"
FAKE_PI
chmod +x "$test_dir/pi"

export N_EIN_PI_BIN="$test_dir/pi"
export N_EIN_AGENT_DIR="$test_dir/home with spaces"
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
--use-theme
ein
--model
openai-codex/gpt-6-sol
--thinking
high
--print
cambia este texto
EOF
diff -u "$test_dir/expected" "$N_EIN_CAPTURE"

export N_EIN_FAKE_VERSION=0.88.0
if "$repo_dir/bin/n-ein-dev" > "$test_dir/out" 2> "$test_dir/err"; then
  printf 'Versiones incompatibles deben fallar.\n' >&2
  exit 1
fi
rg -q 'PI_VERSION :: expected: 0.87.1' "$test_dir/err"

unset N_EIN_FAKE_VERSION
export N_EIN_AGENT_DIR="$HOME/.pi-ein/agent"
if "$repo_dir/bin/n-ein-dev" > "$test_dir/out" 2> "$test_dir/err"; then
  printf 'El hogar de Ein legado debe rechazarse.\n' >&2
  exit 1
fi
rg -q 'HOME_INVALID' "$test_dir/err"

printf 'launcher: OK\n'
