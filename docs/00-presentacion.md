# n_ein

**Una forma de trabajar con agentes que aproveche mejor su capacidad, nuestro tiempo y nuestro dinero.**

Presentación del proyecto · 29 de septiembre de 2026

Este documento describe la experiencia que queremos construir. n_ein está en diseño; sus mejoras se comprobarán con trabajo real conforme se implemente.

## // 000. La idea

Quiero abrir mi proyecto, explicar lo que necesito y avanzar. Entender qué se está haciendo, poder corregir el rumbo y recibir un resultado que pueda revisar. Si mañana continúo, quiero encontrar el trabajo donde lo dejé. Si otro agente puede hacerse cargo, quiero darle el relevo sin volver a contar toda la historia.

n_ein nace para hacer que esa experiencia sea habitual.

El nombre une *new Ein* y *nein*, «no» en alemán. Recuerda una idea que queremos conservar mientras construimos: **no hace falta tanto**. Cada herramienta, regla y paso debe aportar algo al trabajo.

Venimos de Ein. Allí aprendimos a organizar agentes, repartir tareas, conservar contexto y exigir comprobaciones. También vimos cómo un sistema pensado para ayudar podía acabar pidiendo demasiado mantenimiento y demasiadas explicaciones para realizar cambios sencillos.

n_ein recoge ese aprendizaje en un proyecto nuevo. Conserva lo que hacía agradable y útil trabajar con Ein: su pantalla de entrada, el instalador, la identidad visual, la voz cercana, la lista de pendientes y la continuidad entre agentes. Su funcionamiento interno se construirá alrededor de un recorrido más sencillo.

## // 001. Qué queremos conseguir

El objetivo es **terminar más trabajo correcto con menos supervisión**.

Eso incluye gastar menos cuando sea posible, pero también esperar menos, repetir menos explicaciones y dedicar menos tiempo a rescatar un proceso atascado. Un ahorro pequeño en llamadas al modelo puede salir caro si nos obliga a revisar el doble.

Queremos que n_ein entienda el resultado que buscamos, tome decisiones técnicas razonables dentro de ese encargo y nos consulte cuando haya una elección que realmente nos corresponda. Que enseñe algo cuando la explicación ayude a comprender el cambio. Para una rama, un commit o una PR rutinaria, basta con decir qué hizo y dónde está.

Y queremos conservar el control: ver los cambios, detener un trabajador, cambiar una decisión y saber qué se ha comprobado y qué queda pendiente.

## // 002. Una manera natural de trabajar

El recorrido se puede contar en cinco acciones:

**Entender → elegir cómo hacerlo → trabajar → comprobar → dejarlo claro y retomable.**

Son cosas que hace un buen colaborador, no cinco reuniones ni cinco documentos. Una corrección pequeña puede recorrerlas en unos instantes. Un cambio importante puede necesitar volver a investigar o resolver una duda antes de seguir.

**Entender.** n_ein consulta el proyecto y la conversación para saber qué quieres conseguir. Busca por su cuenta lo que pueda averiguar. Pregunta cuando la respuesta cambie el resultado: cómo debe comportarse una función, qué alcance aceptas o qué compromiso prefieres.

**Elegir cómo hacerlo.** Si el agente ya conoce el arreglo y puede terminarlo enseguida, lo hace. Si hay un encargo útil que otro modelo puede completar a menor coste, lo delega. Si necesita información para decidir, pide una investigación acotada. Esa elección debe ayudar a avanzar, sin convertirse en un trabajo adicional que tengas que dirigir.

**Trabajar.** El agente que recibe el encargo puede leer, diagnosticar, probar e implementar. Tiene un objetivo y unos límites claros. Si descubre algo que cambia el alcance, devuelve esa decisión al agente principal; no amplía el proyecto por iniciativa propia.

**Comprobar.** Se eligen pruebas que tengan relación con lo que pediste. Un cambio de texto, una regla de calendario y una modificación de permisos necesitan comprobaciones diferentes. Si hace falta una mirada independiente, se añade. Una comprobación fiable y todavía válida se aprovecha; no se repite solo por costumbre.

**Dejarlo claro y retomable.** Recibes el resultado, las decisiones que importan y las limitaciones reales. Si queda trabajo, se conserva un pendiente entendible. Publicar o entregar el cambio sigue la autorización que hayas dado.

### Intent: pensar juntos qué merece construirse

A veces todavía no tienes un encargo cerrado. Sabes que algo te molesta o que quieres mejorar una parte del proyecto, pero necesitas hablarlo para encontrar una solución que tenga sentido. **`intent` será una de las capacidades principales de n_ein desde el principio.** Recoge la conversación guiada de `grill-me` de Matt y la experiencia del canal de intención de Ein.

Puedes pedirlo directamente. Si el agente detecta varias decisiones abiertas, puede proponértelo y esperar a que aceptes. Un arreglo claro continúa por el camino corto; una duda concreta puede resolverse con una sola pregunta.

Ante «quiero mejorar cómo preparo las semanas», n_ein podría empezar por entender qué te hace perder tiempo y ofrecerte alternativas con una recomendación. Tus respuestas determinan qué merece preguntar después. El agente consulta el proyecto para averiguar hechos; tú decides sobre el resultado que buscas y los compromisos que aceptas.

La conversación debe ayudarte a descubrir posibilidades y sus consecuencias. Al terminar, tendrás una explicación clara de qué vamos a conseguir, qué queda fuera y cómo reconoceremos que funciona. Las dudas que puedan esperar quedan señaladas. Ese acuerdo alimenta el mismo documento de trabajo cuando haga falta conservarlo.

También puedes cerrar la conversación ahí, sin programar nada. Si ya habías pedido implementar y el alcance sigue siendo el acordado, se continúa sin volver a pedir el mismo permiso. Lo importante es empezar el trabajo correcto con un entendimiento compartido.

## // 003. Un encargo de principio a fin

Imagina que abres el Planificador y pides:

> «Quiero duplicar una semana de actividades y colocar la copia en otra fecha».

### Primero, aclarar lo que cambia el resultado

n_ein mira cómo funcionan las semanas y las actividades. Si no está decidido qué debe ocurrir cuando la nueva fecha cae en otro día de la semana, te plantea esa elección. También puede descubrir que el proyecto ya tiene una regla para ello y seguirla sin preguntarte otra vez.

Con lo importante resuelto, te explica brevemente qué propone. Por ejemplo: crear una copia independiente, trasladar sus actividades y mantener intacta la semana original. Si el trabajo merece conservar progreso, deja una lista breve de resultados pendientes.

### Después, repartir trabajo donde compense

El agente principal puede encargar a un modelo económico la copia y el ajuste de fechas, señalándole la parte del proyecto y las comprobaciones que debe superar. El trabajador tiene permiso para entender los detalles; no necesita recibir cada línea escrita de antemano.

Mientras trabaja, ves qué está haciendo, qué modelo utiliza y si avanza o necesita una decisión. Puedes abrir el detalle, pero no tienes que seguir toda su conversación.

Si durante la misma sesión pides cambiar «Duplicar» por «Crear copia» y el agente ya tiene delante el lugar exacto, puede resolverlo directamente. Preparar otro encargo para esa edición no aportaría nada.

### Comprobar el comportamiento que importa

La comprobación debe demostrar que la copia aparece en las fechas elegidas, que sus actividades no siguen vinculadas por error al original y que editar una semana no modifica la otra. Una revisión visual puede confirmar que la acción se entiende y que el resultado se muestra bien.

Si falla un caso al cruzar de mes, se conserva el trabajo hecho y se corrige ese problema. Si el trabajador se atasca, el agente principal puede acotar el encargo, darle más contexto, cambiar de modelo o terminarlo él mismo. El avance no desaparece por haber fallado un intento.

### Entregar una explicación útil

Una respuesta deseada sería algo como:

> «Ya puedes crear una copia de la semana en otra fecha. La copia es independiente: cambiar sus actividades no altera la original. He comprobado el cambio de mes y la edición de ambas semanas. Falta revisar cómo se ve la acción en pantalla estrecha».

La explicación permite juzgar el resultado. Lo pendiente queda visible, sin convertir una comprobación parcial en un “todo correcto”.

### Retomarlo cuando haga falta

Si paras a mitad del encargo, la lista conserva qué está hecho y qué queda. Si cambias de Pi a Claude, primero se detienen las escrituras del agente anterior y sus trabajadores. El siguiente recibe el objetivo, las decisiones y las referencias al trabajo; contrasta ese resumen con los archivos actuales antes de continuar.

Cambiar de agente puede implicar herramientas distintas. La continuidad que buscamos consiste en conservar el sentido y el estado del trabajo, sin prometer que todas las aplicaciones funcionen igual.

## // 004. Las piezas que deben marcar la diferencia

### Un agente principal con criterio

Mantiene la conversación y la visión del encargo. Puede investigar, implementar y delegar. Su responsabilidad es elegir una forma eficaz de llegar al resultado y reconocer cuándo necesita ayuda o una decisión tuya.

Con `intent`, también te ayuda a dar forma a una idea antes de convertirla en tareas. Ese acuerdo es lo que después permite explicar mejor el encargo a un trabajador y revisar si ha construido lo que necesitabas.

### Trabajadores económicos con encargos útiles

Los modelos baratos pueden hacer bastante más que cambios mecánicos cuando reciben un objetivo claro y contexto suficiente. Queremos aprovechar esa capacidad. El ahorro se calcula contando también el tiempo de preparación, la revisión y los intentos que salen mal.

### Buenas prácticas disponibles cuando se necesitan

Las *skills* son guías que el agente consulta para una tarea concreta. Nos interesan especialmente las de Matt Pocock sobre diseño, diagnóstico, pruebas y revisión: ayudan a encontrar la causa de un fallo, evitar soluciones innecesariamente complicadas y comprobar el comportamiento que realmente importa.

Se cargarán cuando aporten algo. Una petición sencilla no necesita llevar encima todos los manuales del proyecto.

### Código que puedas recorrer y reconocer como tuyo

El trabajo también debe entenderse al abrir sus archivos. Conservaremos el estilo personal de comentarios de Ein: cabeceras para orientarse, secciones reconocibles y notas que expliquen el papel de una parte compleja o el motivo de una decisión.

Por ejemplo, una nota como esta ayuda a recordar una precaución importante:

```text
// BLINDAJE -> Una edición posterior invalida la comprobación anterior.
```

La intención es que puedas revisar el código con facilidad y aprender del mecanismo cuando lo necesites. Las explicaciones se concentran donde aportan información; no habrá que leer un comentario para cada línea evidente. El estilo acompañará al código escrito directamente y al que produzcan los trabajadores económicos.

También conservaremos la forma de los logs, los mensajes técnicos que permiten seguir lo que ocurre durante la ejecución:

```text
[DATA] >> COPY_START :: week_id: wk_42
[DATA] ++ COPIED :: activities: 12 | duration_ms: 34
```

De un vistazo puedes reconocer qué empezó, qué terminó y cuánto tardó. Cuando algo falle, el mensaje dará contexto útil para investigarlo. Esa marca personal tendrá una función práctica: hacer más fácil entender, revisar y mantener tus proyectos.

### Comprobaciones que puedan contrastarse

Queremos saber qué se ejecutó, sobre qué versión del trabajo y con qué resultado. Además, alguien debe valorar si esas comprobaciones responden al encargo. Que una prueba pase y que hayamos construido lo que necesitabas son dos preguntas diferentes.

La revisión también tendrá que demostrar su utilidad: detectar problemas reales sin inundarte de observaciones irrelevantes. Un informe largo no vale más por ser largo.

### Una memoria de trabajo sencilla

Para los encargos prolongados habrá un documento con objetivo, decisiones, progreso y pendiente. La lista TODO mostrará ese mismo contenido. Así, la pantalla y el agente trabajan con una única lista, y puedes leerla incluso fuera de n_ein.

Los cambios pequeños no tendrán que crear documentación para ocupar un hueco en la interfaz.

### Una experiencia que invite a usarlo

La pantalla de entrada permitirá ver el proyecto, revisar sesiones, cambiar configuración y elegir agente. Dentro de la sesión verás trabajadores, pendientes y comprobaciones. Se mantendrán los títulos `// NNN`, los colores y la voz docente de Ein.

El instalador permitirá actualizar, diagnosticar y recuperar una versión anterior. Desarrollo y pruebas tendrán espacios propios, para poder experimentar sin convertir la instalación habitual en el primer ensayo de cada novedad.

## // 005. Por qué podría mejorar trabajar con un agente sin esta ayuda

Los agentes actuales ya pueden hacer mucho. n_ein tiene que aportar mejoras concretas sobre esa capacidad:

| Situación | Mejora que buscamos |
|---|---|
| Una idea que todavía no está clara | Concretarla juntos mediante `intent`, con opciones y decisiones que permitan empezar el trabajo correcto. |
| Un arreglo pequeño | Resolverlo sin preparar un proceso desproporcionado. |
| Un encargo que admite delegación | Aprovechar un modelo económico sin perder calidad ni aumentar la supervisión. |
| Una interrupción | Continuar sin reconstruir decisiones o repetir trabajo. |
| Una respuesta optimista | Poder contrastarla con comprobaciones y limitaciones visibles. |
| Varios trabajadores | Entender quién hace qué y poder detenerlos. |
| Una actualización problemática | Recuperar una instalación utilizable. |

Estas son hipótesis que vamos a probar. Compararemos los mismos encargos con un agente capaz trabajando directamente y con n_ein. Miraremos resultados, defectos, coste completo, tiempo y cuántas veces has tenido que intervenir.

Si una pieza no mejora nada, la simplificaremos o la retiraremos. El nombre del proyecto también es un recordatorio para tomar esa decisión.

## // 006. Modelos económicos ahora, ejecución local después

Empezaremos con modelos alojados por proveedores. Eso permite validar los encargos y las comprobaciones antes de sumar el trabajo de mantener un servidor propio.

El siguiente objetivo es ejecutar Qwen3.8-27B en una tarjeta con 24 GB de memoria. Será necesario probar una versión comprimida del modelo y ajustar cuánto contexto recibe. Que entre en memoria no demuestra todavía que resuelva bien nuestros encargos.

La ejecución local usará el mismo criterio que la alojada: resultado, tiempo, fiabilidad y coste completo. Si funciona bien en ciertas tareas, podrá hacerse cargo de ellas. Para otras seguiremos utilizando un modelo más capaz.

La elección puede cambiar a medida que mejoren los modelos. n_ein debe permitir aprovechar esa mejora sin reconstruir todo el producto.

## // 007. Cómo vamos a construirlo

La primera versión útil abrirá una sesión aislada, tendrá la voz y las prácticas esenciales, permitirá definir ideas con `intent` y resolverá un cambio directamente. Después añadiremos un trabajador económico y comprobaremos que completa un encargo real.

Sobre ese recorrido construiremos la continuidad, el TODO y la evidencia de comprobación. El launcher y el instalador completos llegarán cuando haya trabajo real que mostrar y una instalación que merezca usarse. Más adelante ensayaremos la ejecución local.

Cada entrega debe dejar algo utilizable. Conservaremos los aprendizajes y las piezas de Ein que ayuden, adaptaremos las prácticas de Matt y aprovecharemos ideas operativas de Gentle Shell. Las decisiones de diseño se contrastarán con el uso.

Queremos llegar al momento en que puedas abrir n_ein, pedir una mejora y concentrarte en juzgar lo que aporta a tu proyecto. El trabajo de coordinar, comprobar y recordar debe ayudarte a avanzar.

---

La base técnica, las fuentes y los criterios de aceptación están en [decisiones](01-decisiones.md), [diseño](02-diseno.md), [plan](03-plan.md) e [investigación](07-investigacion.md). Esta presentación explica la experiencia deseada; esos documentos concretan cómo construirla y comprobarla.
