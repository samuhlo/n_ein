# Roles propios y skills de n_ein

El usuario pidió un producto más personal y no una copia de Gentle Shell ni de Matt: subagentes con nombre propio y modelo asignable sin volver a los agentes por fase de Ein, skills reescritas con nombres de n_ein y sin referencias a terceros, y valorar el inglés para lo que lee el agente.

## Datos que guiaron la decisión

- Gentle Shell y Matt escriben todas sus skills en inglés; Gentle responde al usuario en su idioma.
- Medido con `o200k_base`: las 11 adaptaciones en castellano ocupaban 22.507 tokens frente a 19.952 de sus originales en inglés (+13 %).

## Hecho

- **Roles.** `nein_scout` (solo lectura con CodeGraph, Luna low), `nein_worker` (implementación, Luna high) y `nein_reviewer` (revisión y comprobaciones sin editar, Sol medium) sustituyen al trabajador único. Modelo y esfuerzo propios en `runtime.json`, `/nein:models`, el banner y Configuración del launcher. El hijo bloquea `edit`/`write` fuera de superficie o en roles de solo lectura; al volver, Git delata lo escrito por shell (`SURFACE_BREACH`, `READONLY_BREACH`). Los roles de solo lectura pueden ir en paralelo (hasta 3); el worker, uno cada vez.
- **Skills** reescritas en inglés como propias, sin nombres de terceros (procedencia y licencia en `NOTICE.md`): `intent`, `tdd`, `diagnose`, `review`, `design`, `glossary`, `research`, `prototype`, `pr`, `agent-docs`, `comments`, `logs` (las lanza el modelo) y `spec`, `tasks`, `retro`, `tell-again`, `to-pi` (las lanza el usuario). Se integran con los roles y con `WORK.md`.
- **Persona, flujo, nota de Pi e instrucción de idioma** en inglés. El flujo de n_ein define una sola vez la forma de `WORK.md`, con títulos en castellano o en inglés; el TODO, el banner y el launcher leen ambos.
- El lanzador de Claude retira los enlaces rotos a skills renombradas sin tocar los ajenos.

## Comprobado

- `tests/agents.ts`: tres herramientas; errores de modelo visibles sin cambiar de proveedor; superficies inválidas rechazadas (`[]`, `.`, `**`, absolutas, `..`); globs; escritura fuera de superficie del worker y escritura del scout detectadas por Git; bloqueo de `edit`/`write` dentro del hijo.
- `tests/models.ts`: el panel recorre principal, scout, worker, reviewer y claude con teclas; persistencia por rol; el worker delega con su modelo.
- Test Go de Configuración con los tres roles y origen por rol; `WORK.md` en inglés leído por launcher y TODO.
- `tests/skills.ts`: frontmatter válido, sin nombres propios, sin terceros fuera de `NOTICE.md` y sin nombres retirados.
- Pi real: cargan las 17 skills; el modelo recibe `nein_scout`, `nein_worker`, `nein_reviewer` y `codegraph_explore` (y ya no `n_ein_worker`), la persona, el flujo y la instrucción de idioma.
- `./scripts/check.sh` pasó.

## No comprobado

- Ningún modelo ha trabajado con los roles ni con las skills nuevas: la llamada real falla con «Codex error: The usage limit has been reached».
- Un worker que modifica de nuevo un archivo ya sucio antes de delegar no se distingue en la comprobación por Git: solo se detectan archivos nuevos en el estado.
