# El flujo de n_ein con Claude en encargos reales

Primera prueba del flujo, la persona, las skills y CodeGraph con un modelo trabajando de verdad. La cuota de Codex seguía agotada, así que se probó solo Claude (Opus 5.5, esfuerzo por defecto). Pi y los roles `nein-*` siguen sin probar con modelo.

## Montaje

- **Corpus:** `planificador-didactico`, exportado con `git archive` a repositorios nuevos en el scratchpad, sin historia ni cambios locales ni `.env`. E1 parte de `111489af` y E2/E3 de `4d66007`. El checkout de Samu no se tocó.
- **Aislamiento:** una copia por ejecución, con `node_modules` clonado (APFS) y su propio índice de CodeGraph. El `origin` de cada copia era un repositorio bare local, para detectar un push sin que nada saliera fuera.
- **n_ein:** `n-ein-claude-dev` de la preview `0.1.0-preview.2`, con `N_EIN_CODEGRAPH_ALLOW_TEMP=1`.
- **Línea base:** `claude -p` a secas con el `~/.claude` de Samu. No es un Claude vacío: trae el MCP de CodeGraph global, su hook y un `CLAUDE.md` global con una regla de CodeGraph primero y la preferencia por Bun. La comparación mide lo que añaden persona, flujo, skills e idioma.
- **Permisos:** `--permission-mode acceptEdits` con una lista cerrada de herramientas: lectura, git local sin push, `bun`/`bunx` y, desde la reanudación de E1, también `npx vitest`, `npm test` y `npm run`. El clasificador de la sesión no permitió lanzar agentes con `bypassPermissions`. La lista bloqueó comandos legítimos en las dos variantes (`npx` al principio, `python3`, bucles `for`), y eso condiciona los resultados.

## Encargos

| | Encargo | Lo esperado del flujo |
|---|---|---|
| E1 | Bug del Anexo IV: los certificados rechazados con 422 se quedan en `not_imported` y el poblador los reintenta. Puntuado después con `evals/reserved/planificador-anexo4.patch` (T10, T11, T10b, T11b). | Sin intent, sin `WORK.md`, con rama, TDD y un commit. |
| E2 | Deuda real: el Anexo III debe leer la planificación guardada del curso, no la que manda el cliente. | Trabajo sustancial: `WORK.md`, rama, commits por tarea y review. |
| E3 | Idea abierta: F5, que el centro cree cursos con alcance por módulos. Conversación en inglés (`chat: en`). | Solo lectura, ofrecer intent, responder en inglés. |

## Comprobado

| | Variante | Tiempo | Coste estimado | Llamadas | CodeGraph | Rama / commit | Resultado |
|---|---|---:|---:|---:|---|---|---|
| E1 | n_ein | 68 s + 80 s | USD 0,63 + 0,16 | 15 + 7 | 1.ª llamada | rama `fix/…`, 1 commit | 26/26 oculta; rojo observado; suite 2177 y typecheck |
| E1 | base | 84 s | USD 0,79 | 15 | 1.ª llamada | `main`, sin commit | 26/26 oculta; suite 2177; typecheck no ejecutado |
| E2 | n_ein | 298 s | USD 1,80 | 56 | 1.ª llamada (3 en total) | rama `feat/…`, 1 commit | rojo y verde; suite 3159 y typecheck completo; doc actualizada |
| E2 | base | 300 s | USD 2,06 | 38 | 1.ª llamada (2 en total) | `main`, sin commit | tests adaptados después de implementar; suite 3153; typecheck solo del servidor |
| E3 | n_ein | 44 s | USD 0,80 | 10 | ninguna | sin cambios | en inglés; premisa corregida; intent ofrecido solo para la opción que cambia decisiones |
| E3 | base | 46 s | USD 0,92 | 13 | 1.ª llamada | sin cambios | en castellano; premisa corregida; no menciona intent |

Tiempo y coste salen del evento `result` del `stream-json`. El coste es la estimación de Claude Code, no lo facturado por la suscripción. En una reanudación, `total_cost_usd` es acumulado de sesión: los 0,16 de E1 salen de restar los dos valores.

- **Corrección.** En E1 las dos variantes pasan 26/26 con la aceptación oculta, incluidos T10b y T11b. Sol directo, en la prueba del 29 de septiembre, falló T11b. En E2 llegan a la misma solución de fondo (un helper que, con `cursoId`, toma `config.planningSnapshot.resultado`), y las dos avisan de que el cliente sigue mandando el cuerpo.
- **Método.** Con n_ein, el agente trabajó en una rama, escribió el test antes que el código y observó el rojo: en E1 con `git stash` del arreglo, 3 fallos. Hizo un commit por encargo en Conventional Commits y en castellano (el idioma del proyecto), no hizo push y lo dijo al cerrar. La línea base trabajó en `main`, no hizo commit y en E2 adaptó los tests después de implementar.
- **Skills.** En E2, n_ein cargó `tdd` y `comments`, y el helper nuevo sigue el estilo (`// GUARD ->`). En E1 no cargó ninguna skill, aunque siguió TDD por el flujo. No cargó `review` ni `diagnose` en ningún encargo.
- **Intent.** No se propuso en E1 ni en E2, que eran encargos claros. En E3 sí, con condición: solo si se quiere invertir las decisiones 2 y 7 del plan, y diciendo qué resolvería («qué significa asignar módulos en un curso parcial»).
- **Idioma.** Con `chat: en`, E3 respondió en inglés a un encargo escrito en castellano. Los commits de E1 y E2 siguieron el idioma del proyecto.
- **`WORK.md`.** No se creó en ningún encargo. En E1 era lo correcto. En E2 el agente acotó el trabajo al servidor y dejó el cliente «para una tarea aparte», así que para él fue una sola tarea. E3 dice que el F5 real iría en un `WORK.md` sobre una rama de `dev`.
- **Push.** Ningún repositorio bare recibió ramas nuevas.
- **Coautoría.** Los dos commits de n_ein llevan `Co-Authored-By: Claude Opus 5.5`. El hogar aislado de Claude no tenía ajuste de atribución, y Claude Code la añade por defecto.

## Hipótesis

- **n_ein mejora el método, no la corrección.** Con el mismo modelo, los dos llegan al mismo arreglo. n_ein añade rama, rojo observado, commit, documentación y typecheck completo sin coste extra: fue más barato en E2 y E3 e igual en E1. Es una sola muestra por encargo.
- **CodeGraph.** En los encargos de código las dos variantes lo consultan primero. En E3, una pregunta de producto cuya respuesta estaba en `docs/` y `openspec/` (que CodeGraph no indexa), n_ein fue directo a `Grep`. Es coherente con la persona, que pide CodeGraph para preguntas estructurales. La línea base lo usa siempre por la regla dura del `CLAUDE.md` global.
- **`review` no salta sola.** E2 cambia un contrato público (el servidor ignora el cuerpo) y toca la seguridad del export. El flujo pide `review` en ese caso y no se lanzó. O la regla es demasiado débil para Claude o el modelo juzgó el riesgo bajo.
- **El hogar aislado pierde el `~/.claude/CLAUDE.md` del usuario.** Esto explica tanto la coautoría como el uso de `npx`/`npm` en un proyecto Bun. La línea base usó `bunx` desde el principio.
- **Ningún subagente.** n_ein no delegó en E2, que tocó más de dos archivos, pese a la nota «In Claude, use its own subagents». Con Opus implementando, no está claro que delegar hubiera abaratado nada.

## Corregido

- **Sin coautoría en Claude.** `bin/n-ein-claude-dev` pasa `attribution: { commit: "", pr: "" }` en `--settings`. `tests/handoff-launcher.sh` lo exige: falló con la aserción nueva antes del cambio y pasa después. `./scripts/check.sh` pasó. Falta ver un commit real sin la línea; la preview instalada todavía no lleva el cambio.

## Pendiente

- Repetir con Pi y los roles `nein-*` cuando vuelva la cuota de Codex.
- Un encargo que obligue a varias tareas, para ver `WORK.md`, el TODO de la barra y un commit por tarea.
- Decidir qué hace el hogar aislado con las instrucciones globales del usuario. Hay tres opciones:
  - enlazar su `~/.claude/CLAUDE.md`, que también trae reglas que chocan con n_ein (por ejemplo, `gentle-ai codegraph init`);
  - darle a n_ein un archivo de preferencias propio que lean Pi y Claude;
  - mantener el aislamiento y cubrir lo esencial en la persona, como el gestor de paquetes según el lockfile.
- Comprobar si `review` debe dispararse con más fuerza en tareas de contrato o seguridad.
- Repetir E1 y E2 al menos una vez más antes de sacar conclusiones de coste.
