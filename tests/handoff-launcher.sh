#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
test_dir="$(mktemp -d)"
trap 'rm -rf "$test_dir"' EXIT

cat > "$test_dir/pi" <<'FAKE_PI'
#!/usr/bin/env bash
if [[ "${1:-}" == "--version" ]]; then printf '0.87.1\n'; exit 0; fi
printf 'claude\n%s\n' "$N_EIN_TEST_SUMMARY" > "$N_EIN_HANDOFF_SIGNAL"
printf 'pi finished\n' > "$N_EIN_TEST_DONE"
FAKE_PI
cat > "$test_dir/claude" <<'FAKE_CLAUDE'
#!/usr/bin/env bash
test -f "$N_EIN_TEST_DONE" || exit 1
test ! -L "$CLAUDE_CONFIG_DIR/skills" || exit 1
mkdir -p "$CLAUDE_CONFIG_DIR/skills/synced"
printf 'generated\n' > "$CLAUDE_CONFIG_DIR/skills/synced/sentinel"
printf '%s\n' "$CLAUDE_CONFIG_DIR" "${PI_CODING_AGENT_DIR:-unset}" > "$N_EIN_TEST_ENV"
printf '%s\n' "$@" > "$N_EIN_TEST_ARGS"
FAKE_CLAUDE
chmod +x "$test_dir/pi" "$test_dir/claude"

printf '# Relevo\n\nObjetivo: terminar el arreglo.\n' > "$test_dir/summary.md"
export N_EIN_PI_BIN="$test_dir/pi"
export N_EIN_CLAUDE_BIN="$test_dir/claude"
export N_EIN_AGENT_DIR="$test_dir/pi-home"
export N_EIN_CLAUDE_DIR="$test_dir/claude-home"
export N_EIN_TEST_SUMMARY="$test_dir/summary.md"
export N_EIN_TEST_DONE="$test_dir/pi-done"
export N_EIN_TEST_ENV="$test_dir/claude-env"
export N_EIN_TEST_ARGS="$test_dir/claude-args"
printf '#!/bin/sh\nexit 0\n' > "$test_dir/codegraph with space"
chmod +x "$test_dir/codegraph with space"
export N_EIN_CODEGRAPH_BIN="$test_dir/codegraph with space"
export N_EIN_MODELS_FILE="$test_dir/models.json"
printf '{"schema":1,"agents":{},"claude":{"effort":"xhigh"}}\n' > "$N_EIN_MODELS_FILE"
mkdir -p "$N_EIN_CLAUDE_DIR"
ln -s "$repo_dir/pi-package/skills" "$N_EIN_CLAUDE_DIR/skills"

"$repo_dir/bin/n-ein-dev"
"$repo_dir/bin/n-ein-dev"
test "$(sed -n '1p' "$N_EIN_TEST_ENV")" = "$N_EIN_CLAUDE_DIR"
test "$(sed -n '2p' "$N_EIN_TEST_ENV")" = "unset"
test -d "$N_EIN_CLAUDE_DIR/skills"
test "$(readlink "$N_EIN_CLAUDE_DIR/skills/intent")" = "$repo_dir/pi-package/skills/intent"
test -f "$N_EIN_CLAUDE_DIR/skills/synced/sentinel"
test ! -f "$repo_dir/pi-package/skills/synced/sentinel"
rg -q 'Objetivo: terminar el arreglo' "$N_EIN_TEST_ARGS"
rg -q 'Eres Ein' "$N_EIN_TEST_ARGS"
# CodeGraph llega a Claude por argumentos: MCP para consultar y hook en cada petición.
bun -e '
  const args = (await Bun.file(process.argv[1]).text()).split("\n");
  const bin = process.argv[2];
  const mcp = JSON.parse(args[args.indexOf("--mcp-config") + 1]).mcpServers.codegraph;
  const settings = JSON.parse(args[args.indexOf("--settings") + 1]);
  const hook = settings.hooks.UserPromptSubmit[0].hooks[0].command;
  if (args[args.indexOf("--effort") + 1] !== "xhigh") throw new Error("Claude no recibió el esfuerzo de models.json");
  if (!settings.statusLine.command.endsWith("bin/n-ein-todo\" --statusline")) throw new Error("Claude sin barra de TODO: " + settings.statusLine.command);
  if (mcp.command !== bin || mcp.args.join(" ") !== "serve --mcp" || mcp.env.DO_NOT_TRACK !== "1") throw new Error("MCP de CodeGraph mal declarado");
  if (hook !== JSON.stringify(bin) + " prompt-hook") throw new Error("hook de CodeGraph mal declarado: " + hook);
' "$N_EIN_TEST_ARGS" "$N_EIN_CODEGRAPH_BIN"
if rg -q 'n_ein_worker' "$N_EIN_TEST_ARGS"; then
  printf 'Claude no debe recibir instrucciones de herramientas exclusivas de Pi.\n' >&2
  exit 1
fi

printf 'handoff launcher: OK\n'
