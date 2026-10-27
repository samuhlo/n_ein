# p_reviewer: revisor propio de n_ein

## Objetivo

Samu quiere convertir la idea de su proyecto `lang-pr-review` en una herramienta de n_ein: «que cuando haga una PR lo invoque, de un enlace para la revisión, y pueda "interaccionar" entre ellos». Debe ser «totalmente una herramienta de n_ein y con su estética» y, una vez montada, «afinarlo lo máximo posible para que sea útil de verdad en detectar fallos». Con voz docente: «que hasta un niño lo pudiera entender, esto siempre luego ayuda a si tengo que explicar lo que se hizo».

Resultado: Samu revisa el trabajo de n_ein en una página local, entiende qué cambió, ve fallos demostrados, elige qué corregir y n_ein lo corrige; una segunda revisión confirma qué quedó resuelto.

## Autorización

Acuerdo confirmado con `intent` el 20 de octubre: «Confirmo, guardalo». El mismo día Samu autorizó implementarlo: «Vamos a empezar a trabajar en p_reviewer y incorporarlo a n_ein». Sin push ni PR hasta que lo pida.

## Decisiones

- **Nombre:** p_reviewer; se invoca con `nein previewer` y entrada «Revisor» en el Panel. Herramienta con personalidad propia; no se confunde con la skill `review`. Lo único fuera del hogar sigue siendo el enlace `nein`.
- **Solo trabajo de n_ein.** PR de otras personas fuera de alcance, no aplazadas: así hay bucle con el autor y se puede ejecutar código propio.
- **Samu en medio.** Valora cada hallazgo (vale / descartar / investigar, con motivo opcional) y solo lo seleccionado vuelve a n_ein. Evita corregir falsas alarmas; sus valoraciones son datos etiquetados para medir.
- **Rama local** con base y head fijados por SHA; la PR, si existe, es un enlace. No depende de `gh` y sirve antes de abrir la PR.
- **Vuelta por la conversación.** Samu dice «aplica la revisión»; el agente lee la selección con `nein previewer handoff` y la trabaja como encargo normal (tareas en `WORK.md`, commit por tarea). La web nunca escribe en el repositorio; funciona en Pi y en Claude. *Ajuste técnico del 20 de octubre:* el agente llama a `"$N_EIN_ROOT/bin/n-ein-previewer" handoff` desde la skill `previewer`, como `to-pi` con `n-ein-prepare-pi`, porque dentro de una sesión `nein` puede apuntar a otra instalación; `nein previewer` queda para Samu con T7.
- **Modelo del revisor (Samu, 21 de octubre):** siempre Sol 6.1 (`openai-codex/gpt-6.1-sol`, esfuerzo alto) por Pi, fijo en el código y sin seguir la tabla de modelos. Nunca Claude, tampoco cuando lo invoca una sesión de Claude Code.
- **Motor: el agente de n_ein sin interfaz**, en solo lectura respecto a la rama y con CodeGraph para seguir consumidores fuera del diff. El banco del tramo 1 compara revisor de la misma familia que el autor frente a otra familia (Sol ↔ Opus) antes de fijar el valor por defecto; Samu acepta el gasto de cuota de Claude.
- **Ejecuta en copia aparte:** tests del proyecto y sondas desechables en una copia en `<repo>-worktrees/` (no `/tmp`, por CodeGraph), fijada al head, sin commits ni push, borrada al terminar. *Ajuste técnico del 20 de octubre:* la copia es un clon local sin remotos ni hardlinks, no un `git worktree`, porque un worktree comparte ramas con el original. Bash y sondas corren bajo aislamiento del sistema (`sandbox-exec` en macOS, `bwrap` en Linux) que solo deja escribir en la copia, temporales y cachés; sin aislamiento utilizable, la revisión es solo de lectura y lo dice.
- **Voz docente.** Recorrido guiado (qué cambia, por qué importa, en qué orden mirarlo) en lenguaje que entendería un niño; detalle técnico (SHA, citas, salida de tests) plegado. El recorrido sale de la misma ejecución del revisor, que ya leyó todo; el motor solo admite archivos del diff, cada uno una vez, y lo que no explique va a un paso final «Archivos sin explicar».
- **Segunda revisión por hilos (técnica, 20 de octubre).** Cada hallazgo pertenece a un hilo, el id de su primera aparición; valoración y selección van por hilo y no se pierden al revisar otra vez. La revisión siguiente recibe los hilos abiertos (`P1`…), con sus sondas restauradas en la copia, y dice si siguen o están resueltos. Desde el afinado autorizado el 27 de octubre, solo un resultado explícito de la condición mantiene o resuelve automáticamente el hilo. Un escenario no aplicable, un error o un resultado antiguo quedan sin comprobar. Una resolución por inspección exige citas al head actual y se etiqueta como tal; una sonda nueva debe justificar su relación con el arreglo. Lo que nadie comprueba queda «sin comprobar»: deja de estar vigente pero sigue en la selección, marcado en el traspaso para reproducirlo antes de tocar código. Lo descartado se le menciona al revisor solo para que no lo repita.
- **Lanzamiento:** al cerrar un encargo o abrir una PR, n_ein propone en una línea «¿Abro el revisor?»; Samu también lo abre a mano. Nunca automático: cuesta modelo y tiempo. *Técnica, 20 de octubre:* `nein previewer` abre la revisión de la rama y `nein previewer review` la hace. En el Panel, «Revisor» (`r`) abre si el head ya está revisado y, si no, propone «revisar la rama» o «volver a revisar»; el launcher solo lee el resumen de `n-ein-previewer status`, que no crea el almacén.
- **Stack:** TypeScript con Bun gestionado, `bun:sqlite`, `Bun.serve`; sin LangGraph (el ritmo lo marca Samu; n_ein ya aporta el bucle de agente). Lo instala el instalador de Go. *Ajuste técnico del 20 de octubre:* la web no se compila en el build de la release sino al arrancar el servidor, desde la fuente que trae el paquete. Bun siempre está, la compilación tarda milisegundos y no hay un artefacto que pueda quedar desfasado de su fuente; el smoke del paquete y `doctor --runtime` comprueban que compila.
- **Web (técnica, 20 de octubre).** Sin dependencias nuevas: `Bun.serve` en `127.0.0.1` con un servidor por canal que se apaga tras 2 h sin uso, y `Bun.build` compila `previewer/web/main.ts` al arrancar. El enlace lleva un token en el fragmento, que no viaja en las peticiones de página y se borra de la barra. La API exige su cabecera, el `Host` propio y JSON, contra DNS rebinding y formularios de otras webs. Las vistas se generan como texto con escape automático, porque todo lo que pintan viene del modelo o del repositorio. Colores desde `brand.json` y el tema `ein`; sin resaltado de sintaxis, que pediría `shiki`. Los archivos largos sin hallazgos empiezan plegados, y lo descartado no marca el diff.
- **La skill `review` no cambia** y su informe no se entrega al revisor, para que mire sin ideas previas.
- **Técnicas (del agente):** sesiones en el hogar del canal (`~/.n_ein/<canal>/`), nunca en el repo; servidor solo en `127.0.0.1`, arrancado al abrir el revisor; idioma de la interfaz = idioma de conversación de n_ein; macOS y Omarchy.

## Hechos y referencias

- `lang-pr-review` (`/Users/samu/Documents/01_Proyectos/lang-pr-review`, rama `feat/review-fix-handoffs`, `54f9ee3`) se queda intacto: es referencia de comportamientos, no código a portar. Python + LangGraph + FastAPI; su PR #1 sigue abierta.
- Reutilizable de allí: modelo de hallazgo (condición, consecuencia, citas `ruta@SHA:Lnn`, vigencia por head), invariantes (valoración humana independiente del análisis; un hallazgo antiguo no desaparece sin decisión), interfaz `web/src/code-view.ts` y `web/src/finding-markers.ts` (TS propio), corpus `evals/corpus/` (6 casos Python), recorrido Entender → Revisar → Decidir.
- Evidencia previa: en `docs/PRUEBA_PR_HISTORICAS.md` encontró un fallo real (UTF-8 cortado en Ein #504). Su único ensayo de evaluación con Codex agotó 180 s sin respuestas: la calidad de detección no está medida.
- n_ein ya ejecuta agentes sin interfaz: `evals/bench/run.sh:100` (`pi -p --mode json`), `evals/bench/conversation.ts:102`, `evals/bench/judge.ts:94` (`claude -p`). Infraestructura de banco en `evals/bench/`.
- Bun desaconseja `better-sqlite3` en favor de `bun:sqlite` (documentación de Bun, consultada el 19 de octubre).

## Límites

Fuera de alcance: PR de otras personas, chat de preguntas, parches descargables, «Ver cómo quedaría», publicar comentarios en GitHub, modificar `lang-pr-review`.

Aplazado: modo mixto (hallazgos fiables directos a n_ein cuando el banco lo justifique); abrir una terminal desde la web.

## Criterios

- «que cuando haga una PR lo invoque, de un enlace» → flujo de cierre y `nein previewer` → al cerrar un encargo n_ein propone «¿Abro el revisor?»; al aceptar devuelve un enlace `127.0.0.1` que abre la sesión de esa rama y SHA.
- «hasta un niño lo pudiera entender» → recorrido y tarjetas de hallazgo → cada paso y hallazgo tiene explicación en lenguaje llano visible sin desplegar; lo técnico aparece solo al abrirlo.
- «interaccionar entre ellos» → `nein previewer handoff` y la conversación → tras seleccionar dos hallazgos y decir «aplica la revisión», el agente crea esas dos tareas y no otras; la segunda revisión del nuevo head marca cada hallazgo como resuelto, sigue o nuevo.
- Ejecutar sin tocar la rama → worktree de revisión → tras una revisión con sondas, `git status` y el log de la rama no cambian y el worktree ya no existe.
- «útil de verdad en detectar fallos» → banco, en la parte reservada: encuentra al menos 7 de cada 10 fallos conocidos; al menos 7 de cada 10 avisos son válidos; todas las citas existen en el SHA revisado; revisión típica ≤ 10 minutos con tests.

## Tareas

Tramo 1, revisor completo:

- [x] T1 · Motor — dada una rama con base/head fijados, crea el worktree, ejecuta el agente sin interfaz y devuelve hallazgos estructurados con citas validadas y sonda cuando la haya. Blocked by: none.
  - Citas inexistentes en el SHA se rechazan, no se muestran.
  - El worktree se borra también si el agente falla o se cancela.
- [x] T2 · Sesiones — almacén `bun:sqlite` en el hogar del canal: sesión, hallazgos, valoraciones, selección y vigencia por head. Blocked by: none.
- [x] T3 · Recorrido — resumen llano del cambio y partes en orden de lectura, con voz docente. Blocked by: T1.
- [x] T4 · Web — recorrido, diff con marcas, panel de hallazgo, valoración y selección, con estética n_ein; servidor local. Blocked by: T2, T3.
- [x] T5 · Traspaso — `nein previewer handoff`, «aplica la revisión» en Pi y Claude, y la propuesta «¿Abro el revisor?» en el flujo. Blocked by: T2.
- [x] T6 · Segunda revisión — sobre el nuevo head: resuelto / sigue / nuevo, sin perder valoraciones. Blocked by: T1, T2.
- [ ] T7 · Launcher e instalador — `nein previewer`, entrada en el Panel, web compilada en la release, comprobación en `doctor`; macOS y Omarchy. Blocked by: T4.
  - Hecho en macOS: el paquete incluye el revisor y su web; `nein previewer`, la entrada «Revisor» del Panel y la línea `// 003 REVISOR` de `doctor --runtime`. La web compila al arrancar (ajuste en «Stack»).
  - Falta la prueba en Omarchy: `bwrap`, el Panel y `doctor` en Linux.
- [x] T8 · Banco mínimo — 6 casos de lang-pr-review + unos 6 fallos reales TS/Vue (Ein, Planificador, n_ein) reconstruidos antes del arreglo, cambios correctos para falsas alarmas, parte reservada; compara misma familia frente a otra. Blocked by: T1.

Tramo 2, afinado:

- [ ] T9 · Afinado — ampliar el banco con valoraciones reales y comparar estrategias y modelos hasta cumplir los umbrales de Criterios. Blocked by: T8 y uso real.

## Evidencia

- Código en `previewer/`: `src/store.ts` (T2, hilos y comprobaciones de T6, esquema 3), `src/engine.ts` con `git.ts`, `copy.ts`, `citations.ts`, `report.ts`, `runner.ts`, `sandbox.ts`, `guard-rules.ts`; recorrido en `settleTour` (T3); traspaso en `src/handoff.ts` (T5); agente en `agent/reviewer.md` y `agent/guard.ts`. Entrada `bin/n-ein-previewer review|handoff` hasta `nein previewer` (T7); skill `previewer` y propuesta de cierre en `pi-package/flow.md`.
- `tests/previewer-store.ts`, `tests/previewer-engine.ts` y `tests/previewer-handoff.ts` (sin inferencia) en `scripts/check.sh`; `previewer/` entra en `typecheck-agents.ts` y en la regla de `tests/skills.ts` de no nombrar a una persona concreta. La migración v1 → v2 se probó también sobre la base real del canal dev, con copia previa. `./scripts/check.sh` completo pasó el 20 de octubre sobre `9f30069`.
- Web (T4): `tests/previewer-web.ts` cubre el escape de HTML hostil, las marcas en la línea exacta del head o de la base, lo llano a la vista y lo técnico plegado, el orden del recorrido, el rechazo de `Host`, `Origin` y token ajenos o de cuerpos que no son JSON, y el arranque y la reutilización del servidor en segundo plano. El smoke del paquete arranca el servidor instalado y comprueba que la web compila. Visto en Chrome headless con la sesión real de esta rama (7 revisiones, 14 hilos, recorrido de 7 pasos). Por DevTools, en una sesión desechable: el token sale de la URL, «vale» se guarda con su motivo sin cerrar el detalle abierto, lo descartado no se puede enviar y una marca del diff enfoca su hallazgo. En viewport móvil de 390 px no hay scroll horizontal de página. `./scripts/check.sh` completo pasó sobre `95b1fb1`.
- Aceptación de T5 con agente real, en un proyecto desechable con tres hallazgos sembrados (dos seleccionados, uno descartado): tras «aplica la revisión», Pi (`openai-codex/gpt-6-sol`) y Claude crearon exactamente las dos tareas seleccionadas, reprodujeron cada fallo en rojo antes de arreglarlo, hicieron un commit por tarea, no tocaron el descartado y cerraron ofreciendo «¿Abro el revisor?».
- Cuatro revisiones reales de esta rama con `openai-codex/gpt-6-sol` alto (canal dev):

  | Head | Resultado | Tiempo | Coste | Hallazgos | Con sonda reproducida |
  |---|---|---:|---:|---:|---:|
  | `c8e6d04` | done | 252 s | 0,53 $ | 3 | 3 |
  | `e8054f1` | done | 209 s | 0,55 $ | 4 | 3 |
  | `cfe2baa` | failed: el sistema se bloqueó a los 5 min por otra ejecución; venció el límite y borró la copia | 6410 s | 0,39 $ | — | — |
  | `cfe2baa` | done | 311 s | 0,55 $ | 4 | 3 |
  | `a6f926a` | done | 213 s | 0,49 $ | 2 | 2 |
  | `9a62aa8` (primera segunda revisión) | done | 118 s | 0,26 $ | 2 nuevos + 3 siguen | 2; 10 resueltos, 8 con su sonda anterior pasando |
  | `e3dd4ee` (primera con recorrido) | done | 111 s | 0,21 $ | 1 sigue + 2 siguen por sonda | 1 resuelto con su sonda; recorrido de 7 pasos que cubre los 19 archivos sin paso «Archivos sin explicar» |
  | `9eb71ea` (antes de publicar 0.3.0-alpha.1) | done | 234 s | 0,50 $ | 2 nuevos + 1 sigue + 2 siguen por sonda | 2; recorrido de 9 pasos |

  Los 11 hallazgos de las tres primeras revisiones completas eran válidos al revisarlos (valoración del autor, no de Samu) y están corregidos en `e8054f1`, `cfe2baa` y `c16f47f`: guardia esquivable con `cd` relativo, sondas fuera de la guardia, carrera entre revisiones, enlace roto, escritura fuera de la copia, sonda con código 127, líneas vacías finales, falta de aislamiento, procesos de sonda vivos, test dependiente del aislamiento y archivo vacío. Ninguna cita rechazada en las tres revisiones completas. Tras cada una, `git status` y las ramas del repositorio no cambiaron y la copia no quedaba.
  De las tres siguientes, el autor corrigió dos hallazgos nuevos (`AGENTS.md` cargado como instrucciones, en `881d5c7`; restaurar una sonda a través de un enlace, en `e3dd4ee`). Otros dos hilos antiguos siguen abiertos solo porque sus sondas prueban la guardia de texto por separado, que ya no es la protección real; son candidatos a descartar. La revisión de `9eb71ea` encontró dos fallos nuevos, los dos válidos y corregidos con su test en rojo antes del arreglo: leer el archivo de una sonda seguía enlaces y podía guardar un archivo privado de fuera de la copia (`f10944c`), y otra pestaña abierta no veía las decisiones tomadas en una (`ec1edeb`). El hilo «un hallazgo no confirmado sigue seleccionado» queda como decisión de Samu (ver «Segunda revisión por hilos»).
- Launcher y doctor (T7): `go/cmd/n-ein/previewer.go` con `previewer_test.go` (cada estado de la rama da su nota y su acción); `checkPreviewer` en `n-ein-install`, con test de un revisor que falla. `tests/previewer-handoff.ts` cubre `status`: no crea el almacén, cuenta vigentes, sin comprobar y seleccionados, ve el head nuevo y no ofrece revisar la base. El smoke del paquete llama `nein previewer check` desde el launcher instalado. A mano en esta rama, el Panel muestra «Revisor · volver a revisar», porque el head avanzó desde `e3dd4ee`. `./scripts/check.sh` completo pasó.
- Banco (T8, 21 de octubre): `evals/previewer/` con 15 casos congelados, partidos en `dev` y `reserved`. Son 8 fallos conocidos (6 reales de Ein, el Planificador y n_ein, comprobados con `git blame`, y 2 de lang-pr-review), 4 cambios correctos y 2 casos de contexto. Opus revisa por Claude Code (`claude-code/claude-opus-5-5`), con el proceso entero en `sandbox-exec` y sin `CLAUDE.md` ni ajustes. Informe completo en `evals/results/2026-10-21-previewer-bench.md`.
  - **Resultado:** en `reserved`, Sol 6.0 y Opus encuentran 3 de 4 fallos y cumplen los umbrales. En los 8 fallos, Sol 6.0 encuentra 6 y Opus 7.
  - **Sol 6.1:** encuentra 6 de 8: 4/4 en `dev` y 2/4 en `reserved`, por debajo del 70 %. Da menos avisos, 14 frente a 23, todos válidos y ninguno en los cambios correctos.
  - **Coste y tiempo:** Opus cuesta unas tres veces más en estimación y consume cuota del plan de Claude, que se agotó una vez durante el banco. Su revisión más lenta tardó 500 s, frente a 241 s la de Sol.
  - **Jueces:** coinciden en 47 de 50 avisos y casi nunca marcan inválidos, así que la precisión espera a las valoraciones reales (T9).
  - **Sin contaminación** en ninguna ejecución.
- Pendiente de observar: `bwrap` en Omarchy (no probado en Linux).

## Siguiente paso

### Cadenas e integración — autorizado el 27 de octubre

Samu acepta «cadenas y revisión de integración juntas» con «Venga, pues dale». Trabajo en `feat/previewer-chains`, desde `42493af`, conservando el revisor ordinario y su modelo fijo. Sin modificar Prelo, publicar ni actualizar la instalación personal.

- [x] C1 · Fijar una cadena lineal por referencias locales y metadatos de PR opcionales; validar todas las bases y heads antes de ejecutar modelos. Guardar snapshots y progreso para reanudar sin repetir tramos completos.
- [x] C2 · Compartir los hilos entre tramos, preservar valoraciones/selección, evitar duplicados identificados y registrar dónde se detectó, siguió o resolvió cada problema. Una detección no demuestra por sí sola el commit que lo introdujo.
- [x] C3 · Pasada final de integración desde la base inicial al último head, con las garantías de evidencia del tramo anterior. Mostrar claramente revisiones parciales y la vigencia al final de la cadena en web, CLI y traspaso.
- [ ] C4 · Verificar reanudación, cambios de refs, concurrencia en la misma cadena, trazabilidad y aislamiento con pruebas deterministas, casos de Prelo y un recorrido con Sol 6.1 real. Registrar evidencia y completar checks.

Decisiones de implementación: entrada mediante manifiesto preparado por el agente (nombre, base y lista ordenada de heads con nombres/enlaces opcionales); no depender de GitHub ni inferir una cadena de todas las ramas del repo. Una sesión por cadena, snapshots inmutables y una ejecución secuencial por snapshot; el bloqueo afecta solo a esa cadena, no al proyecto. Los mismos SHA y versión de revisor reutilizan lo completado; repetir explícitamente o cambiar el snapshot vuelve a revisar. La web conserva las decisiones y no lanza inferencia ni escribe código.

### Siguiente tramo autorizado: evidencia y segunda revisión

Tras la valoración del banco de Prelo, Samu respondió «Pues dale, vamos con ello» a la propuesta de priorizar la evidencia y el recorrido detectar → reproducir → corregir → confirmar. Se implementa ese tramo en `feat/previewer-evidence-loop`; el resto de líneas de mejora conserva su carácter de propuesta. Sin cambios a Prelo ni a la instalación personal, sin push ni publicación.

- [x] E1 · Resultado explícito de sondas: fallo de la condición, comprobación superada, escenario no aplicable, error de ejecución o resultado inconcluso. Conservar datos antiguos sin presentarlos como evidencia nueva; comparar base/head cuando proceda.
- [x] E2 · Segunda revisión: solo una comprobación pertinente puede confirmar o descartar el fallo automáticamente; una sonda obsoleta no fuerza «sigue», una salida 0 sin resultado no fuerza «resuelto». Mostrarlo en web, CLI y traspaso conservando valoración y selección.
- [x] E3 · Verificar el recorrido con regresiones del banco y un revisor real sobre copias aisladas, incluidos fallo persistente, arreglo real y escenario cambiado. Ejecutar los checks pertinentes y registrar resultados y límites.

Implementación en `f445be3`: resultados explícitos con identificador de condición, comparación opcional en copia de la base, comprobación del código fijado, resolución con citas actuales y esquema 4 compatible con la lectura de datos antiguos. Los lectores antiguos rechazan el esquema nuevo para no interpretar un escenario no aplicable como arreglo. Web, CLI y traspaso distinguen resultados y conservan valoración y selección. La API y el traspaso JSON normalizan la evidencia histórica como inconclusa, sin reescribir su fuente en SQLite.

[Evidencia del tramo](evals/results/2026-10-27-previewer-evidence-loop.md): Sol 6.1 real reproduce el fallo conocido del presupuesto (base pasa, head falla) y confirma el arreglo en una segunda revisión; valoración y selección histórica se mantienen. En Prelo PR 2→PR 4, el escenario cambia y el hilo queda sin comprobar hasta aportar citas actuales del arreglo. Checks completos de macOS y paquete instalado pasan. Datos y scripts en `evals/previewer/evidence-2026-10-27/` y `evals/previewer/evidence-loop.ts`. Se prueba la fiabilidad del recorrido, no una mejora de cobertura ni las demás líneas propuestas. Sin actualización personal ni publicación.

### Encargo del 27 de octubre: banco con las diez PR de prelo-ob

Samu autoriza usar p_reviewer para revisar sus diez PR encadenadas, obtener un banco de datos y afinar la herramienta. Trabajo en `feat/previewer-prelo-bench`, desde `ea2d09a`; `prelo` permanece en solo lectura. No incluye corregir Prelo, publicar comentarios, push ni instalación personal.

- [x] Congelar las diez bases/heads y ejecutar la línea base con Sol 6.1 high; guardar hallazgos, sondas, eventos, consumo y tiempos.
- [x] Contrastar los avisos de PR 1–6 y corregir problemas demostrados del revisor. Reservar PR 7–10 hasta fijar la candidata; la dependencia entre PR limita la independencia de esa muestra.
- [x] Comparar candidata y línea base, verificar regresiones y entregar resultados y datos reproducibles con límites explícitos.

Manifiesto en `evals/previewer/prelo/manifest.json`; ejecutor en `run.ts`. Cada caso reconstruye solo base/head, comprueba sus árboles contra los originales y usa una base de datos distinta por variante. Datos completos locales bajo `.n_ein/prelo-bench-20261027/`; credenciales en su hogar nativo. Primer intento dentro del sandbox de Codex falló por no poder crear los locks de Pi y no disponer de sandbox anidado; queda registrado como intento fallido, no como revisión sin fallos.

Resultado del encargo: [informe y límites](evals/results/2026-10-27-previewer-prelo.md). Veinte revisiones comparables, 25 intentos conservados y 22 grupos atribuibles entre ambas pasadas. Base: 13 avisos atribuibles y 2 problemas previos; candidata: 17 atribuibles y 1 dudoso. La candidata aporta 9 grupos y omite 5 de la base; sobre las 12 referencias de desarrollo pasa de 9 a 8 coincidencias. No se certifica una mejora uniforme ni el umbral general del 70 %, y T9 sigue abierto a valoraciones humanas y otros proyectos.

Corregidos en `799aef8` el índice de CodeGraph del padre en repos anidados, y en `e48a738` la clasificación de errores de preparación de sondas y las instrucciones de revisión. Ambos fallos tienen regresiones rojo→verde. Checks completos de macOS, paquete instalado y tipos pasan; web comprobada para las 20 sesiones. Las PR de GitHub conservan base/head y `prelo` conserva estado y referencias. Sin push, comentarios, instalación personal ni cambios a Prelo. Enlaces privados del banco en `.n_ein/prelo-bench-20261027/reviews.md`; datos exportados, etiquetas y scripts en `evals/previewer/prelo/`.

T1 a T6 y T8 terminados; T7 hecho en macOS, falta la prueba en Omarchy. Revisor fijado por Samu el 21 de octubre: «siempre sería Sol 6.1 y listo. Nada de claude aunq se invoque desde claude». Sigue T9 con uso real. La detección en `reserved` (2/4 con Sol 6.1) queda por debajo del umbral y es lo primero que mide T9. Decisión abierta para Samu: si un hallazgo seleccionado que la última revisión no comprobó debe seguir en el traspaso, marcado, como ahora, o salir de él.
