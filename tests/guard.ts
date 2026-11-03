import { strict as assert } from "node:assert";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import { dangerous } from "../pi-package/extensions/guard-core.ts";

const cwd = "/repo/app";
const scratch = [tmpdir(), "/tmp"];
const check = (command: string) => dangerous(command, { cwd, scratch, home: homedir() });
const asks = (command: string, kind: string) => {
  const found = check(command);
  assert.ok(found, `debería pedir confirmación: ${command}`);
  assert.equal(found.kind, kind, command);
  assert.ok(found.reason.length > 0 && found.label.length > 0, command);
};
const passes = (command: string) => assert.equal(check(command), undefined, `no debería parar: ${command}`);

// Historia publicada y ramas.
asks("git push --force origin main", "git");
asks("git push -f", "git");
asks("git push -uf origin feat", "git");
asks("git push --force-with-lease origin feat", "git");
asks("git push origin +feat", "git");
asks("git push origin --delete feat", "git");
asks("git push origin :feat", "git");
asks("git -C ../otro push --force", "git");
asks("git reset --hard HEAD~1", "git");
asks("git clean -fd", "git");
asks("git clean --force -x", "git");
asks("git branch -D vieja", "git");
asks("git branch -d vieja", "git");
asks("git branch --delete vieja", "git");
asks("git checkout -- src/app.ts", "git");
asks("git checkout .", "git");
asks("git restore src/app.ts", "git");
asks("git stash drop", "git");
asks("git stash clear", "git");
asks("git filter-branch --tree-filter 'rm x' HEAD", "git");
asks("git switch -f main", "git");
asks("git switch --discard-changes main", "git");
asks("git switch -C main origin/main", "git");
asks("cd /repo && git reset --hard", "git");
asks("bun test && git push --force", "git");
asks("FOO=1 sudo git reset --hard", "git");
asks("echo $(git reset --hard)", "git");

passes("git push origin feat");
passes("git push -u origin feat");
passes("git reset --soft HEAD~1");
passes("git reset HEAD file.ts");
passes("git clean -n");
passes("git clean -nd");
passes("git branch -vv");
passes("git branch nueva");
passes("git checkout -b nueva");
passes("git checkout main");
passes("git switch main");
passes("git switch -c nueva");
passes("git restore --staged src/app.ts");
passes("git stash");
passes("git stash pop");
passes("git status --short");
passes("git log --format='%h reset --hard'");

// Borrado recursivo: el temporal y lo que se regenera dentro del proyecto pasan.
asks("rm -rf src", "archivos");
asks("rm -r ../otro", "archivos");
asks("rm -rf /", "archivos");
asks("rm -rf ~", "archivos");
asks(`rm -rf ${homedir()}/proyectos`, "archivos");
asks("rm -rf .", "archivos");
asks("rm -rf *", "archivos");
asks('rm -rf "$DESTINO"', "archivos");
asks("rm -rf ../otro/node_modules", "archivos");
asks("find . -name '*.log' | xargs rm -rf", "archivos");
asks("rm --recursive --force docs", "archivos");
asks('rm -rf "$TMPDIR/../../etc"', "archivos");
passes(`rm -rf ${join(tmpdir(), "n-ein-test")}`);
passes("rm -rf /tmp/n-ein-x");
passes('rm -rf "$TMPDIR/n-ein-x"');
passes("rm -rf node_modules dist");
passes("rm -rf ./coverage");
passes("rm -f archivo.txt");
passes("rm archivo.txt");

// Datos.
asks('psql "$DATABASE_URL" -c "DROP TABLE users"', "datos");
asks("sqlite3 app.db 'truncate table pedidos'", "datos");
asks('mysql -e "DELETE FROM pedidos;"', "datos");
asks("psql <<SQL\nDROP SCHEMA public CASCADE;\nSQL", "datos");
asks("dropdb produccion", "datos");
asks("redis-cli FLUSHALL", "datos");
passes('psql -c "SELECT count(*) FROM users"');
passes('psql -c "DELETE FROM pedidos WHERE id = 3"');

// El texto no es un comando.
passes("echo 'git reset --hard'");
passes('printf "rm -rf /\\n"');
passes("cat <<'EOF' > notas.md\ngit push --force\nrm -rf /\nEOF");
passes('git commit -m "evitar git push --force y rm -rf"');
passes("rg 'DROP TABLE' docs");

// Con interfaz decide el usuario; los procesos en segundo plano pasan por la misma guarda.
const { default: registerGuard } = await import("../pi-package/extensions/guard.ts");
let handler: (event: unknown, ctx: unknown) => Promise<{ block?: boolean; reason?: string } | undefined>;
registerGuard({ on: (_name: string, fn: typeof handler) => { handler = fn; } } as never);
const asked: string[] = [];
const withUI = (answer: boolean) => ({ cwd, hasUI: true, ui: { confirm: async (_title: string, text: string) => { asked.push(text); return answer; } } });
assert.equal(await handler!({ toolName: "bash", input: { command: "git reset --hard" } }, withUI(true)), undefined);
assert.match(asked[0]!, /git reset --hard/);
const declined = await handler!({ toolName: "nein_job", input: { action: "start", command: "git push --force" } }, withUI(false));
assert.equal(declined?.block, true);
assert.match(declined!.reason!, /declined/);
assert.equal(await handler!({ toolName: "bash", input: { command: "git status" } }, withUI(false)), undefined);
assert.equal(await handler!({ toolName: "read", input: { path: "x" } }, withUI(false)), undefined);
assert.equal(asked.length, 2);

console.log("guard: comandos destructivos reconocidos; texto, temporal y regenerables pasan; el usuario decide con interfaz");
