# Banco del revisor, primera medición (T8)

21 de octubre de 2026. Corpus `t8-15-v1` (`evals/previewer/`), congelado antes de medir. Dos revisores con el mismo motor y el mismo prompt:

- **Sol:** `openai-codex/gpt-6-sol` alto por Pi, el valor por defecto.
- **Opus:** `claude-code/claude-opus-5-5` por Claude Code, con el proceso entero dentro de `sandbox-exec` y sin `CLAUDE.md` ni ajustes. La suscripción de Claude solo se usa desde Claude Code.

Dos jueces sin herramientas y sin saber qué modelo revisó: Opus por Claude Code y Sol por Pi.

## Resultado

| Revisor | Parte | Fallos encontrados | Avisos válidos (juez Opus · juez Sol) | Falsas alarmas | Mediana / máximo | Coste estimado |
|---|---|---:|---|---:|---:|---:|
| Sol | dev | 3/4 | 11/11 + 1 dudoso · 12/12 | 0 | 118 / 241 s | 1,39 $ |
| Opus | dev | 4/4 | 15/15 · 15/15 | 0 | 73 / 199 s | 3,79 $ |
| Sol | reserved | 3/4 | 10/10 · 9/10 | 0 · 1 | 92 / 204 s | 1,53 $ |
| Opus | reserved | 3/4 | 13/13 · 12/13 | 0 · 1 | 110 / 500 s | 5,06 $ |

En los 8 fallos conocidos, Sol encuentra 6 y Opus 7. La única diferencia es `nein-worker`, de `dev`: Sol no vio que el error del modelo se quedaba fuera del texto. Ninguno de los dos encontró `plan-fechas`, de `reserved`: el esquema zod nuevo acepta fechas imposibles. Los dos revisaron esa zona y señalaron otros fallos reales, pero no ese.

En `reserved`, los dos cumplen los umbrales de WORK.md:

- encuentran el 75 % de los fallos (umbral 70 %);
- entre el 90 y el 100 % de sus avisos son válidos (umbral 70 %);
- ninguna cita inválida llegó a enseñarse;
- ninguna revisión pasó de 10 minutos.

Opus estuvo cerca del límite de tiempo en `nein-receipts`: 500 s.

El coste es la estimación de cada herramienta al precio de la API. Con suscripción no se cobra aparte, pero consume cuota: la primera pasada de Opus por `reserved` se cortó al llegar al límite de sesión del plan de Claude y se completó después con `--resume`.

## Fiabilidad de la medición

- **Contaminación:** ninguna. Ningún revisor nombró los repositorios de origen, `evals/` ni las referencias en sus herramientas.
- **Jueces:** coinciden en los 16 fallos juzgados y en 47 de 50 avisos. De las tres discrepancias:
  - Dos son el mismo aviso de `ein-notice-fix`, señalado por los dos revisores. Es un caso límite sobre la frescura de una observación con error: el juez Opus lo da por válido y el juez Sol, por falsa alarma.
  - La tercera es un aviso de Sol en `nein-worker`: dudoso para el juez Opus y válido para el juez Sol.
- **Indulgencia:** los jueces casi nunca marcan un aviso como inválido. La precisión real necesita las valoraciones del usuario en la web (T9).
- **Tamaño:** con 4 fallos por parte, cada fallo pesa 25 puntos. La diferencia entre revisores es de un caso y no es concluyente.
- **Familia del autor:** los fallos reales los escribieron agentes distintos a lo largo del tiempo, así que no se puede atribuir cada caso a «misma familia» u «otra familia». Lo que se compara es Sol frente a Opus como revisores.
- **Sin ajustar:** `plan-fechas` es de `reserved`. No se ajusta el prompt para encontrarlo; si se quiere trabajar ese tipo de fallo (validación incompleta), se añaden casos nuevos a `dev`.

## Ejecuciones

En `~/.n_ein/dev/bench/previewer/`: `202610210952-sol-dev`, `202610211007-opus-dev`, `202610211019-sol-reserved` y `202610211032-opus-reserved`. El veredicto de cada juez está en `grade/` (Opus) y en `grade-pi_openai-codex_gpt-6-sol/` (Sol).
