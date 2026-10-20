# p_reviewer: revisor propio de n_ein

## Objetivo

Samu quiere convertir la idea de su proyecto `lang-pr-review` en una herramienta de n_ein: «que cuando haga una PR lo invoque, de un enlace para la revisión, y pueda "interaccionar" entre ellos». Debe ser «totalmente una herramienta de n_ein y con su estética» y, una vez montada, «afinarlo lo máximo posible para que sea útil de verdad en detectar fallos». Con voz docente: «que hasta un niño lo pudiera entender, esto siempre luego ayuda a si tengo que explicar lo que se hizo».

Resultado: Samu revisa el trabajo de n_ein en una página local, entiende qué cambió, ve fallos demostrados, elige qué corregir y n_ein lo corrige; una segunda revisión confirma qué quedó resuelto.

## Autorización

Acuerdo confirmado con `intent` el 20 de octubre: «Confirmo, guardalo». Samu pidió solo guardarlo en esta rama; **implementar no está autorizado todavía**. Sin push ni PR hasta que lo pida.

## Decisiones

- **Nombre:** p_reviewer; se invoca con `nein previewer` y entrada «Revisor» en el Panel. Herramienta con personalidad propia; no se confunde con la skill `review`. Lo único fuera del hogar sigue siendo el enlace `nein`.
- **Solo trabajo de n_ein.** PR de otras personas fuera de alcance, no aplazadas: así hay bucle con el autor y se puede ejecutar código propio.
- **Samu en medio.** Valora cada hallazgo (vale / descartar / investigar, con motivo opcional) y solo lo seleccionado vuelve a n_ein. Evita corregir falsas alarmas; sus valoraciones son datos etiquetados para medir.
- **Rama local** con base y head fijados por SHA; la PR, si existe, es un enlace. No depende de `gh` y sirve antes de abrir la PR.
- **Vuelta por la conversación.** Samu dice «aplica la revisión»; el agente lee la selección con `nein previewer handoff` y la trabaja como encargo normal (tareas en `WORK.md`, commit por tarea). La web nunca escribe en el repositorio; funciona en Pi y en Claude.
- **Motor: el agente de n_ein sin interfaz**, en solo lectura respecto a la rama y con CodeGraph para seguir consumidores fuera del diff. El banco del tramo 1 compara revisor de la misma familia que el autor frente a otra familia (Sol ↔ Opus) antes de fijar el valor por defecto; Samu acepta el gasto de cuota de Claude.
- **Ejecuta en copia aparte:** tests del proyecto y sondas desechables en un worktree en `<repo>-worktrees/` (no `/tmp`, por CodeGraph), fijado al head, sin commits ni push, borrado al terminar.
- **Voz docente.** Recorrido guiado (qué cambia, por qué importa, en qué orden mirarlo) en lenguaje que entendería un niño; detalle técnico (SHA, citas, salida de tests) plegado.
- **Lanzamiento:** al cerrar un encargo o abrir una PR, n_ein propone en una línea «¿Abro el revisor?»; Samu también lo abre a mano. Nunca automático: cuesta modelo y tiempo.
- **Stack:** TypeScript con Bun gestionado, `bun:sqlite`, `Bun.serve`; sin LangGraph (el ritmo lo marca Samu; n_ein ya aporta el bucle de agente). Lo instala el instalador de Go; la web se compila en el build de la release.
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

- [ ] T1 · Motor — dada una rama con base/head fijados, crea el worktree, ejecuta el agente sin interfaz y devuelve hallazgos estructurados con citas validadas y sonda cuando la haya. Blocked by: none.
  - Citas inexistentes en el SHA se rechazan, no se muestran.
  - El worktree se borra también si el agente falla o se cancela.
- [x] T2 · Sesiones — almacén `bun:sqlite` en el hogar del canal: sesión, hallazgos, valoraciones, selección y vigencia por head. Blocked by: none.
- [ ] T3 · Recorrido — resumen llano del cambio y partes en orden de lectura, con voz docente. Blocked by: T1.
- [ ] T4 · Web — recorrido, diff con marcas, panel de hallazgo, valoración y selección, con estética n_ein; servidor local. Blocked by: T2, T3.
- [ ] T5 · Traspaso — `nein previewer handoff`, «aplica la revisión» en Pi y Claude, y la propuesta «¿Abro el revisor?» en el flujo. Blocked by: T2.
- [ ] T6 · Segunda revisión — sobre el nuevo head: resuelto / sigue / nuevo, sin perder valoraciones. Blocked by: T1, T2.
- [ ] T7 · Launcher e instalador — `nein previewer`, entrada en el Panel, web compilada en la release, comprobación en `doctor`; macOS y Omarchy. Blocked by: T4.
- [ ] T8 · Banco mínimo — 6 casos de lang-pr-review + unos 6 fallos reales TS/Vue (Ein, Planificador, n_ein) reconstruidos antes del arreglo, cambios correctos para falsas alarmas, parte reservada; compara misma familia frente a otra. Blocked by: T1.

Tramo 2, afinado:

- [ ] T9 · Afinado — ampliar el banco con valoraciones reales y comparar estrategias y modelos hasta cumplir los umbrales de Criterios. Blocked by: T8 y uso real.

## Evidencia

Solo documentación de diseño en esta rama; sin código ni comprobaciones todavía.

## Siguiente paso

Samu abre una sesión limpia. Implementar requiere su autorización expresa; con ella, empezar por T1 y T2.
