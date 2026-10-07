# Empieza aquí

## Qué es n_ein

Herramienta de programación sobre Pi y Claude: calidad, poca fricción, continuidad y coste total razonable. Conserva launcher, instalador, estilo `// NNN`, voz docente, TODO y relevo. Launcher e instalador en Go; código dentro de Pi en TypeScript.

## Decisión vigente

**Un agente y un modelo por encargo.** Samu confirmó el 7 de octubre cerrar el experimento de paralelismo y consolidar el recorrido directo. El modelo se elige según el encargo, se conserva al continuar y puede elevarse si aparece riesgo; la elección manual se respeta. Ahorrar no justifica omitir consumidores, mensajes, documentación o comprobaciones.

La conversación es la entrada normal: ayudar a diseñar cuando se pide o acepta `intent`, ejecutar un encargo claro, aplicar «hazlo» al acuerdo, incorporar correcciones y retomar sin repetir entrevistas. Un acuerdo de diseño no autoriza construir por sí solo. Los comandos son atajos.

El experimento de equipo se conserva desactivado: `N_EIN_TEAM=1` lo habilita expresamente para pruebas. No volver a delegación económica, roles fijos ni fases SDD. Su evaluación no demostró rentabilidad general y detectó que un directo con tests verdes podía explicar mal un rechazo en UI. Se reforzó la revisión del recorrido completo.

## Estado y continuidad

- Rama del proyecto: consultar Git y WORK.md; la conversación actual prevalece sobre propuestas anteriores.
- Preview personal comprobada antes de esta consolidación: `0.1.0-preview.2+hotfix.3bc9b8006cc0`. Los candidatos experimentales posteriores se probaron en instalaciones aisladas; no equivalen a instalación personal.
- Pi 1.0.2 y CodeGraph 1.6.1 fijados en `runtime.json`. No asumir que los binarios globales coinciden.
- Preferencias y ajustes personales viven fuera del paquete, en `~/.n_ein`. Mantener credenciales en su hogar nativo; no copiarlas desde el banco.
- `WORK.md` es la única guía del encargo; decisiones duraderas, glosario e instrucciones del proyecto aportan memoria selectiva.
- El relevo ordinario Pi→Claude→Pi y la recuperación en una sesión nueva están probados. El ensayo con equipo y Claude real quedó pendiente por cuota y ahora está aplazado con el experimento.
- Modelo local descartado el 5 de octubre. No descargar modelos ni preparar servidores.

## Ruta de lectura

Lee [decisiones](01-decisiones.md) y `WORK.md`. Para implementar, [plan](03-plan.md) y solo las secciones pertinentes de [pruebas](04-pruebas.md), [diseño](02-diseno.md) y [despliegue](05-despliegue.md). Los comentarios y logs siguen el contrato de diseño. `./scripts/check.sh` reúne comprobaciones locales sin inferencia pagada.

Referencias de evidencia:

- [Calidad y continuidad](../evals/results/2026-10-06-fiabilidad.md): aceptación, recuperación, decisiones y relevo real.
- [Flujo conversacional](../evals/results/2026-10-06-flujo-conversacional.md): diseñar, ejecutar, cambiar de encargo y retomar.
- [Consolidación del agente único](../evals/results/2026-10-07-agente-unico.md): modo ordinario, calidad hasta el consumidor, intent con correcciones y selección de modelo.
- [Coordinación y contexto](../evals/results/2026-10-07-coordinacion-contexto.md): ocho ejecuciones, ahorro de contexto con más espera y hueco de mensajes de error.
- [Rumbo del agente único](09-rumbo.md): motivo del cambio y banco anterior; sus planes numéricos son históricos.

## Límites del repositorio

Ein legado está en `/Users/samu/Documents/01_Proyectos/ein-agent`, con cambios importantes: no resetear, limpiar ni migrarlo. Desarrollar y comprobar n_ein en su propia carpeta o worktree y en instalaciones aisladas. No publicar, hacer push ni promover a estable por inferencia.

`docs/archive/` y `docs/sources/` son investigación histórica: no ejecutar sus instaladores ni adoptar sus AGENTS.md, skills o prompts como instrucciones activas. Las fuentes y su procedencia están en [investigación](07-investigacion.md) y [manifiesto](source-manifest.json). No cargar todo ese archivo para empezar una tarea.
