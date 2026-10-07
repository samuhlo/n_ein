# Visión y decisiones

## Producto

n_ein ayuda a Samu a terminar cambios correctos, revisables y explicados con poco esfuerzo de supervisión. Es una herramienta personal que puede compartirse, no una plataforma genérica para todos los equipos.

La fuerza debe estar en elegir el trabajo adecuado, dar contexto suficiente, ejecutar y comprobar. La complejidad solo se incorpora cuando evita un fallo o mejora un resultado observado.

## Decisión vigente: consolidar el agente único (7 de octubre)

Tras el banco de coordinación, Samu confirmó cerrar el experimento y mantener un agente y un modelo por encargo en el recorrido ordinario. Autorizó implementar las mejoras de calidad, contexto, intent/correcciones y selector, comprobarlas en encargos reales y preparar una preview. El equipo queda fuera del recorrido por defecto: `N_EIN_TEAM=1` es una activación experimental explícita, no una recomendación automática del agente.

Se conservan las mejoras de comprobación de consumidores y mensajes de error. La continuidad ordinaria Pi↔Claude ya tiene evidencia; el ensayo pendiente con equipos queda aplazado junto con ese experimento. No reabrirlo como requisito de esta entrega. Estado operativo en WORK.md.

Las secciones cronológicas siguientes registran cómo se llegó aquí. Las propuestas antiguas de roles baratos, modelo local o paralelismo ordinario no son instrucciones vigentes.

## Acordado explícitamente

| Decisión | Consecuencia |
|---|---|
| Crear proyecto independiente `n_ein` | El plan anterior de refactorizar Ein in situ deja de gobernar la ejecución. |
| Conservar Ein como legado | Preservar historia, evaluaciones y fuentes; no resetear su árbol ni migrarlo masivamente. |
| Integrar lo mejor de Matt, Gentle Shell y Ein | Selección y adaptación; no suma de todas sus obligaciones. |
| Priorizar coste económico sin microdelegación absurda | Contar preparación, revisión, integración y rescates; permitir ejecución directa. |
| Empezar con baratos alojados | La primera versión útil no depende del servidor local. |
| Qwen3.8-27B en 24 GB como objetivo posterior | Ensayar cuantización y contexto; no prometer el resultado del paper con otra precisión. |
| Mejorar pruebas, limpieza y despliegue | Verificar comportamiento completo y artefactos instalados; aislamiento de canales. |

### Añadido el 29 de septiembre de 2026

Samu pidió explícitamente conservar de Ein lo que ve y usa a diario, con la complejidad interna nueva. n_ein es **el mismo Ein por fuera y más simple por dentro**, no un Ein recortado.

| Decisión | Consecuencia |
|---|---|
| Conservar el launcher con todas sus funciones | Vistas de estado, configuración, sesiones, sistema y runtime, alimentadas por el documento de trabajo, Git y la configuración nueva en lugar de SDD/OpenSpec. Ver [diseño](02-diseno.md#launcher-e-instalador). |
| Conservar el instalador | install, update con canales, doctor, restore y uninstall que conserva auth, secrets y sesiones; backup antes de tocar y `--dry-run` sin mutar. |
| Launcher e instalador en **Go**; extensiones de Pi en **TypeScript** | Go vive fuera del agente; lo que corre dentro de Pi sigue en TS. Los dos lados solo se comunican por archivos neutros. Ver [frontera](02-diseno.md#frontera-entre-lenguajes). |
| Conservar la identidad visual | Títulos `// NNN`, paleta de cuatro colores, un acento por pantalla y gramática de terminal de Ein ([STYLE.md](archive/ein-workspace/runtime/docs/STYLE.md)). |
| Conservar la voz docente y el tono humano | Fácil de entender y que enseñe algo cuando aporte; **las rutinas que Samu ya domina no se explican** (crear una PR, un commit, una rama). |
| Conservar el estilo personal de comentarios y logs | Recuperar `comment-style` y `logging-style`: código fácil de recorrer y entender, decisiones explicadas y eventos de consola reconocibles. Aplicarlo en n_ein y en el código que produzca para los proyectos de Samu; adaptar a Go y a las convenciones del proyecto. Ver [contrato](02-diseno.md#comentarios-de-código-y-logs). |
| Usar GPT-6 Sol high para pensar y GPT-6 Luna high para ejecutar, mediante suscripción | Fijar la selección de modelo; no heredar el proveedor por defecto de Pi. Comprobar el acceso de la instalación aislada antes de declarar una sesión real. |
| `intent` como capacidad central desde la primera versión | Adaptar `grill-me`/`grilling` y el canal de intención de Ein para definir encargos y decisiones abiertas. Activación explícita o propuesta aceptada; rondas con recomendaciones; hechos investigados por el agente. El acuerdo alimenta el documento de trabajo cuando haga falta, sin OpenSpec ni expediente paralelo. Ver [contrato](02-diseno.md#intent-definir-juntos-el-encargo). |
| Conservar el TODO, adaptado | Vista del checklist del documento de trabajo, no otra fuente de verdad. |
| Continuidad entre agentes como requisito central | Pi↔Claude como primer relevo probado. Facilitar Codex u OpenCode mediante adaptadores pequeños: configuración cuando baste y código mínimo cuando haga falta, con pruebas de aislamiento y continuidad. No crear otro supervisor por anticipación. |

La facilidad de añadir agentes es el objetivo acordado. Que cada integración pueda resolverse solo con una entrada declarativa era una hipótesis de diseño; la revisión posterior la deja pendiente de demostrar con cada runtime. Un relevo requiere que las escrituras del origen y sus hijos hayan terminado o se hayan detenido antes de habilitarlas en destino.

Samu aplazó expresamente el ensayo de Qwen local hasta disponer de la máquina con 24 GB. La prioridad actual sigue en el producto con modelos alojados; no hay que descargar pesos ni preparar un servidor mientras tanto.

El 1 de octubre pidió recuperar un selector de modelos por rol como el de Ein: principal y cada trabajador que exista, con esfuerzo configurable. Los valores Sol/Luna high siguen siendo los predeterminados, no una limitación del selector. La configuración personal vive fuera del paquete para sobrevivir a las actualizaciones.

También pidió hotfixes para evitar una nueva alpha por cada arreglo. El mecanismo local aplica un commit limpio y verificado al canal preview mediante el mismo paquete e instalador transaccional; marca versión `+hotfix.<commit>` y usa el restore existente. Después aclaró que quiere **también una release desde una rama**. Esa vía parte del tag publicado, lleva solo el arreglo, verifica su procedencia y publica una prerelease `.hotfix.N` independiente; el trabajo ordinario no hereda las fases SDD ni requiere rama `dev`.

Ese mismo día pidió arrancar con `nein` y que Pi y n_ein quedaran dentro del hogar de n_ein, como en Ein: originales separados de las modificaciones y sitio previsto para futuros runtimes como Codex. El hogar es `~/.n_ein`, no el checkout, para que las actualizaciones no dependan del código fuente. Pi se instala versionado en `runtimes/pi/<versión>`, el código en `installations/<canal>` y credenciales y sesiones siguen en `<canal>/`. El único cambio fuera del hogar es el enlace `nein` en `~/.local/bin`; el Pi global y Ein legado no se tocan.

También eligió la marca **004 Panel** para launcher e instalador y pidió conservar el resto de estilos de Ein. La portada del launcher pasa a ser el menú de runtimes. [Diseño](02-diseno.md#estilo).

Después pidió que **CodeGraph sea obligatorio**, no opcional como en Ein: instalado por n_ein, iniciado y al día en cada proyecto y usado por los agentes. Se fija como Pi, con versión y SHA-256 en `runtime.json`. El lanzador crea o sincroniza el índice al abrir Pi o Claude, Pi lo consulta con la herramienta `codegraph_explore` (también el trabajador) y Claude con el MCP y el hook de prompt de su hogar aislado. Un fallo del índice avisa y no impide trabajar. [Diseño](02-diseno.md#codegraph-obligatorio).

Sobre la paridad con Claude decidió: **sin delegación en Luna y sin selector de modelo**; Claude usa el modelo de Claude Code (hoy Opus 5.5). Sí lleva el TODO, en su barra de estado, y su **esfuerzo** se fija en `/nein:models` y llega como `--effort`; sin ajuste decide Claude Code.

También precisó que n_ein es **un producto que cualquiera pueda usar**, aunque sea principalmente para él: lo que se instala (persona, skills, lanzadores) habla del usuario, nunca de Samu; `tests/skills.ts` lo comprueba. Y que las skills sigan de verdad la manera de trabajar de Matt Pocock: `intent` recupera la redacción de `grilling` (entrevista implacable, árbol de decisiones, rondas sobre la frontera, cada pregunta numerada con su recomendación, hechos a cargo del agente) con las adaptaciones ya acordadas, y las skills que solo se lanzan a mano llevan `disable-model-invocation`.

El 2 de octubre pidió que n_ein sea de verdad **una mezcla de Matt y Gentle Shell**: el método en skills pequeñas de Matt y el flujo de trabajo de Gentle. Decisiones de esa ronda: **commit por tarea** en una rama de trabajo cuando el encargo está autorizado, sin push, merge ni PR sin pedirlo; **`WORK.md`** como única fuente de especificación y tareas, por ser lo que menos tokens gasta (sin gestor de incidencias ni memoria Engram); **idioma elegible en el launcher** en dos ejes, conversación y artefactos, como en Ein; y el orden **método y flujo primero**, después una prueba en un proyecto real y solo entonces roles y revisión. [Diseño](02-diseno.md#recorrido-ordinario).

Ese mismo día pidió **un producto más personal y no una copia**: tres roles con nombre propio y modelo asignable (`nein-scout`, `nein-worker`, `nein-reviewer`; por defecto Luna low, Luna high y Sol medium), sin volver a los agentes por fase de Ein; skills y flujo reescritos como propios, sin referencias a Gentle ni a Matt fuera de `NOTICE.md`, con nombres de n_ein (`diagnose`, `review`, `design`, `glossary`, `agent-docs`, `spec`, `tasks`, `tell-again`, `comments`, `logs`, `to-pi`); y **todo lo que lee el agente en inglés**, con las respuestas y los artefactos en el idioma elegido.

El 5 de octubre, a la vista del [banco de modelos de trabajo](../evals/results/2026-10-05-modelos-de-trabajo.md), aprobó un **cambio de rumbo** ([detalle](09-rumbo.md)):
- **Se retira la delegación económica.** Delegar en un modelo más barato salió más caro y falló más; se elige **un modelo por encargo completo** según su riesgo y complejidad (Luna para lo mecánico, Sol high para datos, usuarios, permisos o contratos), de forma automática, visible y anulable.
- **Sin subagentes en el recorrido ordinario.**
- **La calidad del código y la facilidad de revisión pesan tanto como el coste:** ahorrar no justifica código que él daría por bueno sin serlo. Se conservan en línea las prácticas que el banco validó (TDD, alcance y documentación, `WORK.md` con commit por tarea), y el cierre dice dónde mirar y cómo comprobarlo.
- **El modelo local queda descartado.**
- **El agente hace también las pruebas** que sustentan cada paso.

### Flujo conversacional aprobado el 6 de octubre

Tras revisar `220e60e` y `7e18da8`, Samu pidió priorizar fluidez, ayuda para diseñar, modelo adecuado, fiabilidad y coste y tiempo razonables, sin memorizar comandos; autorizó implementar los seis recorridos propuestos con «Hazlo». La conversación es la entrada ordinaria: una petición explícita de ayuda para pensar o diseñar activa intent; una petición clara va directa; «hazlo» usa el acuerdo sin reconfirmaciones rutinarias; otro encargo permite elegir modelo de nuevo; continuar recupera lo pendiente; pedir otro runtime prepara el relevo. Los comandos quedan como atajos. Spec y tareas las usa el agente cuando el encargo autorizado las necesita. Las comprobaciones y el cierre se ajustan al cambio y reutilizan evidencia vigente. Confirmar diseño sigue sin autorizar implementación por sí solo.

### Paralelismo acordado el 6 de octubre — implementación experimental

Tras investigar Gentle Shell y las skills de Matt, Samu confirmó las recomendaciones con «Sí a las recomendaciones». El acuerdo amplía el diseño del 5 de octubre: permite paralelismo útil, manteniendo retirada la delegación automática por precio. El banco anterior no aisló el beneficio de dos frentes independientes en worktrees frente a ejecución secuencial.

- Una conversación con el coordinador, que puede programar y se responsabiliza de integrar y comprobar el resultado.
- Hasta dos trabajadores simultáneos inicialmente, generalistas con encargos concretos y modelos adecuados a su dificultad. No roles permanentes ni trabajadores baratos obligatorios.
- El agente decide cuándo paralelizar dentro del encargo ya autorizado, comunica brevemente el reparto y admite «hazlo con uno». No pide aprobación rutinaria para repartir; las decisiones de producto y ampliaciones de alcance conservan su autorización propia.
- Separar por dependencias reales: front/back cuando haya un contrato suficiente, o funcionalidades completas cuando permitan avanzar con más independencia.
- Un escritor por worktree, responsable de contratos compartidos y comprobación del resultado integrado. También coordinar recursos externos compartidos por las pruebas.
- Al cerrar, detener los trabajadores y conservar su avance; al volver, reconciliar tareas y Git y continuar aunque haga falta otro agente. Antes de sustituir o relevar, comprobar que el origen y sus hijos han dejado de escribir.
- `WORK.md` sigue siendo la guía común, actualizada por el coordinador. Estado técnico de ejecuciones asociado, sin otra lista de tareas competidora.
- Comprobar la propuesta frente a ejecución secuencial por calidad, tiempo hasta la entrega integrada, consumo total, correcciones y recuperación tras interrupción. No prometer ahorro de tokens ni aceleración sin evidencia.

Queda fuera del primer alcance trabajar con la aplicación cerrada. Esta conversación confirma diseño, no solicita todavía su implementación ni cambia el runtime instalado. El acuerdo y los criterios del siguiente tramo están en `WORK.md`.

Después de ese acuerdo Samu autorizó investigar, probar e implementar si los resultados compensan, y pidió preparar primero un plan de incorporación. El [plan técnico](10-paralelismo.md) conserva esa autorización condicional: elegir una integración acotada sobre Pi mediante un ensayo de ciclo de vida, medir utilidad antes de activar la experiencia completa y probar el paquete antes de actualizar la preview. Sus umbrales numéricos son propuestas del piloto, no preferencias ya confirmadas. Este corte es de documentación; el runtime continúa sin trabajadores.

Implementación posterior autorizada con «manos a la obra, implementa todo… y ve haciendo commits». El código experimental y sus controles están implementados y comprobados; el [piloto](../evals/results/2026-10-06-paralelismo.md) no alcanza el beneficio de tiempo propuesto, por lo que no se activa en la preview personal. El objetivo de elección automática se conserva como diseño, pendiente de evidencia favorable; no se sustituye por una promesa de ahorro. El retorno con Claude real está pendiente de cuota, con parada y transporte comprobados mediante procesos controlados.

Fuentes inspeccionadas: [Gentle Shell, procesos, historial y continuación](https://github.com/Gentleman-Programming/gentle-shell/blob/69c9b5ae265a60ffaf1dc9e0efc1afdac966f300/docs/gentle-shell.md), [Matt, tareas paralelas e integración](https://github.com/mattpocock/skills/blob/6fd947921b935b7e1e69293a200400f0fdd5c15f/skills/engineering/implement-spec/SKILL.md), [Matt, entregas completas y dependencias](https://github.com/mattpocock/skills/blob/6fd947921b935b7e1e69293a200400f0fdd5c15f/skills/engineering/to-tickets/SKILL.md). Gentle conserva historial y permite continuar tareas, pero cerrar Pi detiene hijos activos; no se interpreta el historial como prueba de proceso vivo. La [documentación de equipos de Claude](https://code.claude.com/docs/en/agent-teams#limitations), consultada el 6 de octubre, también reconoce límites de reanudación. Se inspeccionaron fuentes; no se ejecutó un ensayo nuevo de estos sistemas.

## Recomendaciones de diseño, revisables

El 7 de octubre Samu autorizó implementar y evaluar el reparto temprano y la investigación acotada con el mismo mecanismo de equipo, tras la [auditoría del piloto](../evals/results/2026-10-07-auditoria-paralelismo.md). La lectura puede delegarse sin preparar un encargo de escritura. Se mide por separado el ahorro de contexto y el avance paralelo, conservando checks e integración. Esto amplía el experimento; no demuestra ahorro ni activa por sí solo la preview personal. El estado de implementación y evaluación vive en WORK.md.

- Pi como runtime inicial; n_ein como capa pequeña: un paquete Pi (skills, extensiones mínimas, prompts, tema) más un launcher que fija el hogar aislado. Pi ya ofrece el aislamiento (`PI_CODING_AGENT_DIR`) y la carga de paquetes (`pi install`, `pi -e`).
- Pi al día y comprobado. El 5 de octubre Samu pidió no quedarse en una versión antigua: n_ein sube a cada versión nueva de Pi en cuanto sale y pasa sus comprobaciones. Cada versión de n_ein sigue declarando en `runtime.json` la versión de Pi con que se comprobó. Pi cambia su API de extensiones con frecuencia; se prefieren skills y configuración a código de extensión.
- Formatos portables desde el primer día: `AGENTS.md`, skills en formato Agent Skills (`SKILL.md`), documento de trabajo en markdown y resumen de relevo en markdown. No se construyen adaptadores para Codex u OpenCode hasta que se usen.
- Un documento de trabajo para esfuerzo prolongado; ninguno obligatorio para correcciones pequeñas.
- Skills bajo demanda, un registro y una fuente por regla.
- Capacidades genéricas de explorar, trabajar y revisar; no siete agentes permanentes de fase.
- Preferir capacidades nativas, un único runner y límites realmente soportados.
- Resultados de herramientas como evidencia; revisión semántica separada.
- Continuidad con Git, objetivo, decisiones, comprobaciones y pendiente.
- Desarrollo aislado, preview y estable; versiones probadas en lugar de resolución cambiante de latest.
- Reutilizar el soporte nativo de modelos de Pi antes de crear integración propia.

No convertir estos puntos en otra gramática que el modelo tenga que satisfacer para editar. Una necesidad real puede cambiar su implementación.

## Alternativas descartadas en esta conversación

1. Mantener Ein y construir n_ein como dos productos con evolución paralela.
2. Copiar entero Gentle Shell y colocar otro arnés alrededor.
3. Instalar todas las skills de Matt y heredar sin revisión sus confirmaciones, publicaciones o commits.
4. Prohibir al capaz implementar y atribuir toda dificultad del barato a un plan insuficiente.
5. Cambiar únicamente el nombre SDD por ODD conservando las mismas fases.
6. Promocionar un modelo por precio/token o un benchmark externo sin coste total y resultados propios.

## Conocimiento que debe sobrevivir

De Ein se conservan también, como producto y no solo como aprendizaje: launcher, instalador, estilo, voz, TODO y continuidad entre runtimes. Se conservan sus **comportamientos**; su código se porta o se reescribe según lo acoplado que esté a SDD/OpenSpec.

Los informes previos contienen defectos y experimentos valiosos. Reutilizar un caso de fallo y su criterio observable suele aportar más que portar su solución entera. Specs de producto y ADR todavía pertinentes se conservan como referencias, sin hacer que el runtime dependa de documentos obsoletos.

Las pruebas del nuevo producto no tienen que perpetuar nombres de agentes, encabezados o artefactos retirados. Sí deben mantener las propiedades útiles: aislamiento, autorización, continuidad, evidencia fresca y límites del trabajo.

## Cambios respecto al manifiesto de Ein

| Principio anterior | Dirección propuesta |
|---|---|
| El caro decide; el barato ejecuta | Elegir capacidad y coordinación por resultado y coste total. |
| El padre nunca programa | Puede programar cuando es la ruta más eficaz. |
| El ejecutor no debe necesitar pensar | Autonomía proporcional, con escalado ante límites medidos. |
| El router decide la siguiente fase | El agente elige el siguiente paso técnico dentro del alcance; herramientas calculan hechos. |
| Todo fallo se cierra por defecto | Lo desconocido no se declara correcto; el fallo de registro no prohíbe trabajo nuevo por sí mismo. |

## Jerarquía de este paquete

Mensaje actual del usuario → decisiones explícitas → diseño y plan propuestos → investigación → fuentes históricas. El manifiesto archivado de Ein no tiene autoridad sobre n_ein. Si cambia una decisión, actualizar su dueño y referenciarla desde otros documentos; no acumular excepciones contradictorias.
