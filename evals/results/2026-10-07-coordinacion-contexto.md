# Investigación acotada y reparto temprano: implementación y ensayo

## Resultado

Implementado un modo de lectura dentro del equipo existente, entrega de resultados al terminar cada hijo y pautas para repartir antes de explorar a fondo. Git, Pi real con proveedor determinista, permisos de herramientas, recuperación y parada comprobados. El banco con modelos muestra una reducción real del contexto al delegar lectura, con mayor latencia; no demuestra una mejora general que justifique activar el equipo automáticamente en la preview personal.

La revisión también detectó una insuficiencia en la aceptación de S3: el directo nuevo pasaba los tests, pero comunicaba un rechazo de negocio como un fallo de conexión. **No se considera una entrega equivalente en calidad a la paralela.** Se añadió una comprobación del consumidor y se conservaron los resultados originales.

## Lo que cambió

- `nein_team` admite lectura y escritura, con el mismo registro, sesiones, selección de modelos, cola y controles. Sin otro catálogo ni roles permanentes.
- Lectura: herramientas read/grep/find/ls/CodeGraph, sin bash/write/edit; no necesita WORK.md, árbol limpio, rama nueva ni primer commit. Observa archivos actuales y no regenera el índice compartido. No es una instantánea atómica del proyecto.
- Un lector tiene propiedad de proceso independiente del escritor, incluso si la carpeta configurada vive dentro de otro repositorio. Los escritores conservan su worktree. Cerrar y recuperar siguen usando el mismo mecanismo.
- Los hallazgos y el consumo se conservan; una investigación completa puede retomarse para una pregunta posterior. El principal recibe referencias y una síntesis acotada.
- En print el principal puede continuar con el primer resultado, sin esperar al último hijo. Se comprobó con Pi nativo y se observó también en el ensayo alojado.
- El reparto deja la investigación preparatoria con quien implementa. Los hallazgos relevantes se transmiten mediante resultados, `steer` y `resume`; no hay conversación automática entre todos ni consultas periódicas de estado.
- Después del ensayo se precisó la propiedad por comportamiento y consumidores, con exclusiones reales, y la revisión del error a través de su mensaje y acción de recuperación. Son mejoras de las instrucciones, sin una nueva medición alojada en esta tanda.

## Método y procedencia

Ocho ejecuciones, todas conservadas, sobre copias de `planificador-didactico`, base `28fe9a3bf2ba5e7a538500b12472319f8b54d62f`. Control `e74e6c0`; candidato medido `fc1bf6f`. Mismo modelo físico y esfuerzo en principal e hijos: `openai/gpt-6-sol`, medium. Código y binario de cada producto congelados por Git antes de ejecutar; variantes en serie y orden alternado donde correspondía.

Tres pares autónomos: cambio pequeño S6, encargo S3 y una investigación de seis peticiones en la misma sesión. **Ninguno abrió hijos.** Después, dos ensayos explícitos con el candidato: lectura mediante ayudante y S3 repartido en dos escritores. El segundo explicita T1/T2 y deja documentación e integración al principal: no acredita reparto autónomo.

La investigación compara alta de centros, comportamiento de Anexo IV y origen de Anexo III, con preguntas posteriores que reutilizan hallazgos. Se preserva una nota local sin commit y se comprueban HEAD, diff y status. Las respuestas se revisaron contra [criterios de fuente](../reserved/context-review.md), por el agente implementador, sin cegamiento. No se midió una sesión de varias horas ni compacción.

Tokens = entrada + salida + lecturas/escrituras de caché de todas las respuestas de principal e hijos. El pico del principal es la entrada reportada por el proveedor, incluida caché. El coste es estimación de catálogo observada, no factura ni cuota de suscripción. No incluye esta conversación de desarrollo ni cómputo local.

Datos completos: [JSON](2026-10-07-coordinacion-contexto.json). Trazas, sesiones, ramas, aceptación, respuestas y archivos de producto en `/Users/samu/Documents/01_Proyectos/n_ein-bench/logs/<id>/` y `copies/<id>/`. Los IDs aparecen en el JSON. En S6 posterior se resolvió la etiqueta `HEAD` desde el propio `product.tar` con `git get-tar-commit-id`; no se alteraron consumos ni tiempos.

## Resultados

Tiempo del agente, sin añadir la evaluación externa. Para implementación, el JSON también conserva el tiempo hasta los checks originales. La revisión posterior de mensajes no se incluye en ese tiempo.

| Caso | Ruta | Hijos | Segundos | Tokens totales | USD estimados | Calidad observada |
|---|---|---:|---:|---:|---:|---|
| S6 | Anterior, autónoma | 0 | 103,7 | 209.345 | 0,146 | 4/4, suite y tipos |
| S6 | Nueva, autónoma | 0 | 133,2 | 266.483 | 0,170 | 4/4, suite y tipos |
| S3 | Anterior, autónoma | 0 | 558,1 | 2.519.825 | 0,940 | 3/3 originales; 5/5 con diagnóstico de mensaje |
| S3 | Nueva, autónoma | 0 | 471,9 | 1.941.233 | 0,720 | 3/3 originales; **3/5** con diagnóstico de mensaje |
| Investigación | Anterior, autónoma | 0 | 362,7 | 3.335.131 | 1,097 | 9 criterios de fuente; árbol intacto |
| Investigación | Nueva, autónoma | 0 | 426,7 | 4.141.711 | 1,319 | 9 criterios de fuente; árbol intacto |
| Investigación | Nueva, lectura explícita | 2 | 560,3 | 3.003.368 | 1,171 | 8 criterios completos y 1 parcial; árbol intacto |
| S3 | Nueva, dos escritores explícitos | 2 | 665,8 | 4.770.509 | 1,748 | 3/3 originales; 5/5 con diagnóstico de mensaje |

Los tres S3 pasan suite, tipos y detección de ambos mutantes reservados. Esto no elimina el defecto adicional hallado en la UI. Total observado de la tanda: **7,310642 USD**, dentro de los 8 USD propuestos; ninguna ejecución se cortó por presupuesto. No se repitieron casos buscando un resultado favorable.

### Lectores: menos contexto, más espera

Frente a la nueva versión directa, delegar lectura reduce el total un **27,5 %**, el coste estimado un **11,2 %** y el pico del principal de **188.244 a 114.528 tokens** (−39,2 %). El principal procesa 2.135.459 tokens acumulados; los dos hijos añaden 867.909. El tiempo sube **31,3 %**. El principal investiga III directamente después de los dos lectores, reutilizando el contexto disponible.

Frente al control anterior, el total baja 9,9 %, pero el coste sube 6,7 % y el tiempo 54,5 %. Es importante conservar ambas comparaciones: el control nuevo directo no fue el más eficiente en este caso.

El criterio parcial es de precisión: se localiza `use-academia-contrato.ts`, pero no se explica, como en las dos ejecuciones directas, que su mapa tipado exhaustivo debe actualizarse al añadir un código. No se identificó una afirmación falsa; se conserva la reserva en vez de declarar equivalencia perfecta de calidad. El ahorro de contexto no justifica aceptar hallazgos sin comprobar premisas relevantes.

### Escritores: parte del coste corresponde a una entrega más completa

La comparación bruta con el nuevo directo arroja **+41,1 % tiempo**, **+145,7 % tokens** y **+143,0 % coste**. No mide un sobrecoste puro de comunicación: el directo deja sin resolver la explicación del rechazo al usuario, mientras el paralelo modifica ese consumidor y su prueba. Frente al control anterior, que también explica el rechazo, el paralelo sigue gastando y tardando más: +19,3 % tiempo y +86,0 % coste. Una sola observación y diferencias de implementación impiden atribuirlo todo a la topología.

Hallazgos concretos en las trazas:

- El coordinador tarda unos dos minutos en lanzar los escritores; las instrucciones nuevas no acreditan por sí solas un reparto temprano efectivo.
- T2 termina a las 08:54:08 UTC y se integra a las 08:54:22, antes de terminar T1 a las 08:56:31. La entrega temprana funciona y se aprovecha. El principal usa `start` una vez e `integrate` dos, sin polling.
- La asignación de T1 enumera archivos de forma restrictiva y omite `use-academia-contrato.ts`. El trabajador identifica el fallo de tipos y lo devuelve al coordinador como fuera de su alcance; también señala el texto de recuperación de `/acceso`. El principal termina esos cambios. Esto motivó la corrección de las pautas de propiedad, sin añadir otro mecanismo.
- El principal consume **2.226.331 tokens**, más que los 1.941.233 del directo nuevo completo. T1 consume 2.034.215 y T2 509.963. Coordinar aquí no descarga lo suficiente al principal.
- La suite final y tipos se ejecutan en serie, sin la carrera sobre `.nuxt` observada en el piloto anterior. Las ramas quedan integradas y los checks finales pasan.

### El hueco en la aceptación y su corrección

El directo nuevo usa `FORBIDDEN` para impedir el alta. El traductor real de `useAcademiaAlta` no trata ese código y devuelve «fallo de conexión o del servidor», invitando a reintentar sin cambiar de cuenta. El backend rechaza y los tres tests originales pasan, pero la experiencia es incorrecta.

Se añadieron dos casos al [test reservado](../reserved/s3-deudas/tests/api/zz-oculto-alta-centro.test.ts): obtener el rechazo real del handler ante curso propio o módulo asignado y pasarlo al traductor real del cliente. Debe explicar el impedimento de cuenta, sin convertirlo en avería. Sobre copias de evaluación: rojo 3/5 para el directo nuevo; verde 5/5 para el anterior y el paralelo. Se guardan `error-feedback.json` y su log por ejecución; los `grade.json` originales permanecen intactos. Son comprobaciones añadidas después de inspeccionar resultados, no criterios que estuvieran congelados desde el inicio.

## Comprobaciones de implementación

- Rojo/verde con Git real: lectura sin WORK.md y con cambios locales; ningún worktree ni commit creado. Después se cubrió también un repositorio sin primer commit.
- Pi real con proveedor determinista: dos lectores mientras el coordinador mantiene su bloqueo, herramientas de escritura/comandos no disponibles, intento de escritura rechazado, sesión nativa reanudada y consumo acumulado. Entrada por `nein_team` y entrega automática comprobadas desde el coordinador.
- Rojo/verde en print: reanudar T2 antes de terminar T1. Cola, integración, interrupción, EOF/SIGKILL, parada antes del relevo y lectura de estado conservados.
- `./scripts/check.sh` incluye estas pruebas, Go/test/vet, tipos estrictos contra Pi 1.0.2 y smoke del paquete. Los logs locales de este corte están en `/tmp/nein-context-*-check.log`.
- Revisión Spec: permisos, conservación de cambios, lectura sin preparativos de escritura, continuidad y entrega temprana cubiertos; la elección autónoma y la rentabilidad general no quedan demostradas. Se corrigió la restricción indebida del primer commit.
- Revisión Standards: un mecanismo y un catálogo, instrucciones de producto sin nombres personales o de terceros, modelos existentes, logs fuera de stdout RPC. Sin nuevos servicios ni dependencia de producción.

El banco aloja `fc1bf6f`; `61cf7ba` añade después la corrección del repo sin commit, la propiedad por comportamiento y la revisión de mensajes. Esas correcciones tienen comprobación local, no una segunda tanda alojada.

## Candidato comprobado desde el archivo

Versión `0.1.0-preview.2+hotfix.00dab7096225`, fuente `00dab7096225c16183c06dbdca2675ab8d278bf9`. `./scripts/check.sh` completo pasa con las correcciones finales; log `/tmp/nein-context-release-check.log`.

[Tarball macOS arm64](../../dist/releases/n-ein-0.1.0-preview.2+hotfix.00dab7096225-darwin-arm64.tar.gz), SHA-256 `9464833e443d825fe914209ffba0ef8eae5f3d5852d8514370d809a0c6a594b5`.

Extraído e instalado en `dist/context-review-00dab7096225/preview`. Desde esa instalación pasan `tests/agents-read.ts` y `tests/team-pi.ts`: permisos de lectura, coordinador real, conservación de cambios, reanudación, proyecto sin primer commit, entrega temprana, integración y parada de ambos escritores antes de relevar. El proveedor es determinista: no son nuevas ejecuciones alojadas ni prueba de Claude real. Doctor verifica 72 archivos (70 entradas en el manifiesto más los metadatos). La preview personal continúa en `0.1.0-preview.2+hotfix.3bc9b8006cc0`.

## Decisión

Conservar el candidato como experimento revisable y mantener la preview personal anterior. No convertir el paralelismo en un paso obligatorio ni bajar la calidad para mejorar la cifra de coste. Los datos apoyan disponer de lectores para contener contexto y de escritores para frentes independientes, pero no una promoción automática general con este corpus.

Un siguiente ensayo útil usaría encargos más largos con dependencia e integración definidas, y compararía entregas que también pasan la comprobación de mensajes, con repeticiones y revisión independiente. No se ejecutó en esta tanda ni se comparó directamente con Gentle. El relevo completo Pi→Claude→Pi con proveedor real continúa pendiente del corte anterior; las comprobaciones de transporte y parada con destino controlado no lo sustituyen.
