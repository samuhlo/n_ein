# Evaluación del foco por riesgos del revisor

Se conserva el revisor ordinario. La candidata no se promueve: en este piloto no mejora la detección de referencia, tarda más y deja una revisión incompleta.

## Método

Doce intentos, seis casos por variante, Sol 6.1 high, Pi 1.0.2 y CodeGraph 1.6.1. Mismo motor y prompt base, una candidata adicional congelada antes de las ejecuciones. Orden alternado, repos reconstruidos y bases de datos independientes. Límite de cinco minutos por revisión; no se repitió la ejecución agotada para escoger un resultado favorable. Los procesos fueron secuenciales.

Se eligieron un defecto de contrato pequeño, un cambio correcto, dos fallos históricos de proyectos reales y dos fixtures nuevos (carrera de reemplazo y arreglo Unicode correcto). Estos últimos se prepararon con la candidata ya congelada, antes de observar sus resultados; no son una evaluación ciega independiente. Las referencias no se entregaron al revisor. Los resultados de los casos antiguos ya habían participado en investigación previa: esta muestra no sustituye un corpus reservado nuevo de proyectos reales.

## Resultado observado

| Medida | Base | Candidata |
|---|---:|---:|
| Revisiones completas | 6/6 | 5/6 |
| Defectos de referencia detectados | 3/4 | 2/4 |
| Avisos en los dos cambios correctos | 0 | 0 |
| Tiempo total, incluido intento agotado | 595,7 s | 738,3 s |
| Consumo estimado por Pi | 0,66295 USD | 0,71749 USD |

Ambas encuentran el consumidor roto de `make_quote` y la carrera del registro. En `plan-fechas` ambas señalan dos errores TypeScript nuevos, respaldados por comparación base/head, pero **omiten la fecha imposible de la referencia**. La base encuentra el desbordamiento de recibos y un escape de terminal adicional; la candidata agota sus cinco minutos y no entrega informe en ese caso. Una ejecución fallida no equivale a revisión sin defectos.

Las etiquetas son revisión del agente contra código y sondas guardadas, no valoraciones humanas de Samu. Los dos hallazgos adicionales no aumentan artificialmente la detección de referencia. Tiempo +23,9 % y estimación +8,2 % describen esta muestra, no una diferencia general. El total observado es 1,38044 USD estimados; no factura ni coste de preparación/etiquetado.

## Entrega y límites

[Candidata, ejecutor, fixtures y resultados](../previewer/focus-2026-10-30/) permanecen reproducibles. `validate.ts` demuestra que la carrera es una regresión y Unicode un arreglo correcto. Los datos completos se conservan localmente bajo `.n_ein/focus-20261030/`; no se copian credenciales. Los archivos de instrucciones y motor relevantes permanecieron iguales durante ambas variantes; el trabajo de interfaz de esta rama no se inyecta en el revisor sin skills ni contexto de proyecto.

No se cambia el modelo ni se añaden revisores. La mejora de cobertura general y las valoraciones humanas siguen pendientes del T9 original de p_reviewer. Este tramo entrega una comparación y evita promover una hipótesis que no ha demostrado utilidad.
