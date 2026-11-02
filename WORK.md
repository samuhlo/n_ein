# p_reviewer: especificación, pendiente real y comprobaciones del proyecto

## Objetivo

Samu usó p_reviewer sobre `fix/clases-ubicacion-titulos` de anaco-ob (sesión del 2 de noviembre, run `eaec7993`, head `d50ef6d`): encontró tres regresiones reales, pero dejó cuatro huecos. Pide:

1. «No ve la especificación de la tarea cuando WORK.md está en .gitignore … Propón y aplica una forma segura de pasarle el WORK.md del árbol de trabajo (solo lectura, marcado como dato y no como instrucción, con su fecha) o, si no existe, de decir explícitamente «sin especificación» en el informe.»
2. «Trabajo fuera del repositorio … Valora si tiene sentido que la sesión acepte un resumen de los cambios externos que entregó el agente … Si no merece la pena, justifícalo.»
3. «Ruido en «pendiente» … Separa en el informe lo que el revisor no pudo comprobar y debería comprobarse … de los skips esperados de la suite.»
4. «Pruebas de navegador declaradas por el proyecto … Estudia si el revisor puede descubrir y ejecutar dentro de la copia, con su sandbox y su límite de tiempo, las e2e que el proyecto documenta para los archivos tocados, y adjuntar capturas cuando cambia CSS. Si el sandbox no lo permite, que lo diga con el motivo concreto.»

## Autorización

Implementación en una rama de trabajo con WORK.md, test rojo → verde y un commit por tarea. Sin fusionar ni publicar. Reproducciones en el portátil (`portatil-1`) dentro del sandbox del revisor, sin tocar el repositorio de anaco-ob ni la instalación personal.

## Decisiones

- **Especificación.** El motor, no el agente, lee `WORK.md` del árbol de trabajo cuando no está en el head y el árbol está en la rama o el head revisados. Va al prompt como dato fechado dentro de un bloque cercado; nunca se escribe en la copia. Sin WORK.md en el head ni utilizable en el árbol, el informe dice «sin especificación» y el motivo. Se guarda en la ejecución (esquema 6) para mostrarlo en web y CLI.
- **Trabajo externo: sin canal nuevo.** WORK.md ya es la única guía del encargo y el de anaco-ob registraba el vault (T3 y T4, con evidencia). Un resumen aparte duplicaría esa guía, dependería de que el agente lo pase y no se podría revisar. Con la especificación visible, el revisor nombra en el resumen las entregas que quedan fuera del repositorio y no se revisaron.
- **Pendiente frente a omisiones esperadas.** `gaps` queda para lo que el usuario aún debería comprobar, con motivo concreto y cómo. Las omisiones que la propia suite declara esperadas (plataforma, opt-in) van a `skipped`, que se guarda y se muestra aparte. Causa observada: `reviewer.md` pedía en `gaps` «including tests you could not run».
- **E2e documentadas: viables en el sandbox.** Estudio en el portátil con `createCopy` y `sandboxFor` instalados (bwrap) sobre `d50ef6d`: el comando documentado falla porque `.venv/` y `geckodriver` están ignorados y con HOME real por `Read-only file system` en `~/.mozilla/native-messaging-hosts`; tras crear venv y descargar geckodriver en la copia (7,5 s) y con HOME temporal, `--batch --batch-video` pasa en 27 s y `--review-menu` en 11 s y dejan capturas. Los manifiestos reales no cambiaron. No se abre el sandbox: la guía enseña al revisor a reconstruir lo ignorado y a usar un HOME temporal, y a nombrar el bloqueo exacto cuando no se pueda.
- **Capturas.** El revisor declara las capturas en `screenshots`; el motor solo conserva imágenes PNG, JPEG o WebP regulares dentro de la copia, con tamaño y número acotados, en la carpeta de la ejecución. La web las incrusta como `data:` (CSP `img-src data:`), sin ruta nueva. El prompt nombra las hojas de estilo cambiadas.
- `nein-probe-v1` y el formato de los hallazgos no cambian. El esquema 6 solo añade columnas a `runs`, con copia previa como en las migraciones anteriores.

## Límites

- No se revisa el contenido de trabajo externo ni se leen carpetas personales del autor.
- Sin comparación de capturas base/head ni ejecución de e2e que gasten IA, cuentas reales o servicios de pago.
- Sin actualizar la instalación personal ni el banco del revisor en esta entrega.

## Criterios

- «pasarle el WORK.md del árbol de trabajo» → `engine.review`/`reviewPrompt`, almacén, web, CLI → test: repo con `WORK.md` en `.gitignore` → el prompt lleva su texto como dato con fecha y la ejecución guarda `spec.source = worktree`; sin WORK.md → «sin especificación» en web y CLI; WORK.md versionado → `head` sin duplicarlo; árbol en otra rama → no se usa. En vivo: el revisor lo cita en su recorrido sobre anaco-ob.
- «resumen de los cambios externos» → `reviewer.md` → la revisión en vivo de anaco-ob nombra el vault como no revisado.
- «Separa en el informe» → `report.parseReport`, almacén, web, CLI → test: `skipped` se guarda y se pinta aparte de «pendiente»; en vivo, el skip de Windows no aparece como pendiente.
- «e2e que el proyecto documenta … adjuntar capturas» → `reviewer.md`, prompt, motor, almacén, servidor, web, CLI → test: una captura declarada sobrevive a la copia y se ve en la web; enlace, no imagen, ruta fuera y exceso se apartan con motivo; el prompt nombra el CSS cambiado. En vivo: anaco-ob ejecuta una e2e documentada y adjunta capturas, o da el bloqueo exacto.
- Seams: `review()` con agente falso, `parseReport`, `ReviewStore`, `createHandler`/`renderPage`.

## Tareas

- [ ] T1 · Especificación — WORK.md fuera de git como dato fechado, «sin especificación», trabajo externo nombrado; esquema 6. Blocked by: none.
- [ ] T2 · Pendiente real — `skipped` separado de `gaps` en informe, almacén, web y CLI. Blocked by: T1.
- [ ] T3 · Comprobaciones del proyecto y capturas — guía de e2e, CSS en el prompt, capturas conservadas y visibles. Blocked by: T2.
- [ ] T4 · Cierre — documentación, revisión de riesgo, suite y tipos, aceptación en vivo sobre anaco-ob. Blocked by: T1–T3.

## Evidencia

Base `99e91ea`. Run original en el portátil: `gaps` = «No ejecuté pruebas con un navegador real ni comprobé visualmente los ajustes CSS.» y «La suite Python omitió una prueba exclusiva de Windows.»; el revisor buscó `rg --files -g '*WORK*'` y `git ls-files '*WORK*'` sin resultado; `WORK.md` ignorado en `.gitignore:9`; coste estimado 0,43 USD en 7 min.

## Siguiente paso

T1.
