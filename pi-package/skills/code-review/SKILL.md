---
name: code-review
description: "Revisión de los cambios desde un punto fijo (commit, rama, tag o merge-base) en dos ejes: Normas (¿sigue el código las normas documentadas del repo?) y Especificación (¿hace lo que pedía el acuerdo de WORK.md o la especificación?). Úsala cuando el usuario quiera revisar una rama, una PR o el trabajo en curso, pida «revisa desde X», o al cerrar una tarea que merece revisión."
---

Revisión en dos ejes del diff entre `HEAD` y un punto fijo que da el usuario:

- **Normas**: ¿se ajusta el código a las normas documentadas del repo?
- **Especificación**: ¿implementa fielmente lo que se acordó?

Cada eje lo revisa un **revisor independiente** con su propio contexto, para que uno no contamine al otro: en paralelo si el runtime lo permite (subagentes), o uno tras otro con el trabajador en modo `review`. Después esta skill reúne sus hallazgos.

## Proceso

### 1. Fija el punto de comparación

El punto fijo es lo que diga el usuario (un SHA, una rama, un tag, `main`, `HEAD~5`…). Si no lo dice, usa el inicio de la tarea en curso según `WORK.md`; si tampoco hay, pregúntalo.

Fija una vez el comando del diff: `git diff <punto>...HEAD` (tres puntos, para comparar contra el merge-base). Anota también los commits con `git log <punto>..HEAD --oneline`.

Antes de seguir, confirma que el punto resuelve (`git rev-parse <punto>`) y que el diff no está vacío. Una referencia mala o un diff vacío tienen que fallar aquí, no dentro de dos revisores.

### 2. Localiza la especificación

Busca el origen, en este orden:

1. El acuerdo de `WORK.md` (o del documento de trabajo del proyecto): `## Objetivo`, `## Decisiones`, `## Límites`, `## Criterios` y la tarea revisada.
2. Una ruta que haya pasado el usuario.
3. Referencias a issues en los mensajes de commit (`#123`, `Closes #45`), si el proyecto usa un gestor de incidencias y tienes acceso.
4. Un archivo de especificación en `docs/` o `specs/` que coincida con la rama o la funcionalidad.
5. Si no hay nada, pregunta dónde está. Si no existe, el revisor de **Especificación** se omite y el informe dice «sin especificación».

### 3. Localiza las fuentes de normas

Todo lo que en el repo documente cómo escribir código: `CODING_STANDARDS.md`, `CONTRIBUTING.md`, `AGENTS.md`, la configuración del linter. Incluye las skills `comment-style` y `logging-style` si el proyecto no documenta otro estilo.

Además de lo que documente el repo, el eje de Normas lleva siempre la **base de olores** de abajo: un conjunto fijo de olores de código de Fowler (_Refactoring_, cap. 3) que aplica aunque el repo no documente nada. Dos reglas la gobiernan:

- **Manda el repo.** Una norma documentada siempre gana; donde respalda algo que la base marcaría, el olor se suprime.
- **Siempre es criterio.** Cada olor es una heurística etiquetada («posible Envidia de funcionalidad»), nunca una infracción dura. Como cualquier norma aquí, sáltate lo que ya fuerzan las herramientas.

Cada olor dice *qué es* → *cómo se arregla*; compáralo con el diff:

- **Nombre misterioso**: una función, variable o tipo cuyo nombre no revela qué hace o qué guarda. → renómbralo; si no sale un nombre honesto, el diseño está turbio.
- **Código duplicado**: la misma forma de lógica aparece en más de un fragmento o archivo del cambio. → extrae la forma común y llámala desde ambos.
- **Envidia de funcionalidad** (_Feature Envy_): un método que toca más los datos de otro objeto que los suyos. → mueve el método junto a los datos que envidia.
- **Grumos de datos** (_Data Clumps_): los mismos pocos campos o parámetros viajan siempre juntos (un tipo que quiere nacer). → agrúpalos en un tipo y pasa ese.
- **Obsesión primitiva**: un primitivo o un string haciendo de concepto del dominio que merece su propio tipo. → dale su tipo pequeño.
- **Switches repetidos**: el mismo `switch`/cascada de `if` sobre el mismo tipo se repite en el cambio. → polimorfismo, o un único mapa que compartan ambos sitios.
- **Cirugía de escopeta** (_Shotgun Surgery_): un cambio lógico obliga a editar muchos archivos dispersos. → reúne lo que cambia junto en un módulo.
- **Cambio divergente**: un archivo o módulo se edita por varias razones sin relación. → divídelo para que cada módulo cambie por una razón.
- **Generalidad especulativa**: abstracciones, parámetros o ganchos para necesidades que la especificación no tiene. → bórralos; vuelve a lo concreto hasta que aparezca la necesidad real.
- **Cadenas de mensajes**: navegación larga `a.b().c().d()` de la que el llamante no debería depender. → esconde el recorrido tras un método del primer objeto.
- **Intermediario** (_Middle Man_): una clase o función que casi solo delega. → quítala y llama directo al destino real.
- **Herencia rechazada** (_Refused Bequest_): una subclase o implementación que ignora o sobrescribe casi todo lo que hereda. → abandona la herencia y usa composición.

### 4. Lanza los dos revisores

**El encargo del revisor de Normas** incluye:

- El comando del diff y la lista de commits.
- La lista de fuentes de normas del paso 3, **más la base de olores del paso 3** pegada entera (el revisor no tiene otro acceso a ella).
- La consigna: «Informa, por archivo o fragmento cuando aplique, de (a) cada sitio donde el diff incumple una norma documentada, citando la norma (archivo y regla), y (b) cualquier olor de la base que veas, nombrándolo y citando el fragmento. Distingue infracciones duras de cuestiones de criterio: una norma documentada puede ser dura, pero los olores de la base siempre son criterio, y una norma del repo prevalece sobre la base. Sáltate lo que fuerzan las herramientas. Menos de 400 palabras.»

**El encargo del revisor de Especificación** incluye:

- El comando del diff y la lista de commits.
- La ruta o el contenido de la especificación.
- La consigna: «Informa de: (a) requisitos que pedía la especificación y faltan o están a medias; (b) comportamiento del diff que nadie pidió (ampliación de alcance); (c) requisitos que parecen implementados pero cuya implementación parece errónea. Cita la línea de la especificación en cada hallazgo. Menos de 400 palabras.»

Sin especificación, omite el segundo revisor y dilo en el informe final.

### 5. Reúne

Presenta los dos informes bajo `## Normas` y `## Especificación`, tal cual o apenas limpios. Cada eje conserva sus hallazgos y su orden: los dos ejes están separados a propósito (ver _Por qué dos ejes_).

Termina con una línea de resumen: hallazgos por eje y el más grave _dentro de cada eje_, si lo hay. Elegir un ganador entre ejes es justo la reordenación que la separación evita.

## Por qué dos ejes

Un cambio puede pasar un eje y suspender el otro:

- Código que sigue todas las normas pero implementa otra cosa → **Normas bien, Especificación mal.**
- Código que hace exactamente lo pedido pero rompe las convenciones del proyecto → **Especificación bien, Normas mal.**

Informarlos por separado evita que un eje tape al otro.
