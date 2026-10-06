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
bun run tests/work-doc.ts
bun run tests/handoff.ts
bun run tests/models.ts
bun run tests/memory.ts
bun run tests/codegraph.ts
bun run tests/brand.ts
bun run tests/banner.ts
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

scripts/smoke-package.sh

printf 'checks locales: OK\n'
