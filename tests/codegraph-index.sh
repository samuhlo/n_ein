#!/usr/bin/env bash
set -euo pipefail

# [FLOW] El índice de CodeGraph no entra en Git: CodeGraph deja `.codegraph/.gitignore` sin seguimiento
# y acababa colándose en los commits del trabajo. El lanzador lo excluye en el exclude local del repositorio.
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
test_dir="$(mktemp -d)"
trap 'rm -rf "$test_dir"' EXIT

# Imita lo que crea el CodeGraph real al inicializar: su .gitignore interno y la base de datos.
cat > "$test_dir/codegraph" <<'FAKE_CODEGRAPH'
#!/usr/bin/env bash
case "$1" in
  status) printf '{"initialized":false}\n' ;;
  init) mkdir -p "$3/.codegraph"; printf '*\n!.gitignore\n' > "$3/.codegraph/.gitignore"; printf 'db' > "$3/.codegraph/codegraph.db" ;;
esac
FAKE_CODEGRAPH
chmod +x "$test_dir/codegraph"
export N_EIN_CODEGRAPH_BIN="$test_dir/codegraph"
export N_EIN_CODEGRAPH_ALLOW_TEMP=1

new_repo() {
  git init -q -b main "$1"
  git -C "$1" config user.name 'n_ein test'
  git -C "$1" config user.email 'test@n-ein.invalid'
  printf 'base\n' > "$1/README.md"
  git -C "$1" add README.md
  git -C "$1" commit -qm 'test: base'
}
index() { (cd "$1" && "$repo_dir/bin/n-ein-codegraph" 2>/dev/null); }
entries() { grep -cx '.codegraph/' "$(git -C "$1" rev-parse --path-format=absolute --git-path info/exclude)" || true; }

# [CORE] Tras crear el índice, el árbol sigue limpio y el exclude lleva una sola entrada aunque se abra dos veces.
new_repo "$test_dir/plain"
index "$test_dir/plain"
test -f "$test_dir/plain/.codegraph/.gitignore"
status="$(git -C "$test_dir/plain" status --porcelain)"
[[ -z "$status" ]] || { printf 'El índice aparece en git status:\n%s\n' "$status" >&2; exit 1; }
index "$test_dir/plain"
[[ "$(entries "$test_dir/plain")" == 1 ]] || { printf 'El exclude repite la entrada.\n' >&2; exit 1; }
git -C "$test_dir/plain" diff --quiet HEAD -- || { printf 'Se tocaron archivos con seguimiento.\n' >&2; exit 1; }

# Un proyecto que ya ignora el índice en su .gitignore no recibe nada en el exclude.
new_repo "$test_dir/ignored"
printf '.codegraph/\n' > "$test_dir/ignored/.gitignore"
git -C "$test_dir/ignored" add .gitignore
git -C "$test_dir/ignored" commit -qm 'chore: ignore codegraph'
index "$test_dir/ignored"
[[ "$(entries "$test_dir/ignored")" == 0 ]] || { printf 'Se añadió una entrada innecesaria.\n' >&2; exit 1; }

# Un exclude previo sin salto final conserva su última regla entera.
new_repo "$test_dir/previous"
printf '*.log' > "$test_dir/previous/.git/info/exclude"
index "$test_dir/previous"
[[ "$(cat "$test_dir/previous/.git/info/exclude")" == $'*.log\n.codegraph/' ]] || { printf 'El exclude previo quedó pegado a la entrada nueva.\n' >&2; exit 1; }

# Un worktree enlazado comparte el exclude del repositorio común.
git -C "$test_dir/plain" worktree add -q -b feat/otra "$test_dir/tree"
index "$test_dir/tree"
status="$(git -C "$test_dir/tree" status --porcelain)"
[[ -z "$status" ]] || { printf 'El índice aparece en el worktree:\n%s\n' "$status" >&2; exit 1; }
[[ "$(entries "$test_dir/tree")" == 1 ]] || { printf 'El worktree no comparte el exclude común.\n' >&2; exit 1; }

printf 'codegraph index: OK\n'
