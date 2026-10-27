# p_reviewer: evidencia y revisión después del arreglo

Tramo autorizado por Samu tras valorar el banco de Prelo: priorizar la fiabilidad de las sondas y el recorrido detectar → reproducir → corregir → confirmar. Implementado en `feat/previewer-evidence-loop`, código `f445be3`. No se han modificado Prelo, las instalaciones personales ni los resultados del banco anterior; no hay push ni publicación.

## Resultado

El motor ya no interpreta por sí solo un código de salida como prueba del fallo o de su arreglo. Las sondas nuevas declaran una condición y devuelven un único resultado explícito, que el motor vuelve a ejecutar y valida. Web, CLI y traspaso distinguen esos resultados y explican los que no permiten concluir.

| Resultado observado | Qué hace la segunda revisión |
|---|---|
| La condición reproduce el fallo | Conserva el hilo, incluso si el revisor lo daba por resuelto. |
| La misma condición se comprueba y pasa | Marca el hilo como resuelto; conserva valoración y selección histórica y deja de enviarlo como tarea pendiente. |
| El escenario antiguo ya no aplica | Lo deja sin comprobar, con la selección intacta, hasta justificar el arreglo. |
| Error, interrupción, resultado ausente, contradictorio o de otra condición | No lo cuenta como reproducción ni como arreglo. |
| Resolución por inspección del código | Exige explicación y citas válidas al head actual; la presenta expresamente como inspección sin confirmación por sonda. |
| Una sonda nueva sustituye a la antigua | Exige justificarla con explicación y citas actuales; no puede ocultar una reproducción de la sonda original. |

Las sondas pueden solicitar una comparación con la base. Se restauran en otra copia limpia, se guardan ambos resultados con su SHA y se retiran las copias al terminar. Una ruta que apunta a la copia del head impide presentar esa ejecución como comparación con la base. El código seguido por Git debe seguir coincidiendo con el SHA revisado antes y después de la sonda. Las comprobaciones posteriores no heredan una comparación antigua como si acabaran de ejecutarla.

## Evidencia

**Sol 6.1 real, aceptación final en `f445be3`.** Se reconstruyó el caso mínimo `lang-dev-01`: cambiar la forma del presupuesto rompe el consumidor `checkout`. El revisor generó una sonda con el protocolo nuevo; el motor reprodujo el fallo en el head y ejecutó la misma comprobación con éxito en la base. Se seleccionó el hallazgo automáticamente dentro del fixture, se aplicó el arreglo conocido solo en esa reconstrucción y se hizo una segunda revisión real. La sonda original pasó y el hilo quedó resuelto, conservando valoración y selección histórica. El traspaso dejó de incluirlo como tarea pendiente. Los dos recorridos terminaron sin indicios de lectura de referencias según el detector del banco.

Este ensayo prueba el funcionamiento del recorrido con el modelo, no su capacidad general de detectar bugs. Hubo un ensayo inicial y una aceptación final; se conservan ambos, distinguiendo versiones. Los importes de Pi son estimaciones, no facturación ni coste total del trabajo.

**Dos versiones reales de Prelo, comandos reales e informe controlado.** En una reconstrucción de la PR 2, la sonda de subida restaurada reproduce el bloqueo. En otra revisión de la misma reconstrucción, actualizada al head de la PR 4, comprueba que el EPUB restaurado existe y conserva sus bytes: devuelve `not_applicable`. El hilo queda `unchecked` aunque el proceso termine con 0. Una tercera revisión controlada aporta la cita actual del código que incluye el archivo en el backup; el hilo se resuelve por inspección, sin convertir la sonda en una comprobación superada. Este ensayo no llamó al modelo ni utilizó bibliotecas, lectores o servicios personales.

**Regresiones locales.** Cubren escenarios obsoletos, sondas antiguas, excepciones de preparación, resultados duplicados aunque el log se recorte, identificadores o salidas contradictorios, manipulación de una sonda restaurada, código modificado en la copia, reemplazos sin evidencia, citas de resolución antiguas, cancelación durante una sonda y conservación de decisiones. Los tests de web y traspaso comprueban el mensaje que recibe el usuario, no solo los datos internos.

`bash scripts/check.sh` completo pasó sobre `f445be3`: aislamiento real de macOS, motor, almacén, web, CLI/traspaso, tipos, launcher/instalador y paquete instalado. Durante el cierre se reforzó la lectura de sondas históricas: también la API y el traspaso JSON devuelven `inconclusive` y `reproduced=false`, manteniendo los bytes históricos intactos en SQLite. Pasaron de nuevo las regresiones de almacén, web/API, traspaso, ciclo de evidencia y tipos. No se hizo un ensayo nuevo en Linux. No hubo inspección visual en navegador: los proveedores de navegador no estaban disponibles; la compilación, el HTML y la API se comprobaron con los tests del producto.

## Datos y repetición

- [Resultados y metadatos](../previewer/evidence-2026-10-27/summary.json), con salidas, fuentes de sondas y citas en los JSON contiguos. Las sesiones completas quedan en `.n_ein/evidence-loop-*` y `.n_ein/prelo-evidence-*`, ignoradas por Git; no se exportan credenciales.
- `bun evals/previewer/evidence-loop.ts`: dos revisiones reales con el modelo fijo del producto. Consume cuota.
- `bun evals/previewer/prelo/evidence-loop.ts`: reproduce el caso de Prelo con comandos aislados e informes controlados; no consume inferencia.
- `bun tests/previewer-probe-protocol.ts` y `bun tests/previewer-evidence-loop.ts`: contrato y ciclo sin inferencia.

Las valoraciones de estos fixtures son automáticas y están identificadas como tales. No representan decisiones humanas de Samu.

## Compatibilidad y límites

El almacén pasa a esquema **4** por el cambio de significado de la evidencia. Conserva sesiones, fuentes, valoraciones y selecciones anteriores. Una sonda histórica se muestra inconclusa hasta volver a comprobarla con evidencia suficiente. Un lector antiguo rechaza el esquema nuevo en vez de confundir `not_applicable` con un arreglo; volver a un binario antiguo no convierte esos datos al formato anterior. No se ha migrado la base de la instalación personal.

El resultado explícito permite comprobar qué afirmó y ejecutó la sonda, pero no certifica que su aserción represente correctamente el requisito del producto. Sigue siendo necesario revisar la condición, la fuente y las pruebas. Este tramo tampoco acredita una mejora de cobertura: la estabilidad de detección, la vista de PR encadenadas, la comparación con una revisión sencilla y la medición del esfuerzo humano siguen siendo líneas posteriores.
