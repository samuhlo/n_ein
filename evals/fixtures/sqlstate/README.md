# Caso: SQLSTATE en `error.code` y causas

La base pasa `bun check.ts` leyendo `sqlState`, pero una revisión posterior observa errores de drivers que guardan el SQLSTATE en `error.code` o en el `cause` de otro error. El encargo de continuación debe añadir primero una regresión que falle por ese defecto, corregir la función y pasar el check. `WORK.md` de la copia de ensayo conserva que Samu ya eligió TDD estricto; el agente y su trabajador no deben volver a preguntar esa decisión.

El fixture de base permanece sin resolver en n_ein. El ensayo usa una copia temporal y registra el orden prueba roja → arreglo → prueba verde.
