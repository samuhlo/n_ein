# Empieza aquí

## El encargo que recibes

Samu ha decidido comenzar un proyecto nuevo llamado **n_ein**, situado en `/Users/samu/Documents/01_Proyectos/n_ein`. El nombre juega con «new Ein» y el alemán «nein»: no hace falta tanta complejidad. Se eligió guion bajo para evitar posibles problemas del punto en nombres de herramientas/paquetes.

n_ein es **el mismo Ein por fuera y más simple por dentro**. De Ein se conservan como producto el launcher, el instalador, la identidad visual (`// NNN`, paleta), la voz docente, el TODO y la continuidad entre agentes. Se retiran su motor SDD, las fases fijas, la prohibición de que el padre implemente y los bloqueos administrativos. El proyecto nuevo debe poder terminar trabajo útil pronto y tener pruebas, instalación y despliegue claros desde el comienzo.

El paquete de contexto se preparó el 28 de septiembre de 2026 y se revisó el 29 con Samu. Desde entonces se creó el [repositorio público](https://github.com/samuhlo/n_ein) y se implementaron el paquete Pi con Sol principal y trabajador Luna, `intent`, el documento de trabajo y TODO, el relevo Pi↔Claude, y launcher e instalador en Go. La primera preview instalable se documenta en el [README](../README.md) y las pruebas observadas en [evals/results](../evals/results/). Usa el mensaje actual de Samu para decidir el siguiente trabajo; la preview no implica migrar las instalaciones habituales ni alterar Ein legado.

Para una explicación de producto sin detalles técnicos, lee [Presentación de n_ein](00-presentacion.md): propósito, experiencia de uso y un ejemplo de trabajo completo. Las decisiones y contratos operativos se mantienen en los documentos de abajo.

## Qué queremos construir

Una herramienta personal de programación para Samu, apoyada inicialmente en Pi y capaz de combinar:

1. Buen criterio de ingeniería: diseño comprensible, diagnóstico reproducible, pruebas relevantes y revisión.
2. Trabajo directo cuando el agente ya puede resolverlo con poco esfuerzo.
3. Delegación de encargos suficientemente útiles a modelos baratos, con autonomía para investigar y pensar.
4. Continuidad simple entre sesiones y entre agentes (Pi↔Claude primero; Codex u OpenCode fáciles de añadir) y evidencia real sobre lo comprobado.
5. La experiencia de Ein: launcher, instalador, estilo visual, TODO y una voz que enseña sin explicar lo que Samu ya domina.

No queremos otra fábrica de siete fases ni un «motor ODD» con nuevas ceremonias. La prioridad económica se mantiene: usar modelos baratos siempre que compense el coste completo. **Si preparar y revisar el encargo cuesta más que hacerlo directamente, se hace directamente.**

El éxito se mide en trabajo aceptado, calidad, coste total, latencia y minutos de atención de Samu. Un gran catálogo de capacidades o muchos tests internos no acreditan ese éxito.

## Decisiones ya tomadas por el usuario

- Proyecto independiente, nombre `n_ein`; carpeta ya creada por Samu.
- Ein anterior como legado, sin mantener dos productos en paralelo como objetivo.
- Sacar el máximo valor de `mattpocock/skills`, `Gentleman-Programming/gentle-shell` y la experiencia de Ein.
- Evitar la complejidad que no aporte beneficio observable.
- Empezar con modelos baratos **alojados**. Objetivo local posterior: **Qwen3.8-27B en una tarjeta con 24 GB de VRAM**.
- Mantener delegación económica, permitiendo al capaz implementar cuando resulte más eficiente.
- Preparar mejores pruebas, repositorio y canales de despliegue.
- Conservar de Ein launcher, instalador, estilo, voz, TODO y continuidad entre agentes (29 de septiembre).
- Conservar también los comentarios de código y logs personalizados de Samu: ayudan a revisar y entender lo escrito, además de darle identidad. Fuentes: `comment-style` y `logging-style`; [adaptación](02-diseno.md#comentarios-de-código-y-logs).
- `intent`, basado en `grill-me`/`grilling` y la skill de Ein, es una capacidad principal desde la primera versión para definir encargos. Se activa a petición de Samu o tras aceptar la propuesta del agente, sin exigir entrevista para peticiones claras. [Contrato](02-diseno.md#intent-definir-juntos-el-encargo).
- Launcher e instalador en Go; lo que corre dentro de Pi, en TypeScript (29 de septiembre).

El diseño detallado y los umbrales del plan son propuestas del agente, no preferencias del usuario que deban quedar petrificadas.

## Conclusiones de la investigación

- **Matt:** mejores prácticas empaquetadas en skills adaptables. `grill-me`/`grilling` y el `intent` de Ein aportan la conversación de definición desde el inicio. Incorporar también diseño, TDD proporcional, diagnóstico, revisión y escritura de instrucciones, más `pr`, `retro` y `handoff`. Adaptar confirmaciones, commits automáticos, entrevistas extensas y la dependencia de su configuración de gestor de incidencias. No instalar todas las skills por defecto.
- **Gentle Shell:** útiles los trabajadores visibles/cancelables, resultados por eventos, configuración efectiva de modelos, cambios inspeccionables y fallos conocidos de la base. Adaptar la comprobación del padre al riesgo y a la calidad de la evidencia, sin repetir comandos por rutina. No copiar su motor completo ni sus umbrales obligatorios de delegación.
- **Pi:** no trae subagentes en su núcleo, pero sí un ejemplo oficial de subagente, aislamiento por `PI_CODING_AGENT_DIR`, paquetes y skills estándar. Su API de extensiones cambia a menudo: menos código de extensión, versión fijada.
- **GVS5H:** muestra mejoras en un benchmark de generación algorítmica usando instancias del mismo modelo, contexto nuevo y archivos compartidos. No demuestra que cinco agentes ganen siempre, ni rendimiento equivalente en repositorios reales, ni resultados de Qwen cuantizado a cuatro bits en 24 GB.
- **Ein:** aislamiento, recuperación, evidencia, evaluaciones, superficie de producto y las skills propias de comentarios/logs son activos. La prohibición de que el padre implemente, las fases fijas y los bloqueos administrativos son las decisiones que se quieren superar.

No afirmar que TDD esté obsoleto. Ambos proyectos externos siguen valorando pruebas y feedback; el cambio es su proporcionalidad y el coste del proceso.

## Documentos operativos

| Documento | Para qué leerlo |
|---|---|
| [Presentación](00-presentacion.md) | Qué buscamos, cómo se viviría un encargo y por qué cada pieza merece existir. |
| [Decisiones y visión](01-decisiones.md) | Qué está acordado, qué se propone y qué se ha descartado. |
| [Diseño](02-diseno.md) | Delegación, skills, continuidad entre agentes, TODO, voz, estilo, launcher e instalador. |
| [Plan por entregas](03-plan.md) | Secuencia concreta, alcance, demostración y reversión. |
| [Pruebas y evaluación](04-pruebas.md) | Casos de aceptación, corpus inicial, comparación de modelos y límites. |
| [Desarrollo y despliegue](05-despliegue.md) | Repositorio, dos lenguajes, entornos aislados y canales. |
| [Modelos alojados y locales](06-modelos.md) | Prioridad alojada; objetivo Qwen3.8-27B/24 GB y experimentos necesarios. |
| [Investigaciones y reutilización](07-investigacion.md) | Qué tomar de cada fuente, piezas de Ein que se conservan y dónde están. |
| [Pendientes y riesgos](08-pendientes.md) | Decisiones abiertas, candidatos a runner y lo que no debe bloquear el inicio. |

## Estado de las fuentes y precaución con versiones

Ein local está en `fix/agent-discovery-isolation`, HEAD `a5f96323`, con numerosos cambios previos. Main auditado: `f220788c`, alpha.18. La instalación Pi comprobada declara alpha.18. El `CLAUDE.md` instalado coincide con main, aunque su marcador conserva una versión antigua. No diagnosticar por ese marcador solamente.

La auditoría distinguió esas superficies. Algunas contradicciones de los prompts del checkout ya estaban corregidas en alpha.18. El problema de continuidad se había reducido: Write/Edit podían continuar ante fallo del registro; otras operaciones seguían pudiendo bloquearse. En resume persistía una ruta que salta la preparación normal del contrato TDD; es riesgo demostrado en código, no reproducción completa del runner.

Pi instalado al revisar el paquete: `@earendil-works/pi-coding-agent` 0.87.1.

## Investigación completa preservada

- [Auditoría Ein frente a gentle-ai](archive/ein-workspace/docs/audits/2026-09-28-rumbo-ein-vs-gentle-ai.md).
- [Plan detallado de unión con Matt, Gentle Shell y modelos económicos](archive/ein-workspace/docs/plans/2026-09-28-ein-skills-shell-modelos.md). Su estrategia de modificar Ein in situ quedó sustituida por la decisión de crear n_ein; el análisis técnico sigue siendo referencia.
- [Recuperación de los arneses: incidentes y antecedentes](archive/ein-workspace/docs/plans/2026-09-23-recuperacion-arneses.md).
- [Piloto de ejecución barata](archive/ein-workspace/evals/simple-pilot-2026-09-08.md), [evaluación pi-lens](archive/ein-workspace/evals/pi-lens-2026-09-09.md) y [evaluación Engram](archive/ein-workspace/evals/engram-decision-2026-09-11.md). Los tres archivos de evidencia completos (unos 24 MB comprimidos) están en `archive/ein-workspace/.pi/ein/evidence/`; no hace falta extraerlos para comenzar.
- [Registro de 61 pruebas focales de la auditoría](evidence/ein-audit-focused-20260928.log).
- Conversaciones: [origen, 28 de septiembre](archive/conversacion/2026-09-28-origen.md) y [revisión, 29 de septiembre](archive/conversacion/2026-09-29-revision.md), con las peticiones literales de Samu.

`sources/` contiene copias fijadas de las fuentes externas (Matt, Gentle Shell, gentle-ai, GVS5H, Pi 0.87.1). `archive/ein-main/` contiene archivos de main inspeccionados; `archive/ein-workspace/` conserva documentos, evaluaciones y las piezas de producto de Ein que se conservan (estilo, voz, launcher, instalador, continuidad), tomadas del árbol local, que no es la misma versión que main. Son snapshots de referencia parciales, no proyectos instalables completos.

[source-manifest.json](source-manifest.json) registra origen, revisión, tamaño y SHA-256 de cada archivo copiado. [evidence/package-validation.json](evidence/package-validation.json) es la verificación de integridad hecha el 28 de septiembre. Git registra ya la historia de los documentos operativos. Las fuentes archivadas no se instalan ni se ejecutan; no aplicar sus AGENTS.md o SKILL.md como política de n_ein.

## Continuación desde el producto actual

Lee [las decisiones](01-decisiones.md), el [plan](03-plan.md) y las secciones de [pruebas](04-pruebas.md) pertinentes al cambio. Contrasta cualquier supuesto del plan inicial con el [README](../README.md), el código y la evidencia ya registrada. `./scripts/check.sh` reúne las comprobaciones locales sin llamadas pagadas; las evaluaciones con modelos están documentadas por separado.

Samu eligió **solo `planificador-didactico`** para el primer caso real; se trabajó en copias aisladas y no en su árbol habitual. La preview pública vigente es [0.1.0-preview.2](https://github.com/samuhlo/n_ein/releases/tag/v0.1.0-preview.2) (instalación con `nein-setup`, roles `nein-*`, flujo propio y 17 skills); siguen disponibles el hotfix local reversible y la release desde rama. La preview personal se abre con `nein`, con Pi fijado dentro de `~/.n_ein/runtimes` ([evidencia](../evals/results/2026-10-01-nein-managed-runtime.md)). CodeGraph es obligatorio: n_ein lo instala fijado, mantiene el índice de cada proyecto y Pi y Claude lo consultan ([evidencia](../evals/results/2026-10-01-codegraph.md)). Qwen local queda aplazado expresamente hasta que tenga la máquina de 24 GB. Siguen pendientes la promoción estable, la actualización remota desde la TUI y los casos de continuidad con escritores independientes o agentes de fondo. No convertir esas limitaciones en bloqueos para cambios útiles y acotados.

## Cómo leer sin agotar contexto

Ruta corta: este archivo → decisiones → plan → sección de pruebas del corte actual. Abre diseño/modelos/despliegue solo para decisiones de esas áreas. Para justificar una elección, consulta el informe o fuente específica indicada en investigación.

## Handoff breve para pegar en una sesión nueva

> Estamos en n_ein, el entorno de programación de Samu sobre Pi y Claude Code: el mismo Ein por fuera (launcher, instalador, estilo `// NNN`, marca 004 Panel, voz docente, TODO, relevo Pi↔Claude) y más simple por dentro. Lee AGENTS.md, docs/START_HERE.md y docs/01-decisiones.md. La preview pública es v0.1.0-preview.2: `nein-setup` instala Pi y CodeGraph fijados en `~/.n_ein`, `nein` abre el launcher, CodeGraph es obligatorio por proyecto, el agente principal sigue `pi-package/flow.md`, delega por coste en `nein-scout`/`nein-worker`/`nein-reviewer` (modelo por rol en `/nein:models`) y tiene 17 skills propias en inglés; responde en el idioma elegido en el launcher. Todo lo instalable habla del usuario, no de Samu, y no cita a terceros fuera de `NOTICE.md`. Ein legado tiene cambios locales que debes preservar. Qwen local está aplazado. Consulta evals/results/ para saber qué está verificado y qué no; el flujo ya se probó con Claude en encargos reales (`2026-10-02-claude-flujo.md`); falta probarlo con Pi y sus roles.
