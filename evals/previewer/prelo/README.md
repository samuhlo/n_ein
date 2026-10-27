# Banco de las diez PR de Prelo

Encargo de Samu del 27 de octubre de 2026: revisar la serie de `samuhlo/prelo-ob` con p_reviewer, conservar datos y afinar el revisor. El repositorio original permanece en solo lectura; las revisiones no publican comentarios ni corrigen Prelo.

`manifest.json` congela las bases, heads, enlaces y descripciones observados en GitHub. La PR 1 parte de main; cada una de las otras parte del head de la anterior. `run.ts` reconstruye dos commits por caso y comprueba que sus árboles son idénticos a los originales. No entrega al revisor las PR posteriores, las referencias del banco ni los hallazgos de otras variantes.

La reconstrucción reutiliza el mensaje del último commit; las descripciones de GitHub quedan como procedencia, no como instrucciones adicionales al modelo. La PR 9 tenía dos commits, por lo que ese caso no conserva el mensaje del primero. Ambas configuraciones reciben exactamente la misma reconstrucción; es una limitación del contexto de este ensayo.

Las PR 1–6 sirven para desarrollo. Las 7–10 se consultan para evaluar una vez fijada la candidata. Como todas pertenecen a una misma cadena, no son diez observaciones independientes ni permiten estimar por sí solas la capacidad general del revisor. Encontrar más avisos no implica revisar mejor; las etiquetas distinguen fallos válidos, heredados, inciertos y falsas alarmas. Las valoraciones del agente que evalúa no se presentan como valoraciones humanas de Samu.

## Repetir y consultar

```sh
bun evals/previewer/prelo/run.ts baseline-clean
bun evals/previewer/prelo/run.ts candidate
# Un subconjunto; una variante nunca sobrescribe intentos anteriores:
bun evals/previewer/prelo/run.ts repetition 1,3
python3 evals/previewer/prelo/validate.py
bun evals/previewer/prelo/replay.ts candidate 5 base
bun evals/previewer/prelo/replay.ts candidate 5 head
bun evals/previewer/prelo/replay.ts candidate 5 tip
bun evals/previewer/prelo/export.ts baseline baseline-live baseline-clean candidate
bun evals/previewer/prelo/summarize.ts
bun evals/previewer/prelo/open.ts candidate
```

Requiere el checkout de Prelo en `~/Documents/01_Proyectos/prelo` (o `PRELO_SOURCE`), Pi 1.0.2, CodeGraph 1.6.1 y acceso nativo a `openai-codex/gpt-6.1-sol`, esfuerzo `high`. Las credenciales nunca se copian al banco. Las inferencias consumen cuota; los importes de `usage.usd` son estimaciones del runtime, no facturas.

La variante exige los mismos hashes de código y prompt al reanudar; para otro código se usa otro nombre. No se omiten intentos fallidos: tienen su propio resultado. Para detener después del caso en curso, crear `STOP` en el directorio local de la variante. Cada pasada mantiene su propio SQLite, sin hallazgos anteriores que orienten al comparador.

`run.ts` siempre ejecuta el código actual y guarda sus hashes: un nombre de variante no restaura por sí solo una versión histórica. Los prompts y commits de las pasadas originales están en `results/`. Para medir otra versión, usar un nombre nuevo y conservar sus metadatos. `replay.ts` puede leer las sondas exportadas aunque ya no queden sesiones locales y reconstruye sus árboles desde el manifiesto.

Los resultados completos, eventos, sesiones y copias de entrada están en `.n_ein/prelo-bench-20261027/` (ignorado por Git). `results/*.jsonl` contiene la exportación revisable por PR: SHAs originales y reconstruidos, consumo, tiempos, recorrido, citas, hallazgos y sondas. Los scripts de validación usan copias aparte y las dependencias locales existentes solo para importar módulos; no ejecutan servicios personales ni pruebas físicas.

`labels.json` es la valoración explícita del evaluador, con un identificador por defecto para comparar avisos redactados de forma distinta. `references-dev.json` conserva los casos conocidos al afinar; `discoveries.json`, los descubiertos después. `summarize.ts` exige las veinte revisiones completas y una etiqueta por aviso antes de calcular métricas. `open.ts` conserva el SQLite del banco separado de las revisiones personales y deja enlaces privados en el directorio ignorado.

Las sondas antiguas pueden dejar de ser válidas para el final de la cadena. `tip-fixtures.json` registra ajustes solo de datos simulados (imagen válida, sesión de imagen e inventario con `present`); `replay.ts … tip adapt` conserva esos ajustes y la fuente usada por separado. Nunca se cambia el código del producto para obtener el resultado. La repetición reutiliza dependencias locales de solo lectura cuando sustituye el lanzador; guarda tanto el comando original como el ejecutado.

## Qué significa la evidencia

- Una cita validada existe en ese SHA; eso no demuestra que el razonamiento sea correcto.
- Que una sonda falle no basta: hay que leer su aserción y descartar errores de entorno. El banco conserva comando, fuente y salida.
- Comparar base y head separa una regresión de un fallo ya existente. Una reparación incompleta se etiqueta como tal.
- Los hallazgos se refieren al head de su PR. Una PR posterior puede resolverlos; no se presupone que sigan abiertos al final de la cadena.
- Las omisiones conocidas constituyen un mínimo observado, no un censo completo de defectos.
- El detector de contaminación busca rutas en los argumentos de herramientas; no garantiza aislamiento de lectura. La exploración inicial reveló su punto ciego: respuestas de un índice ajeno. `variants.json` excluye esa pasada de la comparación.

El informe de la evaluación recoge qué variante se ejecutó realmente y con qué resultados. Los comandos anteriores no garantizan reproducir respuestas idénticas de un modelo.
