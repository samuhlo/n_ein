# Diseño de n_ein

## Recorrido ordinario

El flujo de n_ein vive en `pi-package/flow.md` y lo reciben Pi y Claude. Pasos: permiso de construir → recuperar decisiones y mirar el código → resolver incertidumbres → conservar petición, consumidores y aceptación → registrar `WORK.md` si hay varias entregas → construir y comprobar tarea a tarea → revisar el riesgo → cerrar contra la petición original. Cada tarea lleva comportamiento, tests, documentación y marca de avance en el mismo commit de una rama de trabajo. El mismo archivo define la forma de `WORK.md`, con títulos en castellano o en inglés según el idioma de los artefactos. Se inspira en el ODD de Gentle Shell, pero es propio: sin memoria Engram, sin límite de 400 líneas por entrega y sin cadenas de PR. Son comportamientos, no fases que generen cada una un archivo o agente.

**Un modelo por encargo.** Desde el 6 de octubre no hay roles delegados (`nein_scout`, `nein_worker`, `nein_reviewer`): el banco mostró que eran entre el 45 y el 63 % del coste sin mejorar el resultado. El principal es `nein/auto`, que elige un modelo para todo el encargo según su clase (mecánico, ordinario, riesgo, abierto) y lo mantiene; [rumbo](09-rumbo.md) y [resultados](../evals/results/2026-10-05-rumbo-resultados.md).

**Idioma de lo que lee el agente.** Persona, flujo, skills y las instrucciones de idioma y preferencias están en inglés: ocupan menos tokens (las skills en castellano medían un 13 % más) y las palabras guía (*tracer bullet*, *seam*, *red*, *frontier*) activan más de lo que el modelo ya sabe. El idioma de las respuestas y de los artefactos lo elige el usuario en el launcher.

El agente investiga, implementa y revisa en la propia sesión. El enrutador usa reglas sobre la petición, sin otra llamada a un clasificador; una petición que también cambia permisos o implementa lógica no se convierte en mecánica por mencionar documentación. «Otra cosa: …» o «Nuevo encargo: …» inicia otro trabajo sin arrastrar la clase anterior; otras formulaciones claras se resuelven con la herramienta de selección según el alcance. Al pasar de un diseño acordado a una implementación autorizada, se puede elegir la capacidad para ese trabajo. Una corrección del encargo conserva su modelo; al cambiar el riesgo solo escala. La ruta física queda en el estado nativo de Pi para reanudarla, y el siguiente encargo lee la tabla guardada. `/nein:nuevo` permanece como atajo. Los límites de autorización, herramientas y entrega los aplica el runtime donde sea posible; no dependen solo de una frase.

## Intent: definir juntos el encargo

Capacidad central desde la primera versión, basada en [grill-me](sources/matt-skills/skills/productivity/grill-me/SKILL.md), [grilling](sources/matt-skills/skills/productivity/grilling/SKILL.md) y el [intent-channel de Ein](archive/ein-workspace/runtime/skills/local/intent-channel/SKILL.md). Su propósito es entender y concretar qué merece construirse antes de gastar en una solución equivocada. Se implementa inicialmente como skill/instrucción invocable del runtime, sin un motor de entrevistas nuevo. El nombre exacto del comando puede adaptarse al host; el usuario lo reconoce como `intent`.

La skill (`pi-package/skills/intent/SKILL.md`) sigue la redacción de `grilling`: sus palabras guía (*implacable*, *árbol de decisiones*, *frontera*, *rondas*) y su formato de ronda, con la pregunta numerada y debajo `▸ Recomiendo:`. Matt usa emoji en ese formato; aquí se cambian por la gramática de STYLE. Lo que n_ein añade va al final y en positivo: el permiso de implementar es aparte y el acuerdo se guarda en `WORK.md`.

### Cuándo se utiliza

| Situación | Comportamiento |
|---|---|
| Petición clara y pequeña | Trabajar con el alcance autorizado, sin activar entrevista. |
| Una duda material concreta | Preguntar esa duda y continuar cuando se resuelva. |
| Idea abierta o decisión importante | Proponer `intent`, explicando qué incertidumbre ayudaría a resolver; esperar aceptación. |
| Samu pide `intent`, ayuda para pensar/diseñar o una sesión equivalente | Entrar en la conversación de definición, aunque el agente crea entender ya el encargo. |

No activarlo por una palabra clave, número de archivos o fase. Tampoco convertirlo en preflight obligatorio. La capacidad está siempre disponible; no se ejecuta en todas las peticiones.

### Cómo se conversa

Modelar las decisiones y sus dependencias. En cada ronda, formular solo preguntas que puedan contestarse con lo ya conocido; usar preguntas numeradas, recomendaciones y opciones concretas que Samu pueda aceptar, matizar o rechazar. Elegir primero las decisiones que más cambian la siguiente entrega, normalmente hasta tres preguntas por ronda, con recomendación; esperar las respuestas antes de resolver sus dependientes. No exigir activar una skill cuando el usuario ya pidió esa ayuda. Si no hay ninguna idea de partida, comenzar con una pregunta llana, no un formulario.

Los hechos los averigua el agente: reutiliza conversación y evidencia del proyecto, consulta directamente el código y las fuentes pertinentes. Una investigación pendiente solo demora las preguntas que dependen de ella. No obligar a usar Scout ni preguntar a Samu lo que el código ya contesta. Distinguir hechos verificados, propuestas y supuestos abiertos.

Las decisiones de producto, alcance y compromisos relevantes corresponden a Samu. El agente puede resolver detalles técnicos reversibles dentro de las convenciones y del encargo, explicándolos cuando ayuden a juzgar la propuesta. Conservar decisiones ya tomadas; reabrirlas solo ante un cambio o evidencia material, indicando el motivo.

### Cuándo se cierra y qué queda

La conversación está lista para cerrar cuando el siguiente trabajo tiene objetivo, alcance, decisiones relevantes y criterios de aceptación suficientes. No necesita agotar todas las decisiones futuras: dejar explícitas las incertidumbres aplazadas, separadas de lo fuera de alcance. Si una incógnita impide actuar correctamente en el siguiente tramo, resolverla antes de implementarlo.

Presentar una síntesis del acuerdo y confirmar una vez la comprensión compartida. Si el usuario ya ha confirmado esa síntesis, no preguntar otra vez por formalidad. **Confirmar el acuerdo no equivale a autorizar código**: una sesión pedida solo para pensar termina sin implementación; una autorización previa de implementación sigue vigente dentro de su alcance y no necesita renovarse por haber aclarado el encargo. Cambios materiales de alcance sí requieren resolver esa decisión.

Cuando el trabajo necesite seguimiento o Samu pida conservar el acuerdo, guardarlo al cierre en el documento de trabajo existente o en su único documento nuevo: objetivo, decisiones y motivos, hechos con referencias, límites, criterios observables y pendiente. No generar un `intent.md` separado, árbol OpenSpec o segunda lista de tareas. Para un acuerdo pequeño puede bastar la conversación. Abandonar la entrevista antes de confirmar no crea ni altera artefactos del proyecto, salvo petición explícita de guardar el borrador.

Ese acuerdo sirve al agente que implementa, y al siguiente agente si hay relevo. Se transmite el contexto pertinente sin repetir la entrevista ni expandirlo hasta convertirlo en una implementación línea por línea.

## Delegación retirada del recorrido ordinario

Los tres apartados siguientes conservan criterios del diseño inicial como referencia. Desde el rumbo del 5 de octubre no hay runner de trabajadores ni roles instalados: las prácticas de alcance y evidencia se aplican al agente que trabaja y al destino de un relevo, sin delegación económica. La decisión actual y su banco viven en [rumbo](09-rumbo.md).


Comparar coste incremental desde el contexto actual. Delegar añade preparación, contexto del hijo, ejecución, comprobación, integración y rescates. Leer un segundo archivo o escribir el test de un arreglo no obliga a delegar.

Favorecer el barato cuando hay un resultado de tamaño útil, contexto localizable y comprobación clara. No prepararle una implementación línea por línea para justificar su existencia. Puede diagnosticar, probar hipótesis, editar y hacer mejoras locales necesarias. No amplía el objetivo ni publica por iniciativa propia.

El modelo capaz conserva la visión del encargo y resuelve decisiones difíciles. También puede implementar. Aumentar razonamiento o capacidad es una herramienta válida; evitar tanto el escalado automático por cualquier error como mantener al barato en un bucle improductivo.

## Encargo mínimo

Incluir:

- Resultado esperado y alcance autorizado.
- Contexto o referencias suficientes, sin volcar todos los archivos.
- Criterios observables y comprobaciones pertinentes.
- Fallos conocidos de la base: identificar el caso o síntoma concreto, el comando que lo reproduce y la revisión/entorno donde se observó. No eximir un comando completo: si la suite fallaba por X y ahora falla también por Y, Y se investiga. El trabajador reporta el fallo previo sin ampliar el alcance para arreglarlo. Si impide comprobar el comportamiento afectado, la verificación sigue incompleta. Idea adaptada de `## Known environmental failures` de Gentle Shell.
- Restricciones especiales solo cuando cambien el trabajo.

Cwd, identidad de ejecución y configuración efectiva deben proceder del runtime. Si el alcance no está claro, investigar o resolver esa decisión; no pedir al humano que invente listas técnicas de rutas cuando el agente puede derivarlas.

El retorno contiene resultado completo/parcial, cambios, comprobaciones observadas, discrepancias y pendiente. Su forma puede ser estructurada para el transporte, pero un defecto menor de prosa no invalida automáticamente el trabajo ni obliga a relanzarlo.

Antes de aceptar el resultado, el padre contrasta el encargo, el diff y la evidencia disponible. Si el runtime registró una comprobación pertinente sobre el código actual, no se repite solo para demostrar que ocurrió. Repetir o ampliar checks cuando falte evidencia fiable, haya cambiado el código o exista una laguna de cobertura. Añadir revisión semántica independiente según las consecuencias de un error y la incertidumbre del cambio. El precio o esfuerzo del modelo no activa por sí solo otro verificador; su fiabilidad observada informa la decisión.

## Trabajadores

Tres capacidades iniciales: exploración de solo lectura, trabajo con escritura autorizada y revisión. Un mismo mecanismo las ejecuta con herramientas y contexto apropiados. Ninguna es un paso obligatorio de todo encargo.

Un escritor por árbol compartido como configuración inicial. Si se necesita paralelismo de escritura, aislamiento explícito en worktrees y comprobación de la integración. No confundir que cada rama pase tests con que la combinación sea correcta.

El runner debe cancelar, distinguir proceso vivo de salida final, gestionar herramientas largas y devolver resultados por eventos cuando lo soporte. No implementar polling del modelo para dibujar progreso. Su fallo no debe perder el diff.

Una revisión de solo lectura es un posible primer ensayo del transporte porque evita escrituras. Eso no demuestra que revisar sea fácil o barato: puede exigir requisitos, consumidores y contexto fuera del diff. La idea de menor presión de contexto en `retro` de Matt se trata como hipótesis. Evaluar al revisor por defectos detectados, omisiones y falsos positivos; evaluar ahorro de implementación con un encargo de escritura acotado. No promover una ruta por la apariencia convincente de su informe.

Pi no trae subagentes en su núcleo. Candidatos concretos para el runner y contrato que deben superar: ver [pendientes](08-pendientes.md#runner-de-trabajadores).

Los presupuestos efectivos incluyen todos los intentos del encargo. No prometer un límite de tokens o turnos que la versión del runner ignore. Un agotamiento deja estado parcial y devuelve control; no desencadena un finalizer que declare éxito.

## Skills

Catálogo (2 de octubre), escrito como propio de n_ein y sin citar a terceros (la procedencia está en `pi-package/NOTICE.md`). Las lanza el modelo cuando tocan: `intent`, `tdd`, `diagnose`, `review`, `design`, `glossary`, `research`, `prototype`, `pr`, `agent-docs`, `comments` y `logs`. Desde el corte conversacional del 6 de octubre, el agente carga también `spec` y `tasks` cuando un encargo autorizado necesita guía y organización, sin confirmaciones rutinarias sobre seams o tamaño de tareas. `to-pi` se carga cuando el usuario pide explícitamente continuar con Pi, también en lenguaje normal. `retro` y `tell-again` conservan la invocación manual. Nombres cortos sin prefijo. Se quedaron fuera por ahora `teach` (cuatro formatos propios), `handoff` (lo cubre el relevo), las que dependen de un gestor de incidencias (`triage`, `wayfinder`, `setup-…`) y las de TypeScript o cursos. Licencia y procedencia en `pi-package/NOTICE.md`. `intent` sigue la activación explícita o propuesta aceptada descrita arriba. Instalar y activar son decisiones diferentes: solo el contenido relevante entra en contexto. Respetar la semántica de invocación del runtime real.

A ese conjunto se incorporan las prácticas propias de Ein `comment-style` y `logging-style` cuando se escribe o revisa código/logs. Las usa el agente que implementa o revisa, tanto en Pi como en Claude. Su alcance y adaptación se definen en [Comentarios de código y logs](#comentarios-de-código-y-logs).

La biblioteca de Matt es fuente de adaptación. Reutilizar su enfoque de interfaces pequeñas, tests de comportamiento, cortes verticales, glosario y decisiones duraderas. Modificar requisitos incompatibles con la experiencia deseada: entrevistas por defecto, aprobación de cada punto de test o dos revisores en todos los cambios. El commit por tarea sí se adopta, en una rama de trabajo y sin push ni PR sin pedirlo (decisión del 2 de octubre). El gestor de incidencias se sustituye por `WORK.md`.

Integración con n_ein: `review` es una pasada en línea, primero la especificación con sondas por petición y después las normas; `research` y `design` leen en la propia sesión; `diagnose` usa CodeGraph para localizar una vez existe el bucle rojo; `spec` y `tasks` escriben en `WORK.md`; `tdd` y `diagnose` consultan `GLOSSARY.md` solo si existe. En `tdd`, «confirma los seams con el usuario» pasa a «el agente declara dónde prueba y sigue», preguntando solo cuando la elección implica una decisión material de alcance o comportamiento.

Piezas adicionales de Matt: `pr` (entrega con evidencia antes/después, reversibilidad y alcance del impacto), `retro` (errores mecánicos como candidatos a comprobaciones deterministas, evitando acumular reglas de prompt) y `claude-handoff`, en `sources/matt-skills/skills/in-progress/`. La skill `handoff` está en `skills/productivity/`. Son referencias para adaptar; ninguna activa commits, nuevas reglas o un mecanismo de continuidad por sí sola.

Un único catálogo de skills en formato Agent Skills (`SKILL.md`). Compartir formato no garantiza idéntica búsqueda, precedencia o invocación. El adaptador de cada runtime determina y prueba dónde desplegar el catálogo y qué otras fuentes se cargan. No instalarlo en `~/.agents/skills` global, porque también lo leen agentes normales y rompería el aislamiento buscado.

Evitar que una skill adaptada y la original se descubran a la vez bajo el mismo nombre. Conservar procedencia y revisión. Actualizar la copia upstream deliberadamente, no cambiar el comportamiento instalado a espaldas del usuario.

## Estado y continuidad

Pequeño: conversación, Git y resultados de herramientas.

Prolongado: un documento con objetivo, decisiones, alcance, criterios, checklist, evidencia y siguiente paso. Reutilizar convención del proyecto cuando exista; no añadir varios tableros equivalentes. Debe poder leerse sin arrancar n_ein.

Al retomar, comprobar repo/cwd/revisión y contrastar documento con diff y comprobaciones actuales. Conservar lo terminado; reabrir solo lo invalidado.

Glosario y ADR describen conocimiento duradero. El documento de trabajo conserva avance. Al iniciar una sesión se leen las instrucciones del proyecto y se recuperan solo las decisiones pertinentes; los hechos fechados se contrastan con el código. Antes de reemplazar un encargo terminado se trasladan sus decisiones duraderas a esos documentos, con razón y fuente, sin duplicar tareas ni historiales. Las preferencias solicitadas por el usuario viven en `~/.n_ein/preferences.md` (o `N_EIN_PREFERENCES_FILE`), común a Pi y Claude y fuera de las instalaciones y canales reemplazables. Ambos lanzadores las añaden como valores por defecto, subordinados al encargo, idioma elegido y convenciones del proyecto; no importan instrucciones globales de otro runtime. Engram queda opcional y fuera del primer recorrido.

### Continuidad entre agentes

Requisito central: Pi↔Claude como primer relevo probado, y facilitar Codex u OpenCode sin construir otro supervisor por anticipación. La documentación consultada el 29 de septiembre de 2026 ofrece estos puntos de integración; no demuestra por sí sola aislamiento ni paridad funcional:

| Necesidad | Pi | Claude Code | Codex | OpenCode |
|---|---|---|---|---|
| Configuración del entorno | `PI_CODING_AGENT_DIR` | `CLAUDE_CONFIG_DIR` | `CODEX_HOME` | `OPENCODE_CONFIG_DIR` añade configuración; no basta para aislar todo el entorno |
| Instrucciones | `AGENTS.md` | `CLAUDE.md` que importa `AGENTS.md` | `AGENTS.md` | `AGENTS.md` |
| Skills `SKILL.md` | sí | sí | sí | sí |
| Arranque con prompt inicial | sí | sí | sí | sí |

OpenCode combina fuentes globales, de proyecto y adicionales; `OPENCODE_CONFIG_DIR` no sustituye las anteriores ([documentación oficial](https://opencode.ai/docs/config/#custom-directory)). Cada integración debe comprobar por separado configuración, instrucciones/skills, sesiones y credenciales: qué se aísla, qué se hereda deliberadamente y qué permanece sin verificar. No presentar una variable de entorno como prueba de aislamiento completo.

Tres piezas:

1. **Estado portable en archivos.** Documento de trabajo, Git y un **resumen de relevo** en markdown que se genera al cambiar de agente: objetivo, autorización vigente, hecho, siguiente paso, decisiones abiertas, comprobaciones con su vigencia (vigente, obsoleta, no ejecutada, desconocida) y rutas cambiadas. Referencia el documento y el diff en vez de copiarlos, como la skill `handoff` de Matt.
2. **Un adaptador pequeño por runtime.** Declarar binario, configuración, ubicación de instrucciones/skills, prompt inicial y, si se necesita, acceso a sesiones. Usar una entrada en `runtimes.toml` (nombre provisional) cuando baste y código mínimo cuando el runtime lo exija. No anticipar una capa universal. Cada integración pasa pruebas reales de arranque, aislamiento y relevo.
3. **El launcher hace el relevo.** `/handoff <runtime>` prepara el cambio; antes de habilitar escrituras en destino, el origen y sus hijos han terminado o han detenido sus escrituras. Entonces se finaliza el resumen con el diff y los resultados realmente disponibles. La vista Runtime arranca el destino con ese resumen como primer mensaje. Si no se puede confirmar la detención, se informa y el destino permanece sin escritura hasta resolverla. El destino contrasta el resumen con el estado actual y marca como obsoleta la evidencia de código que haya cambiado. Este protocolo no requiere un supervisor permanente nuevo.

El launcher Go mantiene un bloqueo de sistema por árbol Git durante toda la cadena de procesos de Pi↔Claude. Una segunda sesión abierta desde el launcher se rechaza antes de arrancar herramientas. El shell conserva un descriptor del bloqueo si muere el padre; no hay servidor permanente ni registro de PID obsoleto que limpiar. En directorios sin Git se usa una clave del directorio físico. Esto coordina las sesiones abiertas desde el launcher; no acredita la detención de herramientas de fondo con descriptores cerrados, lanzadores shell directos ni escritores externos.

No se comparte el historial de conversación, ni se promete paridad de herramientas o de interfaz entre runtimes (lección de la [matriz de runtimes de Ein](archive/ein-workspace/docs-site/src/content/docs/03-runtimes/runtime-matrix.md)).

Ein resolvía el relevo con un checkpoint JSON, un supervisor en PTY, un socket con token y hooks de Claude. Su formato de checkpoint ([límites y avisos](archive/ein-workspace/ein-pi/agent/lib/continuity-checkpoint.ts)) es buena referencia para el resumen; el supervisor es justo lo que se evita. El cambio en caliente dentro de la misma terminal queda como mejora posterior si se echa de menos.

## Evidencia

Un resultado de proceso debe registrar comando real, cwd, salida o referencia, exit code y código comprobado. La identidad de código no puede reducirse a HEAD cuando hay cambios sin commit o archivos nuevos. Reutilizar lo que ya ofrece Pi/CI antes de construir un servicio nuevo.

Separar:

1. Comando ejecutado y resultado observado.
2. Alcance funcional que ese comando cubre.
3. Juicio de revisión sobre requisitos y calidad.
4. Autorización de entrega.

Un recibo de informe demuestra integridad/frescura de ese informe, no toda su veracidad. El éxito de tipos tampoco demuestra comportamiento. Los resultados incompletos se expresan como tales.

TDD aporta cuando existe un comportamiento reproducible y una prueba significativa. No se obliga al mismo ritual para copy, estilo visual o cambios sin un RED útil. Sí se exige la comprobación apropiada. La elección vigente se conserva al delegar y reanudar.

La entrega final y el retorno de un trabajador pueden seguir la forma de la skill `pr` de Matt: resumen visual mínimo, evidencia antes/después, si el cambio es reversible y qué más puede afectar.

Para medir uso se aprovechan los registros de los mensajes del asistente y sus hijos. `usage.cost` puede ser una estimación calculada por Pi a partir de tokens y tarifas del catálogo; no es necesariamente un importe informado o facturado por el proveedor. Etiquetar por separado **estimado**, **facturado** y **desconocido**, conservando tarifa y procedencia cuando existan. En suscripciones puede haber estimación de uso sin coste marginal atribuible. No interpretar un cero, una tarifa ausente o un campo faltante como gratuidad; tampoco sumar dos veces uso del hijo ya agregado por otro registro.

## Interfaz

Dos superficies, con la [gramática visual de Ein](#voz-y-estilo):

- **Dentro de la sesión** (extensiones de Pi, mínimas): actividad de trabajadores sobre el editor y TODO debajo. Detalles de hijos bajo demanda: tarea, modelo/esfuerzo efectivo, tiempo, coste conocido y motivo de espera.
- **Fuera de la sesión**: el launcher.

La atribución de ediciones observadas puede inspirarse en Gentle Shell; el diff Git completo sigue siendo necesario para entregar. Las modificaciones vía shell o externas no desaparecen porque el visor de eventos no las capture.

Los datos desconocidos se muestran como desconocidos, distintos de vacíos. Fallar al renderizar, medir coste o guardar una tarjeta no cambia por sí solo el permiso para trabajar.

### TODO

Conserva el aspecto del de Ein: debajo del editor, la fila actual con `▸`, sin fondo propio. Cambia su fuente: proyecta el checklist del documento de trabajo activo en lugar del `tasks.md` de OpenSpec.

Es una **vista, no una fuente de verdad**: marcar o añadir una tarea escribe en el documento. Sin documento de trabajo no hay TODO; el trabajo pequeño no crea uno para llenar el widget. Si hay varios documentos activos, un comando de foco elige cuál se muestra, como `/ein:focus`. El launcher muestra el mismo checklist en su vista Estado, y Claude, Codex u OpenCode lo leen como casillas markdown sin nada especial.

## Voz y estilo

### Voz

Se conservan las reglas de Ein ([Output en AGENTS.md](archive/ein-workspace/runtime/AGENTS.md), «Identity & voice» y «Samu Output Format» del [orquestador de main](archive/ein-main/runtime/assets/orchestrator.md)):

- Empezar por el objetivo y el efecto en lenguaje cotidiano; después, el mecanismo real paso a paso, definiendo cada término técnico en su primer uso y con un ejemplo pequeño si la idea es abstracta.
- El peso de la respuesta acompaña al peso del cambio. Lo trivial se despacha en una línea.
- El formato completo `// 000 RESUMEN` … `// 006 SIGUIENTE PASO` es para cambios complejos; cuando se usa, `// 002 CÓMO FUNCIONA` es el núcleo. Anti-patrón: informar de «endpoint añadido» sin explicar el mecanismo.
- Español por defecto, directo, sin emojis ni relleno; idioma de artefactos configurable.

Nuevo: **no enseñar lo que Samu ya domina.** El archivo de persona incluye una lista corta y editable de temas conocidos (Git, PRs, ramas, commits, Bun…). Para esas rutinas basta el resultado y su identificador o enlace. La regla de main «explica la jerga en su primer uso, aunque la haya usado el usuario» se matiza: salvo los términos de esa lista. Enseñar se reserva para mecanismos nuevos o que no son evidentes.

La voz vive en un único archivo que llega a todos los runtimes a través de `AGENTS.md`.

### Estilo

El contrato visual es [STYLE.md de Ein](archive/ein-workspace/runtime/docs/STYLE.md), trasladado tal cual:

- Paleta de cuatro colores con fuente única en `brand.json` (Carbon, Concrete, Structure, Yellow) y escala de grises de cuerpo.
- Un solo acento por pantalla; la jerarquía la hacen el aire y el apagado, no los recuadros.
- `// NNN  TÍTULO`, `▏`, `▸`, `·`, `✓`; minúsculas en el texto corrido; `NO_COLOR` y salida sin TTY monocromas.
- Markdown publicado con `## // NNN.`; commits en Conventional Commits sin atribución a IA.

El contrato pide diseño plano, una sola aparición animada y nada de animaciones en bucle. Si se quieren más «virguerías» en la TUI, se revisa el contrato explícitamente; si no, van en maquetación adaptable, transiciones y la marca.

**Marca 004 Panel** (elegida el 1 de octubre entre [seis propuestas](https://claude.ai/artifact/WJrNM4HQfxjxYGSA1nmL6x)): un tablero de estación cuyas palas giran hasta asentarse en `n_ein`, de izquierda a derecha, en 2,2 s; el amarillo es solo la pala del `_`. Es la excepción aceptada a «sin fondos de tarjeta» de STYLE: las palas llevan dos tonos (`#1A1A1A`/`#141414`), solo dentro de la marca. Tamaño grande (39 × 6 celdas, letras en medios bloques) en la portada del launcher y en la cabecera de Pi; pequeño (19 × 3) en el instalador; una pala girando como indicador de trabajo. Go (`go/internal/brand`) y TypeScript (`pi-package/extensions/brand.ts`) la dibujan por separado y sus tests comparan el fotograma final con `tests/fixtures/panel-final.txt`.

**Banner de Pi.** Como el de Ein: la marca abre la sesión y debajo entra en cascada el estado, ordenado por volatilidad (rama y cambios, índice, tarea de `WORK.md`, modelos) y una invitación a contar qué se necesita, con el acceso al selector como ajuste avanzado. El lanzador activa `quietStartup` en el hogar aislado si Samu no lo fijó, para que el listado de recursos de Pi no empuje la marca fuera de pantalla; por debajo de 36 filas el Panel cede al wordmark y el estado pierde los respiros. `PI_SKIP_VERSION_CHECK` evita el aviso de `pi update`: la versión de Pi la fija n_ein.

**`/nein:models`.** Panel superpuesto con la tabla de roles, como el de Ein: enter busca modelo en el catálogo, `e` cicla el esfuerzo, `r` vuelve al paquete, `•` marca lo pendiente y nada se escribe hasta guardar. Claude es una fila de solo esfuerzo. Sin TTY o con `NO_COLOR` se pinta el último fotograma en monocromo.

### Comentarios de código y logs

Son un requisito de legibilidad y de identidad solicitado por Samu. Se conservan las fuentes originales [comment-style](archive/ein-workspace/runtime/skills/local/comment-style/SKILL.md) y [logging-style](archive/ein-workspace/runtime/skills/local/logging-style/SKILL.md). La primera no incluye Go y la segunda se centra en JS/TS: se adaptan sus convenciones, sin presentar los originales como si ya cubrieran todos los lenguajes.

**Comentarios para orientarse y comprender.** En archivos no triviales, una cabecera breve explica la responsabilidad y las secciones ayudan a localizar el flujo. En funciones o pasos complejos, explicar qué papel cumplen, las decisiones, reglas de negocio y trampas que no se deducen fácilmente. Conservar la firma visual de Samu:

```ts
// =============================================================================
// [FLOW] REANUDAR TRABAJO
// Recupera el pendiente y contrasta las comprobaciones con los archivos actuales.
// =============================================================================

// BLINDAJE -> Una edición posterior invalida la comprobación anterior.
```

Etiquetas como `[CORE]`, `[FLOW]`, `[DATA]`, `[AUTH]` o `[UI]` cuando ayuden a navegar. Notas cortas con motivo en mayúsculas y `->` para causa/efecto; como máximo un acento de ese vocabulario por bloque lógico. Sin emojis ni relleno. Nombres claros y explicaciones útiles: no comentar cada línea obvia, ni añadir una cabecera a un archivo trivial solo para decorarlo. El objetivo es que Samu entienda qué hace cada parte relevante y por qué está así.

Aplicar a código propio nuevo y bloques tocados; conservar el idioma coherente del archivo y las convenciones explícitas del proyecto. No reescribir archivos ajenos al encargo para imponer la marca, ni tocar vendor/generados por estilo. En Go, mantener comentarios de documentación y directivas en su forma válida; las cabeceras y etiquetas acompañan esa documentación, no la sustituyen. La adaptación no altera anotaciones con significado para compiladores o herramientas.

**Logs para seguir lo que ocurre.** Un evento por registro, con contexto útil y la gramática original:

```text
[TAG] SEP ACCION :: clave: valor | clave: valor

[DATA] >> COPY_START :: week_id: wk_42
[DATA] ++ COPIED :: activities: 12 | duration_ms: 34
[ERR] :: COPY_FAIL :: reason: invalid_date | attempt: 1
```

Tag de hasta 6 caracteres y acción de hasta 12, ambos en mayúsculas. `::` evento general, `>>` inicio, `++` éxito y `->` salida hacia otro sistema. Alinear columnas cuando resulte sencillo. Registrar decisiones, fallos, operaciones relevantes o lentas; evitar lecturas triviales y ruido por iteración. Los errores aportan contexto diagnóstico sin secretos ni datos personales; usar identificadores seguros cuando proceda.

Integrar con el logger que ya tenga el proyecto y sus niveles. Mantener campos estructurados si los consume una herramienta, con esta presentación para lectura humana. Separar los logs técnicos de la voz de la interfaz y del resumen al usuario. No imprimirlos en el stdout reservado a JSON/RPC ni mezclarlos con el renderizado de la TUI: usar el canal del logger, fichero o stderr que corresponda al entorno. Los logs se añaden cuando hay eventos útiles, no para llenar una cuota.

**Adopción sin otra ceremonia.** Adaptar las dos skills una vez y referenciarlas desde el catálogo compartido. La revisión comprueba claridad y alcance del diff; los tests de comentarios no comparan frases exactas. Para logs, comprobar lo mecánico cuando exista un emisor: nivel/formato, campos, redacción de datos y separación de canales. Una corrección de estilo se hace en el mismo cambio, sin nuevas fases ni rondas de aprobación.

## CodeGraph obligatorio

Las preguntas estructurales (cómo funciona algo, quién llama a qué, qué rompe un cambio) se resuelven con el índice de [CodeGraph](https://github.com/colbymchenry/codegraph) antes que con grep y lecturas sueltas. Una consulta devuelve el código literal de los símbolos, sus rutas de llamada y lo que depende de ellos: menos rondas y menos tokens, sobre todo para el trabajador barato.

- **Binario.** Release oficial por plataforma (lleva su propio Node), versión y SHA-256 en `runtime.json`, copia en `~/.n_ein/runtimes/codegraph/<versión>`. `n-ein-install runtime` y `setup` lo instalan; `doctor --runtime` lo exige. El codegraph del sistema y `~/.codegraph` no se tocan.
- **Índice por proyecto.** `bin/n-ein-codegraph` corre al abrir Pi o Claude en un repositorio git: `init` si no hay `.codegraph/`, `index` si CodeGraph recomienda reindexar tras actualizarse y `sync` en el resto (≈0,2 s sin cambios). Nunca indexa el hogar ni temporales. Los trabajadores hijos no repiten el paso. Un fallo da `[WARN] :: CODEGRAPH_SKIP` y el agente arranca igual.
- **Pi.** Sin MCP nativo, la extensión `codegraph.ts` registra `codegraph_explore`: sincroniza y explora en cada llamada, de modo que tras una edición responde el código actual. El trabajador la recibe también en modos de solo lectura.
- **Claude.** El lanzador pasa `--mcp-config` con `codegraph serve --mcp` y `--settings` con el hook `prompt-hook`, que adelanta contexto en cada petición. Viajan por argumentos: el `~/.claude` habitual no cambia.
- **Persona.** Una regla común: consultar el índice antes de grep/find/read en preguntas estructurales y decir cuándo no estaba disponible.
- `DO_NOT_TRACK=1` en todos los lanzamientos: sin telemetría y sin avisos de versión, porque la versión la fija n_ein.

El índice `.codegraph/` es el mismo que usa un codegraph global instalado aparte. Si ese global es de otra versión, conviene alinearlo para que no reindexen por turnos.

## Launcher e instalador

Se conservan como producto. Se portan sus **comportamientos** (como casos de aceptación) y se reescribe el código en Go.

**Launcher.** Aplicación de terminal con las cinco vistas de Ein ([CLI de Ein](archive/ein-workspace/docs-site/src/content/docs/04-reference/cli.md)), alimentadas por lo nuevo:

| Vista | En Ein | En n_ein |
|---|---|---|
| Estado | proyecto, fase OpenSpec, verificación, git | proyecto, documento de trabajo y su checklist, git, última comprobación y si sigue vigente |
| Configuración | modo, TDD, Hypa, CodeGraph, persona | modelo y esfuerzo efectivos del principal y del trabajador; `/nein:models` en Pi los edita por canal, más el esfuerzo de Claude |
| Sesiones | recientes con la última petición | recientes de todos los runtimes declarados |
| Sistema | actualizaciones y diagnóstico | igual |
| Runtime | elegir Pi o Claude y lanzar | es la **portada**: marca, contexto y menú Pi (`p`), Claude Code (`c`), Codex sin adaptador, sesiones (`s`) y estado (`e`) |

Se mantienen atajos (`tab`, `j/k`, `g/G`, `f` o `/`, `enter`, `q`), `--once`, `--project` y `--no-intro`; sin terminal interactiva pinta una vez y sale. Cada fila de las vistas declara su fuente. La portada sustituye a Runtime porque lo primero que se viene a hacer es abrir un agente; antes quedaba en la quinta pestaña y la pantalla inicial no tenía nada seleccionable. `--view runtime` sigue abriendo la portada.

**Instalador.** Binario separado del launcher, que sirve de vía de reparación cuando el launcher está roto. Verbos `install`, `update`, `doctor`, `restore`, `uninstall`, más `runtime` y `activate`; `setup` los encadena con la superficie del diseño (marca pequeña, `// 000  INSTALAR`, un paso por línea con su pala viva y `✓`), escribiendo solo hacia delante como el progreso de Ein. Se conservan estos comportamientos:

- backup antes de tocar un árbol existente;
- `--dry-run` enseña el plan sin mutar nada;
- el canal elegido solo se guarda tras un update correcto;
- `uninstall` conserva auth, secrets y sesiones;
- nunca toca las instalaciones normales de Pi, Claude, Codex u OpenCode.

Para un hotfix entre releases de preview, construir un candidato desde un commit limpio y pasarle los checks; `update` hace backup y sustitución atómica, `doctor` comprueba la nueva instalación y `restore` recupera la anterior. El identificador `+hotfix.<commit>` distingue el código instalado del tag público sin alterar ese tag. Los datos del canal, incluido `models.json`, permanecen fuera del árbol sustituido.

Cambio respecto a Ein: los paquetes del runtime aislado se instalan con **versión fijada**, no con `@latest`.

### Frontera entre lenguajes

```text
Go  (fuera del agente)   launcher + instalador
TS  (dentro de Pi)       extensiones mínimas: TODO, /handoff, tema de sesión
archivos neutros         brand.json · documento de trabajo · resumen de relevo · runtimes.toml · configuración
```

Los dos lados solo se comunican por archivos. Así Go y TS pintan los mismos colores desde `brand.json` y el launcher lee los mismos documentos que el agente.

Por qué Go, con datos medidos el 29 de septiembre de 2026:

- El binario de Ein (Bun compilado + OpenTUI) ocupa 73 MB (`ein`) y 95 MB (`ein-install`), unos 120 MB en Linux; el de gentle-ai (Go + Bubble Tea), 16 MB.
- En arranque en caliente la diferencia es de décimas (0,05–0,18 s frente a ~0,00–0,04 s). La mejora que se percibe viene sobre todo del diseño y de lo maduro que es el ecosistema, no de la velocidad.
- Bubble Tea, Lip Gloss, Bubbles, Huh y Harmonica son maduros y muy documentados; OpenTUI va por la 0.5 y su API todavía cambia.
- Un solo binario pequeño, compilación cruzada trivial y distribución sencilla encajan con un instalador transaccional.

Coste asumido: dos lenguajes. Samu trabaja a diario en TS/Vue; cuando aparezca algo propio de Go, la voz docente lo explica la primera vez.

## Reutilización técnica

Estudiar `model-config`, descubrimiento de skills, identidad Git y evaluación de Ein. Portar solo las dependencias necesarias. En Gentle Shell, usar los contratos y tests como referencia antes de trasladar `agents-runner` entero: está conectado a más subsistemas. Mapa de piezas de Ein que se conservan: [investigación](07-investigacion.md#ein-piezas-que-se-conservan).

El runner se elige con la primera prueba real, entre candidatos concretos y con un contrato común ([pendientes](08-pendientes.md#runner-de-trabajadores)). No desarrollar dos runners productivos por anticipación.
