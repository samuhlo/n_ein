// =============================================================================
// [AUTH] COMANDOS DESTRUCTIVOS
// Reconoce las formas directas de lo que no se deshace: historia publicada,
// ramas, cambios sin guardar, borrados recursivos y datos. No interpreta shell
// ni expande variables: lo que no puede leer como literal se trata como dudoso.
// =============================================================================

import { basename, isAbsolute, join, normalize, resolve, sep } from "node:path";

export type Danger = {
  kind: "git" | "archivos" | "datos";
  /** Para el diálogo del usuario, en el idioma de la interfaz. */
  label: string;
  /** Para el agente: qué hace el comando y por qué se detuvo. */
  reason: string;
};

export type GuardContext = { cwd: string; scratch: readonly string[]; home: string };

const OPERATORS = [";", "&&", "||", "|&", "|", "&", "\n", "(", ")", "`"];
const WRAPPERS = new Set(["sudo", "env", "command", "exec", "nohup", "time", "nice", "xargs"]);
// Carpetas que el proyecto regenera: borrarlas no pierde trabajo.
const GENERATED = new Set(["node_modules", "dist", "build", "coverage", ".nuxt", ".next", ".output", ".turbo", ".cache", "__pycache__", ".pytest_cache", "target"]);
const DB_CLIENTS = new Set(["psql", "mysql", "mariadb", "sqlite3", "duckdb", "sqlcmd"]);
const SQL_DESTRUCTION = /\b(drop\s+(table|database|schema|view|index)|truncate\b|delete\s+from\s+[\w."]+\s*(;|$|["']))/im;

/** El cuerpo de un heredoc es texto para el comando, no otro comando. */
function withoutHeredocs(command: string): string {
  return command.replace(/<<-?\s*(['"]?)([A-Za-z_]\w*)\1([^\n]*)\n[\s\S]*?\n\s*\2(?=\n|$)/g, (raw) => raw.slice(0, raw.indexOf("\n")));
}

/** Palabras de cada comando simple, con las comillas resueltas y los operadores como frontera. */
function segments(command: string): string[][] {
  const result: string[][] = [];
  let words: string[] = [];
  let word = "";
  let started = false;
  let quote: "'" | '"' | null = null;
  const endWord = () => {
    if (started) words.push(word);
    word = "";
    started = false;
  };
  const endSegment = () => {
    endWord();
    if (words.length) result.push(words);
    words = [];
  };
  for (let i = 0; i < command.length; i++) {
    const char = command[i]!;
    if (quote) {
      if (char === quote) quote = null;
      else if (char === "\\" && quote === '"' && i + 1 < command.length) word += command[++i];
      else word += char;
      continue;
    }
    if (char === "'" || char === '"') {
      quote = char;
      started = true;
      continue;
    }
    if (char === "\\" && i + 1 < command.length) {
      word += command[++i];
      started = true;
      continue;
    }
    const operator = OPERATORS.find((op) => command.startsWith(op, i));
    if (operator) {
      endSegment();
      i += operator.length - 1;
      continue;
    }
    if (char === " " || char === "\t") {
      endWord();
      continue;
    }
    word += char;
    started = true;
  }
  endSegment();
  return result;
}

/** El comando real tras asignaciones y envoltorios como `sudo` o `env`. */
function program(words: string[]): { name: string; args: string[] } | undefined {
  let index = 0;
  while (index < words.length) {
    const word = words[index]!;
    if (/^[A-Za-z_][A-Za-z0-9_]*=/.test(word) || (index > 0 && word.startsWith("-") && WRAPPERS.has(basename(words[index - 1]!)))) index++;
    else if (WRAPPERS.has(basename(word))) index++;
    else break;
  }
  const name = words[index];
  return name === undefined ? undefined : { name: basename(name), args: words.slice(index + 1) };
}

const shortFlags = (args: string[]) => args.filter((arg) => /^-[A-Za-z]+$/.test(arg)).join("");
const has = (args: string[], ...names: string[]) => args.some((arg) => names.some((name) => arg === name || arg.startsWith(`${name}=`)));

function git(args: string[]): Danger | undefined {
  let index = 0;
  // Opciones globales antes del subcomando: `-C dir`, `-c clave=valor`, `--git-dir=...`.
  while (index < args.length && args[index]!.startsWith("-")) {
    index += ["-C", "-c", "--git-dir", "--work-tree", "--namespace"].includes(args[index]!) ? 2 : 1;
  }
  const sub = args[index];
  const rest = args.slice(index + 1);
  const flags = shortFlags(rest);
  const stop = (label: string, reason: string): Danger => ({ kind: "git", label, reason });
  switch (sub) {
    case "push":
      if (has(rest, "--force", "--force-with-lease", "--mirror") || flags.includes("f"))
        return stop("git push forzado reescribe la historia publicada", "a forced push rewrites published history");
      if (has(rest, "--delete", "--prune") || flags.includes("d") || rest.some((arg) => arg.startsWith(":") && arg.length > 1))
        return stop("git push borra ramas o tags remotos", "this push deletes remote branches or tags");
      if (rest.some((arg) => arg.startsWith("+")))
        return stop("git push con + fuerza la referencia remota", "a + refspec force-updates the remote ref");
      return undefined;
    case "reset":
      return has(rest, "--hard") ? stop("git reset --hard descarta cambios sin guardar", "reset --hard discards uncommitted work") : undefined;
    case "clean":
      return (has(rest, "--force") || flags.includes("f")) && !has(rest, "--dry-run") && !flags.includes("n")
        ? stop("git clean borra archivos sin seguimiento", "git clean deletes untracked files")
        : undefined;
    case "branch":
      return has(rest, "--delete", "--force") || /[dDf]/.test(flags)
        ? stop("git branch borra o fuerza una rama", "this deletes or force-moves a branch")
        : undefined;
    case "checkout":
      return has(rest, "--force") || flags.includes("f") || rest.includes(".") || (rest.includes("--") && rest.indexOf("--") < rest.length - 1)
        ? stop("git checkout descarta cambios del árbol de trabajo", "this checkout discards working-tree changes")
        : undefined;
    case "switch":
      return has(rest, "--force", "--discard-changes") || /[fC]/.test(flags)
        ? stop("git switch descarta cambios o reinicia una rama", "this switch discards working-tree changes or resets a branch")
        : undefined;
    case "restore":
      return (has(rest, "--staged") || flags.includes("S")) && !has(rest, "--worktree") && !flags.includes("W")
        ? undefined
        : stop("git restore descarta cambios del árbol de trabajo", "restore discards working-tree changes");
    case "stash":
      return rest[0] === "drop" || rest[0] === "clear" ? stop("git stash borra cambios guardados", "this deletes stashed changes") : undefined;
    case "filter-branch":
    case "filter-repo":
      return stop("reescribe toda la historia del repositorio", "this rewrites the repository history");
    default:
      return undefined;
  }
}

function within(path: string, root: string): boolean {
  const base = normalize(root).replace(/[\\/]+$/, "");
  return path.startsWith(base + sep) && path.length > base.length + 1;
}

/** Seguro: una carpeta regenerable del proyecto, o algo del temporal fuera del proyecto. */
function safeTarget(raw: string, context: GuardContext): boolean {
  let target = raw;
  const tmpVar = /^\$\{?(TMPDIR|TMP|TEMP)\}?(?=\/|$)/.exec(target);
  // BLINDAJE -> `..` saldría del temporal que da por seguro el prefijo.
  if (tmpVar) return target.length > tmpVar[0].length + 1 && !target.split("/").includes("..");
  if (target === "~" || target.startsWith("~/")) target = join(context.home, target.slice(1));
  if (/[$`*?{[]/.test(target)) return false;
  const path = normalize(isAbsolute(target) ? target : resolve(context.cwd, target)).replace(/[\\/]+$/, "");
  const project = normalize(context.cwd).replace(/[\\/]+$/, "");
  // BLINDAJE -> Un proyecto que vive en el temporal sigue siendo el proyecto: solo pasa lo regenerable.
  if (path === project || within(path, project)) return GENERATED.has(basename(path)) && within(path, project);
  return context.scratch.some((root) => within(path, root));
}

function rm(args: string[], context: GuardContext): Danger | undefined {
  const flags = shortFlags(args.filter((arg, i) => !args.slice(0, i).includes("--")));
  if (!has(args, "--recursive") && !/[rR]/.test(flags)) return undefined;
  const end = args.indexOf("--");
  const targets = args.filter((arg, i) => (end >= 0 && i > end) || (!arg.startsWith("-") && (end < 0 || i < end)));
  if (targets.length > 0 && targets.every((target) => safeTarget(target, context))) return undefined;
  return { kind: "archivos", label: "rm recursivo fuera del temporal", reason: "a recursive rm targets paths outside the temporary directory or generated folders" };
}

/** Lo destructivo que contiene el comando, o nada. */
export function dangerous(command: string, context: GuardContext): Danger | undefined {
  for (const words of segments(withoutHeredocs(command))) {
    const found = program(words);
    if (!found) continue;
    const { name, args } = found;
    if (name === "git") {
      const danger = git(args);
      if (danger) return danger;
    } else if (name === "rm") {
      const danger = rm(args, context);
      if (danger) return danger;
    } else if (name === "dropdb" || (name === "redis-cli" && args.some((arg) => /^flush(all|db)$/i.test(arg)))) {
      return { kind: "datos", label: `${name} borra una base de datos`, reason: "this command deletes a database" };
    } else if (DB_CLIENTS.has(name) && SQL_DESTRUCTION.test(command)) {
      // El SQL puede ir en argumentos o en un heredoc: aquí sí se lee el texto completo.
      return { kind: "datos", label: "SQL que borra tablas o filas", reason: "this SQL drops or truncates data, or deletes rows without WHERE" };
    }
  }
  return undefined;
}
