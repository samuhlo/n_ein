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

- [ ] T0 · Ensayo del puente — un turno de Opus en Pi con la persona y las herramientas, y el paso a Sol con «hazlo». Blocked by: permiso de Samu para ejecutar el puente con su login.
- [ ] T1 · Empaquetado del puente — runtime fijado con lockfile, instalador, doctor, configuración y entorno del launcher, NOTICE. Blocked by: T0.
- [ ] T2 · Enrutado opcional de `abierto` a Opus — valor elegible en `/nein:models`, error accionable si falta el modelo. Blocked by: T1 para la prueba en vivo.
- [x] T3 · Medidores de cuota en Pi. Blocked by: none.
- [x] T4 · Guarda de comandos destructivos. Blocked by: none.
- [x] T5 · Regla de preservar. Blocked by: none.
- [ ] T6 · Documentación y cierre — decisiones, modelos, diseño, README. Blocked by: T1-T5.

## Evidencia

- Investigación: gentle-shell `2c06244` en el scratchpad; `pi-claude-bridge` 0.9.3 revisado (4.723 líneas en `src/`, sin `fetch` ni URL propias).
- Pi 1.0.2 trae `claude-opus-5-5` en su catálogo de Anthropic.
- T0: el clasificador de permisos de la sesión bloqueó ejecutar el paquete descargado con el login de Claude.
- T5: `tests/skills.ts` rojo («flow.md debe pedir sonda para lo que comparte el código tocado») → verde tras añadir la regla a `flow.md` (paso 4) y a `tdd` (reglas del bucle).
- T4: `tests/guard.ts` rojo (módulo ausente) → verde: 70 comandos clasificados y la rama con interfaz (confirmar, rechazar, `nein_job`). `tests/guard-pi.ts` con Pi 1.0.2 real y proveedor determinista: sin interfaz, `rm -rf victima` queda bloqueado y `rm -rf node_modules` pasa; sin cargar la guarda, la misma prueba falla («la guarda debía impedir el borrado»). Typecheck contra Pi 1.0.2: OK.
- T3: `tests/usage.ts` rojo (módulo ausente) → verde: cabeceras de Codex y Claude, entradas inválidas sin ventanas, ventana reiniciada a 0, aviso de cuota agotada. `tests/usage-pi.ts` con Pi 1.0.2 en RPC: la cabecera del proveedor llega a `setStatus` como «Codex 5h 37%»; sin cargar la extensión, la prueba falla. Pi no mostraba estas ventanas: `02-diseno.md` decía lo contrario y queda corregido. Typecheck: OK.

## Siguiente paso

T5, T4 y T3; después pedir a Samu que ejecute el ensayo T0.
