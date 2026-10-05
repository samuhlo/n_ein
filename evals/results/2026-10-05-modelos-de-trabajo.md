# Modelos de trabajo: n_ein frente a Gentle Shell, Matt y sin arnés

Ejecución del [plan del 5 de octubre](../plans/2026-10-05-modelos-de-trabajo.md):
- 52 ejecuciones con modelo y 6 tandas de revisión a ciegas;
- unas 11 horas de agente;
- 42 USD de estimación de catálogo (no es lo facturado).

S4b (relevo a Claude) no se ejecutó.

## Montaje

- **Común:** Pi 1.0.2 con `gpt-6-sol` medium en todos los roles, salvo N1L. Copias de `planificador-didactico` sin historia ni `.env`, `HOME` aislado por ejecución, `origin` bare para detectar push, y todo en `/Users/samu/Documents/01_Proyectos/n_ein-bench/`.
- **Productos fijados:** n_ein `f081841`, Gentle Shell `0da07ce9` (sobre el paquete 4.0.0) y Matt `24fe0ef`.
- **Código del banco:** `evals/bench/`. Aceptación oculta: `evals/reserved/`.
- **Variantes:**
  - A: Pi sin arnés;
  - N1: n_ein con `WORK.md`;
  - N1L: N1 con los roles por defecto de n_ein (scout y worker en Luna);
  - N2: n_ein con el formato de Gentle (Specs con citas literales, Tasks, Log);
  - N3: n_ein con `work/<tarea>/spec.md`, `tasks.md` y `log.md`;
  - G: Gentle Shell;
  - GE: Gentle con Engram;
  - M: skills de Matt (`to-spec` → `to-tickets` → `implement`);
  - C: Codex CLI sin arnés.
- **Escenarios:**
  - S1: bug del Anexo IV;
  - S2: Anexo III desde la planificación guardada, en servidor y cliente;
  - S3: tres deudas de `estado-actual.md`;
  - S4a: S3 cortado a la mitad del tiempo medio de cada variante y retomado en una sesión nueva con «Continúa el trabajo pendiente.».
- **Medidas:** dos repeticiones por celda.
  - Coste: recalculado con la tarifa de catálogo de Pi por modelo.
  - Juez: Claude Opus, sin herramientas, con los diffs anonimizados y barajados, más una referencia limpia y un control con un defecto sembrado.

## Comprobado

### S1 · bug pequeño

| Variante | Coste | Tiempo | Oculta | Commits | Hijos |
|---|---:|---:|---|---:|---:|
| A | $0,14 | 143 s | 24/26 · 24/26 | 0 | 0 |
| N1 | $0,36 | 357 s | 24/26 · 24/26 | 1 · 1 | 2 · 2 |
| G | $0,20 | 276 s | 26/26 · 24/26 | 0 | 0 |
| M | $0,13 | 126 s | 24/26 · 24/26 | 0 | 0 |
| C | $0,06 | 122 s | 24/26 · 26/26 | 0 | 0 |

Todas arreglan el bug; T10b y T11b, que miden si se avisa cuando también falla el marcado, los pasa una vez G y otra C. n_ein cuesta 2,6 veces más que A con la misma aceptación: en un bug de un archivo lanza dos revisiones delegadas cada vez.

### S2 · medio

| Variante | Coste | Tiempo | Oculta | Tests rotos | Juez | Commits | Documento |
|---|---:|---:|---|---|---|---:|---|
| A | $0,44 | 423 s | 14/14 · 14/14 | 0 · 0 | 19 · 14 | 0 | — |
| N1 | $1,48 | 1190 s | 9/14 · 14/14 | 0 · 0 | 11 · 21 | 6 · 5 | `WORK.md` |
| N1L | $1,54 | 2438 s | 14/14 · 12/14 | 0 · 0 | 12 · 12 | 5 · 5 | `WORK.md` |
| N2 | $1,64 | 1226 s | 14/14 · 14/14 | 4 · 0 | 13 · 19 | 4 · 4 | `WORK.md` |
| N3 | $2,04 | 1513 s | 14/14 · 14/14 | 4 · 0 | 14 · 19 | 5 · 4 | `work/…` |
| G | $1,12 | 947 s | 14/14 · 14/14 | 0 · 0 | 21 · 19 | 0 | — |
| M | $1,17 | 1292 s | 14/14 · 14/14 | 0 · 0 | 19 · 18 | 1 · 1 | `.scratch/…` |
| C | $0,50 | 359 s | 14/14 · 14/14 | 0 · 4 | 22 · 15 | 0 | — |

Controles del juez en las tres tandas de S2: referencia 17, 17 y 17; defecto sembrado 11, 12 y 11, siempre con bloqueantes.

- G (40) y M y C (37) quedan por delante de n_ein (N1 32, N2 32, N3 33, N1L 24).
- La documentación de n_ein puntúa 1–2 de 5 en las ocho ejecuciones; la de G, 5 de 5 en las dos.
- N1 r1 dejó sin cambiar la ruta JSON y el panel. N1L r1 rompió la carga del módulo de exportación; N1L r2 dejó el panel sin cambiar. N2 r1 y N3 r1 cerraron con 4 tests en rojo, igual que C r2.

### S3 · grande

| Variante | Coste | Tiempo | Oculta | Juez | Test montado (mutantes) | Commits | Documento |
|---|---:|---:|---|---|---|---:|---|
| A | $0,29 | 312 s | 3/3 · 3/3 | 17 · 15 | 1/2 · 1/2 | 0 | — |
| N1 | $1,35 | 1180 s | 3/3 · 3/3 | 19 · 15 | 2/2 · 2/2 | 5 · 3 | `WORK.md` |
| N1L | $0,79 | 904 s | 3/3 · 3/3 | 19 · 18 | — | 5 · 4 | `WORK.md` |
| N2 | $1,43 | 1610 s | 3/3 · 3/3 | 19 · 15 | 2/2 · 2/2 | 5 · 5 | `WORK.md` |
| N3 | $1,27 | 1012 s | 3/3 · 3/3 | 24 · 24 (20 al rejuzgar) | 2/2 · 2/2 | 4 · 5 | `work/…` |
| G | $0,75 | 688 s | 3/3 · 3/3 | 18 · 18 | 1/2 · 1/2 | 0 | — |
| GE | $0,84 | 948 s | 3/3 · 3/3 | 15 · 16 | 2/2 · — | 0 | Engram |
| M | $0,44 | 464 s | 1/3 · 1/3 | 13 · 5 | 1/2 · — | 1 · 0 | `.scratch/…` · — |
| C | $0,31 | 265 s | 3/3 · 3/3 | 17 · 18 | 1/2 · 1/2 | 0 | — |

- **N3 es la mejor en S3 en las dos repeticiones.** Los tres n_ein escriben el test montado más fuerte: matan los dos mutantes cuando el resto solo mata uno.
- **Matt:** en r1 resolvió el alta con un trigger de base de datos, que la aceptación oculta no ve (por eso 1/3) y que el juez considera fuera de alcance. En r2 se detuvo en `to-spec` a pedir confirmación y no entregó nada: su recorrido necesita a alguien que conteste.
- **Gentle no crea `odd/tasks` ni en S2 ni en S3.** Su regla de «se puede retomar con la petición y el diff» los clasifica como trabajo pequeño.

### S4a · cortar y retomar

| Variante | Corte | Retomar: coste y tiempo | Al retomar… | Final |
|---|---:|---|---|---|
| N1 | 600 s | $0,66 · 728 s | Lee `WORK.md` y cierra T1–T3 con 4 commits. | 3/3, test montado, documento corregido |
| N3 | 511 s | $0,90 · 1098 s | Lee `spec.md`, `tasks.md` y `log.md` y cierra las tres entregas con 5 commits. | 3/3, montado, documento corregido |
| M | 632 s | $0,31 · 386 s | Lee su spec en `.scratch/` y termina. | 3/3, montado, documento corregido |
| N2 | 807 s | $0,07 · 69 s | `WORK.md` marcaba T1 pendiente con su commit ya hecho (el corte cayó entre ambos). Pregunta, como manda su regla. | Parada |
| A | 157 s | $0,17 · 422 s | Termina el alta y **devuelve el test del Anexo IV a lectura de texto**, como si el cambio fuera un error. | Documento sin corregir |
| C | 137 s | $0,24 · 217 s | Termina lo que ve en el diff. | Test de texto, documento sin corregir |
| G | 351 s | $0,26 · 214 s | «¿Es ese el trabajo que quieres que continúe?» | Parada, 2/3 |
| GE | 476 s | $0,23 · 227 s | «La memoria de la sesión anterior no está disponible». Pregunta qué alcance seguir. | Parada |

**Sin documento, nadie recupera el encargo completo.** Las cuatro variantes sin documento perdieron dos de las tres entregas (el test montado y el documento) o se pararon.

El fallo de Engram en GE se debe a mi montaje: la reanudación arrancó un servidor de Engram en otro puerto. No demuestra nada sobre Engram en uso normal.

### Coste de cada variante frente a A

| Escenario | n_ein (N1–N3) | Gentle | Matt | Codex |
|---|---:|---:|---:|---:|
| S1 | 2,6× | 1,4× | 0,9× | 0,4× |
| S2 | 3,4–4,6× | 2,5× | 2,7× | 1,1× |
| S3 | 4,4–4,9× | 2,6× | 1,5× | 1,1× |

En tiempo, n_ein tarda entre 2,5 y 5 veces más que A. Los tiempos están inflados por la carga de la máquina, pero esa carga es igual para todas las variantes de una misma tanda.

## Lo que esto dice de n_ein

1. **Documento: sí, para trabajo de varias entregas.** Es lo que permite retomar (S4a). Un archivo (N1) y varios (N3) retoman igual de bien. N3 sale mejor en la revisión de S3, pero es la más cara en S2. El formato de Gentle (N2) no mejora nada y su orden «commit primero, marca después» provocó la parada al retomar. **Recomiendo mantener `WORK.md`** y repetir N3 antes de cambiar nada.
2. **Engram: no compensa aquí.** GE cuesta más que G, puntúa menos y no retomó mejor. Lo último, con la reserva de mi montaje.
3. **Trabajo pequeño: n_ein le añade coste y no le añade calidad.** El 2,6× de S1 sale de las revisiones delegadas en un bug de un archivo.
4. **Delegación: es el principal origen del coste.** Con el mismo modelo en todos los roles, cada revisión o trabajo delegado cuesta casi lo mismo que hacerlo en línea, y n_ein delega en todos los encargos: de 2 a 9 hijos. Con trabajadores Luna (N1L), S3 baja un 41 % ($0,79 frente a $1,35) con la misma nota. En cambio, S2 tarda el doble y empeora (12 y 12 de nota, un bloqueante). Gentle llegó a lo mismo en su banco y desactivó delegar por precio el 4 de octubre.
5. **Documentación del repo:** n_ein no actualiza la documentación afectada (1–2 de 5); Gentle sí (5 de 5).

## Hipótesis

- Quitar la revisión delegada automática en trabajo pequeño y medio acercaría n_ein al coste de G sin perder lo que sí aporta: rama, commits por tarea, tests fuertes y `WORK.md` para retomar.
- Actualizar `WORK.md` (marca y evidencia) en el mismo commit de la tarea evitaría la parada de N2 al retomar.
- Una línea en el flujo para actualizar la documentación afectada corregiría la puntuación de documentación. Es lo que hizo Gentle tras su banco.
- El 24/24 de N3 en S3 puede ser ruido: el juez varía unos ±4 puntos con la misma propuesta según la tanda.

## Fallos del banco

- **Edité `run.sh` con ejecuciones en marcha y bash lo lee sobre la marcha.** Cinco ejecuciones de S2 r2 se recuperaron con sus marcas de tiempo (`"recovered": true`) y M se repitió. Desde entonces el banco usa copias congeladas.
- **Dos tests ocultos dependían de la implementación:** el del cliente (corregido; ahora acepta `$fetch.raw`) y el del alta, que no ve un trigger en la base de datos.
- **Las suites corregidas en paralelo daban timeouts falsos.** Todo se recorrigió al final en serie.
- **El analizador valoraba a los hijos Luna con la tarifa de Sol.** Ahora usa la estimación de catálogo de cada hijo.
- **Credenciales.** El token de OpenAI se invalidó a las 12:30: el cambio de plan de la cuenta invalida las sesiones. El primer login nuevo salió con plan `free`, que solo admite Luna. El banco usa ahora su propio login, en `n_ein-bench/auth/`. Las ejecuciones afectadas se descartaron.
- **Un arranque de Pi colgado** se evita con `PI_OFFLINE=1` y `stdin` cerrado.

## Pendiente

- S4b: relevo del artefacto a Claude.
- Repetir N3 frente a N1 en otros encargos grandes.
- Aplicar y medir los tres cambios propuestos (revisión delegada, commit con `WORK.md`, documentación) con una tanda corta de S2 y S3.
- CodeGraph: solo lo usan las variantes N, y Gentle informó de que no estaba disponible. Su efecto no se ha aislado.
