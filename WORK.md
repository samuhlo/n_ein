# TODO legible, modo de actividad y rama

## Objetivo

Samu ve que el TODO «no funciona muy bien»: «En pi, ni colores, ni el resumen o acortacion, aparece todo y queda horrible»; en Claude «aparece solo la tarea en si»; y «en la app de Miolo, no se mueve de T5 cuando va por la T33». Quiere además «que si esta orquestando ponga orchesting, si esta con codigo, coding, si esta con test testing… esto seria como un mod nuevo» y «otro que marque la rama donde esta trabajando. Todo con el estilo nein». El fin: «saber por donde va y que esta haciendo, tener mas claridad visual».

Pedidos:
1. Arreglar el TODO de Pi: color, recorte y resumen.
2. Un TODO más completo en Claude.
3. Que la tarea actual avance de verdad (Miolo en T5).
4. Mod de modo de actividad: orchestrating, coding, testing…
5. Mod de rama.
6. Todo con el estilo de n_ein.

## Autorización

«hazlo» sobre el plan propuesto el 21 de noviembre: implementación en esta rama con commit por tarea. No incluye integrar en main, publicar ni tocar la instalación personal.

## Decisiones

- **Sin respuesta explícita a las tres preguntas, valen las recomendaciones del plan** («hazlo» tras proponerlas):
  - Modos en inglés y minúscula, también las palabras del spinner de Claude (thinking, writing…): es lo que pidió Samu y mezclar «pensando» con «coding» queda peor. Sustituye la decisión anterior de un spinner en castellano. El resto de la interfaz sigue en castellano.
  - En Claude, el bloque de tareas va en la franja sobre el prompt tras la marca de apertura, plegable con `ctrl+x ctrl+a` y cediendo ante las encuestas; la barra de estado queda compacta. Debajo del prompt solo cabe una línea y el panel lateral no se coloca solo en un portátil.
  - Tarea actual = la primera sin marcar después de la última marcada (si no hay, la primera sin marcar); las abiertas anteriores se señalan aparte. Sin marca nueva en el markdown: GitHub no la pintaría como casilla y obligaría al agente a escribirla.
- **El aspecto sigue el TODO de Ein** (`ein-agent/ein-pi/agent/lib/sdd-overlay.ts`): cabecera con qué a la izquierda y `▸ modo · n/m` a la derecha, filas con `▏`, `✓` y `▸`, id en estructura, recorte al ancho real.
- **Un núcleo puro compartido** en `claude-plugin/hooks/` (como marca y recibos): el plugin de Claude corre sin Node, así que lectura de tareas, regla, filas y modos no importan nada.
- **La cabecera enseña la fase** (modo de la última herramienta mientras trabaja); el spinner, lo que hace en ese instante. En Claude, mientras el modelo escribe la llamada de una herramienta el spinner dice `preparing`: su nombre solo llega por el stream del paso, que no se engancha en esta entrega.

## Límites

- Sin plegado propio en Pi ni panel lateral en Claude.
- Sin cambiar la gramática de casillas de `WORK.md` ni `/todo`.
- Sin hook del stream de pasos de Claude.

## Criterios

- «se queda en T5» → `todo-core.ts`, `work-doc.ts`, `todo.ts`, `bin/n-ein-todo`, `banner.ts`, `go/cmd/n-ein/state.go` → con el fixture de Miolo la actual es T39 con T5 abierta antes, en TS y en Go; con el `WORK.md` de n_ein del 21 de noviembre, T7.
- «ni colores, ni el resumen o acortacion» → `todo.ts` → a 80 y 120 columnas ninguna línea pasa del ancho, hay color salvo con `NO_COLOR`, el título se corta en « — » y el widget cambia al marcar una casilla a mitad de turno.
- «algo mas completa» en Claude → `register.tsx`, `todo-view.ts`, `bin/n-ein-todo` → test del plugin: la franja dibuja el bloque tras la marca, cede ante una encuesta y se refresca tras una edición de `WORK.md`; la barra cabe en la reserva del pie.
- «orchesting… coding… testing» → `activity-core.ts`, `activity.ts`, `register.tsx` → tabla herramienta → modo (Edit de código, de docs y de `WORK.md`, tests, git, Agent y equipo, web, preguntas); el spinner de Claude y el mensaje de trabajo de Pi la usan; lo desconocido dice `working`.
- «marque la rama» → `git-branch.ts`, `branch.ts`, `bin/n-ein-todo` → repositorio en rama, sin rama y sin Git.
- Lo que ya funcionaba: `/todo done N`, `/todo add`, títulos en inglés, `N_EIN_WORK_DOC`, el medidor del pie y los recibos.

## Tareas

- [x] T1 · Tarea actual compartida — `todo-core.ts` con lectura, id y título y la regla nueva; Pi, barra de Claude, banner y launcher la usan. Blocked by: none.
- [x] T2 · TODO de Pi con el estilo de Ein — bloque con cabecera y filas, color, ancho real y refresco tras cada herramienta. Blocked by: T1.
- [x] T3 · TODO en Claude — el bloque en la franja sobre el prompt, barra compacta y reserva del pie compartida. Blocked by: T2.
- [x] T4 · Modo de actividad — `activity-core.ts`, spinner de Claude, mensaje de trabajo de Pi y cabecera del TODO. Blocked by: T2, T3.
- [ ] T5 · Rama — barra de Claude y estado de Pi. Blocked by: T3.
- [ ] T6 · Decisión, revisión y suite completa. Blocked by: T1-T5.

## Evidencia

- T1: `tests/todo-core.ts` (rojo: el módulo no existía) y `TestWorkStateFollowsTheLastDoneTask` en Go (rojo: señalaba «T5 · Puesta en servicio… Blocked by: T4.») pasan con `tests/fixtures/work-focus.md`: T9 actual, T5 atrás, 6/10; la barra de Claude con ese documento dice T9. Sobre los documentos reales: Miolo → T41 con T5 atrás (38/41, ha avanzado desde la mañana); el `WORK.md` de n_ein del 21 de noviembre → T7. `tests/work-doc.ts`, `tests/banner.ts`, `go test ./cmd/n-ein/` y `go vet` OK.
## Siguiente paso

T2.
