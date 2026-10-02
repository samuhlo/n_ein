// =============================================================================
// [DATA] IDIOMA
// Dos ejes, como en Ein: la conversación con el usuario y los artefactos que
// quedan en el repositorio (código, commits, PR, documentación). Se eligen en
// el launcher y viven en lang.json del canal, fuera del código instalado.
// =============================================================================

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { channelDir } from "./models.ts";

export const CHAT = ["es", "en"] as const;
export const ARTIFACTS = ["proyecto", "es", "en"] as const;
export type Lang = { chat: (typeof CHAT)[number]; artifacts: (typeof ARTIFACTS)[number] };

export function langPath(packageRoot: string, requestedChannel?: string): string {
  return process.env.N_EIN_LANG_FILE || join(channelDir(packageRoot, requestedChannel), "lang.json");
}

export function loadLang(packageRoot: string, requestedChannel?: string): Lang {
  const path = langPath(packageRoot, requestedChannel);
  if (!existsSync(path)) return { chat: "es", artifacts: "proyecto" };
  const value = JSON.parse(readFileSync(path, "utf8"));
  if (!CHAT.includes(value?.chat) || !ARTIFACTS.includes(value?.artifacts)) throw new Error(`lang.json inválido: ${path}`);
  return { chat: value.chat, artifacts: value.artifacts };
}

const NAME = { es: "Spanish", en: "English" } as const;

/** Instrucción que los lanzadores añaden al prompt. Está en inglés, como todo lo que lee el agente; solo cambia el idioma que nombra. */
export function langDirective(lang: Lang): string {
  const artifacts = lang.artifacts === "proyecto"
    ? `Write code, comments, identifiers, commit messages, PRs, WORK.md and repository docs in the language the project already uses; in a project with no convention yet, use ${NAME[lang.chat]}.`
    : `Write code comments, commit messages, PRs, WORK.md and repository docs in ${NAME[lang.artifacts]}, whatever the conversation language.`;
  return `Language: talk with the user in ${NAME[lang.chat]}. ${artifacts}`;
}

if (import.meta.main) {
  try {
    console.log(langDirective(loadLang(process.argv[2], process.argv[3])));
  } catch (error) {
    console.error(`[ERR] :: LANG_BAD :: reason: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 64;
  }
}
