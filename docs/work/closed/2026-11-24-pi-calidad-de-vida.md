# Calidad de vida en Pi

Estado: cerrado · Rama: feat/pi-calidad-de-vida · Tests: `./scripts/check.sh`
Autorización: «Venga, haz un plan para integrar las 4, luego hago clear y empezamos»: implementar las cuatro mejoras en esta rama tras el clear, un commit por tarea. Sin integrar en main, publicar ni tocar la instalación preview; las pruebas reales usan el canal dev.
Objetivo: Pi, el producto principal de n_ein, recupera los avisos de Moshi y Herdr, dice cómo volver a una sesión con n_ein, pregunta con opciones y tiene una carpeta temporal por sesión.
Siguiente: ninguno; las cuatro mejoras salen con la publicación de 0.9.0-alpha.1.

## Pedidos

- P1. Moshi y Herdr en Pi (propuesta 1). `~/.pi/agent/extensions` tiene `herdr-agent-state.ts` (Herdr, integración v8) y `moshi-hooks.ts` (moshi-hook 0.3.21), pero `bin/n-ein-dev` arranca Pi con `--no-extensions` y su propio hogar, así que ninguna se carga.
  - **Dónde:** `bin/n-ein-dev` (también se llega por `runtime.go` y por el relevo de Claude a Pi) y un archivo nuevo `~/.n_ein/<canal>/pi-extensions`. También arrancan `n-ein-dev` con el hogar real `doctor --runtime` (`go/cmd/n-ein-install/main.go`) y `tests/ordinary-pi.ts`: no deben leer la lista.
  - **Prueba:** con el falso Pi de `tests/launcher.sh`, cada ruta de la lista llega como `-e`. Una ruta que no existe avisa con `[WARN]` y Pi arranca igual. Sin el archivo, los argumentos no cambian. doctor pasa con una lista personal rota (`installer_test.go`).
  - **Prueba real** (canal dev, dentro de Herdr): el panel de Herdr pasa de trabajando a parado con el turno, y Moshi avisa en el móvil al acabar. Esta prueba manda un aviso a tu móvil.
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

- [x] T1 · Extensiones propias en Pi — `0e5d11f`. `tests/launcher.sh` y `TestDoctorRuntimeSeparatesPackageAndDependencies` (rojo y verde); real en dev: Herdr `idle → working → done` con `source: herdr:pi` y Pi arrancó con Moshi cargado. El aviso del móvil no se comprobó: Samu no usa Moshi ahora y lo da por bueno.
- [x] T2 · Pista para volver con n_ein — `06e6f3d`. `tests/resume.ts`, `tests/resume-pi.ts` (Pi real, `/new` y dueño ajeno), plugin de Claude y lanzadores con `script` (rojo y verde; mutaciones de TTY, relevo y dueño detectadas); real en dev: Pi tras `/new` y Claude tras `/clear` reabren su sesión desde `/` con el comando impreso.
- [x] T3 · Herramienta `nein_ask` — `49f3f28`. `tests/ask.ts` (780 de 1.200 bytes) y `tests/ask-pi.ts` con Pi real en RPC y `-p` (rojo y verde), modo `asking` y recibo; real en la TUI de dev: lista con la recomendada y «Otra respuesta», recibo `1 respuesta` y el modelo recibe la opción.
- [x] T4 · Carpeta temporal por sesión — `98cdfd3`. `tests/launcher.sh` (TMPDIR, instrucción, limpieza de huérfanas), `tests/handoff-launcher.sh` (Claude recibe el temporal original), `tests/guard-pi.ts` y `TestDirectoryLeaseUsesSystemTemp` (rojo y verde); real en dev: borra la huérfana al arrancar, el agente usa su carpeta y esta queda al salir.
- [x] T5 · Revisión — `34ad1e8`. `review` desde `c50498f` con sondas propias; corregidos la pista tras `-p`, la caché en frío de Pi y dos menores; `NOTICE.md`; `./scripts/check.sh` completo en verde sobre el código final.
- [x] T6 · Cierre del documento — registro resumido y documento en `docs/work/closed/`.

## Registro

- R1 (24 nov) Petición: «Venga, haz un plan para integrar las 4, luego hago clear y empezamos». Viene de valorar, desde Pi como producto principal, lo que gentle-shell aporta en calidad de vida: «No, valoralo desde Pi, que no lo estoy usando por varios motivos personales, no porq no sea mi producto princiapl».
- R2 (24 nov) Resultado: las cuatro mejoras en la rama, con un commit por tarea y otro de la revisión. Lo que no dicen los commits: Pi 1.6 no arranca si una extensión no carga y sugiere `pi -ne`, inútil en n_ein, por eso `PI_EXT_CHECK`; `doctor --runtime` y `tests/ordinary-pi.ts` apuntan la lista y el temporal a los suyos; la extensión de la pista solo escribe si su padre es el lanzador; el instalador empaqueta por lista los archivos sueltos de `pi-package/` (sin `resume.ts`, la pista fallaba en silencio en preview y estable); las líneas `! rg -q` de los tests de shell no fallaban nunca bajo `set -e`, y se cambiaron por `absent`; la carpeta temporal por sesión enlaza `jiti` y fija `NODE_COMPILE_CACHE` en el temporal del sistema para no compilar en frío (0,56 s frente a 0,20 s).
- R3 (24 nov) Comprobación final: `./scripts/check.sh` completo en verde sobre `34ad1e8`. Moshi: Samu, «No estoy usando moshi ahora mismo, me fio».
- R4 (24 nov) Pendiente fuera del encargo: `nein_ask` no emite `herdr:blocked`, así que Herdr muestra `working` mientras espera la respuesta (propuesto); los hooks de Moshi y Herdr para Claude; el router eligió el modelo de riesgo ante la palabra «sesión» en una prueba. Las carpetas `n-ein-pi.*` que aparecían en el temporal real durante `check.sh` las dejaban `tests/agents-read.ts` y `tests/team-pi.ts`, que además cargaban la lista real de dev; se aislaron al preparar 0.9.0-alpha.1.
