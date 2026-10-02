# Prototipo de lógica

Un único archivo HTML autocontenido (una **demo compartible**) que deja a cualquiera manejar un modelo de estado pulsando botones. Úsalo cuando la pregunta va de **lógica de negocio, transiciones de estado o forma de los datos**: lo que parece razonable en papel pero solo se nota mal al pasarlo por casos reales.

Al ser un solo archivo sin nada que instalar, puedes dárselo a alguien que no programa (diseño, producto, quien conoce el dominio) para que sienta el modelo por sí mismo. Así que habla su idioma, no el del código.

## Cuándo es la forma correcta

- «No sé si esta máquina de estados aguanta el caso de X y después Y.»
- «¿Este modelo de datos me deja representar el caso en que…?»
- «Quiero tantear cómo debería ser la API antes de escribirla.»
- Todo lo que sea **pulsar botones y ver cambiar el estado**.

Si la pregunta es «cómo debería verse», es la rama equivocada: usa [UI.md](UI.md).

## Proceso

### 1. Enuncia la pregunta

Antes de escribir código, escribe qué modelo de estado y qué pregunta prototipas. Un párrafo, arriba de la demo (en una introducción visible, no solo en un comentario). Un prototipo que responde la pregunta equivocada es puro desperdicio: haz la pregunta explícita para poder comprobarla después, esté el usuario mirando ahora o vuelva más tarde.

### 2. Aísla la lógica en un módulo portable

Pon la lógica de verdad (lo que responde la pregunta) en un único bloque `<script>` escrito como un módulo pequeño y puro que se podría sacar y llevar al código real. La página alrededor es desechable; este módulo no.

La forma adecuada depende de la pregunta:

- **Un reducer puro**: `(state, action) => state`. Bien cuando las acciones son eventos discretos y el estado es un único valor.
- **Una máquina de estados**: estados y transiciones explícitos. Bien cuando «qué acciones son legales ahora mismo» forma parte de la pregunta.
- **Un conjunto pequeño de funciones puras** sobre un tipo de datos simple. Bien cuando no hay estado actual implícito, solo transformaciones.
- **Una clase o módulo con una superficie de métodos clara** cuando la lógica posee de verdad un estado interno que evoluciona.

Elige la forma que mejor encaje con la pregunta, *no* la más fácil de conectar a una página. Mantenla pura: sin DOM, sin `document`, sin manejadores de botones dentro. La página llama al módulo; nada fluye en sentido contrario. Eso hace útil al prototipo más allá de su propia vida: una vez respondida la pregunta, el reducer, la máquina o las funciones validadas pasan solos al módulo real.

### 3. Construye el HTML compartible

Un archivo, HTML/CSS/JS sin más: sin framework, sin bundler, sin servidor, todo en línea para que se abra con doble clic y sobreviva a ir por correo. Cualquiera debe poder ejecutarlo abriéndolo.

Escríbelo para alguien que no programa. Cada etiqueta en **lenguaje del dominio**, no del código: botones y estado se leen como el negocio, no como el reducer. Explica con palabras llanas qué pasa.

Ordénalo con jerarquía clara, de arriba abajo:

1. **Título y una línea** sobre qué deja explorar la demo (la pregunta del paso 1).
2. **Estado actual**: todo el estado relevante en un panel legible (campos etiquetados, no un volcado de JSON), repintado tras cada clic para que se vea el cambio. Donde ayude, señala qué acaba de cambiar.
3. **Botones de juego libre**: uno por acción, siempre disponibles, para tocar el modelo en cualquier orden. Cada clic lanza su acción y repinta el estado.
4. **Recorridos guiados**: un conjunto de **escenarios**, uno por pestaña. Cada pestaña lleva una descripción breve en lenguaje llano (la situación que plantea y en qué fijarse) y debajo los **botones que hay que pulsar**, en orden. Cada paso es un botón real: pulsarlo hace la acción y pasa al siguiente. Empezar un recorrido reinicia a un estado inicial conocido para que el escenario sea siempre igual.

Elige escenarios que enseñen los casos incómodos, los difíciles de razonar en papel: el camino feliz, un caso límite enrevesado, un intento de algo que debería ser ilegal.

Bonito pero contenido: tipografía limpia, espacio generoso, un color de acento. Sin animaciones ni adornos: nada que compita con el estado y los botones.

### 4. Entrégalo

Envía el archivo o ábreselo. Lo recorrerá cuando pueda; los momentos interesantes son cuando dice «espera, eso no debería poder pasar» o «vaya, suponía que X sería distinto»: esos son los fallos de la _idea_, y ahí está la gracia. Si quiere acciones o escenarios nuevos, añádelos. Los prototipos evolucionan.

### 5. Conserva la respuesta y el prototipo

Cuando el prototipo haya respondido su pregunta, anota la respuesta y conserva el prototipo como dice la [SKILL](SKILL.md). En la rama de lógica: el reducer, la máquina o las funciones validadas pasan al módulo real (la decisión, absorbida); la cáscara HTML va a la rama desechable que conserva el prototipo como fuente primaria y, al ser un único archivo, sigue siendo trivial de volver a abrir.

## Antipatrones

- **Añadirle tests.** Un prototipo que necesita tests ya no es un prototipo.
- **Conectarlo a la base de datos real.** Estado en memoria salvo que la pregunta sea precisamente la persistencia.
- **Generalizar.** Nada de «¿y si luego queremos soportar X?». El prototipo responde una pregunta.
- **Mezclar lógica y página.** Si el módulo puro toca el DOM, `document` o manejadores de botones, ya no se puede sacar. La página es una cáscara fina sobre un módulo puro.
- **Recurrir a un framework, bundler o servidor.** Un archivo que el destinatario abre con doble clic; una app React o un servidor de desarrollo matan lo de «compartible».
- **Llevar la cáscara HTML a producción.** La página está pensada para recorrerse a mano. Lo que merece conservarse es el módulo de lógica que hay detrás.
