# Qué faltaba comparar con Gentle

Investigación del 7 de octubre de 2026, motivada por la pregunta de Samu sobre agentes, calidad y consumo. Relectura de trazas existentes y fuentes primarias; sin nuevas ejecuciones de modelos ni cambios al runtime. n_ein inspeccionado: `4ea0497`; Gentle Shell consultado: `aa2c03896be9866ab0af89bbc621d4c2a8fcf9c2`.

## Conclusión corregida

El [piloto anterior](2026-10-06-paralelismo.md) mide un reparto concreto en n_ein. No compara n_ein con Gentle actual, no demuestra que el paralelismo sea generalmente ineficiente y no evalúa bien el ahorro de contexto durante sesiones prolongadas. Mantener provisionalmente la preview anterior sigue siendo coherente con esa evidencia; descartar la capacidad o fijar los umbrales propuestos como requisitos del usuario no lo sería.

Hay dos beneficios que medir por separado: solapar trabajo independiente y evitar que el principal arrastre toda la investigación de cada unidad durante los turnos siguientes. El segundo puede justificar un solo ayudante. Nuestro mecanismo y sus instrucciones actuales se centran en escritores para implementaciones, con base confirmada y WORK.md; no ofrecen todavía un encargo ligero de investigación sin escritura. Fuente: [descripción de la herramienta](../../pi-package/extensions/team.ts), [flujo](../../pi-package/flow.md), [instrucciones del trabajador](../../pi-package/agents/worker.md).

## Qué dice realmente la evidencia de Gentle

El [estudio publicado en gentle-ai #5139](https://github.com/Gentleman-Programming/gentle-ai/issues/5139) informa de coste ponderado parecido (±2 %) con delegación selectiva en sesiones de investigación de 16 turnos. Contexto final: 201k directo frente a 173k con hijos ligeros; tiempo: 6 frente a 10,6 minutos. Forzar delegaciones aumentó coste y latencia. Usó Opus mediante claude-bridge; dos repeticiones largas. No fue una comparación controlada de dos escritores paralelos ni probó mejor calidad: todas las respuestas evaluadas fueron correctas. Las grandes ventajas históricas se estimaron mediante contrafactuales, con sesgo reconocido a favor de delegar.

Sus [instrucciones de delegación](https://github.com/Gentleman-Programming/gentle-shell/blob/aa2c03896be9866ab0af89bbc621d4c2a8fcf9c2/assets/orchestrator-delegation.md) asignan al escritor la exploración que prepara su cambio, limitan la investigación del principal y piden entregas breves con referencias. Es una política verificable en el código, no una garantía de que cada ejecución la siga. El historial de [reducción de contexto](https://github.com/Gentleman-Programming/gentle-shell/blob/aa2c03896be9866ab0af89bbc621d4c2a8fcf9c2/odd/tasks/lean-delegation-context.md) documenta la retirada selectiva de instrucciones exclusivas del coordinador en los hijos.

## Auditoría de S3: resultado observado

Comparación conservada: `parallel-s3-serial-r1` (`b619eaa`) y `parallel-s3-directed-r3` (`f0d77f4`). Mismo modelo, Sol medium, en principal e hijos. Ambos pasan aceptación 3/3 y dos mutantes; las implementaciones y pruebas añadidas difieren. Una observación por variante: no son medias ni una estimación causal del coste de coordinar.

| Medida | Secuencial | Paralelo, principal + 2 hijos |
|---|---:|---:|
| Tiempo del agente | 558,512 s | 528,295 s |
| Tiempo hasta aceptación externa | 596,978 s | 567,826 s |
| Entrada sin caché | 182.210 | 253.445 |
| Salida | 12.525 | 20.425 |
| Lecturas de caché | 2.649.344 | 3.251.968 |
| Escrituras de caché | 0 | 0 |
| Total acumulado | 2.844.079 | 3.525.838 |
| Respuestas de modelo con uso registrado | 58 | 93 |
| Estimación USD del registro | 1,0195388 | 1,3615336 |

El +24 % de tokens incluye caché; entrada nueva sube 39 %, salida 63 % y estimación de coste 34 %. No es un ahorro oculto por ponderación. Tampoco equivale a facturación o consumo exacto de cuota de la suscripción.

El principal paralelo consume **1.190.811 tokens**, 58 % menos que el agente secuencial completo. Los hijos añaden **1.439.850** y **895.177**. Su contexto de entrada en la última respuesta es 47.870 tokens frente a 61.544 en secuencial, aproximadamente 22 % menos. El beneficio de contener el contexto sí aparece, aunque en este encargo no compensa todo el trabajo añadido. No se midió cuánto habría beneficiado a encargos posteriores.

### Dónde transcurrió el tiempo

Horas UTC de la traza paralela:

- 20:01:10,750: inicio de sesión del principal.
- 20:02:50,507: primer hijo iniciado, unos **100 s después**. Antes hubo tres consultas CodeGraph, lectura de pruebas y consumidores de ambos frentes, definición de WORK.md y commit de base. No todo ese tiempo es prescindible: incluye el contrato necesario para repartir.
- T1 dura 284,8 s y T2 207,0 s. Ambos investigan su ámbito y ejecutan `bun install --frozen-lockfile` en sus worktrees. Las primeras entradas de los hijos son 4.678 y 4.600 tokens: no presentan el gran prefijo sobrante del estudio de Gentle.
- 20:04:02: último comando del trabajo documental independiente del principal. El siguiente llega a las 20:07:35, cuando termina T1. No interpretar el intervalo como consumo continuo: hay espera sin nuevas respuestas.
- 20:07:35,323: último hijo terminado. Quedan unos **144 s** hasta el final del agente para revisar, integrar, comprobar y registrar el cierre.
- 20:08:06: el principal lanza suite y tipos juntos. La suite falla por ausencia temporal de `.nuxt/components.d.ts`; la repetición posterior pasa. El agente atribuye el fallo a la regeneración concurrente de `.nuxt`. La traza acredita el solapamiento, el error y la repetición; no se ha reproducido aquí su causalidad de forma aislada.

Hay solapamiento de investigación: el principal consulta el alta y Anexo IV antes del reparto, y los hijos vuelven a mapear sus ámbitos. No toda lectura repetida es desperdicio: parte sirve para acotar y revisar. Los hijos ejecutan comprobaciones enfocadas; entre ambos hacen tres invocaciones de tipos y el principal otra. T1 usa tipos para descubrir y corregir un consumidor: eliminar comprobaciones indiscriminadamente reduciría garantías. El cierre integrado sigue siendo necesario.

### Procedencia y cálculo

Banco local: `/Users/samu/Documents/01_Proyectos/n_ein-bench/`.

- Sesiones: `logs/<id>/sessions/*.jsonl` y `logs/<id>/workers/*.jsonl`.
- Tareas, tiempos y ramas: `copies/parallel-s3-directed-r3/.git/n_ein/team/*.json`.
- Aceptación y tiempos totales: `logs/<id>/grade.json`, `parallel.json` y [resumen versionado](2026-10-06-paralelismo.json).

Para reproducir el desglose: seleccionar entradas nativas `type == "message"` cuyo `message.role == "assistant"`, sumar `message.usage.input`, `output`, `cacheRead`, `cacheWrite` y `cost.total` por sesión, y después sumar principal e hijos. No sumar además los registros de tarea ni los eventos de streaming: duplicaría el mismo uso. `reasoning` se conserva como dato del proveedor, sin añadirlo otra vez a `output`. Los tiempos de herramientas proceden de sus mensajes; las duraciones de hijos, de `started`/`ended`.

## Siguiente experimento útil, propuesto

1. Repartir antes de investigar exhaustivamente cada frente: principal acuerda aceptación, contrato y responsables; el ejecutor investiga e implementa su unidad. Transferir hallazgos relevantes ya conocidos mediante referencias.
2. Permitir encargos de lectura con el mismo mecanismo cuando eviten cargar mucha investigación en el principal; ajustar los requisitos de WORK.md, commit y worktree al hecho de que no escriben. Mantener aislamiento para escritores y parada/recuperación para todos. Requiere diseño e implementación; aún no existe.
3. Preparar worktrees de forma reproducible y planificar comprobaciones por recursos compartidos. Preservar rojo/verde, checks necesarios de cada cambio y aceptación integrada; evitar repeticiones sin motivo y carreras sobre ficheros generados.
4. Comparar versiones congeladas: n_ein directo, n_ein con reparto mejorado y Gentle configurado de forma equivalente. Incluir una tarea pequeña, dos frentes sustanciales y una sesión larga con continuación. Repetir en orden alternado y fijar límite de gasto antes de ampliar el banco.
5. Contar principal e hijos, entrada nueva, caché, salida, coste estimado, tiempo hasta aceptación, defectos, correcciones y atención humana. Evaluar fluidez y continuidad explícitamente. Los umbrales 20 %/25 % anteriores eran orientativos, no preferencias confirmadas de Samu.

La hipótesis es que una coordinación más acotada y el uso selectivo de contextos independientes pueden mejorar el equilibrio. La evidencia actual justifica probarla; no permite prometer ya superioridad ni ahorro.
