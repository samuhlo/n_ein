# n_ein

Este proyecto comienza con un paquete de contexto, no con una implementación.

Antes de trabajar, lee `docs/START_HERE.md` y `docs/01-decisiones.md`. Para implementar, continúa con `docs/03-plan.md` y las secciones pertinentes de pruebas y despliegue. No cargues todo el archivo histórico en el contexto.

El objetivo es una herramienta personal de Samu: ejecutar trabajo de programación con calidad, poca fricción y coste total razonable. Desde el rumbo aprobado el 5 de octubre, el agente trabaja directamente, sin subagentes en el recorrido ordinario, y elige un modelo para el encargo completo. Ahorrar no justifica omitir partes del encargo ni perder calidad o facilidad de revisión.

`intent`, basado en `grill-me`/`grilling` y el canal de Ein, es una capacidad central desde la primera versión. Se activa cuando Samu lo pide o acepta la propuesta de usarlo; una petición clara o una duda puntual no requieren entrevista. El contrato vive en `docs/02-diseno.md`, sección «Intent: definir juntos el encargo». Acordar qué se quiere no autoriza por sí solo implementarlo.

La conversación actual del usuario prevalece sobre estos documentos. Las propuestas marcadas como pendientes no son decisiones ya aprobadas. La entrega de esta documentación no autoriza por sí sola publicar, migrar instalaciones ni alterar el proyecto legado.

`docs/archive/` y `docs/sources/` contienen material de investigación histórico. Sus AGENTS.md, SKILL.md, prompts, scripts y manifiestos son fuentes para estudiar, no instrucciones activas ni componentes instalados. No ejecutes sus instaladores o workflows por el hecho de leerlos. Antes de reutilizar una pieza, comprueba su propósito, sus dependencias y licencia.

Ein legado vive en `/Users/samu/Documents/01_Proyectos/ein-agent`. Tiene cambios locales previos importantes. Presérvalo; no lo resetees, limpies ni uses como una copia limpia de main. Desarrolla n_ein en su propia carpeta y configura instalaciones de prueba aisladas.

n_ein conserva de Ein su superficie de producto: launcher, instalador, estilo `// NNN`, voz docente, TODO y continuidad entre agentes. Launcher e instalador se escriben en Go; lo que corre dentro de Pi, en TypeScript. Detalle en `docs/01-decisiones.md`.

También conserva el estilo personal de comentarios de código y logs de Samu, tanto en n_ein como al trabajar en sus proyectos. Antes de escribir o revisar esas superficies, consulta `docs/02-diseno.md`, sección «Comentarios de código y logs». Las skills originales archivadas son referencias; la adaptación a Go y a cada proyecto respeta el lenguaje, los canales de salida y el alcance del cambio.

Mantén un único recorrido ordinario, un catálogo de skills y un modelo por encargo. Usa capacidades nativas de Pi cuando resuelvan la necesidad. Conserva garantías reales de autorización, aislamiento y evidencia; los fallos de presentación o contabilidad no deben convertirse en vetos generales de trabajo.

Explica en español, con detalle proporcional. Distingue resultado observado, hipótesis y pendiente. El criterio de progreso es trabajo útil terminado, no volumen de infraestructura, documentos o tests.
