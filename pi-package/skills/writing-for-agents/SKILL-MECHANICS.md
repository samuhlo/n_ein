# Mecánica de las skills

La rama de [`writing-for-agents`](SKILL.md) propia de las skills: qué cambia cuando el documento es una skill (frontmatter, elección de invocación y skills enrutadoras). Todo lo demás sobre cómo escribirla es la referencia general de `SKILL.md`.

## Invocación

Dos opciones, que intercambian las dos cargas:

- Una skill **invocada por el modelo** conserva su `description`, así que el agente puede lanzarla por su cuenta y otras skills pueden alcanzarla. También puedes escribir su nombre: la invocación por el modelo siempre _incluye_ el alcance del usuario; una descripción solo añade el descubrimiento por el agente, nunca quita el de la persona. La descripción es el puntero de contexto de primer nivel de la skill, obligado a estar cargado siempre: carga de contexto permanente a cambio de poder descubrirse. Una skill invocada por el modelo cuyo contenido es todo referencia es además un hogar para referencia compartida: otra skill puede invocarla, así que lo que necesitan varias skills vive en un sitio. Mecánica: omite `disable-model-invocation` y escribe una descripción para el modelo con las ramas de disparo (aplican de lleno las reglas de punteros de `SKILL.md`).
- Una skill **invocada por el usuario** saca la descripción del alcance del agente: solo la persona que escribe su nombre puede lanzarla, y ninguna otra skill. Carga de contexto cero, pero gasta carga cognitiva: tú eres el índice que debe recordar que existe. Mecánica: `disable-model-invocation: true`; la `description` pasa a ser para personas: un resumen de una línea, sin listas de disparadores.

Elige la invocación por el modelo solo cuando el agente deba llegar a la skill por su cuenta, o deba hacerlo otra skill. Si solo se lanza a mano, que la invoque el usuario y no pague carga de contexto.

La referencia compartida que necesitan dos skills invocadas por el usuario no puede vivir en ninguna de ellas: sin descripción, ninguna puede lanzar a la otra. Sácala a un archivo normal fuera del sistema de skills: referencia externa a la que cualquier skill puede apuntar.

## Dividir por invocación

El corte por invocación (el de secuencia vive en `SKILL.md`): separa una skill invocada por el modelo cuando tienes una palabra guía distinta que debería dispararla por sí sola (una palabra que de verdad usas en tus prompts), o cuando otra skill debe alcanzarla. Pagas carga de contexto por la nueva descripción siempre cargada, así que ese alcance independiente tiene que merecerla.

## Skills enrutadoras

Cuando las skills invocadas por el usuario se multiplican más allá de lo que puedes recordar, esa carga cognitiva acumulada se cura con una **skill enrutadora**: una skill invocada por el usuario que nombra las demás y cuándo recurrir a cada una, para que la persona recuerde una sola skill en vez de muchas. Solo puede sugerir, nunca lanzarlas: las skills invocadas por el usuario no tienen descripción, así que solo la persona puede alcanzarlas.

## En n_ein

El catálogo es único (`pi-package/skills`) y lo comparten Pi y Claude. En Pi una skill se lanza con `/skill:<nombre>`; en Claude, con `/<nombre>`. `tests/skills.ts` valida el frontmatter de cada una: un YAML roto hace que Pi la descarte sin avisar.
