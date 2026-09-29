# Decisiones pendientes y límites

## Estado y decisiones abiertas

| Área | Estado a 29 de septiembre de 2026 | Pendiente real |
|---|---|---|
| Pi y modelos alojados | Paquete aislado sobre Pi 0.87.1; Sol high y Luna high por suscripción. | Compatibilidad al actualizar Pi y medición de coste total en más tareas reales. |
| Trabajador | Un mecanismo de proceso hijo Pi con cancelación y evidencias; [recorridos observados](../evals/results/2026-09-29-worker.md). | Coordinar procesos padre independientes en el mismo árbol si se necesita concurrencia. |
| Corpus real | Samu escogió solo `planificador-didactico`; [regresión reproducida](../evals/results/2026-09-29-planificador.md) en copias aisladas. | Más casos representativos antes de generalizar ahorro o calidad. |
| Documento y relevo | `WORK.md`, TODO y Pi↔Claude probados en TUI real. | Agentes de fondo y escritores padre independientes; Codex/OpenCode si se incorporan. |
| Launcher e instalador | Go con Bubble Tea v2; paquete local, preview/estable, doctor, restore y cinco vistas. | Edición de ajustes desde la TUI, actualización remota y distribución pública. |
| Remoto, licencia propia y distribución | Sin remoto ni release pública. | Decidir con Samu cuando toque publicar. |
| Modelo local | Objetivo posterior Qwen3.8-27B en 24 GB. | **Aplazado por Samu hasta que tenga la máquina**; no preparar servidor ni descargar pesos ahora. |

### Runner de trabajadores

Pi no trae subagentes en su núcleo. Antes de implementar el trabajador se consideraron estos candidatos, en orden de prueba:

1. [Ejemplo oficial de Pi](sources/pi-installed/examples/extensions/subagent/README.md): proceso aislado por tarea, modelo por agente, coste por tarea y cancelación. Hipótesis: le faltarán tiempo de espera para herramientas largas y persistencia de resultados.
2. `pi-subagents`, usado por Ein; fijar y evaluar su versión efectiva. Gentle Shell archivado usa su runner propio Gentle Agents, no esta dependencia como opción preferida.
3. Runner de Ein o de Gentle Shell, solo si los anteriores no superan el contrato.

El trabajador actual usa un único proceso hijo Pi y cumple en los ensayos el contrato relevante:

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

Hay implementación y evaluaciones registradas, pero **no release pública**. No se ha probado Codex u OpenCode con n_ein, ni Qwen3.8-27B en la tarjeta objetivo; el trabajo local está aplazado a petición de Samu. Los ensayos actuales no demuestran una mejora general sobre el agente nativo ni un porcentaje de ahorro estable. No hay fechas o ahorro económico comprometidos.

Las propuestas de cinco entregas, 12 casos y ahorro orientativo del 20 % son instrumentos de decisión. Se pueden simplificar cuando la evidencia lo aconseje; no son otra burocracia obligatoria.

## Próxima decisión útil

Priorizar un recorrido de uso real y los huecos observables de la interfaz o distribución local. Elegir cualquier ampliación de la evaluación por la pregunta que responda, sin repetir trabajo ya registrado ni reabrir Qwen hasta disponer de la máquina.
