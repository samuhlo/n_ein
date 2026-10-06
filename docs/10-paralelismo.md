# Plan de agentes en paralelo para n_ein

Fecha: 6 de octubre de 2026. Base local: `febbbb5`. Estado: investigación y plan; capacidad todavía no implementada ni evaluada en este corte.

## Recomendación

Incorporar trabajadores visibles y recuperables dentro del recorrido conversacional existente. Usar procesos Pi y su protocolo RPC, un coordinador y hasta dos trabajadores generalistas. Adaptar de Gentle Agents la entrega por eventos, la parada y la vista de actividad; de Matt, las dependencias y la integración. Mantener `WORK.md`, el selector de modelos, la memoria y el relevo de n_ein.

La alternativa preferida es una extensión propia acotada sobre la API pública de Pi. El primer ensayo resolverá cuánto permite reutilizar su `RpcClient` sin perder control de procesos. Si exige acceder a campos privados o no permite demostrar el cierre, usar un adaptador pequeño del protocolo RPC público con control explícito del proceso. Un solo transporte productivo, elegido tras ese ensayo. No instalar Gentle Shell entero ni copiar su extensión de agentes completa.

El beneficio esperado es menor espera en encargos separables. El ahorro de tokens, la aceleración y la recuperación con varios escritores siguen siendo hipótesis que requieren evaluación. Una tarea pequeña mantiene el recorrido de un agente.

## Alcance y autorización

Samu confirmó que el coordinador decida cuándo paralelizar el trabajo autorizado, informe del reparto y respete «hazlo con uno». Confirmó detener al cerrar y recuperar al volver. Después pidió investigar, hacer pruebas e implementar si los resultados compensan; su último encargo es preparar este plan antes de esa ejecución. Esa autorización condicional queda conservada, sin pedirla de nuevo por rutina. Este corte entrega documentación, sin cambiar la preview.

Primer alcance: un proyecto Git, un coordinador Pi, hasta dos trabajadores Pi y continuidad Pi↔Claude. Claude debe poder recibir e integrar el pendiente secuencialmente; ejecutar un equipo dentro de Claude queda fuera de esta primera entrega. Sin equipos anidados, trabajo desatendido tras cerrar, conversaciones entre proyectos, nuevos runtimes ni publicación remota. macOS primero en procesos reales y Linux en CI; no declarar soporte Windows para esta capacidad sin implementarlo y comprobarlo.

## Investigación y comparación

Fuentes actuales: Gentle Shell `69c9b5ae265a60ffaf1dc9e0efc1afdac966f300`, Matt `6fd947921b935b7e1e69293a200400f0fdd5c15f` y Pi instalado y fijado `1.0.2`. Se inspeccionaron documentación, implementación y casos de prueba; no se ejecutaron instaladores ni suites externas ni llamadas nuevas a modelos. Los archivos históricos de `docs/sources/` no se usan como versión actual.

| Opción | Evidencia y encaje | Decisión propuesta |
|---|---|---|
| Instalar `gentle-pi` entero | Su manifest carga el directorio de extensiones, skills, prompts y temas y declara un postinstall de Gentle AI [G1]. Superpone superficies que n_ein ya tiene. | Descartar como dependencia del producto. |
| Extraer Gentle Agents completo | La extensión tiene 2.092 líneas y 49 imports locales directos en la revisión inspeccionada; incluye revisión, perfiles, comunicación entre sesiones y UI de Gentle. El runner tiene 1.053 líneas y 8 imports locales [G2], [G3]. Los tamaños describen acoplamiento, no demuestran mala calidad. | Estudiar comportamientos y adaptar piezas concretas; evitar un fork completo. |
| Ejemplo oficial de subagentes de Pi | Ofrece concurrencia y streaming, pero lanza con `--mode json -p --no-session` [P3]. No proporciona la continuidad persistente que necesitamos. | Referencia de herramientas y presentación; insuficiente como runner final sin cambios. |
| SDK de Pi dentro del principal | Es una API pública para integración en el mismo proceso [P1]. | No preferido para aislar fallos y controlar cada trabajador por separado. |
| RPC público de Pi con integración acotada | Pi recomienda `RpcClient` para TypeScript con subprocesos. La API soporta sesiones, eventos, instrucciones y cancelación [P1], [P2]. Falta cubrir nuestras garantías de cierre, bloqueo y entrega persistente. | Base preferida; resolver el borde de procesos en P0. |

### Hallazgos que cambian el diseño

- **Es compatible con ODD.** Su regla de delegación permite unidades paralelas o necesidades de contexto, sin delegar por tamaño o precio [G5]. El paralelismo no requiere SDD.
- **Historial y recuperación tienen alcances distintos.** Gentle guarda el registro de tarea terminada después de que sale el hijo; este mecanismo concreto no es un checkpoint de cada tarea en curso [G4]. n_ein necesita conservar la asignación antes de lanzar y los hitos durante el trabajo.
- **Una respuesta final no prueba que Pi haya terminado.** En RPC hay que distinguir aceptación del prompt, `agent_end`, `agent_settled`, error y salida del proceso [P1]. El caso `disposition: handled` tampoco inicia necesariamente un turno.
- **El cliente exportado no basta para afirmar cierre completo.** En Pi 1.0.2 `RpcClient.stop()` señala su hijo y puede resolver tras enviar SIGKILL; su interfaz pública no ofrece un `spawn` inyectable ni un handle del proceso. La herramienta bash usa procesos separados y Pi mantiene su propio registro de descendientes [P2], [P4]. Señalar solo el grupo de Pi no demuestra que todos los comandos hayan salido. No se ha reproducido un fallo de cierre: es una limitación observada del contrato que debe ensayarse.
- **Gentle aporta casos de parada valiosos.** Su runner conserva capacidad ocupada cuando la limpieza no está confirmada y distingue herramienta larga de silencio. Su prueba de procesos incluye un descendiente que resiste TERM [G3], [G6]. Esos comportamientos se adaptan a nuestro caso sin asumir que cubren toda la jerarquía de herramientas de Pi.
- **La integración debe tener dueño.** Matt asigna worktrees y ramas a implementadores y reúne sus entregas en una rama de integración [M1]. En n_ein lo hace el coordinador; no añadir otro agente obligatorio solo para fusionar.

### Puntos de integración en n_ein

| Superficie actual | Cambio necesario |
|---|---|
| `pi-package/flow.md`, skills `tasks` y `review` | Sustituir la prohibición actual de ayudantes por reparto justificado, dependencias, contratos y aceptación integrada. Conservar intent y comprobaciones proporcionales. |
| `pi-package/extensions/router.ts`, `pi-package/models.ts` | Reutilizar clases y configuración; resolver proveedor/modelo/esfuerzo efectivos para cada asignación y conservarlos al continuar. |
| `bin/n-ein-dev`, `pi-package/package.json` | Arranque explícito de trabajador con el paquete, instrucciones y recursos pertinentes. No cargar funciones exclusivas del coordinador. |
| `go/cmd/n-ein/runtime.go` | Reutilizar el bloqueo por árbol; adquirirlo también para trabajadores. Incorporar ayuda de ciclo de vida en Go solo donde el ensayo demuestre que hace falta. |
| `pi-package/extensions/handoff.ts`, `bin/n-ein-claude-dev`, skill `to-pi` | Detener y confirmar salida de trabajadores antes de generar el relevo definitivo; incluir todas las ramas y worktrees pendientes. El resumen actual solo recoge el árbol principal. |
| `pi-package/extensions/work-doc.ts`, `todo.ts` y nuevo widget de equipo | Mantener el TODO como lectura de `WORK.md`; actividad de procesos como vista separada, sin competir con la aceptación de tareas. |
| `codegraph.ts`, `bin/n-ein-codegraph`, memoria e idioma | Cwd e índice propios de cada worktree; mismas convenciones e idioma. El hijo debe disponer de estas capacidades sin compartir el índice mutable de otro árbol por accidente. |
| `evals/bench/conversation.ts`, `continuity.ts`, `scripts/check.sh` y empaquetado | Extender recorridos existentes, comprobar el artefacto instalado y separar tests deterministas de evaluaciones con modelos. |

Las rutas anteriores se inspeccionaron en la base local. El bloqueo actual protege sesiones que pasan por el launcher y conserva un descriptor en el shell. No supervisa por sí solo a cualquier escritor externo. Las sesiones de hijos tendrán que pasar por la misma frontera de propiedad.

## Diseño propuesto

### Experiencia de uso

Entrada ordinaria por conversación. El coordinador explica una vez por qué dos frentes pueden avanzar y qué se reserva para integrar. Un widget muestra nombre de tarea, actividad observada, modelo, tiempo y consumo disponible. «Ver equipo», «para el calendario», «hazlo con uno» y «continúa» usan los mismos controles que la vista de detalle. Los botones de ver y detener funcionan localmente; actualizar la pantalla no llama al modelo.

La vista distingue trabajando, bloqueado, detenido y listo para integrar. Una tarea se marca terminada en `WORK.md` cuando cumple sus criterios en el conjunto; la salida correcta del proceso solo significa que hay un resultado para revisar. Sin porcentajes de progreso inventados. Errores de dibujo o estadísticas ausentes no paran trabajo válido.

### Reparto, modelos y contexto

El coordinador decide el reparto con el contexto ya explorado, sin otra llamada clasificadora. Paraleliza cuando hay dos entregas sustanciales que pueden progresar, una base común suficiente y poco solapamiento. Usa ejecución directa para cadenas dependientes, cambios pequeños o contratos todavía abiertos. No repartir por número de archivos ni lanzar siempre dos hijos.

Cada asignación referencia una tarea estable de `WORK.md` y contiene objetivo, aceptación, dependencias, contrato acordado, restricciones, rutas relevantes, base Git y comprobaciones pertinentes. El trabajador recibe hechos y decisiones necesarios, no toda la conversación. Consulta archivos y skills bajo demanda. Solo el coordinador modifica el checklist común y toma decisiones de producto con el usuario.

Reutilizar la tabla de modelos existente por dificultad del encargo y respetar la elección manual del usuario; no crear perfiles de especialistas. Persistir proveedor, modelo y esfuerzo físicos, con cambios explícitos ante nuevos riesgos. No pasar `nein/auto` como si fuera un proveedor físico ni hacer que resultados de hijos se interpreten como una nueva petición del usuario. El piloto compara primero la misma capacidad de modelos para aislar el efecto de paralelizar.

### Procesos, arranque y comunicación

Una extensión TS administra asignaciones y eventos; cada trabajador corre en su propio proceso Pi con sesión persistente. Los detalles del protocolo se concentran en un único adaptador. Reusar `RpcClient` solo si P0 demuestra que las APIs públicas permiten los controles requeridos; de lo contrario usar el protocolo y tipos públicos con control explícito del proceso, sin parchear Pi ni acceder a campos privados.

El arranque hereda deliberadamente el hogar autenticado del canal y carga explícitamente el paquete comprobado, idioma, memoria y CodeGraph. No copia credenciales. Aísla sesiones por ejecución y elimina señales y capacidades del coordinador: relevo, cambio global de modelos, creación de hijos y escritura del documento común. Las credenciales siguen gestionadas por Pi; comprobar dos procesos concurrentes y fallo de proveedor sin introducir otro almacén de auth.

Máximo dos trabajadores activos; la capacidad sigue ocupada hasta confirmar su parada. El padre puede programar en su propio árbol y las operaciones pesadas de pruebas se serializan cuando comparten recursos. Sin delegación recursiva ni un agente adicional para cada fase.

Resultados y bloqueos llegan por eventos al padre. Persistir resultado pendiente de entrega con identidad de tarea, intento y sesión del coordinador; al reanudar se reconcilia y se entrega de forma idempotente. Duplicados o resultados tardíos no reabren tareas ni modifican otro encargo. Usar el bucle nativo de Pi para despertar al padre y agrupar llegadas cercanas, sin polling del modelo ni un turno por fragmento de streaming. En print/json, esperar explícitamente el conjunto dentro de la ejecución; no dejar hijos cuyo padre ya terminó.

En la primera versión, los trabajadores comunican preguntas al coordinador. Las técnicas se resuelven ahí; las decisiones materiales se presentan al usuario una sola vez. Un bloqueo se guarda y el proceso puede detenerse hasta recibir respuesta; no mantener una llamada abierta esperando indefinidamente ni interpretar un timeout como consentimiento. Mensajes de otros agentes son información, nunca una autorización nueva del usuario.

### Git, integración y recursos compartidos

Crear ramas y worktrees propios desde una revisión identificada del encargo. Un escritor por árbol; todos los participantes de n_ein usan el bloqueo existente con identidad canónica. No limpiar ni resetear árboles del usuario, no realizar stash automático ni incluir cambios ajenos en un commit. Con cambios previos necesarios para el encargo, identificar una base explícita y conservarlos; mientras esa base no sea reproducible, seguir secuencialmente.

El coordinador es el único que integra, una entrega cada vez, en la rama de trabajo del encargo. Esto incluye fusiones locales necesarias entre ramas propias, nunca merge a main, push o PR por inferencia. Antes de integrar contrasta base, HEAD del resultado, cambios reales, alcance y pruebas. Si cambia el contrato, comunica su revisión y replantea los frentes afectados. Un conflicto semántico exige comprobar consumidores aunque Git fusione sin conflicto textual.

Tras integrar, comprobar los comportamientos afectados contra el resultado combinado. Conservar commits de cada entrega y registrar su aceptación; no volver a ejecutar checks vigentes solo por actualizar una casilla. El coordinador conserva los worktrees con cambios pendientes o recuperación incierta. Retirar únicamente recursos propios ya integrados y sin cambios, fuera de procesos activos.

Worktrees no son un sandbox: comparten objetos y referencias Git, y no aíslan puertos, bases de datos, caches ni comandos con rutas absolutas [P5]. Definir recursos de prueba por ejecución o serializar su uso. No escribir sobre directorios de dependencias compartidos por enlace sin comprobar su seguridad. Evitar que dos tareas mantengan `WORK.md`, lockfiles, migraciones o tipos compartidos simultáneamente; asignar esos cambios al frente que corresponda.

### Estado duradero, parada y relevo

`WORK.md` conserva objetivo, decisiones, aceptación, dependencias y próximo paso. El coordinador mantiene el documento; un registro técnico versionado dentro del directorio Git común guarda tarea/intento, worktree/rama/base/HEAD, modelo, sesión Pi, propietario, estado del proceso y resultado pendiente. La conversación nativa vive en el hogar de Pi. La UI combina estas referencias; el registro técnico no crea otra lista de aceptación.

Guardar la asignación antes de lanzar, la identidad real al arrancar y los hitos relevantes durante la ejecución mediante reemplazo atómico. Una escritura fallida avisa y no inventa durabilidad. Si no se puede guardar una nueva asignación, el coordinador puede seguir directamente. Con un trabajador ya activo, conservar su árbol, intentar detenerlo ordenadamente y comunicar qué recuperación quedó incierta.

Separar proceso activo, ejecución finalizada, resultado integrado y aceptación. Evidencia identificada por revisión y estado de archivos comprobados, comando y resultado; tras cambios, invalidar solo la parte afectada. Preservar archivos nuevos, cambios sin commit y diagnósticos, sin exigir un commit incompleto para cerrar.

Cierre normal: dejar de admitir trabajos → cancelar colas → pedir parada → confirmar salida de herramientas y procesos → guardar referencias y estado → liberar bloqueos. Herramienta activa tiene un plazo distinto de silencio del modelo. El host debe detectar pérdida del padre y comenzar la parada; SIGKILL no ejecuta hooks del proceso muerto. Ensayar un guardián de vida ligado al lanzamiento, en Go si necesita conservar el bloqueo o supervisar descendientes, sin daemon permanente.

La prueba de procesos decide la implementación de ese guardián: bash de Pi puede vivir en otro grupo, por lo que comprobar solo el PID o el grupo del agente resulta insuficiente. No reconstruir propiedad por PID sin identidad ni matar procesos ajenos. Si no se confirma la parada, el árbol afectado queda pendiente de recuperación y no admite un escritor sustituto; otros árboles seguros pueden seguir. No prometer control universal de procesos externos que el usuario lance por su cuenta.

En nueva sesión: leer guía y registro, contrastar Git y propiedad de procesos, conservar lo hecho y continuar lo pendiente con la sesión anterior o con otro agente. Nunca relanzar automáticamente un intento marcado como activo sin reconciliarlo. En `/new`, fork, reload o cambio de encargo, detener o desvincular explícitamente los trabajos anteriores sin entregar sus resultados al nuevo contexto.

Pi→Claude debe generar la instantánea definitiva después de detener los trabajadores, incluyendo cada árbol y su pendiente. Revisar el uso actual de `agent_end`: Pi 1.0.2 diferencia el fin de un turno de la quietud definitiva. Claude recibe el trabajo en formato legible y puede continuar secuencialmente; Pi al regresar recupera las mismas tareas. No hace falta portar sesiones internas entre runtimes.

## Entregas y pruebas de aceptación

Este orden es un plan de desarrollo de n_ein; no son fases que deban imponerse a los proyectos del usuario. Cada entrega incluye código, comprobaciones, documentación y commit. El checklist activo vive únicamente en `WORK.md`.

| Entrega | Resultado y superficies | Prueba que permite avanzar |
|---|---|---|
| P0 Transporte y ciclo de vida | Ensayo aislado del cliente público frente al adaptador mínimo, con Pi 1.0.2 y ayuda de procesos si es necesaria. Selección de una sola implementación. | Arranque, eventos, instrucciones durante ejecución, sesiones, cierre normal, pérdida del padre y comando descendiente que sigue escribiendo. Registrar versión y límites por plataforma. |
| P1 Dos frentes recuperables | Asignación persistida, worktrees propios, bloqueo, arranque de hijos con recursos correctos, resultados por eventos e integración del coordinador. | Dos cambios independientes llegan al conjunto; una tercera ejecución espera; error de un hijo conserva el otro resultado; matar/reabrir conserva cambios sin commit. |
| P2 Comportamiento y comparación | Flujo y selección conservadores; reutilizar fixtures del banco e incorporar aceptación integrada. | Piloto secuencial/paralelo con modelos reales. Solo avanzar a la experiencia completa si muestra utilidad con calidad y coste razonable. |
| P3 Equipo visible y relevo | Widget compacto, detalles y controles por conversación; parada común; resumen de todas las ramas para Pi↔Claude. | Cambio de instrucciones, detener uno/todos, resultado tardío, reanudación y Pi→Claude→Pi con un frente terminado y otro parcial, sin escritores solapados. |
| P4 Paquete y preview | Empaquetado, avisos de terceros si hay código adaptado, conservación de estado en update/restore y desactivación de nuevos equipos. | Tarball instalado en hogar de prueba supera recorrido real, cierre/recuperación y doctor. Activación local reversible solo después del resultado conjunto. |

### Pruebas deterministas antes de gastar en modelos

1. RPC real con proveedor de prueba: registros partidos, Unicode, error de arranque, prompt handled, respuesta tardía, `agent_end` seguido de retry y `agent_settled`. No declarar capacidad del modelo con un proveedor simulado.
2. Procesos reales: herramienta silenciosa larga, descendiente que resiste TERM, pérdida del padre, muerte abrupta del trabajador, reapertura inmediata. Observar que cesan las escrituras y que no se libera propiedad antes de tiempo. Repetir con la herramienta bash real de Pi y no solo con un hijo artificial.
3. Git real: dos worktrees, contención del mismo árbol desde otro launcher, alias por symlink, usuario con cambios previos, contrato que cambia, conflicto de integración, tareas que completan simultáneamente. No borrar trabajo al resolver.
4. Estado: caída antes/después del spawn, después del commit y antes de actualizar `WORK.md`, resultado persistido antes de notificar, evento duplicado, registro ilegible, falta de disco simulada y sesión equivocada. Recuperación idempotente.
5. Contexto: hijo hereda idioma, memoria, checks y CodeGraph de su árbol; no crea nietos, no transfiere runtime ni reescribe ajustes globales. Petición «hazlo con uno» evita nuevos lanzamientos y detiene de forma ordenada los sobrantes.
6. Contabilidad e interfaz: sumar intentos y continuaciones sin duplicar historial; coste desconocido se muestra desconocido; pantalla estrecha y sin TUI; controles locales sin llamadas al modelo; error visual no cancela tareas.

Casos de referencia adaptables: [runner con procesos de Gentle][G6], [runner de Gentle][G3] y pruebas locales de launcher, handoff, modelos y contexto. Si se reutiliza código o tests, conservar licencia y procedencia en `NOTICE.md`; el repositorio Gentle declara MIT, cuyo aviso debe acompañar las porciones copiadas [G7].

### Evaluación del beneficio

Reutilizar copias aisladas de `planificador-didactico` y su banco donde proceda. Congelar código, instrucciones, base y aceptación antes de cada tanda. No ejecutar distintas variantes simultáneamente en la misma máquina: el banco anterior sufrió timeouts falsos por contención.

| Caso | Qué debe discriminar |
|---|---|
| A Pequeño o dependiente | La nueva capacidad conserva ejecución directa, calidad y coste cercano al control. |
| B Front y back con contrato | Ambos frentes avanzan en paralelo y el recorrido completo funciona con API real; un mock compatible por casualidad no basta. |
| C Dos funcionalidades independientes | Medir beneficio cuando hay independencia real, incluyendo integración, documentación y revisión. |

Control: recorrido actual de un agente. Candidato: nuevo mecanismo, con hasta dos trabajadores. Mismo modelo físico y esfuerzo durante la comparación inicial, acceso a las mismas herramientas, mismo estado inicial y criterios ocultos. Primera tanda: un par por caso, seis ejecuciones. Si pasa aceptación y hay señal de utilidad, ampliar a tres pares por caso: dieciocho ejecuciones totales. Alternar el orden de variantes. Fallos de infraestructura se conservan y se reportan; no elegir solo los intentos favorables ni hacer reintentos ilimitados.

Medir tiempo desde el encargo hasta aceptación integrada, tokens de entrada/salida/cache por modelo, coste de catálogo de principal e hijos, repeticiones de checks, correcciones, conflictos y minutos de intervención humana. Distinguir coste estimado de factura o cupo de suscripción. Una parada abrupta puede impedir observar todo el consumo del proveedor: declarar esa cobertura incompleta. Añadir al menos dos casos reales de interrupción en puntos diferentes y un relevo completo; no usar sus tiempos como si fueran ejecuciones sin fallos.

**Puerta de calidad:** todos los criterios funcionales y de alcance del caso, ninguna regresión bloqueante y recuperación sin pérdida de trabajo. Inspección semántica del conjunto; un juez puede complementar, nunca compensar aceptación fallida. No basta un test de presencia de strings.

**Umbral provisional para automatizar:** en los casos independientes, buscar al menos un 20 % menos de mediana de tiempo hasta aceptación con no más de un 25 % adicional de tokens totales usando el mismo modelo, sin aumentar supervisión. Revisar cada caso y dispersión, no solo el promedio combinado. Son criterios de ingeniería propuestos para el piloto, no preferencias numéricas confirmadas ni demostración estadística con tres pares. Si solo beneficia una clase, activar únicamente para esa clase; si la diferencia es incierta o el coste no compensa, mantener ejecución directa y registrar el resultado.

Detener la ampliación ante un fallo de propiedad, pérdida de cambios, entrega incorrecta o ausencia de señal de beneficio en la primera tanda. Corregir la causa reproducida con pruebas focales antes de otra tanda; conservar todos los resultados. Los checks locales y el ensayo de transporte preceden al banco con modelos para contener gasto.

## Despliegue y reversión

Desarrollo aislado, sin modificar Ein legado ni proyectos habituales. La configuración permite impedir nuevos equipos y seguir directamente; detener antes los trabajadores vivos. Estado, sesiones y worktrees recuperables viven fuera del paquete reemplazable. Update o restore no los elimina ni supone que sus procesos siguen vivos; una versión que no entienda el registro conserva los datos y explica el límite.

Comprobar paquete y recorrido desde el tarball, con Pi fijado y manifest/hash, antes de aplicar hotfix local con backup. No activar una versión nueva sobre sesiones activas. Sin publicación remota ni promoción estable por este plan.

## Incertidumbres que resuelve el plan

- Compatibilidad suficiente de `RpcClient` o necesidad de adaptador y guardián: P0, sin acceso a privados.
- Parada de herramientas descendientes y recuperación de propiedad en macOS/Linux: P0/P1, con procesos reales. No cubierta por los tests anteriores de n_ein.
- Coste de preparación de worktrees, dependencias e índices, renovación concurrente de autenticación y límites del proveedor: P1/P2.
- Fiabilidad de reparto autónomo y mejora real de tiempo/consumo: P2. Ninguna referencia externa sustituye esta evidencia.
- Entrega de eventos sin despertar al contexto incorrecto y relevo con múltiples ramas: P1/P3.

## Fuentes

[G1]: https://github.com/Gentleman-Programming/gentle-shell/blob/69c9b5ae265a60ffaf1dc9e0efc1afdac966f300/package.json
[G2]: https://github.com/Gentleman-Programming/gentle-shell/blob/69c9b5ae265a60ffaf1dc9e0efc1afdac966f300/extensions/gentle-agents.ts
[G3]: https://github.com/Gentleman-Programming/gentle-shell/blob/69c9b5ae265a60ffaf1dc9e0efc1afdac966f300/lib/agents-runner.ts
[G4]: https://github.com/Gentleman-Programming/gentle-shell/blob/69c9b5ae265a60ffaf1dc9e0efc1afdac966f300/lib/agents-history.ts
[G5]: https://github.com/Gentleman-Programming/gentle-shell/blob/69c9b5ae265a60ffaf1dc9e0efc1afdac966f300/docs/readme-reference.md#organic-driven-development
[G6]: https://github.com/Gentleman-Programming/gentle-shell/blob/69c9b5ae265a60ffaf1dc9e0efc1afdac966f300/tests/agents-runner-process.test.ts
[G7]: https://github.com/Gentleman-Programming/gentle-shell/blob/69c9b5ae265a60ffaf1dc9e0efc1afdac966f300/LICENSE
[P1]: https://github.com/earendil-works/pi/blob/v1.0.2/packages/coding-agent/docs/rpc.md
[P2]: https://github.com/earendil-works/pi/blob/v1.0.2/packages/coding-agent/src/modes/rpc/rpc-client.ts
[P3]: https://github.com/earendil-works/pi/blob/v1.0.2/packages/coding-agent/examples/extensions/subagent/index.ts
[P4]: https://github.com/earendil-works/pi/blob/v1.0.2/packages/coding-agent/src/core/tools/bash.ts
[P5]: https://git-scm.com/docs/git-worktree
[M1]: https://github.com/mattpocock/skills/blob/6fd947921b935b7e1e69293a200400f0fdd5c15f/skills/engineering/implement-spec/SKILL.md
