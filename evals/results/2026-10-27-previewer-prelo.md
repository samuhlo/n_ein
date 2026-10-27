# p_reviewer: banco de diez PR encadenadas de Prelo

Fecha: 27 de octubre de 2026. Rama de trabajo: `feat/previewer-prelo-bench`. Fuente inicial de n_ein: `ea2d09a`; correcciones en `799aef8` y `e48a738`. Prelo termina intacto en `4bdf1e0`: no se han aplicado arreglos, publicado comentarios, hecho push ni actualizado la instalación personal de n_ein.

## Resultado observado

Se completaron **20 revisiones comparables**: las diez PR con el prompt original y otras diez con la candidata, siempre con `openai-codex/gpt-6.1-sol`, esfuerzo alto, Pi 1.0.2 y CodeGraph 1.6.1. Las bases y heads siguen coincidiendo con GitHub al comprobarlos al cierre. Las dos pasadas conservan intactos el estado y las referencias del repositorio original.

| Medida | Línea base con índice correcto | Candidata |
|---|---:|---:|
| PR completas | 10 | 10 |
| Avisos emitidos | 15 | 18 |
| Avisos clasificados como atribuibles al cambio | 13 | 17 |
| Limitaciones reales ya presentes en la base | 2 | 0 |
| Avisos dudosos por falta de contrato | 0 | 1 |
| Tiempo mediano | 4.01 min | 3.51 min |
| Tiempo máximo | 7.03 min | 7.42 min |
| Tiempo acumulado | 40.24 min | 43.28 min |
| Consumo estimado por Pi | 2.37 USD | 2.60 USD |

La candidata identifica **nueve grupos que la línea base no señaló y omite cinco que sí señaló**; comparten ocho. Entre ambas se catalogan 22 grupos atribuibles al cambio. Una coincidencia de grupo no garantiza que hayan revisado todos sus consumidores: en las órdenes por lector, la base también señaló el estado visual, mientras que la candidata se centró en la API.

El resultado mejora la cantidad de avisos útiles y su atribución en esta muestra, pero **no demuestra una mejora uniforme de detección**. De las 12 referencias de desarrollo recopiladas antes de probar la candidata, la base cubre 9 grupos y la candidata 8. En las cuatro PR reservadas, ambas producen cuatro avisos considerados válidos: dos comunes y dos distintos por configuración; la candidata añade un aviso dudoso. No se certifica el umbral general de detección del 70 % ni se cierra T9. El banco antiguo reservado de octubre no se ha vuelto a medir.

Las etiquetas son mi valoración como agente, contrastada con código y sondas; **no son valoraciones humanas de Samu**. Una sonda que cambia de verde a rojo acredita un cambio de comportamiento, pero no siempre que ese cambio sea incorrecto.

## Qué se corrigió en n_ein

1. **CodeGraph podía devolver el proyecto padre.** Su consulta `status` busca índices hacia arriba. En un repositorio anidado, n_ein interpretaba `initialized=true` como índice propio y acababa entregando fuente de n_ein al revisor de Prelo. El lanzador ahora distingue la raíz y crea el índice de la copia. El runner verifica además esa raíz antes de ofrecer la herramienta; si no puede verificarla, recurre a búsquedas directas. La regresión se probó primero en rojo y después en verde; las ejecuciones reales posteriores consultan el índice de Prelo.
2. **Un fallo de preparación podía contarse como defecto demostrado.** Una sonda de la exploración inicial dependía de un auxiliar no conservado. Al repetirla, su subproceso fallaba por ese auxiliar y el motor aceptaba el código de salida como reproducción. Ahora reconoce fallos habituales de módulos, archivos de sonda, recopilación de tests y auxiliares cuyo error oculta la aserción. El hallazgo permanece, pero esa ejecución no se presenta como demostración. La prueba del motor falló antes del arreglo y pasa después.
3. **Instrucciones de revisión afinadas.** Siguen estados hasta su persistencia y consumidor, cuestionan las garantías concretas cambiadas, comparan con la base y piden sondas autosuficientes. La candidata quedó congelada antes de leer los resultados y el código de las PR 7–10; sus hashes siguen coincidiendo. Se conserva en la rama de trabajo evaluada, sin promoverla a la instalación personal.

El reconocimiento de errores de ejecución es deliberadamente limitado: no convierte cualquier aserción fallida en una prueba semántica válida. Tampoco garantiza que una sonda antigua siga midiendo el mismo escenario tras un cambio de contrato.

## Balance por PR

Los números de esta tabla son avisos considerados atribuibles; los problemas previos y dudas se muestran aparte.

| PR | Base | Candidata | Evidencia que conviene revisar |
|---|---:|---:|---|
| [1 · Borradores](https://github.com/samuhlo/prelo-ob/pull/1) | 0 | 1 | Cerrar otra revista durante un envío puede dejar el segundo borrador sin compartir. Misma sonda: base pasa, head falla. |
| [2 · Órdenes Kobo](https://github.com/samuhlo/prelo-ob/pull/2) | 3 | 3 | Identidad ligada al firmware, órdenes de lectores distintos, aviso de migración oculto y subida restaurada bloqueada. Las pasadas no encuentran exactamente lo mismo. |
| [3 · Trabajos](https://github.com/samuhlo/prelo-ob/pull/3) | 2 | 2 | Base: imágenes que empiezan tras cancelar y libros sin ruta anunciados como ausentes. Candidata: trabajo inexistente que bloquea nuevas publicaciones y cupos ocupados por escrituras fallidas. |
| [4 · Almacenamiento](https://github.com/samuhlo/prelo-ob/pull/4) | 1 | 1 | Se exige otra vez el espacio de un EPUB que ya está en staging; la misma prueba pasa en base y falla en head. |
| [5 · Integridad](https://github.com/samuhlo/prelo-ob/pull/5) | 2 | 5 | Fecha YAML inválida, ancla nula, identidad con comentario, duplicación al restaurar una ficha y cabecera larga. Las cinco sondas de la candidata pasan en base y fallan en head. |
| [6 · Adaptación](https://github.com/samuhlo/prelo-ob/pull/6) | 1 + 2 previos | 1 | Rechazo de direcciones/identificadores intactos. Cambiar 5 por -5 y sustituir un id de imagen por otro con el mismo prefijo también se permitía en base: se conservan como limitaciones residuales, sin contarlos como regresiones nuevas. |
| [7 · Distribución](https://github.com/samuhlo/prelo-ob/pull/7) | 0 | 0 | Ninguna de las dos pasadas encontró un defecto nuevo; no equivale a certificar ausencia de fallos. |
| [8 · Actualización](https://github.com/samuhlo/prelo-ob/pull/8) | 2 | 2 | Registro de recuperación retirado demasiado pronto; conflicto con instalación manual solo en base; carpeta opcional que bloquea toda la API solo en candidata. |
| [9 · Instalador](https://github.com/samuhlo/prelo-ob/pull/9) | 2 | 2 + 1 duda | Reintento de primera instalación; BOM solo en base; estado USB obsoleto solo en candidata. La supuesta obligación de aceptar puentes antiguos queda sin confirmar. |
| [10 · Aceptación](https://github.com/samuhlo/prelo-ob/pull/10) | 0 | 0 | Sin avisos nuevos. El bloqueo de publicación por aceptación manual pendiente se comporta como exige el proyecto. |

La identidad por firmware está respaldada además por un consumidor independiente: Calibre lee el número de serie del campo 0 y el firmware del campo 2 de `.kobo/version`; no es un identificador inmutable completo. La sonda de Prelo pasa en base y falla en head al cambiar solo el firmware. No hubo actualización de un dispositivo físico. [Fuente primaria: driver Kobo de Calibre](https://github.com/kovidgoyal/calibre/blob/master/src/calibre/devices/kobo/driver.py#L176-L204).

## Vigencia y límites de las sondas

Se repitieron las sondas en copias separadas del head final, además de los contrastes base/head pertinentes. La pérdida de archivos pendientes en un backup de la PR 2 queda resuelta por la PR 4: su antigua sonda ahora falla en la precondición que suponía que el archivo no existía, **no porque siga existiendo el defecto**. La PR 10 deja de confirmar silenciosamente una orden de otro lector; permanece el problema del estado visual global por ruta.

Algunos datos simulados necesitaron adaptarse al contrato final: imagen íntegra, respuesta de generación con id de sesión e inventario con `present`. Los cambios están declarados en `tip-fixtures.json`, y las ejecuciones originales y adaptadas se conservan por separado. No se parcheó el producto para conseguir resultados. La cancelación en espera de un slot sigue fallando una vez adaptada la respuesta de imagen.

El aviso sobre un puente antiguo ilustra otro límite: demuestra que el nuevo servidor rechaza un `/health` sin `authenticated`, pero el proyecto exige comprobar autenticación y actualizar componentes conjuntamente. No se inventa una garantía de compatibilidad; queda `unclear`, fuera de los 17 avisos confirmados de la candidata.

## Banco y comprobaciones

- [Manifiesto y procedimiento](../previewer/prelo/README.md): diez rangos originales, árboles comprobados, reconstrucción sin historia posterior y SQLite distinto por configuración. La reconstrucción conserva el mensaje del último commit; en la PR 9 se pierde el mensaje del primero de sus dos commits. Ambas configuraciones reciben el mismo contexto.
- [Datos exportados](../previewer/prelo/results/): JSONL por PR con modelo, consumo, recorrido, citas, sondas y salida; prompts y hashes; [etiquetas](../previewer/prelo/labels.json), [métricas](../previewer/prelo/results/metrics.json) y repeticiones independientes. Las referencias de evaluación no se entregan al revisor.
- Datos completos y sesiones en `.n_ein/prelo-bench-20261027/`, ignorado por Git; credenciales en su hogar nativo. Enlaces privados en `reviews.md` dentro de ese directorio. Los servidores locales se apagan tras dos horas sin uso; `open.ts` permite abrirlos otra vez sin inferencia.
- **25 intentos conservados:** 20 comparables, tres revisiones exploratorias con índice ajeno, una cancelación al detectarlo y un arranque fallido por permisos de locks de Pi. No se cuenta el arranque fallido como revisión sin defectos. La exploración con índice ajeno queda excluida de la comparación, aunque algunas de sus sondas se verificaron después de forma independiente.
- **5,92 USD estimados por Pi** sumando los intentos, incluidos los descartados; no es facturación ni coste total. Excluye esta conversación y el trabajo de preparación/etiquetado. La comparación principal suma 4,97 USD. No se cambió de modelo ni se usó Claude para revisar.
- `bash scripts/check.sh` completo pasó: motor, aislamiento real macOS, sesiones, traspaso, web, launcher/instalador, tipos y paquete instalado. Las comprobaciones de tipos se repitieron después de completar los scripts del banco. Sin ensayo nuevo en Linux, Obsidian real ni Kobo físico. Las pruebas del instalador de Prelo que aquí se repiten usan sustitutos de Docker/launchd; la aceptación física de sus PR sigue siendo la documentada por el autor.

El afinado deja dos correcciones de fiabilidad demostradas y una candidata de instrucciones con más hallazgos útiles en esta muestra, pero con omisiones claras. El siguiente dato útil son las valoraciones de Samu sobre estos avisos y un conjunto nuevo de proyectos; no aumentar artificialmente la puntuación reetiquetando los casos que la candidata omitió.
