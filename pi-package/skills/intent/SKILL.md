---
name: intent
description: Entrevista implacable para definir una idea, un plan o una decisión abierta antes de construir. Úsala cuando el usuario pida intent o que le acribilles a preguntas, o cuando acepte tu propuesta de usarla.
---

Entrevista al usuario de forma implacable hasta alcanzar un entendimiento compartido de qué merece hacerse. Modela la conversación como un **árbol de decisiones**: cada decisión abre las decisiones que dependen de ella.

Trabaja el árbol por **rondas**. La **frontera** son las decisiones cuyos requisitos ya están resueltos: lo que puedes preguntar _ahora_ sin adivinar respuestas que aún no has oído. Pregunta toda la frontera en una ronda, con cada pregunta numerada y tu respuesta recomendada. Después espera las respuestas del usuario.

Formato de una ronda:

```
**P1 · <título de la pregunta>** — <la pregunta; puede ocupar varios párrafos y ofrecer opciones>

▸ Recomiendo: <tu respuesta recomendada y el motivo>

---

**P2 · <título de la pregunta>** — <la pregunta; puede ocupar varios párrafos y ofrecer opciones>

▸ Recomiendo: <tu respuesta recomendada y el motivo>
```

Cada ronda contestada reordena el árbol: lo decidido empuja la frontera y desbloquea las preguntas que dependían de ello. Recalcula la frontera y abre la siguiente ronda. Una pregunta cuya respuesta depende de otra todavía abierta en esta ronda pertenece a una ronda _posterior_. Sin idea de partida, la primera ronda es una sola pregunta llana.

Los **hechos** son trabajo tuyo, nunca del usuario. Cuando una pregunta de la frontera necesite un hecho del entorno (código, documentación, conversación, herramientas), búscalo tú: directamente si es rápido, o delegándolo a un trabajador o subagente en modo de solo lectura si cuesta. Sin bloquear: una investigación en curso es un requisito sin resolver, así que solo esperan las preguntas que dependen de ella; el resto de la frontera se pregunta ya. Las **decisiones** son del usuario: plantéaselas y espera. Las técnicas y reversibles que caben en las convenciones del proyecto las tomas tú y lo dices. Lo decidido se mantiene; se reabre solo ante evidencia nueva, nombrándola.

La sesión termina cuando la frontera del siguiente tramo queda vacía: objetivo, alcance, decisiones con su motivo y criterios observables resueltos, y lo que puede esperar nombrado como aplazado, sin nada supuesto en silencio. Presenta entonces el acuerdo y pide una confirmación de que lo entendéis igual. Hasta esa confirmación, el trabajo es solo conversación.

## Tras la confirmación

El acuerdo define qué hacer; el permiso para implementarlo es aparte. Si el usuario pidió solo pensar, la sesión acaba aquí. Si ya había autorizado implementar dentro de este alcance, continúa con ese permiso.

Cuando el trabajo necesite seguimiento o el usuario lo pida, guarda el acuerdo en el documento de trabajo del proyecto, o en `WORK.md` si no hay otro, con las secciones que apliquen: `## Objetivo`, `## Decisiones`, `## Límites`, `## Criterios`, `## Tareas`, `## Evidencia` y `## Siguiente paso`. Las tareas reales van como casillas `- [ ]` bajo `## Tareas`, que son las que muestra el TODO. Ese documento es el único registro del acuerdo: el agente que implemente, o el siguiente tras un relevo, parte de él sin repetir la entrevista. Una sesión abandonada antes de confirmar deja el proyecto como estaba.
