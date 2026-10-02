# Prototipo de interfaz

Genera **varias variantes de interfaz radicalmente distintas** en una sola ruta, intercambiables desde una barra flotante abajo. El usuario pasa de una a otra en el navegador, elige una (o roba trozos de cada una) y tira el resto.

Si la pregunta va de lógica o estado y no de cómo se ve algo, es la rama equivocada: usa [LOGIC.md](LOGIC.md).

## Cuándo es la forma correcta

- «¿Cómo debería verse esta página?»
- «Quiero ver unas cuantas opciones de este panel antes de decidir.»
- «Prueba otra disposición para la pantalla de ajustes.»
- Siempre que el usuario se fuera a pasar el día eligiendo entre tres maquetas vagas en su cabeza.

## Dos formas: prefiere claramente la A

Un prototipo de interfaz se juzga mucho mejor **pegado al resto de la app**: la cabecera real, la barra lateral real, datos reales, densidad real. Una ruta desechable aislada es un vacío donde cualquier variante parece bien. Usa la forma A siempre que haya una página plausible que pueda alojar las variantes. Recurre a la B solo si el prototipo no tiene de verdad un hogar cercano.

### Forma A: ajuste a una página existente (preferida)

La ruta ya existe. Las variantes se pintan **en la misma ruta**, elegidas con un parámetro `?variant=` de la URL. La carga de datos, los parámetros y la autenticación existentes se quedan; solo cambia el pintado. Es la opción por defecto; elígela salvo que haya un motivo concreto.

Si se prototipa algo que aún no tiene página pero que *viviría con naturalidad dentro de una* (una sección nueva del panel, una tarjeta nueva en ajustes, un paso nuevo de un flujo), sigue siendo la forma A: monta las variantes dentro de la página anfitriona.

### Forma B: una página nueva (último recurso)

Solo cuando lo prototipado no tiene de verdad una página donde vivir (una superficie de primer nivel completamente nueva, o un flujo que no se puede incrustar en ningún sitio razonable).

Crea una **ruta desechable** siguiendo la convención de rutas del proyecto, sin estructura nueva de primer nivel. Que el nombre deje claro que es un prototipo (por ejemplo, con `prototype` en la ruta o el archivo). Mismo patrón `?variant=`.

Antes de optar por la B, comprueba: ¿de verdad no hay una página existente donde incrustarlo? Una ruta vacía esconde problemas de diseño que una poblada destaparía.

En las dos formas la barra flotante es idéntica.

## Proceso

### 1. Enuncia la pregunta y elige N

Por defecto, **3 variantes**. Más de 5 deja de ser radicalmente distinto y empieza a ser ruido: ese es el tope.

Escribe el plan en una línea, en el sitio del prototipo o en un comentario al principio del archivo:

> «Tres variantes de la página de ajustes, intercambiables con `?variant=`, en la ruta existente `/settings`.»

Sirve tanto si el usuario está para opinar como si no.

### 2. Genera variantes radicalmente distintas

Redacta cada variante ateniéndote a:

- El propósito de la página y los datos a los que tiene acceso.
- La librería de componentes o el sistema de estilos del proyecto (TailwindCSS, shadcn, MUI, CSS a secas, lo que sea).
- Un componente exportado con nombre claro, por ejemplo `VariantA`, `VariantB`, `VariantC`.

Las variantes tienen que ser **estructuralmente distintas**: otra disposición, otra jerarquía de información, otra acción principal, no solo otros colores. Tres rejillas de tarjetas con retoques no son un prototipo de interfaz, son papel pintado. Si dos borradores salen demasiado parecidos, rehaz uno con una indicación explícita como «sin rejilla de tarjetas».

### 3. Conéctalas

Crea un único componente selector en la ruta:

```tsx
// pseudocódigo, adáptalo al framework del proyecto
const variant = searchParams.get('variant') ?? 'A';
return (
  <>
    {variant === 'A' && <VariantA {...data} />}
    {variant === 'B' && <VariantB {...data} />}
    {variant === 'C' && <VariantC {...data} />}
    <PrototypeSwitcher variants={['A','B','C']} current={variant} />
  </>
);
```

Forma A (página existente): deja toda la carga de datos por encima del selector; por variante solo cambia el subárbol pintado.

Forma B (página nueva): la ruta desechable bajo `/prototype/<nombre>` monta el mismo selector.

### 4. Construye la barra flotante

Una barra pequeña fija abajo en el centro de la pantalla, con tres piezas:

- **Flecha izquierda**: pasa a la variante anterior (vuelve al final).
- **Etiqueta de variante**: la clave actual y, si la variante exporta un nombre, también ese nombre. Por ejemplo `B (barra lateral)`.
- **Flecha derecha**: avanza (vuelve al principio).

Comportamiento:

- Pulsar una flecha actualiza el parámetro de la URL (con el router del framework: `router.replace` en Next, `navigate` en React Router…) para que la variante se pueda compartir y aguante una recarga.
- Teclado: `←` y `→` también cambian de variante, salvo con el foco en un `<input>`, `<textarea>` o `[contenteditable]`.
- Visualmente distinta de la página (una píldora de alto contraste, una sombra sutil) para que se vea que no forma parte del diseño evaluado.
- Oculta en producción: condicionada a `process.env.NODE_ENV !== 'production'` o equivalente, para que un merge despistado no se la enseñe a los usuarios.

Pon el selector en un único componente compartido para que lo usen las dos formas, donde el proyecto guarde la interfaz compartida.

### 5. Entrégalo

Da la URL (y las claves de `?variant=`). El usuario las recorrerá cuando pueda. La respuesta interesante suele ser **«quiero la cabecera de B con la barra lateral de C»**, que es el diseño que de verdad quiere.

### 6. Conserva la respuesta y limpia

Cuando gane una variante, anota la respuesta (cuál y por qué) y conserva el prototipo como dice la [SKILL](SKILL.md). Lleva la ganadora al código real y el resto a la rama desechable, no a la principal:

- **Forma A**: integra la ganadora en la página existente; quita de la principal las variantes perdedoras y el selector.
- **Forma B**: convierte la variante ganadora en una ruta real; quita de la principal la ruta desechable y el selector.

El conjunto completo de variantes es la fuente primaria, así que va a la rama desechable, no a la papelera: componentes de variantes y selectores olvidados en la rama principal se pudren rápido y confunden a quien venga detrás.

## Antipatrones

- **Variantes que solo cambian color o textos.** Eso es un retoque, no un prototipo. Las variantes de verdad discrepan en estructura.
- **Compartir demasiado código entre variantes.** Una `<Header>` común vale; un `<Layout>` común mata la gracia. Cada variante debe poder tirar la disposición.
- **Conectar las variantes a mutaciones reales.** Los prototipos de solo lectura están bien. Si una variante necesita mutar, apúntala a un sustituto: la pregunta es «cómo debería verse», no «funciona el backend».
- **Pasar el prototipo tal cual a producción.** El código de las variantes se escribió con restricciones de prototipo (sin tests, manejo de errores mínimo). Reescríbelo bien al integrarlo.
