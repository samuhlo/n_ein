#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "$repo_dir"

if ! command -v bun >/dev/null 2>&1; then
  printf '[ERR] :: CHECK_DEPS :: required: Bun\n' >&2
  exit 69
fi
expected_pi_version="$(bun -e 'const c=await Bun.file(process.argv[1]).json(); console.log(c.pi.version)' "$repo_dir/runtime.json")"
managed_pi="${N_EIN_HOME:-$HOME/.n_ein}/runtimes/pi/$expected_pi_version/bin/pi"
if [[ -z "${N_EIN_PI_BIN:-}" ]]; then
  if [[ -x "$managed_pi" ]]; then export N_EIN_PI_BIN="$managed_pi"
  else export N_EIN_PI_BIN="$(command -v pi || true)"; fi
fi
if [[ ! -x "$N_EIN_PI_BIN" || "$("$N_EIN_PI_BIN" --version)" != "$expected_pi_version" ]]; then
  printf '[ERR] :: CHECK_DEPS :: required: Pi %s\n' "$expected_pi_version" >&2
  exit 69
fi
go_bin="$(command -v go || true)"
if [[ -z "$go_bin" ]]; then go_bin="$HOME/.n_ein/dev/toolchain/go1.27.1/go/bin/go"; fi
if [[ ! -x "$go_bin" ]]; then
  printf '[ERR] :: CHECK_DEPS :: required: Go 1.27.1\n' >&2
  exit 69
fi
bun install --frozen-lockfile
export GOMODCACHE="$HOME/.n_ein/dev/go-cache/mod"
export GOCACHE="$HOME/.n_ein/dev/go-cache/build"
export GOPATH="$HOME/.n_ein/dev/go-cache/path"

bash -n bin/nein bin/nein-setup bin/n-ein-codegraph bin/n-ein-dev bin/n-ein-claude-dev bin/n-ein-prepare-pi scripts/check.sh scripts/smoke-package.sh scripts/build-preview.sh scripts/hotfix-preview.sh scripts/verify-hotfix-branch.sh
tests/launcher.sh
tests/handoff-launcher.sh
tests/reverse-launcher.sh
bash -n install.sh scripts/build-release.sh scripts/installer-e2e.sh
bun run tests/work-doc.ts
bun run tests/models.ts
bun run tests/memory.ts
bun run tests/codegraph.ts
bun run tests/brand.ts
bun run tests/banner.ts
bun run tests/receipts.ts
bun run tests/claude-receipts.ts
bun run tests/tools-view.ts
bun run tests/skills.ts
bun run tests/router.ts
bun run tests/context.ts
bun run tests/bench.ts

(
  cd go
  GOTOOLCHAIN=local "$go_bin" test -count=1 ./...
  GOTOOLCHAIN=local "$go_bin" vet ./...
  mkdir -p ../dist
  GOTOOLCHAIN=local "$go_bin" build -o ../dist/n-ein ./cmd/n-ein
  GOTOOLCHAIN=local "$go_bin" build -o ../dist/n-ein-install ./cmd/n-ein-install
)

bun run tests/ordinary-pi.ts
bun run tests/handoff.ts
bun run tests/agents-rpc.ts
bun run tests/agents-pi.ts
bun run tests/agents-store.ts
bun run tests/agents-manager.ts
bun run tests/agents-read.ts
bun run tests/team-view.ts
bun run tests/team-extension.ts
bun run tests/team-pi.ts
bun run scripts/typecheck-agents.ts
# El plugin de Claude se valida con el motor que lo cargará; sin Claude instalado no hay nada que validar.
if [[ "${N_EIN_REQUIRE_CLAUDE:-0}" == 1 ]] && ! command -v claude >/dev/null 2>&1; then
  printf '[ERR] :: CLAUDE_TEST :: required host missing\n' >&2; exit 69
fi
if command -v claude >/dev/null 2>&1; then
  claude plugin validate pi-package/claude-plugin > /dev/null
  claude plugin test pi-package/claude-plugin
else
  printf '[PEND] :: CLAUDE_TEST :: native plugin tests skipped; host unavailable\n'
fi
scripts/smoke-package.sh

printf 'checks locales: OK\n'
