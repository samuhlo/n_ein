# Agente único: calidad, contexto y conversación

## Objetivo

«Venga, pues vamos a implementar todo, y sacar un pepinazo. Dale caña». Consolidar el recorrido ordinario de un agente y un modelo por encargo; revisar de extremo a extremo; explorar con menos contexto redundante; conservar el acuerdo al diseñar y corregir; validar el selector y preparar una preview comprobada.

## Autorización

Implementación, pruebas y commits autorizados. Sin push ni publicación. Trabajar en `fix/agente-unico-consolidado`, worktree `n_ein-single-agent`, desde `2b821ae`. Otro agente sigue trabajando en la interfaz y recibos del checkout original; preservar sus cambios y coordinar la integración al acabar. Paquete y pruebas en destinos aislados; no sustituir la instalación personal mientras se integra el trabajo concurrente.

## Decisiones

- Un agente y un modelo por encargo. El equipo queda experimental y solo se habilita explícitamente; conservar la recuperación y parada de trabajos anteriores.
- Mantener un catálogo, WORK.md como guía y los mecanismos nativos de Pi.
- Conservar hechos, decisiones, instrucciones, errores y checks. Reducir la exploración antes de recurrir a recortes más agresivos.
- El acuerdo de intent no autoriza construir; «hazlo» sí dentro de ese acuerdo. Una corrección modifica solo lo afectado y no reinicia la entrevista ni descarta lo hecho.
- Revisión por comportamiento completo, incluidos rechazo esperado, mensaje y recuperación en sus consumidores.

## Criterios y fronteras de prueba

- Arranque y herramientas de Pi: sin capacidad de delegar ni instrucciones de equipo por defecto; opt-in experimental funciona; datos anteriores preservados.
- CodeGraph: consulta enfocada, amplitud explícita, salida completa recuperable si se recorta y fallos del índice visibles sin bloquear lecturas.
- Enrutador: modelo apropiado para el alcance; nueva tarea permite elegir otra vez; aclaraciones elevan riesgo cuando corresponde; una elección manual no se rebaja ni se sustituye automáticamente.
- Conversación: diseñar sin escribir, ejecutar el acuerdo autorizado, incorporar una corrección sin reabrir decisiones resueltas y retomar con contexto suficiente.
- Caso real de código: cumplir backend, consumidores, mensajes y recuperación, pruebas pertinentes, documentación y commit.

## Tareas

- [x] U1 Consolidar agente único — equipo solo con N_EIN_TEAM=1, instrucciones experimentales separadas, recuperación conservada y documentación vigente. Rojo/verde en registro de herramienta; launcher ordinario y experimental, catálogo y formato pasan.
- [ ] U2 Calidad y contexto — aceptación de consumidores; consultas acotadas y evidencia recuperable.
- [ ] U3 Acuerdo y modelo — intent/correcciones y casos de selección, continuidad y elección explícita.
- [ ] U4 Validación real — dos encargos en copias de planificador: S3 completo y diseño/corrección de S6. Modelo automático real, máximo inicial 4 USD estimados; detener ampliación ante un fallo y conservar trazas. Tests deterministas antes de modelos.
- [ ] U5 Revisión y preview — checks completos, paquete instalado, evidencia, integración compatible con el otro agente.

## Evidencia

Pendiente de este corte. El experimento anterior queda conservado en `evals/results/2026-10-07-coordinacion-contexto.md` y en Git, incluido su candidato `00dab7096225`. No repetir aquel banco. El relevo real con equipos queda aplazado junto con el experimento; el relevo ordinario Pi↔Claude ya tiene evidencia en `evals/results/2026-10-06-flujo-conversacional.md`.

## Siguiente paso

U1: aislar la política experimental del recorrido ordinario y comprobar las dos entradas con Pi.
