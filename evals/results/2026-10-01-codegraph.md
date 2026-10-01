# CodeGraph obligatorio

Samu pidió que CodeGraph sea obligatorio, no opcional como en Ein: instalado por n_ein, iniciado y al día en cada proyecto y usado por los agentes. Commit `09a5fd4` y ajustes posteriores.

## Comprobado

- **Release real.** `n-ein-install runtime` descargó `codegraph-darwin-arm64.tar.gz` 1.6.1 de GitHub, verificó el SHA-256 fijado en `runtime.json` (`7a08cf8c…`), lo extrajo en `runtimes/codegraph/1.6.1` y comprobó `--version`. Repetirlo no reinstaló. `~/.codegraph` y el codegraph global 1.6.0 quedaron intactos.
- **Tests Go.** Release falsa servida con `httptest`: instalación e idempotencia; un hash distinto se rechaza sin dejar runtime; la extracción rechaza enlaces y rutas que escapan; `doctor --runtime` falla con CodeGraph ausente o de otra versión; `setup` tiene cinco pasos y repetirlo no reinstala nada.
- **Lanzadores.** `tests/launcher.sh`: `init` en la primera apertura de un repo, `sync` en la segunda, nada en los trabajadores hijos, y un temporal no se indexa pero Pi arranca igual. `tests/handoff-launcher.sh`: Claude recibe `--mcp-config` con `serve --mcp` y `DO_NOT_TRACK`, y `--settings` con el hook, incluso con espacios en la ruta.
- **Herramienta de Pi.** `tests/codegraph.ts`: sin binario no se registra; sincroniza antes de explorar, recorta a 60 000 caracteres y un fallo devuelve `CODEGRAPH_FAIL` sin romper la sesión. Contra el binario y el índice reales de este repo: 0,66 s y 18 KB, con `codegraph.go` del mismo día ya indexado.
- **Pi real (hogar dev).** Las definiciones de herramientas enviadas al modelo incluyen `codegraph_explore` junto a `n_ein_worker`, y el prompt lleva la regla de la persona.
- **Claude real (hogar dev).** Con los argumentos del lanzador, el evento `init` dio `codegraph · connected` y la herramienta `mcp__codegraph__codegraph_explore`. `prompt-hook` devolvió `<codegraph_context>` para una pregunta estructural.
- **Índice existente.** El de n_ein, creado por el global 1.6.0, se reindexó con 1.6.1 en unos 2 s porque CodeGraph lo recomendaba; la siguiente apertura tardó 0,44 s.
- **Preview personal.** `runtime` y `nein-setup` desde `0.1.0-preview.1+hotfix.09a5fd4ebadb`: cinco pasos y doctor con Pi, CodeGraph y Bun. Sistema muestra `CodeGraph 1.6.1 [runtime CodeGraph de n_ein]` y Estado el índice.
- `./scripts/check.sh` pasó.

## No comprobado

- **Uso por el modelo.** La llamada a Sol falló con `Codex error: The usage limit has been reached`: la suscripción de OpenAI Codex está al límite. No se ha visto a Sol ni a Luna elegir `codegraph_explore` por sí solos, ni se ha medido el ahorro de tokens frente a grep.
- **Claude.** No se lanzó una conversación completa de Claude con el MCP; solo se comprobó la conexión.

## Riesgo abierto

El `.codegraph/` de cada proyecto es compartido con el codegraph global de Samu (1.6.0 en su `~/.claude`). Con versiones distintas, cada una puede pedir reindexar al ver el índice de la otra. Alinear el global con 1.6.1 lo evita.
