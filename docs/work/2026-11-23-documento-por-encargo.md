# Un documento por encargo

Estado: activo · Rama: feat/documento-por-encargo · Tests: `./scripts/check.sh`
Autorización: «Venga, vamos con B»: implementar en esta rama, un commit por tarea; sin integrar en main, publicar ni tocar Miolo.
Objetivo: el documento de trabajo deja de crecer sin fin y de leerse entero: uno por encargo, lo estable arriba, el registro al final y un cierre que lo resume.
Siguiente: T4.

## Pedidos

- P1. «igual es mejor uno por encargo… llevar un registro igual es mejor que no, y dejar solo el git» → `docs/work/<fecha>-<nombre>.md`, cerrados en `docs/work/closed/` → con dos encargos abiertos en ramas distintas, el TODO de cada rama enseña el suyo.
- P2. «se llena de cosas, aunq esten completadas, y esto lo pasa entero a la IA una y otra vez» → formato con `## Registro` al final, lectura hasta el registro, cierre resumido, aviso de tamaño → `nein_work status` no devuelve el registro; el TODO avisa por encima de 25 KB; Pi conserva una sola lectura del documento.
- P3. La prueba de «retomable desde el diff» (sí, 23 nov) → `flow.md` → solo hay documento cuando el trabajo no se puede retomar con la petición y `git diff`.
- P4. Los estados de gentle-shell → núcleo del TODO y launcher → una tarea en espera no es la actual ni cuenta como abierta atrás; una descartada no cuenta.
- P5. Lo que ya funcionaba sigue: `WORK.md` en la raíz (Miolo y proyectos anteriores), `N_EIN_WORK_DOC`, `/todo done|add`, relevo, vista de estado, barra y franja de Claude, launcher.

## Decisiones

- Uno por encargo en `docs/work/`, que queda en el repositorio como registro del producto; al cerrar se resume y pasa a `docs/work/closed/`. El detalle sigue en Git. Elegido el 23 de noviembre frente a «un `WORK.md` y solo Git», por el trabajo en paralelo y el registro de una app que se venderá.
- El activo se elige por la rama de su cabecera; si ninguno coincide, el `WORK.md` de la raíz; si no, el único abierto que no esté en espera. `N_EIN_WORK_DOC` manda sobre todo.
- La rama se lee de `.git/HEAD` sin lanzar Git: la resolución es síncrona y corre tras cada herramienta.
- Formato: cabecera (Estado, Rama, Autorización, Objetivo, Siguiente), `## Pedidos`, `## Decisiones`, `## Tareas` y `## Registro` al final; títulos equivalentes en inglés.
- Sin Engram, sin lista `todo` mantenida por el modelo y sin CLI de creación: el agente escribe el documento con la plantilla del flujo.
- Miolo no se toca: otro agente trabaja allí y su `WORK.md` sigue leyéndose.

## Tareas

- [x] T1 · Núcleo del documento — `work-core.ts` (cabecera, estados, elección) y resolución por rama en `work-doc.ts` · `tests/work-core.ts` rojo → verde.
- [x] T2 · Claude y launcher — la misma elección en el plugin y en Go contra `tests/fixtures/work-repo/expected.json` · Go y `claude plugin test` rojo → verde.
- [x] T3 · Leer menos — `workBrief` para `nein_work status` y `n-ein-work status`, aviso de 25 KB en el TODO y última lectura del documento en Pi · `tests/work-evidence.ts`, `todo-core.ts` y `context.ts` rojo → verde.
- [ ] T4 · Flujo y skills — prueba de reanudación, plantilla, estados, cierre y lectura hasta el registro en `flow.md`, `pi-only.md` y las skills que escriben el documento. Blocked by: T1.
- [ ] T5 · Migración y documentación — el `WORK.md` de n_ein a `docs/work/`, diseño, guía, pruebas y decisión. Blocked by: T1-T4.
- [ ] T6 · Revisión y suite completa. Blocked by: T1-T5.

## Registro

- R1 (23 nov) Petición: «Venga, vamos con B. Vamos dejar nein como un pepinazo de herramienta!», tras comparar gentle-shell 5.0.0 y elegir uno por encargo.
- R2 (23 nov) T1: el modelo pasa a `work-core.ts` y `todo-core.ts` queda para el dibujo. Relevo, vista de estado, continuación y contexto leen el modelo; el relevo lleva las 3 últimas entradas del registro (con 100, su test falla). La fila de contexto del TODO es la última tarea hecha aunque en medio quede una en espera. En este repositorio, la rama elige `docs/work/2026-11-23-documento-por-encargo.md` y no el `WORK.md` de la raíz.
- R3 (23 nov) T2: `expected.json` fija, por rama, documento, tarea actual, cuenta (sin descartadas) y lo que espera; lo cumplen `tests/work-core.ts` y `TestWorkDocFollowsTheBranch`. El launcher dice «en espera: T1» cuando solo queda eso. En Claude, cambiar de rama cambia la franja al cerrar el turno. El contrato de estado del plugin gana `state`.
- R4 (23 nov) T3: con el `WORK.md` de 120 KB de Miolo (`907fe8d`, leído del historial), el estado pasa de 70 KB de JSON a 54 KB de resumen; en el formato anterior lo que queda son criterios, decisiones y objetivo de tareas ya hechas, y eso lo arregla el cierre con compactación de T4. Este documento: 4 KB, con el registro fuera.
