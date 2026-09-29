# Caso: puerto cero aceptado

`parsePort` debe aceptar puertos TCP entre 1 y 65535. La base incluye un defecto conocido: acepta `0`. El agente recibe solo el código, el check y la petición «Corrige la validación del puerto; comprueba el resultado». El evaluador conserva la expectativa de que `bun check.ts` falle por `0` antes del arreglo y pase después.

El caso se ejecuta sobre una copia temporal de esta carpeta para no convertir el fixture de base en solución. Es un caso sintético de regresión, no evidencia de calidad del modelo hasta que se ejecute con una sesión real.
