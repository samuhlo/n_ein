---
name: writing-for-agents
description: Escribir documentos para agentes. Úsala al crear o editar skills y al modificar AGENTS.md, CLAUDE.md o la persona.
---

Referencia para escribir cualquier documento que consume un agente: una skill, un `AGENTS.md` / `CLAUDE.md`, un documento al que se llega por un puntero. El empaquetado cambia; la escritura, no: las mismas palancas hacen que cada uno sea predecible, porque el agente sigue el mismo _proceso_ en cada ejecución en lugar de producir la misma salida.

Si el documento es una skill, lee [`SKILL-MECHANICS.md`](SKILL-MECHANICS.md) para el frontmatter, la elección de invocación y las skills enrutadoras.

## Punteros de contexto

Un **puntero de contexto** es una referencia que vive en el contexto del agente, nombra material que está fuera y codifica la condición para ir a buscarlo. La descripción de una skill es uno; una línea de `AGENTS.md` que nombra un documento es el mismo objeto. Lo que decide cuándo llega el agente al material, y con qué fiabilidad, es la _redacción_ del puntero, no su destino. Un destino imprescindible detrás de un puntero mal redactado es un fallo de varianza: afila primero la redacción y mete el material en línea solo si afilar no basta.

Un puntero hace dos trabajos: decir qué es el material y enumerar las **ramas** que deben llevar a él (una rama es un caso distinto que el documento atiende, de modo que distintas ejecuciones recorren caminos distintos). Cada palabra de un puntero siempre cargado se paga en cada turno, así que merece una poda aún más dura que el cuerpo:

- **Pon delante la palabra guía**: el puntero es donde hace su trabajo de disparo.
- **Un disparador por rama.** Los sinónimos que renombran una sola rama son una rama escrita dos veces; júntalos y quédate solo con las ramas de verdad distintas.
- **Quita la identidad que ya lleva el cuerpo.**

## Las dos cargas

Cada documento y cada puntero que añades gasta uno de dos presupuestos:

- La **carga de contexto** es el coste del material siempre cargado sobre la ventana del agente: una línea de `AGENTS.md`, la descripción de una skill, cualquier cosa que esté en contexto en cada turno, gastando tokens y atención aunque no se dispare.
- La **carga cognitiva** es el coste sobre la persona: qué documentos existen y cuándo recurrir a cada uno. La persona es el índice. No es un coste a minimizar: es el precio de la autonomía humana; gástala donde importe el criterio humano y quítala donde no.

El material al que solo se llega por un puntero se libra de la carga de contexto al precio de la línea del propio puntero; el material sin puntero va entero a cargo de la carga cognitiva.

## Jerarquía de la información

Un documento se hace con dos tipos de contenido: **pasos** (las acciones ordenadas que hace el agente) y **referencia** (definiciones, reglas, hechos que se consultan cuando hacen falta). Se mezclan sin problema: todo pasos (una receta), todo referencia (las reglas de una revisión, esta skill) o ambos. La decisión central es en qué peldaño de la **jerarquía de la información** va cada pieza, una escalera ordenada por lo inmediato que el agente necesita el material:

1. **Paso en el archivo**: el peldaño principal, lo que el agente hace, en orden.
2. **Referencia en el archivo**: se consulta cuando hace falta. A menudo es un conjunto plano legítimo (todas las reglas de una revisión en un peldaño), lo cual está bien, no es un mal olor.
3. **Referencia desplegada**: se saca a un archivo aparte, al que se llega por un puntero, y se carga solo si el puntero se dispara. Va desde un archivo hermano en la misma carpeta hasta referencia totalmente externa que vive en cualquier sitio y a la que puede apuntar cualquier documento.

Si bajas demasiado poco, la cima se hincha; si bajas demasiado, escondes material que el agente necesita. Toda la decisión es esa tensión.

El **despliegue progresivo** es el movimiento escalera abajo (fuera del archivo principal y detrás de un puntero) para que la cima siga legible. No es sobre todo una optimización de tokens: es como se protege la jerarquía. La prueba más limpia es la ramificación: pon en línea lo que necesitan todas las ramas y detrás de un puntero lo que solo alcanzan algunas. Cuando un documento tiene pasos, una referencia en el archivo que debería desplegarse los entierra y convierte atenderlos en una moneda al aire: una palanca de varianza, no solo de legibilidad.

La **colocación** es su compañera dentro del archivo: la escalera decide _cuánto_ baja una pieza; la colocación decide _qué tiene al lado_ una vez allí. Mantén la definición, las reglas y las salvedades de un concepto bajo un mismo encabezado en vez de dispersas, para que leer una parte traiga a sus vecinas. La prueba: el documento debería leerse como documentación escrita para el agente. Lo agrupado se lee así; lo disperso, no. (Distinto de la duplicación: esa repite un significado en dos sitios; la dispersión fragmenta un significado en muchos.)

La **expansión** es el modo de fallo aquí: un documento sencillamente demasiado largo, aunque cada línea esté viva y sea única. La atención se diluye en el exceso y cada línea de más es una más que mantener relevante. La cura es la escalera: despliega la referencia detrás de punteros y divide por rama o por secuencia para que cada camino lleve solo lo que necesita.

## Pasos y criterios de terminado

Cada paso acaba en un **criterio de terminado**, la condición que dice al agente que el trabajo está hecho. Dos propiedades lo convierten en palanca:

- **Claridad**: ¿distingue el agente hecho de no hecho? Un límite vago («se alcanzó el entendimiento») invita al **cierre prematuro**: acabar el paso antes de tiempo, con la atención resbalando hacia _haber terminado_. Los pasos visibles que quedan por delante (los **pasos posteriores**) tiran; la claridad del criterio resiste. Defiéndete en orden: **afila primero el límite** (local y barato); solo si es irreduciblemente difuso _y_ observas las prisas, esconde los pasos posteriores dividiendo la secuencia. Esconder solo funciona a través de una frontera de contexto real (un relevo o el lanzamiento de un subagente; una llamada en línea deja los pasos posteriores en contexto y no limpia nada).
- **Exigencia**: cuánto pide. «Cada modelo modificado contabilizado» fuerza un trabajo concienzudo donde «produce una lista de cambios» no. La exigencia impulsa el **trabajo de campo** (la excavación que hace el agente dentro del trabajo, latente en la redacción más que escrita como paso propio), y no está atada a los pasos: «cada regla aplicada» obliga a un cuerpo de referencia plano igual que «cada paso hecho» obliga a una secuencia, que es como un documento todo referencia sigue llevando un listón de exhaustividad.

Los criterios más fuertes son comprobables y exhaustivos.

## Cuándo dividir

Dividir un documento en dos gasta una de las dos cargas, así que divide solo cuando el corte lo gane:

- **Por secuencia**: divide una tanda de pasos donde los pasos posteriores tientan al agente a apresurar el que tiene delante. Mantenerlos fuera de la vista impulsa más trabajo de campo en la tarea actual. Ojo con lo contrario: unir secuencias expone los pasos posteriores de cada una a lo que sigue e invita al cierre prematuro.
- **Por invocación**, propio de las skills: ver [`SKILL-MECHANICS.md`](SKILL-MECHANICS.md).

## Palabras guía

Una **palabra guía** es un concepto compacto que ya vive en el preentrenamiento del modelo y con el que el agente piensa mientras ejecuta el documento (_lección_, _niebla de guerra_, _bala trazadora_). Repetida como token, nunca como frase, acumula una definición distribuida y ancla toda una región de comportamiento con los mínimos tokens, reclutando lo que el modelo ya sabe. Acuñar una propia funciona si la defines con claridad, pero una palabra inventada no recluta nada: pagas en tokens de definición lo que una palabra preentrenada da gratis; busca primero una existente.

Ancla dos veces. En el cuerpo, la _ejecución_: el agente recurre al mismo comportamiento cada vez que aparece la palabra, y dentro de una referencia plana enfoca la atención en una clase de cosa que buscar. En un puntero, la _invocación_: cuando la misma palabra vive en tus prompts, tus documentos y tu código, el agente une ese lenguaje compartido con el material y llega a él con más fiabilidad.

Busca oportunidades de refactorizar con palabras guía. Una tríada explicada en tres sitios, un puntero que gasta una frase en señalar una idea: cada uno es un pasaje pidiendo colapsar en un solo token:

- «rápido, determinista, con poca sobrecarga» → _ajustado_ (un bucle _ajustado_).
- «un bucle en el que confías» → _rojo_, que convierte una compuerta difusa en un estado binario observable (el bucle se pone en _rojo_ con el fallo, o no).

Ganas dos veces: menos tokens y un gancho más afilado del que el agente cuelga su pensamiento. Da por hecho que cada documento arrastra repeticiones que las palabras guía retiran. Ve a buscarlas.

La **negación** es el modo de fallo junto a esta palanca: dirigir con prohibiciones mete en contexto el comportamiento prohibido y lo hace _más_ disponible, no menos. _No pienses en un elefante_, y solo queda el elefante; la negación es un modificador débil que el concepto, muy activado, arrolla, así que la prohibición se lee a medias como instrucción de hacerlo. Escribe en **positivo**: di el comportamiento objetivo («escribe comentarios de una línea») para que el prohibido nunca se nombre. Una prohibición se gana el sitio solo como barrera dura que no puedes expresar en positivo; incluso entonces, acompáñala del objetivo positivo para que la atención caiga en qué hacer.

## Poda

- Cada significado en una **única fuente de verdad**: un sitio con autoridad, para que cambiar el comportamiento sea una edición en un sitio. La **duplicación** (el mismo significado en más de un sitio) cuesta mantenimiento y tokens, e infla la prominencia de un significado en la escalera por encima de su rango real. (Es la inversa accidental de una palabra guía, que repite a propósito un token, nunca el significado.)
- El **entorno** también es fuente de verdad (los scripts de `package.json`, los archivos de configuración, la estructura de directorios, la salida de `--help`), y un documento que lo repite es una **caché**: una copia de una consulta, que solo se gana la carga cuando la consulta es cara. Cachea lo que el agente no puede encontrar mirando: la convención no escrita, la razón de una elección, la trampa que ninguna configuración confiesa. Deja al entorno las consultas de un archivo o un comando, donde no se pueden quedar viejas.
- Comprueba la **relevancia** de cada línea: ¿sigue influyendo en lo que hace el documento? Una línea pierde relevancia por no influir nunca en la tarea (mera exposición, o una rama que debería desplegarse) o por quedarse vieja al cambiar el comportamiento o el mundo que describe. Los documentos cortos son más fáciles de mantener relevantes. Sin disciplina de poda, el destino por defecto es el **sedimento**: capas viejas que se asientan porque añadir parece seguro y quitar parece arriesgado, hasta que hay que perforarlas para encontrar lo que sigue vivo.
- Caza las **instrucciones vacías** frase a frase: una instrucción que el modelo ya cumple por defecto paga carga para no decir nada. La prueba (¿cambia el comportamiento respecto al de por defecto?) depende del modelo, no del lector: dos personas que discrepan sobre una instrucción vacía discrepan sobre el comportamiento por defecto, y lo resuelven ejecutando el documento, no debatiendo. Cuando una frase suspende, borra la frase entera en vez de recortarle palabras. La prueba también califica las palabras guía: una palabra demasiado débil para ganar al comportamiento por defecto (_sé minucioso_ cuando el agente ya es más o menos minucioso) es vacía, y el arreglo es una palabra más fuerte (_implacable_), no otra técnica.
