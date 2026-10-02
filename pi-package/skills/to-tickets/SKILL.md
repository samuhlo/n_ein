---
name: to-tickets
description: Trocea un plan, una especificación o la conversación en tareas bala trazadora (cortes verticales), cada una con lo que la bloquea, en la sección de tareas de WORK.md.
disable-model-invocation: true
---

# A tareas

Trocea un plan, una especificación o una conversación en **tareas**: cortes verticales tipo **bala trazadora** (_tracer bullet_), cada uno con las tareas que lo **bloquean**.

## Proceso

### 1. Reúne el contexto

Trabaja con lo que ya hay en la conversación y en `WORK.md` (o el documento de trabajo del proyecto). Si el usuario pasa una referencia (la ruta de una especificación, una issue), léela entera.

### 2. Explora el código (opcional)

Si aún no lo has hecho, explora el código para entender su estado (CodeGraph primero). Los títulos y descripciones usan el vocabulario del glosario del dominio y respetan los ADR de la zona.

Busca oportunidades de prefactorizar para facilitar la implementación. «Haz fácil el cambio y después haz el cambio fácil.»

### 3. Esboza los cortes verticales

Divide el trabajo en tareas **bala trazadora**.

<reglas-de-corte-vertical>

- Cada corte atraviesa un camino estrecho pero COMPLETO por todas las capas (esquema, API, interfaz, tests): vertical, NO una franja horizontal de una sola capa
- Un corte terminado se puede enseñar o verificar por sí solo
- Cada corte cabe en una ventana de contexto nueva
- Cualquier prefactorización va primero

</reglas-de-corte-vertical>

Da a cada tarea sus **bloqueos**: las otras tareas que deben terminar antes de que empiece. Una tarea sin bloqueos puede empezar ya.

**Los refactors anchos son la excepción al corte vertical.** Un **refactor ancho** es un cambio mecánico (renombrar una columna, cambiar el tipo de un símbolo compartido) cuyo **radio de impacto** se abre por todo el código, de modo que una sola edición rompe miles de llamadas a la vez y ningún corte vertical puede quedar en verde. No lo fuerces a bala trazadora; ordénalo como **expandir y contraer** (_expand–contract_). Primero expande: añade la forma nueva junto a la vieja para que nada se rompa. Después migra las llamadas por lotes del tamaño de su radio de impacto (por paquete, por directorio), cada lote su tarea bloqueada por la expansión, con la integración continua en verde lote a lote porque la forma vieja sigue existiendo. Por último contrae: borra la forma vieja cuando no quede ningún llamante, en una tarea bloqueada por todos los lotes. Si ni los lotes pueden quedar en verde por separado, mantén la secuencia pero que compartan una rama de integración y bloqueen todos una tarea final de integrar y verificar: el verde solo se promete ahí.

### 4. Pregunta al usuario

Presenta el desglose como lista numerada. Para cada tarea:

- **Título**: nombre corto y descriptivo
- **Bloqueada por**: qué otras tareas deben terminar antes (si alguna)
- **Qué entrega**: el comportamiento de punta a punta que esta tarea hace funcionar

Pregunta al usuario:

- ¿La granularidad es la adecuada? (demasiado gruesa / demasiado fina)
- ¿Los bloqueos son correctos: cada tarea depende solo de tareas que de verdad la condicionan?
- ¿Alguna tarea debería unirse con otra o dividirse más?

Itera hasta que apruebe el desglose.

### 5. Escribe las tareas en WORK.md

Añade las tareas aprobadas bajo `## Tareas`, en orden de dependencias (las que bloquean, primero), con ID estable y una casilla por tarea. Los criterios de aceptación van debajo como viñetas sin casilla, para que el TODO cuente solo tareas:

```markdown
## Tareas

- [ ] T1 · <título> — <qué entrega, de punta a punta, desde el punto de vista del usuario>. Bloqueada por: ninguna.
  - Criterio: <comportamiento observable>
  - Criterio: <comportamiento observable>
- [ ] T2 · <título> — <qué entrega>. Bloqueada por: T1.
  - Criterio: <comportamiento observable>
```

Se trabaja la **frontera**: cualquier tarea cuyos bloqueos estén hechos. En una cadena lineal, de arriba abajo.

Sin rutas de archivos ni fragmentos de código en las tareas: se quedan viejos rápido. Excepción: si un prototipo produjo un fragmento que fija una decisión con más precisión que la prosa (máquina de estados, reducer, esquema, forma de un tipo), inclúyelo indicando que viene de un prototipo, recortado a lo que lleva la decisión.
