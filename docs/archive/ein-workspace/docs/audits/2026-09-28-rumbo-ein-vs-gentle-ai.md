# Auditoría de rumbo: Ein frente a gentle-ai

Fecha: 28 de septiembre de 2026. Auditoría y propuesta; no implementación.

**Recomendación: reducir Ein a una capa pequeña sobre el agente nativo, permitir ejecución directa y convertir la delegación barata en una estrategia evaluable. Retirar progresivamente el motor SDD del camino habitual. Conservar verificación, continuidad, aislamiento y recuperación donde aporten una garantía concreta.**

No hay evidencia en esta revisión para afirmar que los modelos hayan vuelto obsoletos los requisitos explícitos o TDD. Sí hay evidencia de que Ein convierte decisiones de coordinación discutibles en restricciones permanentes. Cambiar SDD por las letras ODD sin quitar esas restricciones conservaría el problema.

## Alcance y versiones

Se contrastaron cuatro superficies distintas:

| Superficie | Identidad y alcance comprobado |
|---|---|
| Checkout de trabajo | Rama `fix/agent-discovery-isolation`, HEAD `a5f96323`, con numerosos cambios locales previos. Se preservaron. |
| Ein publicado en main | `f220788c1da2f77afac21cb37af154621aa05cce`, confirmado con `git ls-remote`; release alpha.18. Extraído a un directorio temporal para inspección y pruebas. |
| Instalación de Samu | Pi declara `0.99.0-alpha.18`. Continuidad, gateway, orquestador y contrato apply comprobados contra main. El parser de delegación solo difiere en una ruta de import de tipo ajustada al empaquetar. `CLAUDE.md` instalado coincide con main, aunque su marcador conserva `0.91.0-alpha.3`; ese marcador no identifica por sí solo la versión efectiva. |
| gentle-ai | Clonado en `e2cb2bf25193f9ac953978906596cf06cc16b733`, commit del 27 de septiembre. Se leyó código de generación de instrucciones, contratos, documentación y registros de retirada de SDD. No se ejecutó gentle-ai ni se auditó el runtime separado gentle-pi. |

Es importante distinguirlas: el checkout local conserva problemas de prompt ya corregidos en alpha.18. Por ejemplo, la contradicción entre `chain` y el gateway, y la dependencia de una frase mágica para transportar TDD, ya tienen un tratamiento actualizado en el orquestador publicado. No se presentan aquí como defectos nuevos de alpha.18.

La inspección cubre arquitectura de coordinación, SDD/TDD, continuidad, evidencias, evaluaciones y dependencias. No es una auditoría exhaustiva de seguridad ni una comparación de rendimiento realizada con modelos actuales.

## Qué propone realmente gentle-ai

ODD significa **Organic Driven Development**. Su orientación útil para Ein es ajustar el proceso al trabajo: resolver lo pequeño directamente y mantener un documento recuperable cuando hay trabajo sustancial. En el código actual, las rutas de implementación son directa o delegada; el documento reúne objetivo, alcance, tareas y comprobaciones. Fuente: [generador de routing, revisión auditada](https://github.com/Gentleman-Programming/gentle-ai/blob/e2cb2bf25193f9ac953978906596cf06cc16b733/internal/components/agentguidance/routing.go).

La retirada de SDD/OpenSpec es explícita en el trabajo integrado. Sin embargo, `docs/trigger-rules.md` todavía describe SDD opcional. Para determinar qué se instala, pesa más el generador actual que esa página desactualizada. Esto es una divergencia documental comprobada, no una prueba de que siga activo todo el sistema anterior. Fuentes: [retirada de SDD](https://github.com/Gentleman-Programming/gentle-ai/blob/e2cb2bf25193f9ac953978906596cf06cc16b733/odd/tasks/remove-sdd-odd-only-main.md), [documentación que conserva SDD opcional](https://github.com/Gentleman-Programming/gentle-ai/blob/e2cb2bf25193f9ac953978906596cf06cc16b733/docs/trigger-rules.md).

**gentle-ai no descarta TDD.** El README describe Strict TDD configurable. Además, el generador actual prescribe test-first cuando existe una prueba determinista ejecutable y un resultado esperado claro, con excepciones explícitas. Por tanto, tampoco reduciría su propuesta a «todo se hace sin RED/GREEN». Hay una diferencia de énfasis entre documentación y código que conviene comprobar en cada instalación. Fuentes: [README](https://github.com/Gentleman-Programming/gentle-ai/blob/e2cb2bf25193f9ac953978906596cf06cc16b733/README.md), [política generada](https://github.com/Gentleman-Programming/gentle-ai/blob/e2cb2bf25193f9ac953978906596cf06cc16b733/internal/components/agentguidance/routing.go).

RDD es otra capa: revisión de un candidato congelado, con transiciones propias y activación por defecto que admite deshabilitarse. No equivale a ODD ni autoriza la entrega. La identidad del candidato es una idea aprovechable; copiar todo su motor transaccional no está justificado para Ein. Fuente: [contrato RDD](https://github.com/Gentleman-Programming/gentle-ai/blob/e2cb2bf25193f9ac953978906596cf06cc16b733/docs/review-integration.md).

Tampoco ODD elimina toda ceremonia: conserva delegación obligatoria por determinados umbrales, espejo del documento en Engram y commits por unidad de trabajo. Su contrato contiene requisitos bastante específicos para los encargos a trabajadores. Adoptaría la proporcionalidad, pero no importaría esas obligaciones sin medirlas. Fuente: [contrato de orquestación](https://github.com/Gentleman-Programming/gentle-ai/blob/e2cb2bf25193f9ac953978906596cf06cc16b733/internal/assets/skills/_shared/odd-orchestrator-sections.md).

## Hallazgos de Ein, por prioridad

### 1. Alta: el principio económico se ha convertido en una prohibición arquitectónica

El manifiesto impide que el modelo caro implemente y atribuye cualquier necesidad de razonamiento del ejecutor a una fase anterior insuficiente. El orquestador publicado conserva delegación obligatoria incluso para un cambio de una línea y ordena detenerse si se agota la capacidad de crear hijos.

Eso excluye de antemano una alternativa que podría ser más barata y rápida: un modelo capaz que ya tiene el contexto y termina el cambio en pocas acciones. También confunde ejecución con ausencia de juicio: diagnosticar, implementar y revisar pueden descubrir información que ningún plan razonable anticipaba.

**Cambio propuesto:** optimizar coste total por resultado aceptado. Permitir al padre implementar; delegar por aislamiento, trabajo independiente, volumen de contexto o ahorro demostrado. Aumentar capacidad o razonamiento debe ser una opción legítima ante un límite medido. La revisión semántica tampoco es necesariamente trabajo mecánico para el modelo más barato.

Evidencia: [manifiesto publicado, principio económico](https://github.com/samuhlo/ein-agent/blob/f220788c1da2f77afac21cb37af154621aa05cce/MANIFIESTO.md#L25), [routing y parada por cuota](https://github.com/samuhlo/ein-agent/blob/f220788c1da2f77afac21cb37af154621aa05cce/runtime/assets/orchestrator.md#L45).

### 2. Alta: el flujo grande sigue organizado alrededor de artefactos y fases

Ein ya tiene un camino ad hoc: sería incorrecto afirmar que exige siete fases para todo. Pero convierte tamaño, ambigüedad o riesgo en motivos para entrar en `scope → map → design → tasks → apply → verify → close`. Cada frontera exige transporte, persistencia, interpretación y recuperación.

El router calcula coherentemente el estado de esos artefactos. Eso no demuestra que los artefactos sean la mejor unidad de trabajo. Que un documento tenga un consumidor mecánico tampoco justifica por sí solo mantener ambos: el consumidor puede existir exclusivamente por una decisión previa del arnés.

**Cambio propuesto:** una tarea puede alternar lectura, decisión, edición y prueba en el mismo contexto. Para trabajo prolongado, un documento con objetivo, límites, criterios observables, pendiente y evidencia. Specs y ADR adicionales solo cuando describan contratos o decisiones duraderas. No convertir ese documento en otra gramática extensa con un nuevo router.

Evidencia: [orquestador](https://github.com/samuhlo/ein-agent/blob/f220788c1da2f77afac21cb37af154621aa05cce/runtime/assets/orchestrator.md#L103), [router de artefactos](https://github.com/samuhlo/ein-agent/blob/f220788c1da2f77afac21cb37af154621aa05cce/shared/sdd/sdd-routing-core.ts).

### 3. Alta: continuidad todavía puede impedir el trabajo local delegado

Alpha.18 ya deja continuar `write` y `edit` si no puede registrar la operación. Es un arreglo real respecto al informe del 23 de septiembre.

Sin embargo, el hook conserva rechazo por ausencia de identidad, fallo del journal o límite de operaciones para otros efectos. La función de clasificación trata tanto un `bun test tests/example.test.ts` como un `subagent` de apply local como `external-or-unknown`. Como el padre tiene prohibido implementar, la excepción para Write/Edit no asegura que pueda llegar a lanzar al ejecutor.

**Cambio propuesto:** el registro de continuidad no debería decidir el permiso de una nueva operación por estar averiado. Conservar los permisos efectivos y la prevención de repetir un efecto externo incierto. Distinguir esa prevención de una caída de almacenamiento auxiliar. No resolverlo declarando inocuo todo Bash ni construyendo otro clasificador universal.

Evidencia: [hook instalado/publicado](https://github.com/samuhlo/ein-agent/blob/f220788c1da2f77afac21cb37af154621aa05cce/ein-pi/agent/extensions/ein-continuity.ts#L169), [clasificación](https://github.com/samuhlo/ein-agent/blob/f220788c1da2f77afac21cb37af154621aa05cce/ein-pi/agent/lib/continuity-operations.ts#L46). La clasificación se reprodujo con las funciones reales; no se reprodujo una sesión completa atascada.

### 4. Alta: persiste una frontera débil en resume y TDD

En alpha.18, `admitDelegation({action:"resume", id:"audit-fixture", tdd:"strict"})` devuelve `kind: management`. El gateway retorna para management antes del bloque que resuelve y adjunta el contrato TDD a un apply normal.

Eso demuestra que esa ruta no vuelve a transportar la elección mediante el mecanismo de lanzamiento normal. No demuestra que toda reanudación pierda TDD: un hijo puede conservar contexto anterior y falta observar el runner completo en el caso real.

**Cambio propuesto:** si se conserva ese camino, probar una continuación real con la elección persistida y sin preguntar de nuevo. En el diseño reducido, preferir una continuación breve con alcance, diff y comprobaciones pendientes antes que reproducir una fase entera. Una migración de arquitectura no debe ocultar esta regresión pendiente.

Evidencia: [admisión](https://github.com/samuhlo/ein-agent/blob/f220788c1da2f77afac21cb37af154621aa05cce/ein-pi/agent/lib/delegation-admission.ts#L325), [retorno del gateway](https://github.com/samuhlo/ein-agent/blob/f220788c1da2f77afac21cb37af154621aa05cce/ein-pi/agent/extensions/internal/ein-tool-call-gate.ts#L115), [incidente previo](../plans/2026-09-23-recuperacion-arneses.md).

### 5. Alta: frescura del informe y ejecución comprobada son garantías distintas

El servicio de recibos aporta valor: vincula informe, superficie de archivos y decisiones, y rechaza evidencia obsoleta. Pero `finishVerification` recibe contenido del agente y extrae de él el resultado; no ejecuta los comandos ni recibe un resultado de proceso independiente como condición de emisión. El agente verify sí tiene instrucciones para ejecutar y contrastar evidencia: no afirmo que no lo haga.

La garantía concreta del recibo es integridad y vinculación del informe. Por sí solo no demuestra que lo declarado dentro ocurrió. Lo mismo aplica a RED/GREEN: una tabla no prueba la cronología.

**Cambio propuesto:** conservar la identidad del código comprobado. Para comandos, aprovechar resultados nativos del runner o CI: comando, cwd, resultado, salida y revisión a la que corresponden. Mantener separado el juicio del revisor. No fabricar una nueva plataforma de certificación para guardar cinco datos que ya produce la ejecución.

Evidencia: [servicio, finishVerification](https://github.com/samuhlo/ein-agent/blob/f220788c1da2f77afac21cb37af154621aa05cce/shared/sdd/sdd-verification-receipt.ts#L127), [herramienta expuesta al agente](https://github.com/samuhlo/ein-agent/blob/f220788c1da2f77afac21cb37af154621aa05cce/ein-pi/agent/extensions/internal/ein-verify-receipt-child.ts).

### 6. Alta: las evaluaciones no prueban la arquitectura completa

El piloto del 8 de septiembre sí respalda algo valioso: en cinco encargos de un archivo, planificación común más ejecución barata obtuvo menor coste API atribuible que planificación común más ejecución capaz: 0,3968 frente a 0,9451 USD, incluyendo reparación. El barato pasó 4/5 inicialmente. Eso justifica seguir explorando esa estrategia.

Falta el comparador decisivo: **modelo capaz resolviendo directamente el encargo**, sin pagar primero la planificación y los traspasos. Los estudios tampoco recorren el prompt completo del padre y todo SDD ni incluyen el coste humano de preparación y rescate. No permiten afirmar que siete fases ahorren dinero o mejoren calidad.

Las evaluaciones de pi-lens y Engram son activos especialmente útiles: registran fallos, límites y resultados desfavorables. No se ha vuelto a ejecutar su corpus en esta auditoría. La memoria útil quedó prácticamente empatada en el pequeño ensayo corregido; no hay razón para reinstaurar un espejo obligatorio porque gentle-ai lo use.

Evidencia: [piloto](../../evals/simple-pilot-2026-09-08.md), [pi-lens](../../evals/pi-lens-2026-09-09.md), [Engram](../../evals/engram-decision-2026-09-11.md). Estos informes están en el árbol local auditado; algunos aún son archivos no rastreados.

### 7. Media: coste de mantenimiento y actualización superior al necesario para una herramienta personal

Medición reproducible sobre main, contando archivos `.ts` y `.md`, líneas físicas incluidas vacías: `ein-pi/agent` contiene 236 archivos y 38.425 líneas; `shared`, 47 y 7.443; `tests`, 343 y 60.961. Son tamaños de superficies distintas, no una medida de código inútil ni una tasa de defectos.

Solo `runtime/assets/orchestrator.md` ocupa 43.011 bytes; la guía compartida suma 7.011 y apply 12.879. Son tamaños de archivos, no tokens facturados ni contexto inyectado en cada turno. Sí muestran cuánto contrato hay que mantener coherente.

Los paquetes Pi se declaran con `@latest`, mientras Ein adapta esquemas, transporte, prompts y comportamiento de extensiones. Los checks de compatibilidad existentes ayudan, pero no convierten futuras resoluciones de latest en el mismo entorno reproducible.

**Cambio propuesto:** una combinación probada de versiones para uso habitual y actualización experimental aislada. Reducir parches al runtime y aprovechar capacidades nativas. Mantener Claude como continuidad limitada que se ensaya, sin exigir paridad de todos los mecanismos de Pi.

Evidencia: [settings](https://github.com/samuhlo/ein-agent/blob/f220788c1da2f77afac21cb37af154621aa05cce/ein-pi/agent/settings.json), [instalación de dependencias](https://github.com/samuhlo/ein-agent/blob/f220788c1da2f77afac21cb37af154621aa05cce/installer/src/core/deps.ts).

## Qué conservar, simplificar y retirar

| Pieza | Decisión propuesta | Motivo |
|---|---|---|
| Instalación aislada, backup, restore y doctor | Conservar, congelar mejoras especulativas | Protegen el entorno real de Samu. |
| Criterios de aceptación y tests funcionales | Conservar | Evalúan comportamiento útil. |
| Revisión independiente | Aplicar según consecuencia y dificultad | Puede encontrar defectos fuera de lo que cubren los tests; no necesita siete fases. |
| Frescura de evidencia | Conservar la propiedad, reducir acoplamiento SDD | Evita presentar resultados anteriores como actuales. |
| Continuidad Pi ↔ Claude | Reducir a objetivo, estado, diff, pruebas y pendiente | El disco y Git ya ofrecen una base portable. |
| Scout y ejecución barata | Opcionales y comparables con ejecución directa | Tienen usos valiosos; los umbrales no deben ser dogma. |
| Skills | Cargar las pertinentes para el encargo | Evitar pagar instrucciones genéricas que no cambian una decisión. |
| Cadena SDD, lanes, preflight y cierre documental | Retirar del trabajo nuevo habitual | El coste de transición y recuperación debe justificarse por resultados. |
| Specs existentes | Conservar cuando describan producto; archivar lo obsoleto | Abandonar un motor no obliga a perder conocimiento. |
| Tablas TDD y prosa usada como transporte | Sustituir por configuración simple y evidencia de ejecución | El método no debería requerir reparar documentos para continuar. |
| Engram/espejo obligatorio | No incorporarlo | La evidencia propia no demuestra una ventaja general. |
| Máquina RDD completa de gentle-ai | No copiarla en esta recuperación | Añadiría otra superficie importante que mantener. |
| Tests de texto de contratos retirados | Retirar junto al contrato; conservar pruebas de comportamiento | No mantener tests que obliguen a perpetuar una arquitectura descartada. |

## Diseño al que reconduciría Ein

Una sesión entiende el encargo, actúa con herramientas nativas, comprueba el resultado y explica qué queda. Puede delegar cuando haya un motivo concreto. Para trabajo que deba sobrevivir a una interrupción mantiene un documento breve. La interfaz muestra trabajando, comprobando, terminado con evidencia o decisión pendiente.

El determinismo se concentra en efectos y hechos observables: límites de acceso, autorización de entrega, estado Git, resultados de comandos e identidad de lo comprobado. La elección del siguiente paso técnico puede quedar al agente dentro del alcance autorizado. Comprobar que un comando terminó con código cero es determinista; decidir si ese comando cubre el requisito sigue requiriendo juicio.

TDD queda como técnica disponible. Para una regresión reproducible o lógica con ejemplos claros, observar un fallo antes del arreglo es valioso. Para copy, CSS o exploración inicial, exigir el mismo ritual no suele aportar la misma información. Las pruebas pueden incluir integración, tipos, ejecución real y comprobación visual según el cambio. La verificación no desaparece cuando TDD está desactivado.

Cambiaría explícitamente cuatro reglas del manifiesto:

1. De reparto fijo por precio a coste total, calidad y tiempo de Samu por resultado aceptado.
2. De ejecutor sin razonamiento a autonomía proporcional al encargo, con escalado permitido.
3. De routing siempre determinista a garantías deterministas sobre hechos y efectos, con planificación adaptable.
4. De fallo del registro como posible veto global a continuidad degradada visible, manteniendo límites reales de seguridad y entrega.

La recomendación no presupone que un modelo nuevo lo resuelva todo. La literatura de ingeniería consultada aconseja empezar sencillo y justificar complejidad mediante evaluación; también conserva progreso persistente y pruebas reales para tareas largas. Son antecedentes útiles, no un benchmark de Ein ni una demostración universal sobre los modelos de septiembre de 2026. Fuentes: [Building effective agents, 2024](https://www.anthropic.com/engineering/building-effective-agents), [Effective harnesses for long-running agents, 2025](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents).

## Transición propuesta, sin otra campaña interminable de arquitectura

**Primero: establecer una referencia utilizable.** Conservar el estado local y las instalaciones. Preparar una configuración aislada del agente nativo y otra de Ein reducido a partir de main actual. No hacer un reset del checkout ni revertir decenas de PR como bloque. No modificar a la vez modelo, runner, dependencias y workflow.

**Segundo: un único corte de simplificación.** Permitir trabajo directo; retirar SDD y sus instrucciones del camino ordinario; conservar un documento solo para trabajo prolongado, los checks y los permisos existentes. Evitar diseñar un «motor ODD». Los cambios SDD ya abiertos mantienen un modo de compatibilidad durante la transición, sin crear nuevas obligaciones de migración para poder trabajar.

**Tercero: comparar trabajo real antes de consolidarlo.** Piloto propuesto de 12 casos: 3 cambios pequeños, 3 regresiones, 3 cambios de varios archivos y 3 continuaciones/correcciones después de verify. Incluir el incidente TDD ya registrado. Para cada caso, misma base, criterios y entorno en tres alternativas: agente nativo con instrucciones breves; Ein reducido; Ein actual. Repetir los casos dudosos o sensibles al azar. Es un piloto de decisión, no una prueba estadística concluyente.

Medir éxito contra criterios independientes, defectos detectados al revisar, tiempo hasta primera edición y aceptación, coste de todos los modelos e intentos, intervenciones humanas, recuperación tras interrupción y trabajo administrativo del arnés. Conservar prompts y resultados; ningún participante conoce tests reservados antes de terminar. Registrar limitaciones de caché y ejecución concurrente.

Criterio propuesto para adoptar: sin regresiones críticas; mismas exigencias de aceptación; ninguna reparación manual del arnés en casos simples; recuperación fiel del pendiente; mejora clara en tiempo/intervenciones o coste total. Un ahorro API pequeño que requiera más atención de Samu no basta. Si una regresión es importante, ampliar ese caso antes de decidir.

**Cuarto: retirar lo que no gane.** Si el agente nativo iguala a Ein reducido, reducir Ein aún más a configuración, skills y utilidades independientes. Si una delegación barata gana en una clase de tareas, conservarla para esa clase. Eliminar después código, prompts, pantallas y tests exclusivos del motor abandonado. Git conserva el trabajo histórico: no hace falta que siga instalado.

No recomiendo cambiar directamente a todo gentle-ai sin ese ensayo: su producto cubre muchos agentes y contiene obligaciones ajenas al uso personal. Tampoco recomiendo reescribir Ein desde cero antes de volver a usarlo en Planificador o BERRO. El objetivo del siguiente corte es terminar trabajo real con menos fricción.

## Comprobaciones realizadas y límites

- Se inspeccionaron fuentes locales, main publicado y las superficies instaladas indicadas arriba; no se leyó ni modificó autenticación.
- Se clonó gentle-ai y se fijó su revisión. Se contrastó documentación con código, sin instalar su producto ni asumir paridad con Gentle Shell.
- En la copia temporal de Ein main se ejecutaron `tests/tdd.test.ts`, `tests/apply-tdd-contract.test.ts`, `tests/delegation-admission.test.ts`, `tests/ein-continuity-extension.test.ts` y `tests/sdd-verification-receipt.test.ts`: **61 pass, 0 fail, 276 assertions**.
- El primer intento se detuvo en el preloader por ausencia de dependencias en la copia. Se enlazaron las dependencias existentes del workspace y se repitió con éxito; no se instalaron versiones nuevas. Esto no acredita un entorno limpio de release.
- Se reprodujeron con funciones reales la clasificación de resume como management y la de tests/apply como efectos externos o desconocidos. La relación con el atasco completo se presenta como riesgo de integración, no como reproducción end-to-end.
- No se ejecutaron suite completa, sesiones de pago, comparación de modelos, migración ni cambios de runtime. No se afirma que los 61 tests demuestren superioridad de un flujo.

Artefactos temporales de esta sesión: `/private/tmp/ein-main-audit-20260928`, `/private/tmp/gentle-ai-audit-20260928` y `/private/tmp/ein-audit-focused-20260928.log`. Pueden desaparecer; los enlaces de código anteriores fijan commits para conservar la referencia.

**Decisión recomendada:** autorizar una simplificación reversible que ponga a prueba el agente nativo y un Ein mínimo. Los meses invertidos no obligan a mantener cada mecanismo. Han producido conocimiento, casos de fallo, herramientas y evaluaciones reutilizables; esas son las piezas que deben sobrevivir a la arquitectura actual.
