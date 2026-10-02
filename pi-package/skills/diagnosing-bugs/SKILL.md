---
name: diagnosing-bugs
description: Bucle de diagnóstico para fallos difíciles y regresiones de rendimiento. Úsala cuando el usuario pida diagnosticar o depurar, o cuente que algo se rompe, lanza errores, falla o va lento.
---

# Diagnosticar fallos

Una disciplina para fallos difíciles. Salta una fase solo con una justificación explícita.

Al explorar el código, lee `GLOSSARY.md` si existe para tener un modelo mental claro de los módulos implicados, y revisa los ADR de la zona.

## Oculta secretos

Esta skill te hace enseñar comandos, salidas y artefactos capturados. **Oculta antes cada secreto**: escribe `<REDACTED>` en su lugar. Construye los bucles con variables de entorno, para que la credencial se quede en el entorno y no en lo que enseñas. Los artefactos capturados llevan cabeceras de autenticación: cita solo las líneas que llevan la señal.

Si la salida ocultada no basta para diagnosticar, dilo y pide ayuda al usuario.

## Fase 1: construir un bucle de realimentación

**Esta es la skill.** Lo demás es mecánico. Si tienes una señal de pasa/falla **ajustada** (_tight_) para el fallo, una que se ponga en **rojo** con _este_ fallo, encontrarás la causa: la bisección, las hipótesis y la instrumentación solo la consumen. Sin ella, ninguna cantidad de mirar código te salvará.

Dedica aquí un esfuerzo desproporcionado. **Sé agresivo. Sé creativo. No te rindas.**

### Formas de construirlo, más o menos en este orden

1. **Test que falla** en la costura que alcance el fallo: unitario, integración, e2e.
2. **Script curl / HTTP** contra un servidor de desarrollo en marcha.
3. **Invocación de CLI** con una entrada fija, comparando la salida con una instantánea buena conocida.
4. **Script de navegador sin cabeza** (Playwright / Puppeteer) que maneje la UI y compruebe DOM, consola o red.
5. **Reproducir una traza capturada.** Guarda en disco una petición, payload o log de eventos real y pásalo aislado por el camino del código.
6. **Arnés desechable.** Levanta un subconjunto mínimo del sistema (un servicio, dependencias dobladas) que recorra el camino del fallo con una sola llamada.
7. **Bucle de propiedades / fuzz.** Si el fallo es «a veces sale mal», lanza 1000 entradas aleatorias y busca el modo de fallo.
8. **Arnés de bisección.** Si el fallo apareció entre dos estados conocidos (commit, datos, versión), automatiza «arrancar en X, comprobar, repetir» para poder lanzar `git bisect run`.
9. **Bucle diferencial.** Pasa la misma entrada por la versión antigua y la nueva (o por dos configuraciones) y compara las salidas.
10. **Script con una persona en el bucle.** Último recurso. Si alguien tiene que hacer clic, guíale con `scripts/hitl-loop.template.sh` para que el bucle siga siendo estructurado. Lo capturado vuelve a ti.

Con el bucle adecuado, el fallo está resuelto en un 90 %.

### Ajusta el bucle

Trata el bucle como un producto. Cuando tengas _un_ bucle, **ajústalo**:

- ¿Puede ir más rápido? (Cachea la preparación, sáltate lo que no hace falta, estrecha el alcance del test.)
- ¿Puede dar una señal más nítida? (Comprueba el síntoma concreto, no «no peta».)
- ¿Puede ser más determinista? (Fija el tiempo, la semilla, aísla el sistema de archivos, congela la red.)

Un bucle de 30 segundos e intermitente apenas mejora no tener bucle; uno de 2 segundos y determinista es ajustado: un superpoder para depurar.

### Fallos no deterministas

El objetivo no es una reproducción limpia sino una **tasa de reproducción más alta**. Repite el disparador 100 veces, paraleliza, añade carga, estrecha las ventanas de tiempo, inyecta esperas. Un fallo al 50 % se puede depurar; uno al 1 %, no: sube la tasa hasta que se pueda.

### Cuando de verdad no puedes construir un bucle

Para y dilo explícitamente. Enumera lo que probaste. Pide al usuario: (a) acceso al entorno que lo reproduce, (b) un artefacto capturado y ocultado (HAR, volcado de logs, core dump, grabación con marcas de tiempo) o (c) permiso para instrumentación temporal en producción. Las hipótesis empiezan cuando hay bucle.

### Criterio de terminado: un bucle ajustado que se pone en rojo

La fase 1 acaba cuando el bucle es **ajustado** y **capaz de rojo**: puedes nombrar **un comando** (la ruta de un script, la invocación de un test, un curl) que **ya has ejecutado al menos una vez** (enseña la invocación y su salida, ocultada), y que es:

- [ ] **Capaz de rojo**: recorre el camino real del fallo y comprueba el **síntoma exacto del usuario**, así que puede ponerse en rojo con este fallo y en verde al arreglarlo. No «se ejecuta sin errores»: tiene que poder _cazar este fallo concreto_.
- [ ] **Determinista**: el mismo veredicto en cada ejecución (fallos intermitentes: una tasa de reproducción alta y fijada, como arriba).
- [ ] **Rápido**: segundos, no minutos.
- [ ] **Ejecutable por el agente**: lo puedes lanzar sin supervisión; una persona en el bucle solo mediante `scripts/hitl-loop.template.sh`.

Si te pillas leyendo código para construir una teoría antes de que exista ese comando, **para: saltar directamente a una hipótesis es justo el fallo que esta skill evita.** Sin comando capaz de rojo no hay fase 2.

## Fase 2: reproducir y minimizar

Ejecuta el bucle. Míralo ponerse en rojo cuando aparece el fallo.

Confirma:

- [ ] El bucle produce el modo de fallo que describió el **usuario**, no otro fallo cercano. Fallo equivocado = arreglo equivocado.
- [ ] El fallo se reproduce en varias ejecuciones (o, si no es determinista, con una tasa suficiente para depurar).
- [ ] Has capturado el síntoma exacto (mensaje de error, salida errónea, tiempo lento) para que las fases siguientes verifiquen que el arreglo lo resuelve.

### Minimiza

Con el rojo, reduce la reproducción al **escenario más pequeño que sigue en rojo**. Quita entradas, llamantes, configuración, datos y pasos **de uno en uno**, relanzando el bucle tras cada corte, y quédate solo con lo que sostiene el fallo.

Por qué: una reproducción mínima reduce el espacio de hipótesis de la fase 3 (menos piezas sospechosas) y se convierte en el test de regresión limpio de la fase 5.

Acaba cuando **cada elemento restante sostiene el fallo**: quitar cualquiera pone el bucle en verde.

La fase 3 empieza con la reproducción hecha **y** minimizada.

## Fase 3: hipótesis

Genera **de 3 a 5 hipótesis ordenadas** antes de probar ninguna. Generar una sola ancla en la primera idea plausible.

Cada hipótesis tiene que ser **falsable**: di qué predice.

> Formato: «Si la causa es <X>, entonces <cambiar Y> hará desaparecer el fallo / <cambiar Z> lo empeorará.»

Si no puedes decir la predicción, la hipótesis es una corazonada: descártala o afínala.

**Enseña la lista ordenada al usuario antes de probar.** A menudo tiene conocimiento del dominio que la reordena al instante («acabamos de desplegar un cambio en la 3») o sabe qué hipótesis ya descartó. Punto de control barato, gran ahorro de tiempo. Sin bloquearte: si el usuario no está, sigue con tu orden.

## Fase 4: instrumentar

Cada sonda corresponde a una predicción concreta de la fase 3. **Cambia una variable cada vez.**

Herramientas, por preferencia:

1. **Depurador / REPL** si el entorno lo permite. Un punto de ruptura vale más que diez logs.
2. **Logs dirigidos** en las fronteras que distinguen hipótesis.
3. Nada de «loguearlo todo y hacer grep».

**Etiqueta cada log de depuración** con un prefijo único, por ejemplo `[DEBUG-a4f2]`. La limpieza final se reduce a un grep. Los logs sin etiqueta sobreviven; los etiquetados mueren.

**Rama de rendimiento.** En regresiones de rendimiento, los logs suelen ser la herramienta equivocada. Establece una medida de base (arnés de tiempos, `performance.now()`, perfilador, plan de consulta) y después biseca. Primero medir, después arreglar.

## Fase 5: arreglo y test de regresión

Escribe el test de regresión **antes del arreglo**, pero solo si hay una **costura correcta** para él.

Una costura correcta es aquella en la que el test ejercita el **patrón real del fallo** tal como ocurre en el punto de llamada. Si la única costura disponible es demasiado superficial (un test de un solo llamante cuando el fallo necesita varios, un unitario que no reproduce la cadena que lo disparó), un test ahí da una confianza falsa.

**Si no existe una costura correcta, ese es el hallazgo.** Anótalo: la arquitectura impide fijar el fallo. Señálalo para la siguiente fase.

Si existe:

1. Convierte la reproducción mínima en un test que falla en esa costura.
2. Míralo fallar.
3. Aplica el arreglo.
4. Míralo pasar.
5. Relanza el bucle de la fase 1 contra el escenario original, sin minimizar.

## Fase 6: limpieza

Obligatorio antes de dar el trabajo por terminado:

- [ ] La reproducción original ya no reproduce (relanza el bucle de la fase 1)
- [ ] El test de regresión pasa (o queda documentada la falta de costura)
- [ ] Retirada toda la instrumentación `[DEBUG-...]` (grep del prefijo)
- [ ] Prototipos desechables borrados (o movidos a un sitio de depuración bien marcado)
- [ ] La hipótesis que resultó correcta figura en el mensaje del commit o la PR, para que aprenda quien depure después
