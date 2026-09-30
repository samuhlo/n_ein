# Plan de implementación para un repositorio nuevo

Este plan sustituye la parte de migración in situ del informe original. La investigación y los criterios siguen vigentes. Son entregas de producto, no un workflow que n_ein deba imponer a sus usuarios.

**Estado:** este texto conserva la secuencia propuesta antes de implementar. Las entregas 1–4 tienen recorridos locales y una primera preview instalable; los resultados y límites están en el [README](../README.md) y [evals/results](../evals/results/). La entrega 5, sobre Qwen local, está aplazada por Samu hasta tener el hardware.

## Preparación acotada

Inspeccionar la carpeta actual y las instrucciones vigentes. Fijar versiones de Pi y dependencias realmente utilizadas; la instalada al preparar este paquete era `@earendil-works/pi-coding-agent` 0.87.1. Usar el mecanismo nativo de Pi: un paquete local (`skills/`, `extensions/`, `prompts/`, tema) cargado en un hogar propio con `PI_CODING_AGENT_DIR`, sin tocar Pi vanilla ni Ein (`~/.pi-ein`). Tener en cuenta la confianza de proyecto de Pi: sin ella no carga la configuración `.pi` del proyecto.

Crear Git local cuando se empiece implementación y registrar la documentación. Nombre y propietario del remoto quedan pendientes; no publicar por inferencia. Lenguajes decididos: TypeScript/Bun para lo que corre dentro de Pi y Go para launcher e instalador ([frontera](02-diseno.md#frontera-entre-lenguajes)). Go no entra hasta la entrega 4.

Comenzar la entrega 1 con los fixtures sintéticos del [corpus](04-pruebas.md#corpus-inicial). El agente prepara una propuesta de dos tareas reales con base y aceptación concretas para el ensayo posterior; su selección no bloquea el primer prototipo. Las preferencias de voz ya expresadas bastan para arrancar.

No copiar todos los módulos ni inicializar una arquitectura por capas vacías. Cada superficie entra con el primer comportamiento que la necesite.

## Entrega 1: una sesión útil y directa

**Resultado:** arrancar n_ein aisladamente, recibir una petición, editar directamente, comprobar y explicar.

Implementar el arranque mínimo, instrucciones breves y las primeras prácticas adaptadas. Detectar comandos/convenios existentes. Nada de OpenSpec, lane, preflight o siete fases para trabajar.

Incluir `intent` desde esta entrega como skill/instrucción invocable para definir encargos, según su [contrato](02-diseno.md#intent-definir-juntos-el-encargo). Probar una idea abierta con decisiones dependientes, una duda puntual y una petición clara que no entre en entrevista. El agente puede investigar directamente mientras concreta el acuerdo; no depende de tener listo el runner de la entrega 2. El acuerdo confirmado usa el documento de trabajo cuando lo necesite, aunque todavía no exista widget TODO ni relevo automático.

Incorporar `comment-style` y `logging-style` de Ein al trabajo del agente que escribe, según el [contrato](02-diseno.md#comentarios-de-código-y-logs). Desde esta entrega, el código no trivial del fixture debe poder revisarse con cabeceras/notas útiles; si el encargo tiene eventos que registrar, sus logs siguen el estilo personal. No inventar comentarios o logs para cumplir una cuota. Adaptar a Go al implementar launcher/instalador en la entrega 4.

El arranque es un lanzador de shell de unas cuarenta líneas, como `ein-pi.fish` de Ein, que fija el hogar aislado y arranca Pi con el paquete. Desde el primer día: tema con la paleta de `brand.json`, títulos `// NNN` y la voz docente con la lista «Samu ya domina». Instrucciones y skills en formatos portables (`AGENTS.md`, `SKILL.md`).

**Aceptación:** un arreglo conocido y una regresión con test se resuelven en un fixture; una consulta no modifica código; un cambio visual recibe una comprobación pertinente; no hay preguntas administrativas; una rutina conocida (crear una rama o una PR) se informa sin explicarla. Verificar que la instalación habitual no cambia.

Para `intent`: rondas con recomendaciones, sin preguntar hechos ya disponibles; síntesis suficiente para el siguiente tramo, sin resolver todo el futuro. Poder cerrar solo el acuerdo o abandonar sin artefactos. Si ya hay autorización de implementación y el alcance no cambia, continuar sin un segundo permiso administrativo. Ninguna escritura de código se infiere de confirmar una conversación de diseño.

**Pruebas:** arranque real de paquete local, sesión sobre fixture, evidencia de resultados. Tests unitarios solo de lógica necesaria. Reducir una dependencia si solo existe para cargar instrucciones que Pi ya soporta.

**Reversión:** borrar/desactivar únicamente la instalación de desarrollo identificada, conservando los cambios del fixture si se quieren revisar. No alterar Ein.

## Entrega 2: un trabajador barato completa trabajo

**Resultado:** delegar un encargo completo a un modelo alojado y decidir si merece la pena.

Seleccionar capaz habitual y un barato alojado disponible. Elegir el runner entre los [candidatos](08-pendientes.md#runner-de-trabajadores) con el contrato común, empezando por el ejemplo oficial de Pi. El worker puede investigar. El padre puede terminar tareas pequeñas directamente.

Se puede ensayar primero el transporte con una revisión de solo lectura. Para medir ahorro de implementación, usar después una feature vertical o regresión acotada. No asumir que revisar requiere poco contexto: evaluar al revisor con defectos conocidos, omisiones y falsos positivos. El encargo identifica los fallos concretos de la base; el padre acepta evidencia fiable y vigente y repite o amplía comprobaciones cuando el riesgo o la cobertura lo requieran, según el [diseño](02-diseno.md#encargo-mínimo).

El trabajador y el revisor reciben las mismas convenciones pertinentes de comentarios/logs que el agente principal. La delegación económica conserva la legibilidad del resultado y no extiende el diff a archivos intactos solo por estilo.

**Aceptación:** feature vertical y regresión correctas; el caso trivial no se microdelega; un error devuelve resultado parcial útil. Medir coste completo y comparar con directo. No introducir una llamada extra de clasificación.

**Pruebas:** llamada real al runner que se distribuirá, edición/check/retorno; ausencia de modelo y error de proveedor visibles; cancelación conserva avance. No reemplazarlo por mocks en la demostración final.

**Reversión:** desactivar ruta delegada manteniendo ejecución directa y diff existente.

## Entrega 3: comprobar, retomar y relevar entre agentes

**Resultado:** trabajo prolongado puede interrumpirse y continuar, en Pi o en Claude, sin perder decisiones ni fingir verificación.

Documento único, referencia al estado Git y resultados de herramientas. Transportar modo y comandos relevantes al worker inicial y a la continuación. Separar registro auxiliar de permiso de ejecución.

TODO dentro de Pi como vista del checklist del documento. Continuidad según el [diseño](02-diseno.md#continuidad-entre-agentes): resumen de relevo en markdown, `/handoff <runtime>` y adaptaciones mínimas para Pi y Claude. La configuración declarativa puede vivir en `runtimes.toml`; se añade código específico solo si la integración lo requiere. Mientras no exista el launcher en Go, el lanzador de shell usa esa configuración para arrancar el destino después de confirmar que el origen y sus hijos han dejado de escribir.

**Aceptación:** continuar una sesión interrumpida, mantener tareas terminadas, conservar elección TDD; reproducir el caso SQLSTATE de los informes: verify detecta un defecto, la continuación añade regresión/arreglo y completa sin volver a preguntar la misma decisión. Invalidar evidencia cuando cambia lo comprobado.

Ensayo Pi→Claude→Pi como parte de la aceptación de esta entrega: sin escritores solapados, con aislamiento comprobado y decisiones conservadas. Portabilidad del documento antes que paridad de interfaz. Codex u OpenCode no se añaden hasta que se usen; cada uno deberá superar esos mismos casos, sin prometer que bastará una entrada nueva.

**Reversión:** conservar documento y Git legibles incluso sin extensión de continuidad. No migración destructiva de estados.

## Entrega 4: launcher e instalador

**Resultado:** Samu usa n_ein como usaba Ein: abre el launcher, ve el estado, elige runtime, actualiza y vuelve a una versión anterior si algo falla.

Launcher e instalador en Go ([diseño](02-diseno.md#launcher-e-instalador)). Primero el instalador, con los comportamientos de Ein como casos de aceptación; después el launcher con sus cinco vistas. Empaquetar lo que ya funciona, ejecutar pruebas desde el artefacto instalado y mostrar versión/configuración efectiva. Distinguir edición atribuida y diff completo.

**Aceptación:** instalación aislada, update correcto, fallo de update recuperable, `--dry-run` sin cambios, canal guardado solo tras un update correcto, desinstalación que conserva auth, secrets y sesiones. Las cinco vistas muestran «desconocido» distinto de vacío y funcionan con `--once` sin terminal interactiva. El relevo Pi↔Claude funciona desde la vista Runtime. Herramienta larga no se mata por falso silencio. Fallo visual no impide trabajar.

Los canales se detallan en [despliegue](05-despliegue.md). Algunas comprobaciones de paquete comienzan en la entrega 1; esta entrega no posterga toda la higiene hasta el final.

**Reversión:** el lanzador de shell de la entrega 1 sigue funcionando sin launcher ni instalador; `restore` devuelve la versión anterior.

## Entrega 5: ejecución local

**Resultado:** Qwen3.8-27B cuantizado puede sustituir al barato alojado en las clases de trabajo que supere.

Usar endpoint y configuración de modelos nativa de Pi. Comenzar con una petición activa y contexto moderado. Medir herramientas, memoria, calidad y latencia, no solo velocidad de generación.

**Aceptación:** sin OOM bajo el perfil elegido, resultado válido en el corpus y fallback explícito preconfigurado. No descargar pesos o elegir kernels antes de saber GPU y servidor.

**Reversión:** cambiar al alias alojado sin tocar documentos, permisos ni protocolo del encargo.

## Transición desde Ein

Ein se conserva como repositorio legado. No es obligatorio cerrar o migrar todos sus cambios para trabajar con n_ein. Para retomar un trabajo concreto, crear un handoff acotado desde sus artefactos y el diff actual, conservando el original.

Lo que Ein aporta como producto (launcher, instalador, estilo, voz, TODO y continuidad) entra por las entregas 1, 3 y 4 como se describe arriba. El hogar de n_ein es distinto de `~/.pi-ein` y `~/.claude-ein`, para que Ein siga funcionando mientras se use.

No importar nombres/fases antiguos solo para satisfacer tests de Ein. Tras adoptar n_ein para uso habitual, documentar el estado legado y dejar las instalaciones separadas. Un eventual archivo de GitHub o cambio público de README requiere la instrucción correspondiente; no forma parte de este paquete.

## Criterio de avance

Cada entrega acaba con una demostración útil, evidencia y una reversión entendible. No avanzar acumulando subsistemas sin usarlos. Si el agente nativo con skills adaptadas iguala al arnés, reducir más el arnés. Si un barato gana en una clase, promoverlo para esa clase.

No hay estimación de calendario comprometida. Falta observar el primer recorrido y la compatibilidad del runner. La primera meta concreta es que n_ein arregle y compruebe un bug pequeño en un fixture aislado.
