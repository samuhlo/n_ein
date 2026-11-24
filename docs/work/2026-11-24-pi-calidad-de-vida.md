# Calidad de vida en Pi

Estado: activo · Rama: feat/pi-calidad-de-vida · Tests: `./scripts/check.sh`
Autorización: «Venga, haz un plan para integrar las 4, luego hago clear y empezamos»: implementar las cuatro mejoras en esta rama tras el clear, un commit por tarea. Sin integrar en main, publicar ni tocar la instalación preview; las pruebas reales usan el canal dev.
Objetivo: Pi, el producto principal de n_ein, recupera los avisos de Moshi y Herdr, dice cómo volver a una sesión con n_ein, pregunta con opciones y tiene una carpeta temporal por sesión.
Siguiente: T1 · Extensiones propias en Pi.

## Pedidos

- P1. Moshi y Herdr en Pi (propuesta 1). `~/.pi/agent/extensions` tiene `herdr-agent-state.ts` (Herdr, integración v8) y `moshi-hooks.ts` (moshi-hook 0.3.21), pero `bin/n-ein-dev` arranca Pi con `--no-extensions` y su propio hogar, así que ninguna se carga.
  - **Dónde:** `bin/n-ein-dev` (también se llega por `runtime.go` y por el relevo de Claude a Pi) y un archivo nuevo `~/.n_ein/<canal>/pi-extensions`.
  - **Prueba:** con el falso Pi de `tests/launcher.sh`, cada ruta de la lista llega como `-e`. Una ruta que no existe avisa con `[WARN]` y Pi arranca igual. Sin el archivo, los argumentos no cambian.
  - **Prueba real** (canal dev, dentro de Herdr): el panel de Herdr pasa de trabajando a parado con el turno, y `moshi-hook logs` registra eventos de la sesión. Esta prueba manda un aviso a tu móvil.
- P2. Volver a la sesión con n_ein (propuesta 2). Al salir, Pi imprime `To resume this session:` y `pi [--session-dir …] --session <id>` (función `formatResumeCommand`, solo con TTY y una sesión guardada). En tu shell, `pi` es la 0.87.1 con el hogar del Ein antiguo. Claude imprime `Resume this session with:` y su comando abre tu Claude personal.
  - **Dónde:** `bin/n-ein-dev`, `bin/n-ein-claude-dev`, una extensión de Pi que guarda el id de la sesión y el hook `session.end` del plugin de Claude (`workspace-hooks.ts`).
  - **Prueba:** al salir con TTY se imprime debajo un comando de n_ein. Copiado desde otra carpeta, reabre esa misma sesión, en n_ein y en el mismo canal. Tras `/new` en Pi o `/clear` en Claude, el comando apunta a la sesión nueva.
  - **Casos sin pista:** sin TTY, sin sesión guardada o tras un relevo no se imprime nada.
- P3. Preguntas con opciones en Pi (propuesta 3). Pi 1.6 no trae herramienta de preguntas, solo `ctx.ui.select` e `input` para extensiones; Claude tiene AskUserQuestion.
  - **Dónde:** una extensión nueva en `pi-package/package.json` y una frase en `pi-only.md`.
  - **Prueba** (Pi real en `--mode rpc`, con un proveedor falso que llama a la herramienta): el test responde a la petición `extension_ui_request` y el resultado lleva la opción elegida. «Otra respuesta» devuelve el texto escrito. Esc devuelve que no hubo respuesta.
  - **Sin interfaz:** en `-p` (print), la herramienta indica que se pregunte en texto.
  - **Tamaño:** su declaración (nombre, descripción y parámetros en JSON compacto) cabe en 1.200 bytes.
- P4. Carpeta temporal por sesión (propuesta 4). Pi no tiene la carpeta temporal propia que tiene Claude, y sus pruebas acaban en `/tmp` o dentro del repositorio.
  - **Dónde:** `bin/n-ein-dev`, una instrucción añadida al prompt de sistema y `guard.ts` (`scratchDirs`).
  - **Prueba (falso Pi):** recibe `TMPDIR` apuntando a una carpeta `n-ein-pi.*` nueva, y la instrucción lleva su ruta. Al arrancar, se borra la carpeta de un lanzador muerto y se conserva la de uno vivo. El relevo a Claude recibe el `TMPDIR` original.
  - **Prueba (guarda):** con el `TMPDIR` cambiado, `rm -rf` sigue pasando dentro del temporal del sistema y sigue parándose dentro del proyecto.

## Decisiones

- **Lista explícita de extensiones.** P1 es una lista explícita del usuario, una ruta absoluta por línea; `#` comenta y `~` se expande. No se detectan las extensiones solas: la protección del lanzador («solo los recursos explícitos del paquete») sigue valiendo para todo lo que no está en la lista. Se cargan desde su ruta original para que Herdr y Moshi las actualicen. Los trabajadores del equipo no las cargan, porque `manager.ts` ya elige sus extensiones. La versión para Claude (sus hooks de Moshi y Herdr) queda fuera de este encargo.
- **El comando para volver reabre el mismo canal.** P2 usa `nein` cuando apunta a este paquete y, si no, la ruta absoluta del lanzador que se usó. Lleva el proyecto para funcionar desde cualquier carpeta, en la forma `nein --project <ruta> --runtime pi -- --session <id>`; con Claude, `-- --resume <id>`. El id lo escribe el runtime en un archivo que indica una variable de entorno; gana la última escritura. El aviso propio del runtime no se puede quitar sin parchearlo, así que el nuestro va debajo y explica cuál usar.
- **Una herramienta de preguntas.** P3 es una sola herramienta, `nein_ask`: de 1 a 4 preguntas, de 2 a 4 opciones cada una, la recomendada opcional, «Otra respuesta» siempre disponible y sin selección múltiple. Las preguntas abiertas, y las explicaciones de `intent`, siguen en texto: la herramienta solo recoge decisiones con opciones cerradas. `intent` no cambia, porque es común a los dos runtimes.
- **Carpeta temporal por lanzador.** P4 crea una carpeta por ejecución del lanzador, no por id de sesión, porque Pi puede cambiar de sesión dentro del mismo proceso. Vive en el temporal del sistema y guarda el pid de su dueño en `.owner`. No se borra al salir, para poder revisarla; se borra al arrancar el siguiente Pi cuando su dueño ya no vive. `N_EIN_SYSTEM_TMPDIR` conserva el temporal original para la guarda y para el relevo.
- **Sin reproducir gentle-shell.** La inspiración (su pista para retomar, su carpeta temporal, sus preguntas y su informador para Herdr) se cuenta en `NOTICE.md`, sin reproducir su código ni su texto.
- **Rama apilada.** La rama sale de `feat/conectores-codegraph-review` (sin integrar), porque P2 toca `n-ein-claude-dev`, que esa rama ya cambia. Si esa entra antes en main, esta se integra encima.
- **Fuera de alcance:** sonidos, historial de prompts entre sesiones, cambio automático de modelo, confirmaciones válidas para toda la sesión y el registro de clones de gentle-shell.

## Tareas

- [ ] T1 · Extensiones propias en Pi — lectura de `~/.n_ein/<canal>/pi-extensions` en `n-ein-dev`, test con el falso Pi, guía y diseño, y prueba real con Herdr y Moshi en dev. Blocked by: none.
- [ ] T2 · Pista para volver con n_ein — el id lo guardan Pi (extensión nueva) y Claude (`session.end`); el aviso lo imprimen los dos lanzadores solo con TTY y sin relevo. Tests de texto, de TTY (`script -q /dev/null`) y de id tras `/new`; guía. Blocked by: none.
- [ ] T3 · Herramienta `nein_ask` — núcleo puro con validación y formato del resultado, extensión con `ui.select` e `input`, respuesta en texto sin interfaz, tope de 1.200 bytes, test RPC con Pi real, frase en `pi-only.md`, guía y diseño. Blocked by: none.
- [ ] T4 · Carpeta temporal por sesión — `TMPDIR` propio, limpieza de las carpetas huérfanas, instrucción en el prompt, `N_EIN_SYSTEM_TMPDIR` en la guarda, relevo con el temporal original; tests del lanzador y de la guarda; guía. Blocked by: none.
- [ ] T5 · Revisión y cierre — `review` (T1 carga código de terceros y T4 cambia la guarda), `NOTICE.md`, `scripts/check.sh` completo y cierre del documento. Blocked by: T1, T2, T3, T4.

## Registro

- R1 (24 nov) Petición: «Venga, haz un plan para integrar las 4, luego hago clear y empezamos». Viene de valorar, desde Pi como producto principal, lo que gentle-shell aporta en calidad de vida: «No, valoralo desde Pi, que no lo estoy usando por varios motivos personales, no porq no sea mi producto princiapl».
