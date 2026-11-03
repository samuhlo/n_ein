# Opus piensa, GPT ejecuta: puente de Claude en Pi y mejoras de Gentle

## Objetivo

Samu quiere el equilibrio que ve en Gentle Shell: «la parte pensante, de arquitectura y de decisiones usa opus 5.5 y la de ejecución usa los modelos de OpenAI … no me importaría poder tener de cabeza pensante opus 5.5 en high». También pidió «busca bien lo que mejoraría el nuestro ya de paso» y hacer un plan para integrarlo. Tras la investigación (gentle-shell 4.5.1, `2c06244`, 3 nov) respondió: «Hazlo, con tus recomendaciones en las dos decisiones».

Pedidos:
1. Opus 5.5 high como cabeza pensante en Pi: la fase abierta (intent, diseño, decisiones) en Opus y la obra en GPT.
2. Medidores de cuota de las dos suscripciones en Pi.
3. Guarda de comandos destructivos en Pi.
4. Regla de preservar el comportamiento que comparte el código cambiado.

## Autorización

«Hazlo» sobre el plan de cinco tramos, el ensayo T0 incluido: implementación en esta rama con commit por tarea. Sin fusionar, publicar ni tocar la instalación personal. Ejecutar el puente con el login de Claude quedó bloqueado por el clasificador de permisos de la sesión; necesita que Samu lo ejecute o lo permita.

## Decisiones

- **Por fase, no por delegación.** El router ya separa la clase `abierto` y la transición `start_implementation`, que deja bajar a ordinario o mecánico (`pi-package/extensions/router.ts:107`). Opus entra como modelo de `abierto`; no hay subagentes ni orquestador. Motivo: el banco del 5 de octubre de n_ein y el de Gentle (T24, 4 oct: 3,12 USD frente a 1,59) dan pérdida al delegar la obra en un modelo más barato.
- **Opus como opción, no por defecto** (decisión 1). `abierto` sigue en Sol high hasta que el ensayo y 2-3 encargos reales lo confirmen.
- **Proveedor: `pi-claude-bridge` 0.9.3** (MIT, Eli Dickinson). Lanza el Claude Code oficial mediante el Agent SDK y gasta la cuota de la suscripción. El código no hace llamadas de red propias ni lee tokens; escribe su configuración, sus logs de depuración y sesiones de Claude Code en `CLAUDE_CONFIG_DIR`. Alternativa sin dependencia si el ensayo falla: pensar en `nein claude` y relevar con `to-pi`, que ya existe.
- **Mejoras de Gentle que entran** (decisión 2): medidores, guarda y regla de preservar. Fuera: aviso de tamaño de rama, perfiles con pin por repositorio y delegación por ratio de precio. Opus como revisor no se propone: Samu fijó p_reviewer en Sol 6.1 el 21 de octubre.
- **Fallo del modelo pensante:** se informa y se ofrece Sol; nunca se cambia de modelo en silencio (`docs/06-modelos.md`).

## Límites

- Claude Code no cambia: ya usa Opus y su esfuerzo se fija en `/nein:models`.
- Sin AskClaude, MCP de claude.ai ni memoria automática de Claude Code dentro del puente.
- La guarda reconoce formas directas de comandos; no interpreta shell, scripts ni variables.
- Sin migrar la instalación personal ni publicar versión.

## Criterios

- «opus 5.5 en high … cabeza pensante» → `runtime.json`, `router.ts`, `/nein:models`, launcher `bin/n-ein-dev`, instalador → con `abierto` en `claude-bridge/claude-opus-5-5` high, una pregunta de diseño responde Opus con la persona de n_ein, y «hazlo» pasa la obra a Sol o Luna en la misma sesión; sin el puente o sin login, el error dice cómo seguir con Sol.
- «medidores» → nueva extensión de Pi sobre `after_provider_response` → test: cabeceras `x-codex-*` y `anthropic-ratelimit-unified-*` producen la línea de estado; cabeceras ajenas o inválidas no inventan ventanas; ventana agotada avisa con la salida.
- «guarda» → `tool_call` de `bash` y `nein_job` en la sesión principal → test: `git push --force` (también `--force-with-lease`, que reescribe igual la historia publicada), `reset --hard`, `clean -fd`, `branch -D`, `rm -rf` fuera del temporal y `DROP TABLE` piden confirmación con interfaz y se bloquean sin ella; `rm -rf` en el temporal o de carpetas regenerables del proyecto y texto dentro de un `echo`, un mensaje de commit o un heredoc pasan.
- «preservar» → `flow.md`, skill `tdd` → test de skills: el texto pide un test para el comportamiento existente que comparte el código tocado.
- Seams: `nextState` y `physical` del router, parsers puros de cabeceras y de comandos, `tests/skills.ts`.

## Tareas

- [x] T0 · Ensayo del puente — un turno de Opus en Pi con la persona y las herramientas, y el paso a Sol con «hazlo». Blocked by: none.
- [x] T1 · Empaquetado del puente — runtime fijado con lockfile, instalador, doctor, configuración y entorno del launcher, NOTICE. Blocked by: T0.
- [ ] T2 · Enrutado opcional de `abierto` a Opus — valor elegible en `/nein:models`, error accionable si falta el modelo. Blocked by: T1 para la prueba en vivo.
- [x] T3 · Medidores de cuota en Pi. Blocked by: none.
- [x] T4 · Guarda de comandos destructivos. Blocked by: none.
- [x] T5 · Regla de preservar. Blocked by: none.
- [x] T6 · Documentación y cierre — decisiones, modelos, diseño, README. Blocked by: T1-T5.

## Evidencia

- Investigación: gentle-shell `2c06244` en el scratchpad; `pi-claude-bridge` 0.9.3 revisado (4.723 líneas en `src/`, sin `fetch` ni URL propias).
- Pi 1.0.2 trae `claude-opus-5-5` en su catálogo de Anthropic.
- T0: el clasificador de permisos de la sesión bloqueó ejecutar el paquete descargado con el login de Claude; Samu lanzó `ensayo-puente.sh` (3 nov, 09:20). Resultado:
  - Opus por el puente responde como Ein y ve `nein_job`, `nein_work` y `codegraph_explore`.
  - Con `nein/auto` y `abierto` en Opus, el diseño lo da Opus y deja una decisión; con «Hazlo.», Opus llama a `nein_set_task` (`start_implementation → ordinario`) y Sol hace la obra: `suma.ts`, test, configuración, 3 pruebas en verde y commit `35eb513` en una rama.
  - Cuota: `rate_limit_event` con `isUsingOverage: false` y uso extra desactivado en la organización; consume la ventana de 5 h (49 % al terminar, con el resto de la sesión).
  - **Fallo:** el proceso no terminó. El puente dejó su consulta de Claude Code esperando el resultado de `nein_set_task` (`session_shutdown left state behind — pendingToolCalls=1`) porque la continuación fue a Sol; el hijo de Claude siguió vivo hasta cerrarlo a mano. Gentle no lo sufre porque no cambia de proveedor a mitad de una ejecución.
- Arreglo en n_ein, sin parchear el puente: con el puente como último proveedor, una continuación no cambia de modelo; `nein_set_task` con `start_implementation` pide a Opus cerrar su mensaje y deja en cola un turno nuevo que arranca la obra en el ejecutor. `tests/router.ts` rojo → verde (incluye escalado diferido y reintento que sí cambia). `tests/bridge-handover-pi.ts`, Pi 1.0.2 real en print con puente simulado: llamadas `claude-bridge(user) → claude-bridge(toolResult) → exec-test(user)` y el proceso termina; con el router anterior la secuencia es `claude-bridge → exec-test(toolResult)` y la prueba falla.
- Reensayo con el puente real tras `9a94702` (Samu, 11:05-11:07): Opus llama a `nein_set_task` y cierra («Empiezo a implementarlo en el siguiente turno…»); el turno en cola arranca en Sol, que deja `0e0cab1` con 4/4 pruebas. El proceso termina solo, sin avisos de fuga en el log del puente y sin hijos de Claude vivos. Cuota: sin uso extra.
- T5: `tests/skills.ts` rojo («flow.md debe pedir sonda para lo que comparte el código tocado») → verde tras añadir la regla a `flow.md` (paso 4) y a `tdd` (reglas del bucle).
- T4: `tests/guard.ts` rojo (módulo ausente) → verde: 70 comandos clasificados y la rama con interfaz (confirmar, rechazar, `nein_job`). `tests/guard-pi.ts` con Pi 1.0.2 real y proveedor determinista: sin interfaz, `rm -rf victima` queda bloqueado y `rm -rf node_modules` pasa; sin cargar la guarda, la misma prueba falla («la guarda debía impedir el borrado»). Typecheck contra Pi 1.0.2: OK.
- T3: `tests/usage.ts` rojo (módulo ausente) → verde: cabeceras de Codex y Claude, entradas inválidas sin ventanas, ventana reiniciada a 0, aviso de cuota agotada. `tests/usage-pi.ts` con Pi 1.0.2 en RPC: la cabecera del proveedor llega a `setStatus` como «Codex 5h 37%»; sin cargar la extensión, la prueba falla. Pi no mostraba estas ventanas: `02-diseno.md` decía lo contrario y queda corregido. Typecheck: OK. Después (`6ee9300`): con la cuota agotada, Claude puede responder con uso extra de pago y solo `overage-status` lo dice; la línea y el aviso lo marcan.
- T2 (parcial, sin puente real): `tests/router.ts` rojo (el error no decía cómo seguir) → verde. Con `abierto` en `claude-bridge/claude-opus-5-5` high, el diseño va a Opus y `nein_set_task` con `start_implementation` lleva la obra a `openai-codex/gpt-6-sol` medium; sin el modelo en el catálogo, el error nombra el puente y ofrece `[sol high]` o `/nein:models`. Los hogares de Claude de n_ein no guardan hooks: los de n_ein llegan por argumentos, así que no se disparan dentro de los turnos del puente.
- Suite completa (`scripts/check.sh`) sobre `194392a`: exit 0, Go, plugin de Claude y paquete instalado incluidos.
- T1: tests de Go rojos (runtime del puente inexistente) → verdes. Ahora `runtime` y `setup` instalan `runtimes/claude-bridge/0.9.3` con `--frozen-lockfile --omit peer`, sin ejecutable propio; son idempotentes, el paquete lleva `claude-bridge-runtime/` y `doctor --runtime` informa del puente sin exigirlo. El lockfile es el del ensayo; instalarlo congelado da 97 paquetes, sin peers. `tests/launcher.sh` rojo (sin `claudeBridge` en `runtime.json`) → verde: sin el runtime, Pi no carga el puente; con él, carga `-e <puente>`, usa `CLAUDE_CONFIG_DIR=<hogar>/<canal>/claude` y fija en `claude-bridge.json` el envoltorio `bin/n-ein-claude-bridge`, conservando las elecciones del usuario (AskClaude, plan). El test aísla `N_EIN_HOME` y el entorno de Claude. `go vet`: OK.
- Revisión (`review`, desde `b8794d1`), cuatro hallazgos importantes corregidos con test rojo → verde:
  - la guarda daba por seguro `rm -rf "$TMPDIR/../../etc"`: ahora `..` tras el prefijo del temporal pide confirmación;
  - `git switch -f`, `--discard-changes` y `-C` descartan cambios como `checkout` y pasaban;
  - dos llamadas de Opus a `nein_set_task` dejaban dos turnos de obra en cola: ahora uno por elección pendiente;
  - el launcher quitaba `ANTHROPIC_*` a todo Pi, y los comandos del proyecto las perdían aunque no se usara Opus: ahora solo las quita el envoltorio `bin/n-ein-claude-bridge`, que lanza el Claude gestionado (`N_EIN_BRIDGE_CLAUDE_BIN`); sin Claude gestionado falla con `BRIDGE_CLAUDE_MISSING` en vez de usar otro.
- Suite completa sobre `b26a5e7` (código final tras la revisión): exit 0; `dist/n-ein-install runtime --dry-run` planea solo `runtimes/claude-bridge/0.9.3`.
- Suite completa sobre `95fa2d1` más README: exit 0 (el `[ERR] :: TEAM_SAVE` del log sale igual antes de este encargo: lo provoca un test de equipo).

## Siguiente paso

T2 en vivo: Samu ejecuta `ensayo-instalado.sh` (scratchpad de la sesión). Instala el runtime del puente en `~/.n_ein/runtimes` y repite diseño y «Hazlo» con el launcher, sin `-e` ni configuración a mano. Si sale bien, T2 queda hecho. Hacer de Opus el valor por defecto de abierto queda para después de 2-3 encargos reales y es decisión de Samu.
