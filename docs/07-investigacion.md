# Investigación, fuentes y reutilización

## El análisis completo

Los dos informes del 28 de septiembre se preservan íntegros, incluidos matices, referencias y resultados negativos:

1. [Auditoría del rumbo de Ein frente a gentle-ai](archive/ein-workspace/docs/audits/2026-09-28-rumbo-ein-vs-gentle-ai.md): versiones, principios, fases, continuidad, TDD, verificación, evaluación y mantenimiento.
2. [Plan de integración](archive/ein-workspace/docs/plans/2026-09-28-ein-skills-shell-modelos.md): catálogo amplio de skills, capacidades de Gentle Shell, estudio GVS5H, routing económico, cinco entregas y local.

El segundo se escribió antes de decidir el repositorio nuevo. Sus referencias a modificar superficies de Ein son ahora **mapa de procedencia**, no orden de editar el legado. El plan actual es [03-plan.md](03-plan.md).

## Matt Pocock

Snapshot: `c55ee46073ed923f86ce59a5eb3b6d895095d1b7`. Se copian completos los directorios engineering y productivity, junto a README, CONTEXT y licencia. Esto conserva referencias auxiliares de las skills; no las instala en n_ein.

Entradas principales: [diseño](sources/matt-skills/skills/engineering/codebase-design/SKILL.md), [diagnóstico](sources/matt-skills/skills/engineering/diagnosing-bugs/SKILL.md), [TDD](sources/matt-skills/skills/engineering/tdd/SKILL.md), [revisión](sources/matt-skills/skills/engineering/code-review/SKILL.md), [escritura](sources/matt-skills/skills/productivity/writing-for-agents/SKILL.md), [cortes verticales](sources/matt-skills/skills/engineering/to-tickets/SKILL.md), [dominio](sources/matt-skills/skills/engineering/domain-modeling/SKILL.md).

Adaptar sus decisiones fuertes: aprobación de seams, entrevistas exhaustivas, dos revisores siempre, commits automáticos y nunca abortar un merge. Esas instrucciones no son políticas aprobadas de n_ein. Las skills deben respetar contexto, autorizaciones y complejidad real.

**`intent` pasa a ser capacidad central por decisión de Samu.** [grill-me](sources/matt-skills/skills/productivity/grill-me/SKILL.md) es la entrada explícita que llama a [grilling](sources/matt-skills/skills/productivity/grilling/SKILL.md): decisiones dependientes, rondas con recomendaciones y hechos investigados por el agente. [grill-with-docs](sources/matt-skills/skills/engineering/grill-with-docs/SKILL.md) añade modelado de dominio. n_ein adapta esa práctica a los acuerdos necesarios para el siguiente trabajo; no obliga a cerrar todo el árbol futuro ni crea un registro documental adicional. Activación y cierre tienen un único dueño en [diseño](02-diseno.md#intent-definir-juntos-el-encargo).

Comprobado en la revisión del 29 de septiembre de 2026: el snapshot coincidía con el HEAD de upstream. `code-review` exige configurar el gestor de incidencias y remite a `setup-matt-pocock-skills` si falta; `tdd` y `diagnosing-bugs` consultan `CONTEXT.md` solo si existe. La adaptación debe distinguir requisitos reales de referencias opcionales y revisar también las confirmaciones y secuencias que introduce cada skill.

Se añadieron tres skills de `skills/in-progress/`, que el snapshot original no incluía: [pr](sources/matt-skills/skills/in-progress/pr/SKILL.md) (formato de entrega con evidencia), [retro](sources/matt-skills/skills/in-progress/retro/SKILL.md) (errores mecánicos → comprobaciones deterministas; instrucciones breves) y [claude-handoff](sources/matt-skills/skills/in-progress/claude-handoff/SKILL.md). Con [handoff](sources/matt-skills/skills/productivity/handoff/SKILL.md) y [PHASE-BOUNDARIES](sources/matt-skills/skills/engineering/ask-matt/PHASE-BOUNDARIES.md) aportan pautas para el resumen y la elección de continuación. No prueban por sí solas el arranque, el aislamiento o la detención de escritores al relevar. La menor presión de contexto del revisor descrita en `retro` es una hipótesis que se evalúa, no garantía de revisión barata.

## Gentle Shell

Snapshot: `12de3e98cac73d2ef85478a93497ccaacf5426a3`. Distinguirlo de gentle-ai: el primero posee el runtime Pi/UX; el segundo configura agentes y suministra parte de los contratos.

Leer por necesidad: [runner](sources/gentle-shell/lib/agents-runner.ts), [protocolo](sources/gentle-shell/lib/agents-protocol.ts), [actividad](sources/gentle-shell/docs/gentle-agents-activity.md), [modelo efectivo](sources/gentle-shell/lib/model-routing-authority.ts), [cambios de sesión](sources/gentle-shell/lib/session-changes.ts), [orquestador](sources/gentle-shell/assets/orchestrator.md), [worker](sources/gentle-shell/assets/agents/gentle-ai-worker.md).

Su paquete del checkout declara 3.7.0 y componentes Pi fijados en algunas dependencias. No se comprobó publicación ni se ejecutó. La inspección encontró acoplamiento del runner con otros subsistemas; una extracción requiere comprobar dependencias, no solo copiar un archivo.

Dos ideas que n_ein adapta: **fallos conocidos de la base**, identificados por caso/síntoma y revisión, sin eximir una suite entera (`## Known environmental failures` en el [worker](sources/gentle-shell/assets/agents/gentle-ai-worker.md)); y **comprobación del padre** según riesgo, cobertura y fiabilidad de la evidencia. La [verificación delegada](sources/gentle-shell/docs/delegated-verification.md) se conserva como fuente, pero n_ein no hereda una repetición obligatoria ni activa otro verificador solo por el tamaño del modelo. La política vigente está en [diseño](02-diseno.md#encargo-mínimo).

El 29 de septiembre el snapshot iba 20 commits por detrás de main; ninguno toca el runner, los prompts ni la captura de cambios (solo interfaz y un aviso para reanudar sesión).

Conservar eventos, cancelación, resultados parciales, terminación correcta, atribución y configuración visible. Evitar thresholds rígidos, memoria obligatoria y todo el motor RDD. El visor de ediciones observadas no cubre toda escritura vía shell o externa: Git sigue siendo necesario.

## gentle-ai

Snapshot: `e2cb2bf25193f9ac953978906596cf06cc16b733`. Contexto de la primera auditoría: ODD en el generador actual, retirada de SDD, TDD todavía presente y revisión RDD separada.

[Routing real](sources/gentle-ai/internal/components/agentguidance/routing.go), [retirada SDD](sources/gentle-ai/odd/tasks/remove-sdd-odd-only-main.md) y [documentación contradictoria](sources/gentle-ai/docs/trigger-rules.md). La última aún describía SDD opcional pese a la retirada en código. Determinar comportamiento por fuentes efectivas, no solo README.

## Pi

Instalado al preparar el paquete: `@earendil-works/pi-coding-agent` 0.87.1 (licencia MIT). Copia de la documentación pertinente en `sources/pi-installed/`.

- **Sin subagentes en el núcleo.** Trae un [ejemplo oficial de subagente](sources/pi-installed/examples/extensions/subagent/README.md): un proceso `pi --mode json -p --no-session` por tarea, modelo y razonamiento por agente, coste y tokens por tarea y cancelación. Es el primer candidato a runner.
- **`pi-subagents`** es una alternativa usada por Ein que debe evaluarse por su versión y capacidades. No es el runner preferido del Gentle Shell archivado: este tiene **Gentle Agents**, procesos `pi --mode rpc` propios; su [extensión](sources/gentle-shell/extensions/gentle-agents.ts) describe el paquete anterior como retirado y evita colisiones si sigue instalado. La versión reportada en una instalación de Samu no demuestra la versión que distribuirá n_ein.
- **Aislamiento nativo:** `PI_CODING_AGENT_DIR` cambia el directorio de configuración ([configuración](sources/pi-installed/docs/configuration.md)). Ein ya lo usa en `ein-pi.fish`.
- **Paquetes:** `pi install` con npm, git o ruta local, y `pi -e` para probar sin instalar ([paquetes](sources/pi-installed/docs/packages.md)). Las versiones npm quedan fijadas.
- **Skills:** especificación Agent Skills; lee también `.agents/skills/` del proyecto ([skills](sources/pi-installed/docs/skills.md)).
- **Uso y coste:** los mensajes del asistente pueden incluir `usage`; el [ejemplo de subagente](sources/pi-installed/examples/extensions/subagent/index.ts) suma su coste. Pi puede calcular `usage.cost` desde tarifas de catálogo y tokens, por lo que ese campo no demuestra un importe facturado. El diseño distingue estimado, facturado y desconocido; no todos los registros de sesión son mensajes de uso.
- **Otros ejemplos útiles:** [handoff](sources/pi-installed/examples/extensions/handoff.ts) (resumen para una sesión nueva en vez de compactar).
- **Estabilidad de la API:** 0.87.0 rompió `shouldStopAfterTurn`, añadió `ContextEditEntry` y `agent_before_settle` y cambió `turn_end`. Cuanto menos código de extensión, menos que rehacer.

## Codex y OpenCode

Consultado en su documentación actual el 29 de septiembre de 2026, sin copiar fuentes:

- **Codex:** hogar con `CODEX_HOME`; lee `AGENTS.md`; skills `SKILL.md` en `.agents/skills` del proyecto, `~/.agents/skills` y `$CODEX_HOME/skills` (ubicación ya marcada como obsoleta).
- **OpenCode:** configuración adicional con `OPENCODE_CONFIG_DIR`; lee `AGENTS.md`; skills en `.opencode/skills`, `.claude/skills` y `.agents/skills`, del proyecto y globales.

Consecuencia para n_ein: esos formatos reducen trabajo de integración, pero no demuestran un relevo funcional ni aislamiento completo. OpenCode combina configuración global, de proyecto y adicional; `OPENCODE_CONFIG_DIR` no sustituye todo el entorno ([fuente oficial](https://opencode.ai/docs/config/#custom-directory)). Cada runtime necesita comprobar ubicaciones, precedencia, credenciales/sesiones y la transición sin escritores solapados. Evitar instalar skills en `~/.agents/skills` global; elegir y probar la ubicación propia de cada integración. La facilidad de añadir runtimes sigue siendo un objetivo, no la promesa de que bastará un TOML.

## GVS5H

Snapshot: `707e21296bfa032250f10bdde4afaff7ec998f71`. Se preservan README, paper en PDF/LaTeX, tablas pertinentes y código de la variante v2. No se copia todo su corpus de decenas de miles de archivos ni se afirma reproducción independiente.

La comparación aporta una hipótesis sobre organización de inferencia. No comparar sus resultados de llamada única con un agente completo de n_ein como si fueran el mismo entorno. El paper reconoce limitaciones; algunos ajustes/modelos no mejoran. Costes derivados de tarifas no equivalen al coste local.

## Ein: piezas que se conservan

Decisión del 29 de septiembre: n_ein conserva de Ein su superficie de producto. Copias de referencia en `archive/ein-workspace/` (árbol local, HEAD `a5f96323` más cambios previos):

| Pieza | Referencia | Qué se conserva | Cómo |
|---|---|---|---|
| Intent | [intent-channel](archive/ein-workspace/runtime/skills/local/intent-channel/SKILL.md) | conversación por decisiones dependientes, recomendaciones, opciones concretas y síntesis confirmada | capacidad inicial; investigación directa o delegada según convenga; documento único y sin dependencia de OpenSpec |
| Estilo | [STYLE.md](archive/ein-workspace/runtime/docs/STYLE.md), [brand.json](archive/ein-workspace/ein-pi/agent/brand.json), [tema Pi](archive/ein-workspace/ein-pi/agent/themes/ein.json), [theme.ts](archive/ein-workspace/ein-pi/agent/lib/theme.ts), [ein-tv.ts](archive/ein-workspace/shared/contracts/ein-tv.ts) | paleta, `// NNN`, gramática de terminal, marca | contrato tal cual; `brand.json` como fuente única para Go y TS |
| Voz | [AGENTS.md local](archive/ein-workspace/runtime/AGENTS.md), [orquestador de main](archive/ein-main/runtime/assets/orchestrator.md) (Identity & voice, Samu Output Format) | enseñar proporcional, `// 002 CÓMO FUNCIONA`, lenguaje humano | reglas tal cual, más la lista «Samu ya domina» |
| Comentarios | [comment-style](archive/ein-workspace/runtime/skills/local/comment-style/SKILL.md) | cabeceras útiles, etiquetas, notas de intención y causa/efecto con firma personal | adaptar al código nuevo/tocado y a Go; no comentario por línea ni reescritura masiva |
| Logs | [logging-style](archive/ein-workspace/runtime/skills/local/logging-style/SKILL.md) | un evento por registro, `[TAG] SEP ACCION :: clave: valor`, niveles y contexto útil | integrar con logger existente, adaptar a Go y separar de salida TUI/JSON/RPC |
| Launcher | [CLI de Ein](archive/ein-workspace/docs-site/src/content/docs/04-reference/cli.md), [lanzadores fish](archive/ein-workspace/ein-pi/launchers/ein-pi.fish) | cinco vistas, atajos, `--once`, desconocido ≠ vacío | comportamientos; reescrito en Go |
| Instalador | [README del instalador](archive/ein-workspace/installer/README.md), [CLI de Ein](archive/ein-workspace/docs-site/src/content/docs/04-reference/cli.md) | verbos, canales, backup, dry-run, uninstall conservador | comportamientos; reescrito en Go |
| TODO | STYLE.md, regla 7 y «Tintes derivados» | posición bajo el editor, `▸` sin fondo, comando de foco | extensión TS mínima que lee el documento de trabajo |
| Continuidad | [continuity-checkpoint.ts](archive/ein-workspace/ein-pi/agent/lib/continuity-checkpoint.ts), [matriz de runtimes](archive/ein-workspace/docs-site/src/content/docs/03-runtimes/runtime-matrix.md), [ein-continuity.ts de main](archive/ein-main/ein-pi/agent/extensions/ein-continuity.ts) | campos y avisos del checkpoint; sin paridad prometida | resumen de relevo en markdown; sin supervisor PTY ni IPC |

La versión de main del orquestador tiene la redacción más reciente de la voz; la del árbol local es anterior. Al portarla, partir de main.

El 29 de septiembre Samu añadió expresamente comentarios y logs a lo que debe conservarse. Se archivaron ambas skills propias del árbol local sin modificar sus bytes y se registraron en `source-manifest.json`. Su frontmatter indica `license: internal`; no se reclasifican como skills externas MIT. Son referencias para la adaptación de n_ein, descrita en [diseño](02-diseno.md#comentarios-de-código-y-logs).

En la misma conversación se confirmó el papel central de `intent`. Se conserva ahora el `intent-channel` original, con su atribución a `grilling`, en el manifiesto de fuentes. Ese archivo histórico también contiene `/ein:eh`, escritura en OpenSpec y delegación obligatoria a Scout; archivarlo no adopta esas obligaciones ni añade otro comando a n_ein. El contrato actual permite investigar directamente, cerrar solo lo necesario y preservar el acuerdo en el documento de trabajo cuando corresponda.

## Ein: tres clases de evidencia

- `archive/ein-workspace/`: documentos/evaluaciones y estado intelectual del árbol local. Incluye cambios todavía no rastreados. No equivale al commit de main.
- `archive/ein-main/`: archivos concretos inspeccionados del commit `f220788c1da2f77afac21cb37af154621aa05cce`. Snapshot parcial, no código listo para compilar.
- `evidence/ein-audit-focused-20260928.log`: tests ejecutados por esta auditoría. La ausencia inicial de deps se resolvió enlazando las existentes; no acredita un entorno limpio de release.

Los tarballs de pilotos conservan su evidencia original con hashes. Las afirmaciones de éxito pertenecen al experimento descrito; no a una evaluación realizada en n_ein.

## Otras fuentes consultadas

- [Building effective agents, Anthropic, 2024](https://www.anthropic.com/engineering/building-effective-agents): simplicidad y complejidad justificada por evaluación.
- [Effective harnesses for long-running agents, Anthropic, 2025](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents): continuidad, progreso incremental y pruebas reales.
- Referencias locales/Qwen en [modelos](06-modelos.md).

Son antecedentes, no evidencia de que un modelo de septiembre de 2026 haga obsoleto un método de ingeniería.

## Procedencia y licencias

[source-manifest.json](source-manifest.json) enumera cada fuente copiada, hash y revisión. Matt y código Gentle tienen sus licencias MIT archivadas. Pi se distribuye con licencia MIT según su `package.json`; los archivos copiados de Pi son de la versión 0.87.1 instalada. Gentle conserva avisos de marca. GVS5H separa código MIT y paper/datos CC BY 4.0, con excepciones para terceros en NOTICE.

Si se reutiliza una pieza, conservar atribución y anotar la adaptación. Fuentes inmutables y código adaptado deben distinguirse. No redistribuir inadvertidamente documentos/evidencias de investigación en el paquete de ejecución.

Este paquete conserva contenido sustantivo, no la traza interna del modelo ni todos los logs de cada comando de lectura. Las fuentes fijadas, los informes, la conversación y las evidencias relevantes permiten reconstruir el razonamiento y verificar los hechos sin depender de la sesión anterior.
