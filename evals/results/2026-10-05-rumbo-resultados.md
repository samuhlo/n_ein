# Rumbo nuevo: n_ein ligero con un modelo por encargo

Ejecución de las fases 1–4 del [rumbo](../../docs/09-rumbo.md) el 5 de octubre de 2026, sobre el mismo banco del [informe anterior](2026-10-05-modelos-de-trabajo.md).

- **Fase 2:** 51 ejecuciones nuevas.
- **Fase 4:** 16 de los rivales en S5 y S6, 14 de la variante final NR (incluida su S4a) y 8 tandas del juez.
- **Coste:** estimación de catálogo, con la tarifa de cada modelo (Luna cuesta 20 veces menos que Sol); no es lo facturado.

## Qué se construyó

| Commit | Cambio |
|---|---|
| `4672f04` | Flujo sin roles. Lista de lo pedido; `WORK.md` en el mismo commit que la tarea; documentación al día; cierre con «dónde mirar y cómo comprobarlo» y línea de riesgo; skill `review` en línea, con sondas por petición, severidad y una sola ronda de corrección. Roles tras `N_EIN_ROLES=1`. |
| `a5f856a` | `nein/auto`: modelo virtual de Pi que clasifica la primera petición por reglas y mantiene el modelo todo el encargo; solo sube de clase. Incluye `nein_escalate`, `/nein:modo` y el prefijo `[luna]`/`[sol]`/`[sol high]`. |
| `c44a97a`, `64c981e` | Panel `/nein:models`, banner y launcher con la tabla de enrutado; `router.ts` dentro del paquete instalable. |
| `5035770` | Persona: lo que se alcanza por una cadena (rutas HTTP, eventos, claves) no está en el grafo y se busca también con `rg`. |
| `0e852d6` | Lo mecánico en Luna high; el cierre exige el commit de cada tarea. |

**Tabla final:**

| Clase | Ejemplos | Modelo |
|---|---|---|
| Mecánico | Documentación, textos, estilos, interfaz sin lógica | Luna high |
| Ordinario | Funcionalidad acotada, bug con test | Sol medium |
| Riesgo | Datos, usuarios, permisos, contratos, concurrencia, despliegue | Sol high |
| Abierto | Decisiones sin cerrar | Sol high |

## Comprobado

### Clasificación (fase 3)

Las reglas aciertan:
- 36 de 36 en las peticiones con las que se ajustaron (30 de commits reales de planificador, berro, ein-agent y n_ein, más los seis encargos del banco);
- **13 de 15 en un conjunto de control** etiquetado antes de clasificar.

Ningún encargo de riesgo fue a un modelo barato; los dos fallos van hacia el caro. `tests/router.ts` lo fija.

### ¿Dónde basta Luna? (fase 2)

n_ein ligero (N0) en los cuatro modelos, juzgado en la misma tanda con la nueva dimensión de revisabilidad (sobre 30):

| Clase | Escenario | Luna medium | Luna high | Sol medium | Sol high | Pi sin arnés (Sol medium) |
|---|---|---|---|---|---|---|
| Ordinario | S1 | 20 · 16 | — | **29 · 26** | 23 · 22 | 24 · 18 |
| Riesgo | S2 | 12 · 13 | — | 24 · 15 | **27 · 22** | 23 · 22 |
| Riesgo | S3 | 15 · 15 | — | 24 · 21 | **23 · 29** | 23 · 19 |
| Mecánico | S5 | 22 · 23 | **27 · 24** | 27 · 25 | — | — |
| Mecánico | S6 | 20 · 28 | **27 · 24** | 27 · 27 | — | — |

Los controles de S2 se mantuvieron en todas las tandas: referencia 16–17, defecto sembrado 12 con 2–3 bloqueantes.

- **Luna no sirve para lo que tiene riesgo:** deja partes sin hacer. En S2 saca 9/14 y 11/14 en la aceptación oculta.
- **En lo mecánico, Luna high queda a un punto de Sol medium** por una doceava parte del coste.
- **Sin CodeGraph (N0SNC), S2 sale 14/14 las dos veces.** Las dos ejecuciones con Sol que fallaron S2 nunca vieron el segundo cliente, que llama al endpoint con una cadena. De ahí el cambio de `5035770`.
- **Sin el paso de revisión (N0SNR)** las notas son parecidas; en S2 r2 usó el esquema v1 y rechazaría todos los cursos nuevos.

### Variante final NR frente a los rivales (fase 4, misma tanda del juez)

| Escenario | NR | Mejor N0 | Pi sin arnés | Gentle | Codex |
|---|---|---|---|---|---|
| S1 | **30 · 29** | 29 · 24 | 24 · 19 | 21 | 21 |
| S2 | **29 · 30** | 28 · 21 | 24 · 21 | 25 | 24 |
| S3 | 23 · 23 | 24 · 22 | 22 · 19 | 19 | 20 |
| S5 | 25 · 23 | 26 · 22 | **26 · 25** | 21 | 25 |
| S6 | **29 · 27** | 29 · 25 | 28 · 28 | 27 | 27 |

**Aceptación oculta de NR:**

| Escenario | Resultado |
|---|---|
| S1 | 24/26 en las dos (como todas las variantes salvo una ejecución de G y otra de C) |
| S2 | 14/14 en las dos |
| S3 | 3/3 en las dos; el test montado mata 2/2 mutantes; documento corregido |
| S5 | 16/16 |
| S6 | 4/4 |

Ningún test de la suite queda en rojo y el typecheck pasa siempre.

**S4a de NR:** cortado a 291 s, retoma leyendo `WORK.md` y cierra las tres entregas con un commit más. Reanudar cuesta $0,37 (N1 $0,66, N3 $0,90). Termina con aceptación 3/3, documento corregido y test montado.

### Coste y tiempo

| Variante | Mecánico | Ordinario | Riesgo | Mezcla real* | Tiempo medio |
|---|---:|---:|---:|---:|---:|
| **NR** | **$0,007** | $0,37 | $1,11 | $0,52 | 382 s |
| Pi sin arnés | $0,062 | $0,14 | $0,37 | $0,20 | 205 s |
| Gentle | $0,21 | $0,20 | $0,93 | $0,47 | 467 s |
| Codex | $0,10 | $0,06 | $0,40 | $0,20 | 187 s |
| n_ein de antes (N1) | $0,15 | $0,36 | $1,42 | $0,68 | 612 s |

\* La mezcla pondera 10 encargos mecánicos, 9 ordinarios y 11 de riesgo, la proporción de las 30 peticiones reales.

- **NR cuesta un 24 % menos que el n_ein de antes** y tarda un 38 % menos.
- **Frente a Pi sin arnés:** lo mecánico cuesta la novena parte, pero lo de riesgo 3 veces más. **El objetivo de «como mucho 1,3 veces Pi sin arnés» no se cumple:** la mezcla sale a 2,6 veces.
- **De dónde sale el gasto en riesgo:** de Sol high y del método (tests, documentación, commit, `WORK.md`). Bajar el riesgo a Sol medium abarata, pero empeora la nota (S2: 19,5 frente a 24,5).

## Hipótesis

- La búsqueda por texto de `5035770` explica el 14/14 de NR en S2, donde N0 con CodeGraph fallaba una de cada dos. Con dos muestras es un indicio, no una prueba.
- **S1 escaló de Sol medium a Sol high en las dos ejecuciones**, porque escribe un estado guardado. La lista de riesgo podría limitarse a «cambiar o borrar datos que ya existen», como hizo Gentle; abarataría lo ordinario sin perder seguridad. No se ha probado.
- **El juez varía unos ±4 puntos** con la misma propuesta según la tanda. Por eso cada comparación se hace dentro de una misma tanda.

## Fallos del banco en esta ronda

- **Tres falsos negativos de mi aceptación**, corregidos y recorregidos para todas las variantes:
  - el alta de S3 hecha con SQL directo, que la base falsa no veía;
  - dos veces, la comprobación del documento de S3, que confundía «no está en gris» y «lo que sigue en gris son las tarjetas» con el botón.
- **N0SNR r2 en S2 no era un falso negativo:** usó el esquema v1, que rechaza el `municipioId` de los snapshots v2.
- **Hice un commit con `check.sh` en rojo** (`c44a97a`, faltaba `router.ts` en el paquete) y lo arreglé en `64c981e`.
- **El producto NR recibió a mitad de su tanda** el cambio de Luna high y el commit obligatorio en el cierre. Las ejecuciones de S5 y S6 que usaron Luna medium se repitieron.

## Pendiente

- Retirar el código de los roles (`agents.ts`, sus tests y los campos de `runtime.json`), que ya no usa ningún recorrido.
- Probar la lista de riesgo más estrecha en S1.
- Instalar en la preview y usarlo en un proyecto real (fase 5). Hace falta login en los hogares de n_ein, cuyo token quedó invalidado.
- Claude sigue con su modelo y su esfuerzo; la tabla de enrutado no le aplica.

## 6 de octubre: lista de riesgo y retirada de los roles

**Roles retirados** (`3e27d03`):
- se borran la extensión `agents.ts` y su test, los roles de `runtime.json`, del panel, del banner y del launcher, y el modo `N_EIN_WORKER_CHILD`;
- el lanzador lee cuatro campos de `models.ts`;
- `./scripts/check.sh` pasa.

**Lista de riesgo.** S1 escalaba siempre a Sol high porque escribe un estado guardado. Se probaron tres versiones de la lista, cada una en la misma tanda del juez:

| Variante | Qué cambia | S1, notas sobre 30 | Coste medio |
|---|---|---|---|
| NR | Lista amplia para la revisión y para el escalado | 28 · 29 · 26 · 23 · 27 (media 26,6) | $0,38 |
| NR2 (`fcfb31c`) | Lista estrecha para las dos | 22 · 23 y 20 · 19 en dos tandas | $0,17 |
| **NR3 (`1ac6059`)** | Revisión con la lista amplia, escalado con la estrecha | 25 · 24 · 27 · 29 · 24 (media 25,8) | **$0,31** |

- **Lo que sostiene la calidad es la revisión, no Sol high.** NR2, sin revisión, pierde documentación y tests. NR3 iguala a NR (0,8 puntos de diferencia, dentro del ruido del juez) por un 18 % menos.
- **NR3 escala S1 de todas formas**, con un motivo que sí está en la lista estrecha («cambia el estado persistido de certificados existentes»).
- **S3b, prueba de seguridad:** las deudas pedidas con una frase vaga, que el enrutador clasifica como mecánica por la palabra `docs`.
  - En las tres ejecuciones (NR2 ×2, NR3 ×1) el agente empezó en Luna high y **escaló solo a Sol high antes de escribir**, con motivos concretos (permisos de alta de cuentas, fuente de las exportaciones).
  - Aceptación oculta del alta: 3/3.
- **S2 con NR2:** 14/14, en Sol high desde la primera petición.

**Pendiente:**
- **Actualizar la documentación afectada solo ocurre en algo más de la mitad de las ejecuciones** (los cierres que no lo hacen se puntúan con 2 de 5 en documentación). Es la deducción más frecuente que queda.
