# Un documento por encargo

Estado: cerrado · Rama: feat/documento-por-encargo · Tests: `./scripts/check.sh`
Autorización: «Venga, vamos con B»: implementar en esta rama, un commit por tarea; sin integrar en main, publicar ni tocar Miolo.
Objetivo: el documento de trabajo deja de crecer sin fin y de leerse entero: uno por encargo, lo estable arriba, el registro al final y un cierre que lo resume.

## Pedidos

- P1. «igual es mejor uno por encargo… llevar un registro igual es mejor que no, y dejar solo el git» → `docs/work/<fecha>-<nombre>.md`, cerrados en `docs/work/closed/` → con dos encargos abiertos en ramas distintas, el TODO de cada rama enseña el suyo.
- P2. «se llena de cosas, aunq esten completadas, y esto lo pasa entero a la IA una y otra vez» → registro al final, lectura hasta el registro, cierre resumido, aviso de tamaño → `nein_work status` sin registro; el TODO avisa por encima de 25 KB; Pi conserva una sola lectura del documento.
- P3. La prueba de «retomable desde el diff» (sí, 23 nov) → `flow.md` → solo hay documento cuando el trabajo no se puede retomar con la petición y `git diff`.
- P4. Los estados de gentle-shell → una tarea en espera no es la actual ni cuenta como abierta atrás; una descartada no cuenta.
- P5. Lo que ya funcionaba sigue: `WORK.md` en la raíz, `N_EIN_WORK_DOC`, `/todo done|add`, relevo, vista de estado, barra y franja de Claude, launcher.

## Decisiones

- Uno por encargo en `docs/work/`, que queda como registro; al cerrar se resume y pasa a `docs/work/closed/`. Elegido frente a «un `WORK.md` y solo Git» por el trabajo en paralelo y el registro de una app que se venderá.
- El activo, por la rama de su cabecera (leída de `.git/HEAD`); si no, el `WORK.md` de la raíz; si no, el único abierto que no espera. `N_EIN_WORK_DOC` manda.
- Sin Engram, sin lista `todo` mantenida por el modelo y sin CLI de creación. Miolo no se toca.

## Tareas

- [x] T1 · Núcleo del documento — `7f167ee`
- [x] T2 · Claude y launcher — `53587ed`
- [x] T3 · Leer menos — `63a7b3b`
- [x] T4 · Flujo, skills, p_reviewer, relevo de Claude a Pi y launcher — `913ca2b`
- [x] T5 · Migración y documentación — `3642b5a`
- [x] T6 · Revisión y suite completa — `106f58c`

## Registro

- R1 (23 nov) Petición: «Venga, vamos con B. Vamos dejar nein como un pepinazo de herramienta!», tras comparar gentle-shell 5.0.0 y elegir uno por encargo.
- R2 (23 nov) Resultado: los cinco pedidos hechos. Aparecieron tres consumidores por nombre fijo fuera del plan (p_reviewer, `n-ein-prepare-pi`, la vista Estado) y se adaptaron. La revisión encontró que una tarea escrita a mano con guion o semirraya (`- espera:`) contaba como abierta; corregido en TS y Go. Con el `WORK.md` de 120 KB de Miolo, el estado pasa de 70 KB a 54 KB: en el formato anterior el resto solo baja con el cierre resumido.
- R3 (23 nov) Comprobación final: `scripts/check.sh` → `checks locales: OK`; Pi 1.5.2 real elige el documento de la rama por delante del `WORK.md` antiguo, enseña «en espera: T3» y avanza al marcar una tarea a mitad de turno; ramas, subcarpeta, worktree y `main` con dos encargos probados con Git real.
- R4 (23 nov) Pendiente: integrar y publicar; el flujo nuevo llega a Miolo y a los demás proyectos al instalar la versión. Los documentos con el formato anterior siguen leyéndose; cada uno se pasará al nuevo cuando cierre su encargo.
