# Modelos de trabajo: resultados parciales

Ejecución del [plan del 5 de octubre](../plans/2026-10-05-modelos-de-trabajo.md) hasta que el token de OpenAI Codex quedó invalidado a las 12:30, a mitad de S3 r2. Cuarenta ejecuciones válidas. Las de S3 r2, salvo A, se descartaron.

## Montaje

- **Común:** Pi 1.0.2, `gpt-6-sol` medium en todos los roles. Copias de `planificador-didactico` sin historia ni `.env`, `HOME` aislado por ejecución, `origin` bare para detectar push, y todo en `/Users/samu/Documents/01_Proyectos/n_ein-bench/`.
- **Productos fijados:** n_ein `f081841`, Gentle Shell `0da07ce9` (sobre el paquete `gentle-pi` 4.0.0) y Matt `24fe0ef`.
- **Código del banco:** en `evals/bench/`; la aceptación oculta, en `evals/reserved/`.
- **Coste:** se recalcula para todas las variantes con la tarifa de catálogo de Pi para `gpt-6-sol` (2 / 10 / 0,2 USD por millón de entrada, salida y caché). Es una estimación, no lo facturado.
- **Variantes:**
  - A: Pi sin arnés;
  - N1: n_ein con `WORK.md`;
  - N2: n_ein con el formato de Gentle (Specs, Tasks, Log);
  - N3: n_ein con varios archivos;
  - G: Gentle Shell;
  - GE: Gentle con Engram;
  - M: skills de Matt (spec, tickets e implementación);
  - C: Codex CLI sin arnés.

## Comprobado

Media de las repeticiones válidas (n = 2, salvo S3 con n = 1, y A con n = 2).

| Escenario | Variante | Coste | Tiempo | Tokens | Oculta | Commits | Documento |
|---|---|---:|---:|---:|---|---:|---|
| S1 bug | A | $0,14 | 143 s | 251k | 24/26 · 24/26 | 0 | — |
| | N1 | $0,36 | 357 s | 704k | 24/26 · 24/26 | 1 | — |
| | G | $0,20 | 276 s | 504k | 26/26 · 24/26 | 0 | — |
| | M | $0,13 | 126 s | 261k | 24/26 · 24/26 | 0 | — |
| | C | $0,06 | 122 s | 153k | 24/26 · 26/26 | 0 | — |
| S2 medio | A | $0,44 | 423 s | 1,37M | 14/14 · 14/14 | 0 | — |
| | N1 | $1,48 | 1190 s | 3,77M | 9/14 · 14/14 | 6 · 5 | `WORK.md` |
| | N2 | $1,64 | 1226 s | 4,57M | 14/14 · 14/14 | 4 · 4 | `WORK.md` |
| | N3 | $2,04 | 1513 s | 5,36M | 14/14 · 14/14 | 5 · 4 | `work/…` |
| | G | $1,12 | 947 s | 3,55M | 14/14 · 14/14 | 0 | — |
| | M | $1,17 | 1292 s | 3,72M | 14/14 · 14/14 | 1 | `.scratch/…` |
| | C | $0,50 | 359 s | 1,53M | 14/14 · 14/14 | 0 | — |
| S3 grande | A | $0,29 | 312 s | 814k | 3/3 · 3/3 | 0 | — |
| | N1 | $1,55 | 1352 s | 3,73M | 3/3 | 5 | `WORK.md` |
| | N2 | $1,26 | 1201 s | 3,04M | 3/3 | 5 | `WORK.md` |
| | N3 | $1,28 | 1098 s | 3,03M | 3/3 | 4 | `work/…` |
| | G | $0,79 | 698 s | 2,43M | 3/3 | 0 | — |
| | GE | $0,89 | 801 s | 2,65M | 3/3 | 0 | Engram |
| | M | $0,74 | 815 s | 2,01M | 1/3 (trigger en BD, ver abajo) | 1 | `.scratch/…` |
| | C | $0,31 | 286 s | 694k | 3/3 | 0 | — |

**Coste y tiempo.** n_ein es la variante más cara y lenta en los tres escenarios:

| Escenario | n_ein frente a A (coste) | n_ein frente a A (tiempo) | Gentle frente a A (coste) | Matt frente a A (coste) |
|---|---:|---|---:|---:|
| S1 | 2,6× | 2,5× | 1,4× | ≈ 1× |
| S2 | 3,4–4,6× | 2,8–3,6× | 2,5× | 2,7× |
| S3 | 4,3–5,3× | 3,5–4,3× | 2,7× | 2,5× |

Codex sin arnés es la más barata. Los tiempos están inflados por la carga de la máquina (hasta 33 de carga con 10 núcleos), pero esa carga afecta a todas las variantes de una misma tanda.

**Qué paga n_ein.** Todas sus ejecuciones delegan, aunque todos los roles usan el mismo modelo:
- S1: 2 revisiones;
- S2: entre 3 y 9 hijos (reviewer, worker, scout);
- S3: entre 5 y 7 hijos.

Además trabaja en rama con un commit por tarea y crea su documento de trabajo. A, Codex y Gentle no crean rama ni hacen commit; Matt, uno al final de `implement`.

**Corrección.** La aceptación oculta apenas separa a las variantes. Todas pasan casi todo, con dos excepciones:
- N1 r1 en S2 dejó sin cambiar la ruta JSON y el panel de documentos (9/14).
- N2 r1 y N3 r1 en S2 cerraron con 4 tests de la suite en rojo (`anexo3-publication-gate.test.ts`).

**Revisión a ciegas** (Claude Opus, 0–25). Los controles se mantuvieron estables en las dos tandas de S2: la referencia sacó 17 y 17; el defecto sembrado, 11 y 12, con 2–3 bloqueantes.

| Variante | S2 r1 | S2 r2 | S2 total | S3 r1 |
|---|---:|---:|---:|---:|
| G | 21 | 19 | **40** | 18 |
| M | 19 | 18 | 37 | 13 |
| C | 22 | 15 | 37 | 17 |
| A | 19 | 14 | 33 | 17 |
| N3 | 14 | 19 | 33 | **24** |
| N1 | 11 | 21 | 32 | 19 |
| N2 | 13 | 19 | 32 | 19 |
| GE | — | — | — | 15 (rechaza de más) |

- La documentación de n_ein se puntuó con 1 o 2 de 5 en las seis ejecuciones de S2; la de Gentle, con 5 de 5 las dos veces.
- En S3 los tres n_ein escribieron el test montado más fuerte: mató los 2 mutantes en los tres casos. A, G, M y C, solo 1 de 2.

**Documento de trabajo.**
- n_ein crea siempre su documento en S2 y S3.
- Gentle no crea `odd/tasks` ni en S2 ni en S3: su regla de «se puede retomar con el diff» clasifica ambos como trabajo pequeño.
- GE guardó en Engram (`mem_save` y `mem_session_summary`).
- Matt dejó la spec en `.scratch/` (9 KB).

**CodeGraph.** Solo las variantes N lo usan, siempre en la primera llamada. El explorador de Gentle informó «CodeGraph was not available in this session».

## Fallos del banco (corregidos o registrados)

- **Edité `run.sh` con ejecuciones en marcha y bash lo lee sobre la marcha.** Cinco scripts de S2 r2 murieron tras terminar su agente; sus metadatos se reconstruyeron con las marcas de tiempo (`"recovered": true`) y M se repitió entera. Desde entonces el banco ejecuta copias congeladas en `n_ein-bench/scripts/`.
- **Test oculto del cliente demasiado estricto.** Solo vigilaba `$fetch`, y M usaba `$fetch.raw`. Se corrigió y se recorrigió S2.
- **Aceptación del alta de centro dependiente de la implementación.** M lo resolvió con un trigger en la base de datos, que el mock no ve. Esa parte la decide el juez.
- **Suites corregidas en paralelo con timeouts falsos.** Ahora se corrige en serie. Las ejecuciones corregidas antes no tienen `suiteFailed` (salen como «?»); la recorrección final en serie lo completará.
- **Token de OpenAI invalidado a las 12:30**, a la vez en Pi y en Codex CLI. No sé la causa: el token no estaba caducado (expira el 9 de octubre) y ninguna copia lo renovó. Se pararon todas las ejecuciones y se descartaron las afectadas.

## Hipótesis

- **El sobrecoste de n_ein viene de su regla de delegación y revisión, no del documento.** N1, N2 y N3 cuestan parecido. Lo que dispara el gasto son las revisiones `nein-reviewer` en cada tarea, que con el modelo uniforme cuestan tanto como trabajar. El bloque N1L (roles baratos) lo comprobará.
- **El formato del documento no cambia el resultado mientras se trabaja** (H2): N2 y N3 no se separan de N1 en coste ni en aceptación. Lo que decida entre ellos tendrá que salir de S4 (retomar).
- **El trabajo pequeño de Gentle y el de A son equivalentes en resultado.** El método de n_ein añade calidad en los tests de S3, pero no en S2.

## Pendiente

- S3 r2 de siete variantes.
- S4a: cortar y retomar.
- S4b: relevo a Claude.
- Bloque de delegación N1L.
- Juez de S3 r2.
- Recorrección final en serie.
- Informe con la decisión sobre los cinco puntos del plan.
