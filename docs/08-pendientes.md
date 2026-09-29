# Decisiones pendientes y límites

## Resolver al comenzar implementación

| Decisión | Propuesta inicial | Cuándo hace falta |
|---|---|---|
| Forma de integración Pi | Casi resuelta: paquete Pi local + lanzador de shell con `PI_CODING_AGENT_DIR`. Queda la ruta del hogar. | Entrega 1. |
| Versiones exactas | Partir de Pi 0.87.1 y fijar runner y paquetes; nada con `@latest` | Antes de probar el runtime. |
| Runner de trabajadores | [Candidatos y contrato](#runner-de-trabajadores) | Entrega 2; no construir dos. |
| Modelo económico alojado | Uno disponible y medible frente al capaz habitual | Primer experimento real. |
| Tareas reales del corpus | El agente propone dos de `planificador-didactico` o `berro`, con base y aceptación; Samu puede elegir o ajustar ([corpus](04-pruebas.md#corpus-inicial)) | Antes de evaluarlas; no bloquea la entrega 1 con fixtures. |
| Lugar del documento de trabajo | Convención existente del proyecto; si no hay, elegir una ubicación sencilla para el único documento. `intent` guarda ahí el acuerdo cuando necesita persistencia, sin archivo paralelo. | Primera necesidad de persistencia, incluida entrega 1; TODO y relevo automático en entrega 3. |
| Formato del resumen de relevo | Markdown con los campos del [diseño](02-diseno.md#continuidad-entre-agentes); se inspira en el checkpoint de Ein | Entrega 3. |
| Integración de runtimes | Configuración declarativa donde baste y código mínimo donde sea necesario; probar aislamiento y relevo sin escritores solapados | Entrega 3. |
| Contenido de «Samu ya domina» | Empezar por ramas, commits y PR rutinarias, ya expresado por Samu; ampliar con el uso | Ajustable, sin confirmación previa obligatoria. |
| Versión de Bubble Tea | Gentle usa v1.3; comprobar si v2 ya compensa | Entrega 4. |
| Animación en la TUI | Mantener el contrato plano de STYLE.md o revisarlo para permitir más | Entrega 4. |
| Distribución del instalador | Script como Ein, brew como Gentle, o ambos | Entrega 4. |
| Remoto, licencia propia y distribución | Decidir con Samu cuando se vaya a publicar | No bloquea el prototipo local. |
| Nombre del ejecutable/paquete | Derivado de n_ein tras comprobar colisiones (`n_ein`, `n_ein-install`…) | Packaging. |
| GPU/servidor/cuanti local | 24 GB confirmado; modelo de tarjeta pendiente | Entrega 5. |

### Runner de trabajadores

Pi no trae subagentes en su núcleo. Candidatos, en orden de prueba:

1. [Ejemplo oficial de Pi](sources/pi-installed/examples/extensions/subagent/README.md): proceso aislado por tarea, modelo por agente, coste por tarea y cancelación. Hipótesis: le faltarán tiempo de espera para herramientas largas y persistencia de resultados.
2. `pi-subagents`, usado por Ein; fijar y evaluar su versión efectiva. Gentle Shell archivado usa su runner propio Gentle Agents, no esta dependencia como opción preferida.
3. Runner de Ein o de Gentle Shell, solo si los anteriores no superan el contrato.

Contrato común:

- se puede cancelar sin perder el diff;
- devuelve el resultado parcial;
- no corta una herramienta larga por falso silencio;
- distingue que el agente termina de hablar de que ha terminado de verdad;
- muestra el modelo realmente usado y distingue coste estimado, facturado o desconocido.

No hacer una entrevista larga sobre estas decisiones antes de construir algo útil. Resolver por inspección y criterio las reversibles; preguntar lo que realmente cambie el producto, permisos, coste o destino.

## Riesgos concretos

- **Reescritura interminable:** convertir el nuevo comienzo en una plataforma. Antídoto: primera corrección real antes de UI avanzada, perfiles o proveedores propios.
- **Copiar el arnés antiguo por piezas hasta reconstruirlo:** cada importación necesita una propiedad útil y dependencias explícitas.
- **Skills contradictorias:** una fuente por política y adaptación deliberada. No cargar original y variante simultáneamente.
- **Ahorro aparente:** medir preparación, caché, intentos, revisión y rescates; conservar capaz directo como comparador.
- **Benchmark irrelevante:** LiveCodeBench no representa directamente nuestros proyectos ni tool calling.
- **Contexto local que no cabe:** cuantización, buffers y caché cuentan; una petición inicial y perfil conservador.
- **Falsa evidencia:** no equiparar relato del agente con resultado de proceso ni tipos con comportamiento.
- **Compatibilidad accidental:** validar paquete instalado, no solo fuentes y mocks con dependencias de la máquina.
- **Regresión de continuación:** transportar decisiones y conservar trabajo; caso SQLSTATE como prueba de integración.
- **Doble mantenimiento:** Ein legado no recibe todas las novedades de n_ein.
- **Reconstruir Ein por fuera arrastrando su interior:** launcher e instalador se conservan por sus comportamientos; si una vista necesita algo de SDD/OpenSpec para funcionar, se rediseña esa vista, no se recupera el mecanismo.
- **Dos lenguajes:** Go y TS solo se comunican por archivos neutros. Si aparece código compartido duplicado, es señal de que falta un contrato en archivo.
- **API de Pi cambiante:** cada línea de extensión es deuda al subir de versión; prueba rápida del paquete instalado en cada subida.

## Lo que no está demostrado todavía

No hay implementación, benchmark o release de n_ein. Tampoco se ha probado ningún candidato a runner, ni el relevo por resumen entre Pi y Claude, ni Codex u OpenCode con n_ein. No se ha observado Qwen3.8-27B en la tarjeta objetivo. No se ha demostrado que los nuevos prompts/skills superen al agente nativo ni que un nuevo runner sea necesario. No hay fechas o ahorro económico comprometidos.

Las propuestas de cinco entregas, 12 casos y ahorro orientativo del 20 % son instrumentos de decisión. Se pueden simplificar cuando la evidencia lo aconseje; no son otra burocracia obligatoria.

## Próxima decisión útil

Cuando Samu pida empezar, construir el arranque aislado con fixtures y las preferencias de voz ya conocidas. Proponer las dos tareas reales para el ensayo posterior sin detener el prototipo por su selección. Lo demás se decide con ese resultado delante.
