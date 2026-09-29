# Ein: prácticas de Matt Pocock, capacidades de Gentle Shell y ejecución económica

28 de septiembre de 2026 · Propuesta de producto y plan de implementación. No implementado.

## Decisión principal

**Construir sobre Ein una experiencia de trabajo sencilla: un agente capaz que puede actuar directamente, trabajadores baratos con autonomía suficiente y comprobaciones reales. Incorporar las prácticas de Matt como skills selectivas y las mejores capacidades operativas de Gentle Shell sin importar su motor completo.**

La unidad de trabajo será un resultado verificable. Dejan de gobernar las fases SDD, el número de archivos y la regla «el caro nunca programa». La ejecución barata sigue siendo una prioridad explícita, pero deberá ahorrar después de contar preparación, revisión, intentos fallidos y rescates.

Preferencia confirmada por Samu: empezar con modelos baratos alojados. Objetivo posterior: Qwen3.8-27B en una GPU con 24 GB de VRAM. La fase alojada debe ser útil por sí misma; no dependerá de comprar hardware.

Este plan desarrolla la [auditoría previa](../audits/2026-09-28-rumbo-ein-vs-gentle-ai.md). No modifica todavía el manifiesto, el roadmap vigente ni las instalaciones.

## Fuentes y alcance

| Fuente | Revisión inspeccionada | Qué aporta |
|---|---|---|
| [mattpocock/skills](https://github.com/mattpocock/skills/tree/c55ee46073ed923f86ce59a5eb3b6d895095d1b7) | `c55ee46073ed923f86ce59a5eb3b6d895095d1b7` | Prácticas de ingeniería como instrucciones pequeñas y adaptables. |
| [gentle-shell](https://github.com/Gentleman-Programming/gentle-shell/tree/12de3e98cac73d2ef85478a93497ccaacf5426a3) | `12de3e98cac73d2ef85478a93497ccaacf5426a3` | Runtime Pi, trabajadores visibles, routing, continuidad y revisión. Paquete del checkout: `gentle-pi` 3.7.0; no se presupone que ese checkout sea el paquete publicado. |
| [GVS5H](https://github.com/slee-persis/GVS5H/tree/707e21296bfa032250f10bdde4afaff7ec998f71) | `707e21296bfa032250f10bdde4afaff7ec998f71` | Experimento sobre organización de inferencia, contexto nuevo y estado persistente. |
| Ein | Main `f220788c`, checkout local y comprobaciones de instalación documentadas en la auditoría | Base de integración, garantías existentes y fallos que deben dejar de ocurrir. |

Se leyeron skills, implementaciones relevantes y el fuente LaTeX del estudio. No se instalaron los proyectos externos ni se invocaron sus skills como instrucciones de esta sesión. No se ejecutaron modelos ni se reprodujeron sus benchmarks. «Adoptar» indica una propuesta, no una capacidad ya incorporada.

## 1. Qué extraer de Matt

Su mayor aportación es separar buenas prácticas de un motor que imponga todo el proceso. Aun así, varias skills contienen decisiones fuertes que requieren adaptación a Ein.

| Skill / práctica | Incorporación propuesta | Adaptación para Ein |
|---|---|---|
| `codebase-design` | Primera entrega de skills | Interfaces pequeñas que ocultan complejidad; evaluar si una capa aporta algo antes de mantenerla. Evitar convertir su vocabulario obligatorio en otra policía de prosa. |
| `tdd` | Primera entrega | Pruebas del comportamiento público, valores esperados independientes, un cambio vertical cada vez. Resolver internamente el punto de prueba cuando sea obvio; preguntar solo por decisiones materiales. |
| `diagnosing-bugs` | Primera entrega | Buscar una señal reproducible del problema, reducir el caso, contrastar hipótesis y añadir regresión. Para un bug evidente no imponer cinco fases ni 3–5 hipótesis artificiales. |
| `writing-for-agents` | Primera entrega | Instrucciones breves con referencias que se cargan cuando hacen falta; un dueño por regla. Medir activación correcta de esas referencias. |
| `code-review` | Primera entrega | Separar cumplimiento del encargo y calidad/mantenibilidad. Una revisión puede cubrir ambos; dos revisores solo cuando la independencia compense. |
| `to-tickets` | Trabajo sustancial | Cortes verticales que ya funcionan, dependencias reales; expandir, migrar y retirar para refactors amplios. Normalmente checklist único; issues solo si aportan colaboración o seguimiento. |
| `to-spec` | Opcional | Sintetizar la conversación sin entrevistar otra vez. Contrato corto y criterios observables; no exigir una lista extensa de historias para cualquier feature. |
| `domain-modeling` | Cuando aparezca ambigüedad de dominio | Glosario pequeño y decisiones duraderas. `CONTEXT.md` es glosario, no otro almacén del estado de tareas. Reutilizar documentos existentes. |
| `grilling`, `grill-me`, `grill-with-docs` | Invocación expresa o propuesta aceptada | Entrevista útil para decisiones abiertas; no una aduana al comienzo de toda petición. No preguntar hechos que se pueden consultar. |
| `prototype` | Para una incertidumbre concreta | Prototipo desechable de comportamiento o interfaz con una pregunta que resolver. Capturar la decisión y su referencia, no convertirlo en producto accidental. |
| `research` | Investigación acotada | Fuentes primarias, citas y separación entre evidencia e inferencia. Segundo agente solo si libera trabajo útil del padre. |
| `handoff` | Reutilizar en continuidad | Resumen de pendiente y referencias, sin duplicar specs/diffs. Usar el almacenamiento persistente de Ein cuando deba sobrevivir al directorio temporal. |
| `improve-codebase-architecture` | Revisión puntual de zonas problemáticas | Buscar fricción en áreas que cambian; aplicar la prueba de eliminación. No programar refactors periódicos sin una necesidad. |
| `wayfinder` | Reserva para trabajos grandes con decisiones dependientes | Mapa progresivo de incertidumbres. No imponer un issue por decisión ni una decisión por sesión en el flujo diario. |
| `setup-matt-pocock-skills` | Adaptar al descubrimiento existente | Reutilizar stack, comandos, tracker y docs del proyecto. No abrir un segundo asistente de configuración con autoridad propia. |
| `implement` | Absorber sus prácticas | Edición y checks focales, cierre verificable. Su instrucción de commit automático queda sometida a la autorización de entrega de Ein. |
| `resolving-merge-conflicts` | Disponible bajo demanda | Resolver por intención e historia. No adoptar «nunca abortar» ni «stage everything»: conservar el alcance y la estrategia de recuperación acordada. |
| `triage`, `ask-matt` | Opcionales | Útiles para cola de trabajo y descubrimiento de skills; no son necesarios para implementar una petición clara. |
| `wizard`, `to-questionnaire` | Opcionales | Ayudar con pasos externos o decisiones de terceros cuando el trabajo realmente los necesita. |
| `wait-what`, `teach` | Incorporar claridad de explicación; enseñanza aparte | Español claro y profundidad proporcional. Los espacios de aprendizaje no entran en el runtime de programación. |

Fuentes de las decisiones centrales: [diseño](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/engineering/codebase-design/SKILL.md), [TDD](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/engineering/tdd/SKILL.md), [diagnóstico](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/engineering/diagnosing-bugs/SKILL.md), [revisión](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/engineering/code-review/SKILL.md), [cortes verticales](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/engineering/to-tickets/SKILL.md), [escritura de instrucciones](https://github.com/mattpocock/skills/blob/c55ee46073ed923f86ce59a5eb3b6d895095d1b7/skills/productivity/writing-for-agents/SKILL.md).

Un detalle ilustra por qué no copiar literalmente: el TDD actual de Matt reserva refactoring para review, mientras Gentle incluye REFACTOR en su ciclo. Ein debe tener una sola política comprensible: mejoras locales que ayuden al cambio con pruebas verdes; refactors amplios requieren alcance propio. Tampoco se hereda automáticamente la semántica de invocación de Claude a Pi: probar descubrimiento e invocación explícita en cada runtime soportado.

## 2. Qué extraer de Gentle Shell

| Capacidad | Qué incorporar | Qué evitar |
|---|---|---|
| Trabajadores en procesos separados | Inicio/fin fiables, cancelación y entrega del resultado al padre mediante eventos. | Reescribir el runner actual si ya cubre el contrato probado. |
| Estado visible | Objetivo del hijo, modelo efectivo, tiempo, coste conocido y bloqueo accionable. | Hacer que la interfaz consuma contexto del modelo mediante consultas constantes. |
| Resultado parcial recuperable | Conservar cambios y pendiente tras timeout o interrupción. | Relanzar desde cero o convertir un fallo de registro en fracaso del código. |
| Perfiles y routing | Mostrar modelo/esfuerzo realmente elegidos y su procedencia; override de proyecto. | Matriz de roles por cada fase antigua. |
| Skills selectivas | Descubrimiento y lectura de lo pertinente; caminos concretos al delegar. | Segundo registro que compita con `ein_skill_resolve`. |
| Cambios atribuidos a la sesión | Vista rápida de ediciones observadas y su autoría. | Presentarla como diff completo: las escrituras vía shell y cambios externos necesitan Git. |
| Verificación del candidato exacto | Vincular comprobaciones y revisión al código examinado. | Importar toda la maquinaria RDD para cada tarea. |
| Un documento de trabajo | Intención, progreso y pendiente recuperables. | Espejo Engram obligatorio o múltiples documentos equivalentes. |
| Cierre real del hijo | Distinguir final de una respuesta, fin del agente y proceso terminado. | Marcar éxito por recibir una frase final mientras hay continuación o herramientas activas. |

Fuentes: [runner](https://github.com/Gentleman-Programming/gentle-shell/blob/12de3e98cac73d2ef85478a93497ccaacf5426a3/lib/agents-runner.ts), [actividad por eventos](https://github.com/Gentleman-Programming/gentle-shell/blob/12de3e98cac73d2ef85478a93497ccaacf5426a3/docs/gentle-agents-activity.md), [routing](https://github.com/Gentleman-Programming/gentle-shell/blob/12de3e98cac73d2ef85478a93497ccaacf5426a3/lib/model-routing-authority.ts), [captura de ediciones](https://github.com/Gentleman-Programming/gentle-shell/blob/12de3e98cac73d2ef85478a93497ccaacf5426a3/lib/session-changes.ts), [orquestador](https://github.com/Gentleman-Programming/gentle-shell/blob/12de3e98cac73d2ef85478a93497ccaacf5426a3/assets/orchestrator.md).

No adoptaría los umbrales obligatorios de cuatro archivos, dos escrituras no triviales o veinte llamadas. Un segundo archivo puede ser el test natural de un arreglo; no demuestra que un traspaso compense.

Tampoco instalaría Gentle Shell encima de Ein. En la revisión leída, su runner depende de mensajería, routing, cambios y permisos de revisión; no es una biblioteca autónoma que baste con copiar. El orquestador principal es pequeño, pero su contrato de delegación cargado bajo demanda ocupa 45.958 bytes. Esta medición no es una factura de tokens; muestra que mover complejidad a referencias no la elimina.

**Estrategia de reutilización:** probar primero el comportamiento equivalente en Ein; portar una pieza aislada con sus pruebas si falta; cambiar el runner solo ante un fallo demostrado que la pieza actual no pueda resolver razonablemente. Un solo runner productivo, no dos motores y un adaptador universal entre ellos.

## 3. Qué demuestra GVS5H y qué probaríamos nosotros

El estudio informa que Qwen3.8-27B pasa de 66,8 % a 92,4 % en su selección de 100 problemas difíciles de LiveCodeBench, frente a 90,4 % de Fable 5 en llamada única. Son medias de cinco pasadas; no una certificación de equivalencia general. Sirven Qwen localmente en FP8. El comparador fuerte no se ensaya con el mismo sistema de coordinación; tampoco igualan tokens entre llamada única y sistema. Fuente: [estudio](https://github.com/slee-persis/GVS5H/blob/707e21296bfa032250f10bdde4afaff7ec998f71/paper/paper_latest.tex), [tabla](https://github.com/slee-persis/GVS5H/blob/707e21296bfa032250f10bdde4afaff7ec998f71/paper/tab-4new-5pass.tex).

El código alterna coordinación y ejecución con instancias del mismo modelo, contexto nuevo y archivos compartidos. Acota notas, detecta una tarea repetida y usa tests públicos como feedback. No exige cinco modelos residentes ni cinco GPU. Fuente: [implementación](https://github.com/slee-persis/GVS5H/blob/707e21296bfa032250f10bdde4afaff7ec998f71/codebase/v2-current/escalation/multiagent.py).

**Aplicación propuesta a Ein:** permitir que el barato investigue e implemente dentro de un encargo; darle contexto nuevo cuando arrastre confusión; conservar hechos, intentos y pendiente; usar el resultado de herramientas para corregir el rumbo. El capaz interviene ante decisiones difíciles o atasco, no tiene que escribir previamente cada edición.

No copiaría su secuencia fija de brainstorming, manager, worker y finalizer. Tampoco su finalización al agotar presupuesto como permiso para declarar terminado. Un límite termina en resultado parcial. No trasladaría los porcentajes a mantenimiento de repositorios, tool calling, edición multiarchivo ni cuantización a 4 bits sin ensayarlos.

Los costes monetarios del estudio usan tarifas supuestas por tokens, también para Qwen local. No equivalen al coste de electricidad, GPU, latencia o mantenimiento de Samu. Fuente: [cálculo de costes](https://github.com/slee-persis/GVS5H/blob/707e21296bfa032250f10bdde4afaff7ec998f71/paper/fig-cost-tables.tex).

## 4. Cómo funcionaría el nuevo Ein

### Una sesión, tres decisiones posibles

| Situación | Acción preferida |
|---|---|
| El agente ya entiende el arreglo y explicarlo a otro costaría parecido a hacerlo | Implementar directamente y ejecutar comprobaciones pertinentes. |
| Hay un resultado acotado, suficiente contexto localizable y forma de comprobarlo | Delegar al barato el encargo completo, incluyendo investigación local necesaria. |
| Hace falta evidencia amplia para decidir, o hay investigaciones independientes | Delegar exploración concreta y recibir hechos con referencias. |

La elección ocurre en el agente actual. No añadimos una llamada de clasificación, un modelo router ni un lenguaje de workflows. Al principio es juicio informado por ejemplos y mediciones. Los permisos, capacidades del endpoint y límites explícitos sí los comprueba el runtime.

El coste incremental que interesa comparar es:

`delegar = preparar + ejecutar + comprobar + integrar + rescates esperados`

frente al coste de terminar directamente desde el estado actual. La revisión necesaria cuenta en ambos recorridos; no se gana eliminando verificaciones de uno. Latencia y minutos de intervención humana se muestran aparte, sin inventar una conversión a euros. El contexto ya leído es coste pasado; importan el trabajo y las llamadas adicionales.

**Preferencia operativa:** enviar al barato trabajo de tamaño útil y comprobable cuando la ventaja sea plausible. Evitar tanto microdelegaciones como planes gigantes. Una instrucción razonable no necesita convertirse en pseudocódigo completo. Si preparar el encargo descubre la solución trivial, terminarla directamente.

### Un contrato pequeño para el trabajador

El encargo contiene objetivo, alcance autorizado, contexto necesario, criterios de aceptación y comprobaciones. Solo añade riesgos o instrucciones especiales cuando cambian la ejecución. El runtime aporta cwd y configuración efectiva; el padre no los reconstruye en prosa cada vez.

Ejemplo: «Corrige la detección de SQLSTATE leyendo `error.code` y causas anidadas. Trabaja en el migrador y sus pruebas. Conserva los contratos públicos. Reproduce el caso del informe, comprueba la regresión y tipos con los comandos del proyecto. Devuelve cambios, resultados y cualquier discrepancia material.»

El barato puede leer, diagnosticar, probar hipótesis y decidir detalles locales. No puede ampliar el producto ni publicar por iniciativa propia. Su respuesta comunica resultado completo/parcial, qué cambió, checks observados y pendiente. Un error menor de formato del resumen no exige repetir el trabajo.

El escalado conserva el diff y los checks. Se permite corregir un fallo concreto; si reaparece el mismo fallo sin evidencia nueva, el padre decide entre acotar, cambiar de enfoque, continuar él mismo o subir capacidad. Los límites de coste/tiempo son compartidos entre intentos, no se reinician con cada hijo. Solo se promete un límite que el runner realmente pueda aplicar.

No se codifica `thinking: low` como principio universal. Modelo, tarea y servidor determinan qué esfuerzo resulta eficiente. Separar elección de modelo y elección de esfuerzo, tal como permite el routing existente.

### Pocos roles y estado mínimo

Tres capacidades bastan inicialmente: explorar, trabajar y revisar. Son permisos y encargos distintos sobre el mismo mecanismo de ejecución, no una cadena obligatoria. Un comando de tests lo ejecuta una herramienta; lanzar un agente solo para pulsar ese comando debe justificar contexto o aislamiento.

Trabajo pequeño: conversación, diff y resultados de herramientas. Trabajo prolongado: un archivo de trabajo en la ubicación existente del proyecto, con objetivo, decisiones relevantes, checklist y pendiente. El nombre y formato exactos se concretan en el primer corte; no se añade un segundo tablero.

Separar conocimiento duradero de progreso: glosario/ADR para conceptos y decisiones; documento de trabajo para estado transitorio; Git para código; resultados de ejecución para comprobaciones. Engram puede evaluarse después como ayuda opcional, sin una copia autoritativa obligatoria.

Verificación por consecuencia: tests focales durante edición; checks requeridos al entregar; revisión semántica independiente cuando el riesgo lo merece. Un test verde no prueba que el encargo esté satisfecho y un reviewer optimista no sustituye un proceso que falló. La evidencia corresponde al código actual, incluidos los archivos nuevos pertinentes.

La interfaz conserva una conversación principal y muestra solo trabajo activo, cambios, comprobaciones y decisiones necesarias. Los detalles de hijos se abren bajo demanda. Fallar al dibujar o guardar una tarjeta no cambia el permiso para editar.

## 5. Integración con el Ein existente

Las rutas siguientes se refieren a main auditado; antes de editar hay que reconciliar los numerosos cambios locales. Son superficies candidatas, no una lista cerrada para un ejecutor barato.

| Superficie actual | Cambio de responsabilidad |
|---|---|
| `MANIFIESTO.md`, `runtime/AGENTS.md`, `runtime/assets/orchestrator.md` | Cambiar reparto fijo por coste total; permitir ejecución directa; reglas cortas y skills selectivas. |
| `runtime/skills/local/`, `vendor/skills/`, `runtime/skills/stack-profile.json` | Incorporar fuentes fijadas y adaptaciones explícitas; retirar duplicados de arquitectura, disciplina y escritura. |
| `ein-skill-registry.ts`, `ein-agent-prompt-hook.ts` | Un único descubrimiento y lectura selectiva. El camino ordinario no inyecta SDD/TDD preflight ni contratos de fases. |
| `model-config.ts`, inventario de agentes | Reutilizar asignación actual para capaz/barato y, después, local; migrar aliases antiguos sin reintroducir sus fases. |
| Gateway y configuración del runner | Encargos breves, cancelación, resultado parcial y transporte de configuración también en continuación. |
| `continuity-*`, `project-state-*` | Recuperar objetivo, revisión, cambios, evidencia y pendiente sin necesitar reconstruir fases. |
| `sdd-verification-*`, `verification-surface-git.ts` | Reutilizar identidad/frescura donde aporte valor, desacoplada del cierre de documentos. Resultados de comandos proceden de la ejecución. |
| `session-accounting*`, `evals/` | Coste y resultado por encargo; distinguir valores medidos, estimados y desconocidos. |
| `ein-cc/` | Continuidad funcional mediante el mismo documento y Git. Verificar comportamiento real; no portar toda la UI de Pi. |
| Instalador | Mantener aislamiento y rollback; combinación de versiones probada y actualización experimental separada. |

Distribución: fuentes externas con commit y licencia; adaptaciones propias fuera del vendor inmutable, evitando que ambas versiones compitan bajo el mismo nombre. Mantener atribución MIT al reutilizar código/skills. GVS5H separa código MIT de paper/datos CC BY 4.0; usar ideas no requiere copiar su corpus. Fuente: [aviso de GVS5H](https://github.com/slee-persis/GVS5H/blob/707e21296bfa032250f10bdde4afaff7ec998f71/NOTICE.md).

## 6. Plan por entregas utilizables

### Preparación: referencia y compatibilidad

Fijar main, versiones efectivas y configuración en un hogar aislado. Preservar el checkout sucio. Elegir casos de Planificador/BERRO y los fallos reales de Ein ya documentados. Registrar qué sabe hacer el runner instalado sin asumir soporte por su esquema TypeScript. No es un proyecto nuevo de telemetría.

### Entrega 1 — Ein resuelve lo pequeño sin ceremonia

Permitir al padre editar y comprobar. Retirar del camino ordinario los gates ligados a crear fases; mantener permisos reales y entrega. Incorporar primero `writing-for-agents`, diseño, TDD, diagnóstico y revisión adaptados. Reutilizar el catálogo existente y eliminar reglas duplicadas al introducirlas.

**Demostración:** arreglo conocido, bug con regresión y ajuste visual terminados sin SDD, entrevistas administrativas ni delegaciones obligatorias. Los checks apropiados siguen ejecutándose. Preguntas, auditorías y planificación no activan escrituras de implementación. Reversión: configuración/prompt anterior en el hogar aislado, sin migrar documentos existentes.

### Entrega 2 — Un barato termina un encargo completo

Un solo trabajador con modelo alojado seleccionado, contexto fresco, alcance y checks. El padre puede seguir haciendo trabajo independiente, y recibe el resultado por el mecanismo de eventos disponible. El trabajador conserva capacidad de diagnóstico. Integrar las ideas de Gentle Shell donde el runner actual tenga un hueco probado; no sustituirlo por motivos estéticos.

**Demostración:** una feature vertical y una regresión pasan aceptación independiente; un caso trivial permanece directo. Un fallo devuelve cambios parciales y pendiente; el padre puede rescatarlos sin rehacer el plan. Se observan modelo efectivo, coste cuando existe y tiempo total. Reversión: desactivar esa ruta conservando el diff.

### Entrega 3 — Interrupción y comprobación fiables

Continuidad con un único documento; transportar decisiones al reanudar; registrar resultados de comandos y revisión comprobada. La indisponibilidad del registro auxiliar degrada continuidad, no autorización de trabajo nuevo. Un efecto externo cuyo resultado sea incierto se inspecciona antes de repetirlo.

**Demostración:** detener tras editar, retomar en sesión nueva y después en Claude; conservar decisiones y tareas terminadas. Reproducir `apply → verify detecta error.code → continuación → regresión pasa` sin repetir la pregunta TDD. Cambiar código después de comprobarlo invalida solo la evidencia afectada; nunca se presenta como vigente sin justificación.

### Entrega 4 — Hacer visible lo que ya funciona y retirar legado

Panel pequeño con trabajadores, modelo/esfuerzo efectivo, progreso, cambios y checks. Conservar UI existente si ya sirve. Captura de ediciones para atribución; diff Git completo para entrega. Cancelación de hijos, detección correcta de fin y comandos largos sin falsos atascos.

**Demostración:** Samu entiende qué se hace, cuánto tarda y qué necesita su decisión sin leer logs. Un fallo del panel no bloquea trabajo. Después de demostrar sustitución, retirar roles/fases/validadores exclusivos de SDD y sus tests textuales. Mantener acceso a cambios antiguos hasta cerrarlos; archivar specs que ya no describan producto. No dejar dos flujos activos indefinidamente.

### Entrega 5 — Piloto local de Qwen en 24 GB

Conectar el endpoint local mediante soporte de proveedores/modelos de Pi, sin crear una capa nueva. Ensayar cuantización, contexto y herramientas en el mismo corpus y aceptar solo las clases que funcionen. Ver requisitos abajo.

**Demostración:** operación sostenida sin OOM, tool calling correcto, cambios dentro del alcance y aceptación comparable al barato alojado. Si falla o está caído, comunicarlo y usar el fallback previamente configurado; no cambiar silenciosamente costes o destino del código. Reversión: volver al alias alojado.

El primer resultado útil debe existir tras la entrega 1. Los experimentos acompañan los cortes, no esperan a que toda la arquitectura esté terminada. Cada entrega elimina o sustituye mecanismos; no abre otra campaña general de limpieza.

## 7. Evaluación que decide qué se queda

Primero un control rápido de 6 casos para descartar configuraciones claramente malas. Después, 12 casos representativos, al menos dos ejecuciones por configuración candidata; repetir los resultados discordantes. Conjunto propuesto: 2 triviales, 3 regresiones, 3 features verticales, 2 investigaciones y 2 recuperaciones. Los casos de recuperación incluyen TDD persistido y un hijo interrumpido con diff parcial.

Comparadores: A) agente capaz directo con instrucciones breves; B) Ein ligero con capaz directo; C) Ein ligero delegando al barato. Una pequeña ablación sin las skills nuevas separa valor de skills y coordinación. El Ein actual sirve como referencia de regresiones en una muestra; no multiplicar toda la matriz por cada idea. Más adelante D) trabajador local, misma tarea y aceptación.

Misma base, herramientas y criterios en comparaciones equivalentes. Tests reservados y revisión independiente del resultado; incluir intentos fallidos. Las instrucciones más simples no reciben menos comprobaciones. Registrar endpoint y versión, parámetros de generación y caché; alternar orden. Medir coste total, latencia hasta primera edición/aceptación, rescates humanos, calidad del diff, defectos, llamadas administrativas y éxito al retomar.

**Umbrales iniciales propuestos, ajustables tras la primera muestra:** ningún defecto crítico adicional ni pérdida de alcance/decisiones; cero reparación manual de artefactos en casos simples; para promover delegación barata en una clase, ahorro total orientativo de al menos 20 % sin aumentar rescates, con latencia aceptada. Un porcentaje en 12 casos es una señal para uso supervisado, no una conclusión poblacional. Si la diferencia es pequeña o incierta, preferir la ruta más sencilla y seguir observando uso real.

El estudio GVS5H se convierte en una hipótesis concreta: «un trabajador barato con contexto nuevo y feedback suficiente puede resolver más por sí mismo». No en una promesa de que cinco llamadas ganan siempre. No se promueve por precio/token ni por porcentaje de un benchmark ajeno.

## 8. Objetivo local: Qwen3.8-27B, 24 GB

La ficha oficial describe 27B parámetros y soporte de servidores locales. El experimento GVS5H usa FP8: no es la configuración que cabe íntegra de forma razonable en 24 GB. Estimación aritmética de pesos nominales, antes de metadatos y memoria de ejecución: 16 bits ≈54 GB; 8 bits ≈27 GB; 4 bits ≈13,5 GB decimales. No son tamaños medidos del fichero ni del proceso. Fuente del modelo: [ficha Qwen](https://huggingface.co/Qwen/Qwen3.8-27B).

**Punto de partida propuesto:** cuantización de 4 bits compatible con la GPU y el servidor elegidos, una petición activa, 8k–16k de contexto inicial y pruebas progresivas a 32k solo si memoria y calidad lo permiten. Es un perfil conservador de ensayo, no el límite del modelo. Reservar espacio para caché de contexto, buffers y uso de pantalla. La cuantización y caché cambian requisitos y comportamiento: [memoria en vLLM](https://docs.vllm.ai/en/latest/configuration/conserving_memory/).

No fijar NVFP4 o un kernel concreto hasta saber la GPU: 24 GB no identifica arquitectura ni formatos acelerados. Elegir entre un servidor compatible con GGUF u otro backend soportado a partir del artefacto real. Verificar plantillas y llamadas a herramientas; compatibilidad HTTP no demuestra compatibilidad de agente. Referencias: [receta vLLM para Qwen](https://github.com/vllm-project/recipes/blob/main/models/Qwen/Qwen3.8-27B.yaml), [tool calling en llama.cpp](https://github.com/ggml-org/llama.cpp/blob/master/docs/function-calling.md).

Un servidor mantiene una copia de los pesos y atiende trabajadores secuenciales. No cargar una copia por rol. Aumentar concurrencia únicamente después de medir memoria de contexto, latencia y rendimiento; la capacidad de concurrencia alojada no se hereda en una sola GPU.

Registrar antes de promover: GPU/controlador, formato y hash de pesos, cuantización, versión del servidor, plantilla, contexto real, parámetros de generación, VRAM pico, latencia de primer token, velocidad, errores de herramientas y éxito por encargo. Comparar la cuantización con el modelo alojado teniendo presente que pueden ser variantes distintas. Coste local incluye energía, amortización y mantenimiento; no se representa como cero porque no haya factura por token.

La documentación de Pi disponible en el proyecto ya contempla modelos personalizados y endpoints locales mediante `models.json`; se verificará la versión distribuida y se usará el hogar aislado de Ein. No se necesita anticipar un gestor propio de proveedores.

## 9. Condiciones para no construir otro sistema enrevesado

- Una fuente por decisión y una lista de pendientes; ninguna sincronización obligatoria con tres almacenes.
- Un catálogo de skills y un runner; cero nueva máquina de estados ODD.
- Ningún rol permanente nuevo sin una tarea observada que lo justifique.
- Leer cinco archivos o tocar dos no es por sí solo razón para delegar.
- Las instrucciones del padre no contienen manuales de todas las situaciones posibles.
- Automatizar hechos computables; dejar al modelo juicio técnico y libertad para resolver detalles dentro del alcance.
- No exigir aprobación de pasos ya autorizados; las preguntas resuelven decisiones que cambian el trabajo.
- La calidad se exige al resultado. Un modelo barato que cumple puede pensar, investigar y refactorizar localmente; uno caro puede implementar.
- Conservar permisos, aislamiento y recuperación. Distinguirlos de contabilidad y presentación.
- Ante empate, elegir menos piezas. Si Pi con las skills adaptadas iguala al Ein reducido, retirar más Ein.

## Próximo corte recomendado

**Entregas 1 y 2, en ese orden, sobre instalación aislada:** trabajo directo sin SDD y primer trabajador barato que resuelva un encargo real. Dejar la UI avanzada, la autoorganización multillamada y el hardware local después de demostrar ese recorrido.

El objetivo de la unión es combinar buen criterio de ingeniería, ejecución económica y visibilidad. Su éxito se reconoce cuando Samu acaba más trabajo con menos supervisión, no cuando el sistema contiene más capacidades o más agentes.
