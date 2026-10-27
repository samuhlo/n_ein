# p_reviewer: cadenas e integración

Encargo autorizado por Samu con «Venga, pues dale»: agrupar PR dependientes, seguir sus hallazgos y revisar el conjunto integrado. Implementación en `feat/previewer-chains`; núcleo en `8c2d9a3` y protección adicional de historial/reanudación en `047e2e7`. No se han publicado cambios, actualizado instalaciones personales ni modificado Prelo.

## Qué queda disponible

- `nein previewer chain --file serie.json --plan` valida la cadena completa y fija sus SHAs sin inferencia ni creación de sesiones. Requiere rangos lineales; una base divergente se rechaza sin sustituirla por otro merge-base.
- `chain --file serie.json` revisa cada diferencia incremental y después el conjunto desde la base inicial hasta el último head. Una cadena de N tramos realiza hasta N+1 revisiones con el modelo fijo del producto.
- Una sesión común conserva hilos, valoraciones y selección. Los avisos identificados mediante `previous` y las coincidencias conservadoras mantienen su identidad; comprobaciones distintas no se fusionan por compartir una descripción genérica.
- El historial muestra dónde se detectó, persistió, reapareció, quedó sin comprobar o se resolvió cada hallazgo. No confunde «detectado en» con una atribución demostrada del commit que lo introdujo.
- La vista diferencia integración terminada, resultados parciales y evidencia histórica. Los informes y diffs de los tramos son consultables; las decisiones se editan desde el balance actual. Los cambios posteriores de referencias se señalan sin alterar el snapshot.
- `open`, `status` y `handoff` aceptan `--chain nombre`; `chains` lista las cadenas locales. El traspaso identifica el head final y conserva las selecciones sin comprobar, sin aplicarlas por accidente a una PR anterior.

Los mismos rangos y versión de revisor reanudan lo incompleto y reutilizan lo terminado. `--again`, un cambio de referencias o de código relevante del revisor crea otra evaluación, conservando decisiones e historial. La exclusión afecta únicamente a otra ejecución de la misma cadena. Un intento abandonado queda marcado y puede reanudarse; cuando el sistema permite comprobarlo, se distingue un PID reutilizado de su propietario anterior.

[Formato y uso](../../docs/12-cadenas-revisor.md). El agente prepara el manifiesto a partir del encargo o de metadatos de PR; GitHub no es una dependencia del motor. Las sesiones individuales previas permanecen independientes, sin importación o fusión automática de sus decisiones.

## Comprobación con Sol 6.1 real

Se reconstruyó una cadena pequeña de tres cambios alrededor de `pricing.py` y su consumidor `checkout.py`. Hubo cuatro ejecuciones reales, incluida la integración, usando `openai-codex/gpt-6.1-sol` con esfuerzo alto:

| Paso | Estado del mismo hilo |
|---|---|
| PR 1 | Detectado; sonda explícita reproduce el fallo. |
| PR 2 | Sigue presente; conserva valoración y selección. |
| PR 3 | Resuelto tras pasar la comprobación. |
| Integración | Confirma el resultado en el conjunto. |

Se conservó un solo hilo. Repetir el mismo snapshot desde el ejecutor y desde la CLI reutilizó los cuatro run IDs sin nuevas llamadas al modelo. El ensayo sumó 126,2 segundos y 0,126 USD estimados por Pi; no son facturación ni coste total. Las decisiones de selección de este fixture fueron automáticas y están identificadas como tales; no representan una valoración humana de Samu.

Este ensayo verifica el recorrido y la continuidad. No estima cobertura de detección, no compara modelos y no demuestra que cualquier hallazgo semánticamente equivalente vaya a agruparse correctamente.

## Caso de Prelo

Se validaron los diez rangos congelados del banco como una cadena de once pasos, incluida la integración, sin ejecutar once inferencias. Además se recorrieron las PR 2→3→4 en una copia aparte, con informes controlados y sondas reales bajo el aislamiento del producto:

| Paso | Resultado |
|---|---|
| PR 2 | Se detecta la subida restaurada sin archivo que ya no puede cancelarse. |
| PR 3 | La sonda confirma que sigue presente; mismo hilo y decisiones. |
| PR 4 | El archivo ya se conserva: el escenario antiguo no aplica y queda sin comprobar. |
| Integración | La cita actual del código que guarda el archivo justifica la resolución por inspección. |

No se convirtió la salida 0 de un escenario obsoleto en prueba de arreglo. La selección histórica permanece guardada y lo resuelto deja de aparecer como tarea pendiente. Estado y referencias del repositorio original no cambiaron. Este caso no usó un modelo ni hardware o servicios personales.

## Pruebas y correcciones de cierre

Las regresiones cubren validación previa, bases divergentes, reanudación tras fallo/cancelación, propietario activo, intento abandonado, PID reutilizado, referencias movidas, snapshots nuevos, hilos reabiertos, decisiones persistentes, agrupación conservadora, nuevos hallazgos de integración, lectura histórica, API, CLI y traspaso.

Se ejecuta también el JavaScript real compilado de la web para verificar que quitar el token conserva el tramo elegido y que el polling no cambia una vista histórica por el balance actual. Se corrigió una carrera que podía dejar la página sin actualizar si la revisión terminaba durante la carga inicial. Otra prueba, con dos conexiones SQLite, reproduce una revisión que termina entre lecturas de la página: la respuesta ahora mantiene coherentes informe, hallazgos e historial.

`bash scripts/check.sh` completo pasó sobre `047e2e7`, incluido el paquete instalado y la planificación de una cadena desde el launcher empaquetado. Tras las últimas correcciones de coherencia de la vista pasaron de nuevo web/API, cadenas y tipos. El smoke inicial se detuvo por una comprobación del texto de ayuda antiguo; se mantuvo la ayuda compatible y se añadió la prueba del nuevo comando instalado.

No hay un ensayo nuevo en Linux ni una inspección visual en navegador. Se han comprobado la compilación, el HTML, el JavaScript y la API. Los diffs históricos necesitan que los commits sigan disponibles localmente; las citas, sondas y decisiones permanecen en el almacén.

## Datos y repetición

- [Resumen](../previewer/chains-2026-10-27/summary.json), [cadena real](../previewer/chains-2026-10-27/live-result.json) y [caso Prelo](../previewer/chains-2026-10-27/prelo-result.json).
- `bun evals/previewer/chain-live.ts`: aceptación con cuatro revisiones reales; consume cuota.
- `bun evals/previewer/prelo/chain.ts`: planificación de las diez PR y recorrido controlado con sondas reales; sin inferencia.
- `bun tests/previewer-chains.ts` y `bun tests/previewer-web.ts`: regresiones deterministas.

El almacén usa esquema 5 y conserva los datos de sesiones anteriores. Un binario antiguo rechaza ese esquema; no se ha migrado la base personal. Las copias de revisión se retiran al terminar. Las reconstrucciones, sesiones completas y SQLite de los ensayos quedan en `.n_ein/chain-live-*` y `.n_ein/prelo-chain-*`, ignorados por Git; los datos exportados no incluyen tokens de los servidores locales.
