# Engram en ein: decisión con pruebas reales

> Decisión posterior del usuario: retirar la integración de Engram del proyecto. El informe conserva la evaluación que motivó esa decisión; la propuesta de mantenerlo opcional no es la política vigente de ein.

**Decisión: no aumentar el uso de Engram por defecto ni adoptar el protocolo completo de gentle-pi/gentle-engram. Mantenerlo como cuaderno opcional para recuperar antecedentes concretos. Reparar sus defectos actuales es razonable; no hay evidencia para añadir memoria obligatoria a las fases.**

Esta conclusión sustituye el análisis provisional del 11 de septiembre. Se completaron las pruebas con modelos, incluyendo una comprobación adicional para corregir un sesgo del propio experimento. No queda otra tanda de pruebas necesaria para tomar esta decisión de alcance. La evidencia no demuestra que Engram sea inútil: demuestra que no conviene generalizar su uso en la clase de trabajo que queremos abaratar.

## Resultado que gobierna la decisión

En cinco encargos pequeños con planes cerrados, memoria útil y ausencia de memoria consiguieron **5/5 cambios correctos cada una**, con costes prácticamente idénticos: **+0,35% con memoria**, antes de pagar la creación de recuerdos. El ejecutor barato ya podía completar el trabajo con las instrucciones, el código y las pruebas disponibles.

En investigación sobre el código actual de ein, repetir un diagnóstico conocido salió **21,96% más barato** con memoria; otro diagnóstico salió **13,02% más caro**. Cada comparación se repitió dos veces. No aparece una ventaja uniforme que justifique consultar e inyectar memoria en todas las tareas.

El manifiesto pide convertir buen pensamiento en ejecución sencilla y barata con la misma exigencia. Estos resultados respaldan entregar mejores planes y consultar antecedentes cuando exista una razón concreta. No respaldan más llamadas, más contexto ni más obligaciones por sistema.

## Qué se ejecutó

- **40 recorridos de planificación + ejecución**: cinco tareas, cuatro condiciones y dos rondas. Condiciones: sin memoria, nota útil, nota irrelevante y nota contradictoria.
- **10 recorridos adicionales**: los cinco mismos casos, sin memoria/con memoria útil, eliminando la obligación de justificar el uso de memoria.
- **8 investigaciones de código**: dos preguntas reales sobre ein, sin/con memoria, dos rondas. Estudio separado, sin ejecutor barato.
- **2 llamadas para extraer recuerdos** de antecedentes preparados: cinco notas del corpus histórico y dos de los hallazgos anteriores sobre ein.
- En total, **110 llamadas medidas**: 60 a Astra/high y 50 a Luna/low. Una llamada breve inicial de conectividad queda fuera del coste registrado.

Modelos tomados de la configuración instalada de las fases: `openai-codex/gpt-6-astra` con razonamiento alto para planificar y `openai-codex/gpt-5.6-luna` con razonamiento bajo para ejecutar. Pi 0.85.1, Bun 1.3.14, Node 26.6.0, TypeScript 5.9.3 y Zod 4.4.3 en el caso que lo requiere. Engram real 1.20.0.

Los cinco encargos proceden de las evaluaciones previas de Planificador/BERRO: fechas de calendario, horarios, contadores de progreso, esquemas STUN y query de ICE. Fechas reproduce una regresión histórica; los otros son propuestas acotadas de endurecimiento sobre copias de módulos reales. No son cinco aplicaciones completas ni cambios nuevos aplicados a esos proyectos.

Cada ejecución parte del mismo código, requisito, tests visibles y configuración estricta. El planificador solo tiene herramientas de lectura. El ejecutor recibe el plan producido, el requisito y los archivos de la tarea, sin acceso directo a herramientas de memoria. Usa el contrato ad-hoc actual de sdd-apply con las restricciones del experimento. Después se restauran los tests visibles, se añaden los tests reservados y se comprueban comportamiento, tipos y archivo permitido. Ninguna ejecución necesitó reintento externo ni agotó su límite de 240 segundos por fase.

**Los 50 cambios pasan los criterios comprobados.** En los ocho diagnósticos, las citas se contrastaron literalmente con el snapshot y las conclusiones se revisaron contra la implementación. Ninguno afirmó haber ejecutado el binario o tests que no ejecutó. Sus propuestas de reparación no se presentan como implementaciones verificadas.

## Comparación principal y corrección del sesgo

La comparación inicial exigía devolver el plan y explicar qué recuerdos se habían usado o descartado. Todos recibían el mismo contrato, pero las condiciones con memoria tenían más que explicar.

| Condición, 10 recorridos | Correctos | Planificación USD | Ejecución USD | Total USD |
|---|---:|---:|---:|---:|
| Sin memoria | 10/10 | 0,613810 | 0,041671 | 0,655481 |
| Memoria útil | 10/10 | 0,701000 | 0,039341 | 0,740341 |
| Memoria irrelevante | 10/10 | 0,659030 | 0,034884 | 0,693914 |
| Memoria contradictoria | 10/10 | 0,677690 | 0,035571 | 0,713261 |

La memoria útil parecía encarecer el recorrido un 12,95%. **No es correcto atribuir ese porcentaje íntegro a usar Engram:** incluye la obligación de explicar la memoria. Para comprobarlo se ejecutó un estudio separado, retirando esa obligación en ambas condiciones, sin cambiar los casos ni sus comprobaciones.

| Sin informe de atribución, 5 recorridos | Correctos | Coste USD | Tokens | Tiempo acumulado de fases |
|---|---:|---:|---:|---:|
| Sin memoria | 5/5 | 0,325918 | 155.866 | 267,8 s |
| Memoria útil | 5/5 | 0,327057 | 157.634 | 260,5 s |

El cambio agregado de coste es **+0,35%**, con una mediana por par de **+0,71%**. El tiempo cambia −2,72%; los tokens, +1,13%. Con cinco pares, esos valores describen un empate práctico, no una ventaja robusta. No se mezclaron estos prompts con los de la comparación principal para obtener un porcentaje favorable.

Extraer las cinco notas costó **0,050260 USD**. Si se imputa toda esa creación a un primer lote de cinco reutilizaciones, el recorrido con memoria cuesta **15,77% más**. Esa imputación es un escenario de primer uso; la captura se cuenta una sola vez en el coste total del experimento. Amortizarla entre muchos usos tampoco demuestra ahorro si cada uso queda prácticamente empatado.

Las notas contradictorias fueron rechazadas por el planificador al contrastarlas con requisitos y código. Son contenidos sintéticos que contradicen el encargo actual, almacenados recientemente; no prueban por sí solos un sistema general de detección de obsolescencia. La conclusión de calidad se limita a los tests y condiciones ejercitados.

## Investigación: utilidad real, pero localizada

Las preguntas fueron diagnosticar la pérdida de contenido entre Engram y el prompt, y comprobar si varios aprendizajes de una fase con stableId diferentes pueden coexistir. Se usó un snapshot del árbol actual, excluyendo los informes de evaluación para que no sirvieran de respuesta a la condición sin memoria.

| Investigación, suma de 2 repeticiones | Sin memoria USD | Con memoria USD | Cambio |
|---|---:|---:|---:|
| Recuperación incompleta de recuerdos | 1,044712 | 0,815272 | **−21,96%** |
| Identidad y deduplicación de notas | 0,836426 | 0,945364 | **+13,02%** |

En el primer diagnóstico, la reducción de coste fue 32,70% en una ronda y 8,44% en la otra. Los dos resultados tienen la misma dirección, pero distinta magnitud. En el segundo, la memoria aumentó coste en ambas rondas. Recordar una explicación no elimina la necesidad de releer las fuentes, y puede ampliar la comprobación.

El ahorro conjunto de estas investigaciones es **6,41%** antes de crear notas y **5,37%** incluyendo los **0,019570 USD** de extracción. No debe ocultarse el diagnóstico que empeora presentando solo el ahorro del que mejora. Tampoco se atribuye este resultado al ejecutor barato: estas ocho llamadas fueron de investigación del modelo capaz.

El umbral propuesto en el análisis inicial era una reducción mediana de al menos 15% en tareas con antecedentes, sin regresiones y con sobrecoste limitado cuando no ayudan. La comparación de trabajo pequeño no lo cumple; la investigación suplementaria no ofrece una mejora general que lo sustituya. No se autoriza una integración habitual por ese criterio.

## Qué se probó de Engram, además de los modelos

Para separar el valor de recordar de los fallos actuales, el experimento usa un **prototipo aislado de recuperación HTTP**: consulta Engram real, obtiene la observación completa por ID y entrega registros con contenido, proyecto, tema y fecha al MemoryLifecycle y renderizador actuales de ein. Conserva sus límites y su marcado de datos no confiables. Comprobó **17 notas completas y 7 búsquedas vacías** entre ambos estudios. No instaló el plugin completo ni reemplazó el transporte del producto.

Las consultas usan identificadores de casos conocidos y las notas útiles proceden de la solución histórica del mismo comportamiento. Es una condición favorable a la memoria: no se paga una búsqueda autónoma que encuentre el término correcto y no hay una base grande con competidores de relevancia. No se demuestra recuperación general en proyectos nuevos ni aprendizaje de arquitectura novedosa.

También se comprobaron defectos actuales que conviene distinguir del valor económico de la memoria:

1. **Disponibilidad:** con Pi y el MCP adapter reales, el gateway conectado permite encontrar mem_save, pero las herramientas activas son mcp/mcpScript/mcp__engram. El detector de ein devuelve false porque espera otros nombres. La sonda usa directTools:false, como la configuración inspeccionada, y no registra errores de carga.
2. **Recuperación:** el parser por líneas convierte cabeceras en recuerdos y puede consumir el cupo antes del cuerpo. La prueba anterior recuperó seis aprendizajes en el CLI y ninguno completo en el contexto de ein; una búsqueda vacía apareció como retrieved.
3. **Identidad del proyecto:** un repositorio temporal, su subdirectorio y un worktree del mismo repositorio produjeron tres nombres distintos: shared-project, un hash de raíz y other-tree. Compartir la base de datos no garantiza consultar las mismas notas.
4. **Identidad de la lección:** dos candidatos de la misma fase con stableId diferentes generaron el mismo tema. El binario guardó ambos como #1 y quedó solo el segundo aprendizaje. Esto es apropiado para actualizar una nota agregada, pero no cumple la expectativa de conservar varias lecciones individuales.
5. **Confirmación de operaciones:** en la prueba sin red anterior, avisos de actualización hicieron que se declarasen fallidos guardados que sí existían. Los recibos necesitan distinguir la operación de los avisos accesorios.

El cuaderno esperado de la instalación, ~/.engram-ein/engram.db, tenía cero observaciones en la inspección inicial. No se usó ni modificó para los experimentos. No se deduce de ello que nunca se utilizara Engram o que no existan notas en otros almacenes.

## Qué tomar de gentle-pi y qué no adoptar

La revisión se hizo sobre gentle-pi `6c4a69310c1e19c4a11a94e2f58f9706b73fbde9` y Engram `de322e985310d453897071d8939cc0683b4e9c65`, donde vive plugin/pi. Esos checkouts no se presuponen idénticos al binario instalado.

gentle-pi permite herramientas de memoria en sus agentes y pide aprendizajes reutilizables en sus retornos. Su proveedor Pi añade protocolo, captura de prompts/resultados elegibles y recuperación tras compactación. Parte es código y parte depende de que el modelo siga instrucciones de guardar y resumir. Fuentes: [proveedor](https://github.com/Gentleman-Programming/engram/blob/de322e985310d453897071d8939cc0683b4e9c65/plugin/pi/index.ts), [contrato de apply](https://github.com/Gentleman-Programming/gentle-pi/blob/6c4a69310c1e19c4a11a94e2f58f9706b73fbde9/assets/agents/sdd-apply.md).

Para ein conservaría la idea de recuperar un antecedente concreto y guardar una lección que cambie una decisión futura. No añadiría el protocolo completo, captura pasiva universal, búsqueda obligatoria por fase ni memoria cruda en el ejecutor barato. Tampoco trasladaría la autoridad del estado SDD a memoria: el [contrato de gentle-pi por almacén](https://github.com/Gentleman-Programming/gentle-pi/blob/6c4a69310c1e19c4a11a94e2f58f9706b73fbde9/assets/support/sdd-status-contract.md) contempla modos que requieren resolver artefactos desde Engram; ein ya exige autoridad determinista y estado canónico en disco.

**Alcance recomendado:** conservar el modo opcional; corregir disponibilidad, identidad, recuperación completa y temas de lecciones antes de depender de ese cuaderno; consultar antecedentes cuando el padre tenga una razón concreta para hacerlo. OpenSpec/Git mantienen el estado y la verificación. No añadir nuevos requisitos al flujo de apply ni una obligación de guardar tras cada tarea. Es una reparación acotada de la integración existente, no una adopción del comportamiento completo de gentle-pi.

## Evidencia, coste y límites

Coste API reportado por Pi para las 110 llamadas: **7,16757692 USD**, incluidas las dos extracciones. Es una medida del catálogo/uso de Pi con la caché observada, no una factura. Excluye la comprobación breve de conectividad sin registro, preparación y supervisión de Codex, revisión humana y recursos locales. Las latencias suman spawn a salida de cada fase; no incluyen los checks independientes posteriores ni el arranque previo del servidor de memoria. Hubo concurrencia acotada; no son mediciones de latencia aislada.

Los estudios utilizan una fase de planificación controlada y el contrato ad-hoc del ejecutor; no cargan el prompt completo del orquestador ni recorren todo SDD. El texto asesor se aporta al encargo de planificación. No se demuestra paridad funcional completa Pi/Claude, confinamiento ni ejecución con modelos locales. Los ocho diagnósticos no comparan Engram contra un índice de notas en archivos; prueban el efecto de disponer del antecedente, no una ventaja exclusiva del motor de almacenamiento.

[Resultados estructurados](engram-results-2026-09-11.json). [Evidencia completa local](../.pi/ein/evidence/engram-2026-09-11.tar.gz): **5.847.246 bytes, 2.656 archivos comprobados por SHA-256**, sin credenciales ni node_modules. Incluye protocolos, inputs, snapshots, notas, respuestas de Engram, peticiones/transcripts, planes, diffs, tests reservados, logs de tipos y auditoría. El análisis provisional queda archivado para trazabilidad, no como recomendación vigente.

SHA-256 del archivo: `f0491db0326c79e82131c72c98f3e21428d580a2b0b6b069adc22f1784a3453c`.

Para auditar sin gastar modelo, comprobar evidence-manifest.json y leer final-summary.json, audit.json y los logs. README-evidence.md documenta versiones, rutas que adaptar y reproducción. Se conserva también la preparación fallida inicial de resolución de Zod, corregida antes de evaluar modelos, y la primera sonda de capacidades excesivamente restringida, repetida con herramientas normales y conexión efectiva.

Ein partía de `b9e6959b665ba2517cbcb9d02270ff61eb3f7f9b` más tus cambios locales. La auditoría comprobó que los archivos rastreados del snapshot permanecieron iguales. **No se cambió el runtime, la configuración habitual ni el manifiesto.** La reparación productiva de los defectos señalados queda fuera de esta evaluación; no se presenta el prototipo como desplegado.
