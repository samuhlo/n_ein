---
name: retro
description: "Retrospectiva de una sesión de programación."
disable-model-invocation: true
---

El usuario ha pedido una **retrospectiva**. Tu papel es proponer mejoras al **entorno** del agente para que las próximas sesiones salgan mejor.

## Pasos

1. Carga la skill `writing-for-agents` para la guía de escritura.

2. Lee las fuentes primarias de la sesión que indique el usuario: las sesiones de Pi viven en `~/.n_ein/<canal>/pi-agent/sessions` y las de Claude en `~/.n_ein/<canal>/claude/projects`. Si no indica ninguna, usa la actual.

3. Busca candidatas a mejora en estas categorías.

- **Navegación**: ¿le costó al agente encontrar los archivos correctos? ¿Hay dependencias ocultas entre archivos? ¿Ayudaría un **puntero de navegación**? _Cuándo_: la sesión tardó mucho en encontrar un dato.
- **Comprobaciones automáticas**: ¿qué comprobación automática habría cazado los errores del agente? Linter, tipos, tests, linters del sistema de archivos. Lee primero el comando de comprobación del propio repo (los scripts `lint`/`check` de su `package.json` o herramienta de build, su workflow de CI): una comprobación que ya existe pero está sin conectar o rota en silencio es el hallazgo, no una reinvención. Un repo sin **barrera** (ni hook de pre-commit ni trabajo de CI que lance su lint, tipos o tests) es un hallazgo en sí: un repo sin linter es una oportunidad perdida permanente, no un punto neutro. _Cuándo_: el agente cometió un error que una comprobación habría cazado, o el repo no tiene ninguna barrera.
- **Normas de código**: ¿necesita el **agente revisor** una regla nueva? ¿Sobra o hay que aclarar alguna existente? Clasifica antes la infracción: una **mecánica** (un patrón sintáctico fijo, una API prohibida, una forma de import, una regla de ubicación de archivos) recibe una comprobación determinista, sin más: una regla propia en el linter del repo, un hook de pre-commit nuevo o un trabajo de CI nuevo, lo que salga más barato según el lenguaje y la barrera existente. Por defecto, construye la comprobación en vez de escribir la regla. Reserva `CODING_STANDARDS.md` para las **cuestiones de criterio** reales (coherencia entre archivos, «encaja con el estilo de alrededor», lo que ninguna barrera podría sustituir). _Cuándo_: el revisor no cazó un error.
- **AGENTS.md global**: ¿hay instrucciones de dirección que deberían pasar a normas de código o a comprobaciones automáticas? _Cuándo_: el AGENTS.md es especialmente grande, en el repo o en el ámbito global del usuario.
- **Economía de herramientas**: ¿hizo el agente llamadas caras que se podrían abaratar? ¿Hay alguna herramienta propia (CLI, MCP) especialmente ineficiente en tokens? _Cuándo_: el agente hizo una llamada cara.
- **Instrucciones que no cambian nada**: busca instrucciones en los archivos de dirección que no modifican el comportamiento del agente. _Cuándo_: esos archivos son grandes y difíciles de manejar.
- **Acceso a la información**: busca formas de dar al agente más acceso a información: duplicar los logs del servidor de desarrollo, acceso de solo lectura a servicios de terceros. _Cuándo_: faltó un dato crucial.

4. Presenta las candidatas al usuario, ordenadas por gravedad.

## Referencia

### Implementación frente a revisión

Todo trabajo pasa por dos etapas: implementación y revisión. El agente que implementa soporta la mayor **presión de contexto**: explora, escribe código y depura fallos.

El agente revisor soporta la menor: recibe un diff, así que no necesita explorar. A menudo no tiene que escribir código ni depurar.

Por eso las normas de código las impone el revisor, no el implementador.

### Archivos

Tienes acceso a varios archivos del repo:

- `CLAUDE.md`/`AGENTS.md`: entran en la ventana de contexto de cualquier agente que trabaje en el repo. Úsalos con muchísima mesura, normalmente solo para **punteros de navegación** a otros archivos.
- `CODING_STANDARDS.md`: se lee al revisar, no al implementar. Añade punteros a carpetas de documentación si pasa de 1.000 líneas.
- Documentación: úsala como archivos de referencia a los que apuntan otros. Busca la existente antes de escribir nueva.
- Skills: para documentación (su descripción entra en la ventana de contexto del agente) o para comandos que lanza el usuario. Sigue la skill `writing-for-agents`.
