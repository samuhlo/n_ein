# Estrategia de modelos

## Preferencia confirmada

Samu: «Empieza con los baratos alojados. Pero en local mi idea seria Qwen3.8-27B en una tarjeta con 24gb VRAM».

Mantener la opción económica desde el principio. La elección de un modelo alojado concreto no está cerrada; usar como referencias el capaz habitual y un barato disponible en las cuentas configuradas, verificando identidad y condiciones actuales antes del experimento. Las etiquetas del piloto antiguo no son recomendaciones eternas.

## Trabajo y esfuerzo

El barato puede diagnosticar y decidir detalles locales. El capaz no tiene que especificar cada línea y puede implementar directamente. Ni modelo ni esfuerzo quedan ligados a fases heredadas. Comparar coste completo y resultado, no solo tarifa o thinking bajo.

Dos asignaciones iniciales bastan: modelo de la sesión y modelo del trabajador económico. La opción local se añade más adelante. Mostrar modelo efectivo y fuente de la configuración. Fallos de auth, proveedor o disponibilidad se reportan, sin usar otro modelo silenciosamente.

Al comparar costes, etiquetar estimaciones de tokens por tarifa, importes facturados y datos desconocidos. `usage.cost` de Pi puede ser una estimación de catálogo; no equivale por sí solo a factura ni permite atribuir un coste marginal a una suscripción. Incluir revisión y rescates en todas las rutas comparadas.

## Qué tomar de GVS5H

Instancias nuevas del mismo modelo comparten plan/notas/solución; la coordinación no requiere siempre un modelo caro. Un resultado de tests fallido invalida la declaración de finalización. Notas acotadas y detección de falta de progreso son prácticas a ensayar.

El benchmark es generación de soluciones algorítmicas, con llamada única como baseline y más inferencia en la ruta coordinada. No es una prueba del tool calling, mantenimiento multiarchivo, contexto de un repositorio ni ejecución cuantizada en la tarjeta de Samu. Conservar los datos publicados como hipótesis, no como capacidad adquirida por n_ein.

Ver [paper preservado](sources/gvs5h/paper/paper_latest.tex), [tabla](sources/gvs5h/paper/tab-4new-5pass.tex) y [código](sources/gvs5h/codebase/v2-current/escalation/multiagent.py). No hay que ejecutar ese código para empezar n_ein.

## Qwen3.8-27B en 24 GB

El paper usa FP8. Cálculo nominal de pesos, sin metadatos ni memoria de ejecución: 27B a 16 bits ≈54 GB; a 8 bits ≈27 GB; a 4 bits ≈13,5 GB decimales. Es una estimación aritmética, no el tamaño medido del fichero o proceso. FP8 completo no es el perfil razonable para una GPU de 24 GB.

Propuesta: cuantización a 4 bits compatible con la GPU/servidor, una petición activa y contexto inicial de 8k–16k. Probar 32k posteriormente si calidad y memoria lo permiten. El modelo puede admitir ventanas mayores; no implican que ese hardware y precisión sostengan el mismo uso.

Una instancia del servidor puede mantener los pesos y atender trabajadores secuenciales. No cargar cinco copias del modelo por los cinco «humanos» del nombre del paper. La concurrencia alojada no se traslada sin más a una GPU.

Pendientes antes del despliegue: modelo exacto de GPU, sistema operativo, RAM, formato de pesos, servidor compatible, plantilla y soporte de herramientas. No elegir NVFP4 u otro kernel solo porque la tarjeta tenga 24 GB. No descargar pesos durante las primeras entregas.

## Prueba del endpoint

Comprobar llamadas a herramientas, argumentos, resultados, edición, errores, cancelación, límites y continuación. Una API HTTP compatible no garantiza un agente funcional. Adaptar capacidades reales (`developer` role, razonamiento, contexto) en la configuración nativa de Pi cuando proceda.

Registrar revisión/hash de pesos, cuantización, GPU/controlador, servidor y versión, plantilla, parámetros, contexto efectivo, VRAM pico, latencia inicial, velocidad, aceptación y errores. El éxito del paper en FP8 no se hereda en 4 bits.

Si el local se promociona solo para cierta clase de tareas, limitar allí su uso. Mantener el alojado como alternativa elegida. El fallback puede afectar destino del código y coste; debe ser parte de la preferencia configurada, no improvisarse en silencio.

Coste local: energía, amortización, tiempo, mantenimiento y rescates. Cero tokens facturados no significa cero coste.

## Referencias consultadas

- [Ficha oficial Qwen](https://huggingface.co/Qwen/Qwen3.8-27B).
- [Receta vLLM](https://github.com/vllm-project/recipes/blob/main/models/Qwen/Qwen3.8-27B.yaml).
- [Memoria en vLLM](https://docs.vllm.ai/en/latest/configuration/conserving_memory/).
- [Llamadas a herramientas en llama.cpp](https://github.com/ggml-org/llama.cpp/blob/master/docs/function-calling.md).
- [Documentación de modelos Pi disponible en el workspace](sources/pi-installed/docs/models.md).

Las páginas web sin revisión fijada se consultaron el 28 de septiembre de 2026 y pueden cambiar. Volver a comprobar los detalles al implementar; no se ha observado ninguna ejecución local de este modelo en el hardware objetivo.
