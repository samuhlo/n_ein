# Pruebas y evaluación

## Qué debe demostrar n_ein

El producto funciona cuando termina trabajo autorizado con calidad y menos fricción. Sus pruebas deben atravesar las fronteras donde ocurrieron fallos reales: prompt/configuración→runner, resultado del hijo→padre, edición→verificación, interrupción→continuación y paquete→instalación.

## Casos de aceptación iniciales

| ID | Escenario | Resultado observable |
|---|---|---|
| A01 | Arreglo conocido pequeño | Edición directa, check pertinente, ninguna fase/entrevista artificial. |
| A02 | Consulta o auditoría | Respuesta/evidencia; no implementación ni estado de cambio inferido. |
| A03 | Bug reproducible | Prueba falla por el defecto correcto y pasa tras el arreglo. |
| A04 | Cambio visual o copy | Verificación apropiada; no RED/GREEN inventado. |
| A05 | Feature vertical al barato | Comportamiento completo, alcance respetado y aceptación independiente. |
| A06 | Worker se atasca | Conserva diff/checks y devuelve pendiente; rescate sin reiniciar. |
| A07 | Interrumpir y reanudar | Mantiene objetivo, decisiones y trabajo terminado. |
| A08 | Verify encuentra SQLSTATE ausente | Continuación respeta TDD elegido sin preguntar de nuevo; regresión/arreglo válidos. |
| A09 | Cambiar código tras los tests | Evidencia anterior no se presenta como vigente para el nuevo estado. |
| A10 | Falla registro o UI | Degradación visible; no veto general de nueva edición local. |
| A11 | Herramienta larga/hijo finalizando | No timeout por falso silencio ni éxito prematuro. |
| A12 | Instalación/update fallido | Entorno habitual preservado y versión anterior recuperable. |
| A13 | Endpoint/modelo no disponible | Modelo realmente usado identificable; ningún fallback silencioso. |
| A14 | Archivos nuevos y cambios por shell | El diff de entrega los incluye aunque el visor de eventos no los atribuya. |
| A15 | Relevo entre runtimes (Pi↔Claude primero) | Pendiente y decisiones se conservan; la evidencia de código cambiado se marca obsoleta. Origen e hijos dejan de escribir antes de habilitar escrituras en destino. Cada integración prueba aislamiento de configuración/datos y explicita las herencias deliberadas. |
| A16 | TODO con documento de trabajo | El widget refleja el checklist del documento; marcar una tarea escribe en el documento; sin documento no aparece TODO. |
| A17 | Rutina que Samu domina | Crear una rama o una PR se informa con resultado e identificador, sin explicar cómo se hace. Un mecanismo nuevo sí se explica en lenguaje humano. |
| A18 | Launcher sin datos o sin TTY | «Desconocido» se distingue de vacío en cada vista; con `--once` o sin terminal interactiva pinta una vez y sale con 0. |
| A19 | Instalador | `--dry-run` no cambia nada; el canal se guarda solo tras un update correcto; `uninstall` conserva auth, secrets y sesiones; las instalaciones normales de los runtimes no se tocan. |
| A20 | Suite con un fallo previo | La excepción identifica X y su base; un fallo nuevo Y en el mismo comando se detecta. Si X impide comprobar el cambio, no se declara verificación completa. |
| A21 | Evidencia fiable de un trabajador | Un check pertinente y vigente no se repite por rutina; un hueco de cobertura, cambio posterior o evidencia no fiable provoca la comprobación necesaria. |
| A22 | Código no trivial, directo o delegado | Comentarios con la firma de Samu que permiten orientarse y entender decisiones; sin explicar líneas obvias ni modificar archivos fuera del alcance. En Go, documentación/directivas válidas. Revisar utilidad, no coincidencia literal de prosa. |
| A23 | Eventos y errores de ejecución | Logs con nivel, acción y contexto conforme al estilo personal, sin secretos/datos personales ni ruido innecesario. Canales JSON/RPC y TUI no se contaminan con texto de diagnóstico. |
| A24 | Petición clara, duda puntual e idea abierta | Directo, pregunta concreta o propuesta de `intent`, respectivamente. La entrevista no se activa sin petición o aceptación del usuario. |
| A25 | `intent` solicitado | Preguntas por dependencias, recomendaciones concretas, hechos investigados y decisiones del usuario preservadas. No exige Scout ni completar todas las decisiones futuras. |
| A26 | Cierre o abandono de `intent` | La síntesis confirmada conserva objetivo, límites y aceptación en el documento único si corresponde. Sin confirmación no hay artefactos salvo borrador solicitado. Confirmar comprensión no autoriza código; autorización previa válida no se pregunta otra vez. |
| A27 | Acuerdo de `intent` delegado o retomado | Trabajador/destino reciben decisiones y pendiente relevantes, sin repetir entrevista ni perder límites. Evidencia nueva puede reabrir una decisión indicando por qué. |

No convertir esta tabla en un requisito de ejecutar todo para cada cambio. Cada corte selecciona casos pertinentes; smoke esencial para artefactos de release.

## Capas de comprobación propuestas

1. **Deterministas rápidas:** lógica, parsing limitado, permisos/configuración, identidad de evidencia, cancelación y persistencia. Ejecutadas regularmente y en CI donde proceda.
2. **Integración real del runtime:** carga de extensión, payload aceptado por la versión instalada, eventos y terminación. Puede usar un proveedor controlado para probar transporte; eso no acredita calidad de modelos. Se repite al subir la versión de Pi, porque su API de extensiones cambia con frecuencia (0.87 rompió varios eventos).
3. **Artefacto instalado:** desde paquete limpio, fuera del source tree y sin resolver dependencias accidentalmente desde el workspace. Incluye los binarios Go del launcher y el instalador.
4. **Evaluaciones con modelos reales:** tareas representativas, resultados reservados y costes completos. Manuales o programadas con límites configurados; no en cada cambio documental.
5. **Uso supervisado:** proyectos reales, registrando rescates y defectos posteriores. Complementa el corpus, no permite declarar éxito sin comprobar.

Proteger decisiones externas de permisos/entrega con pruebas. Usar mocks en las fronteras necesarias; no llenar la suite de tests que replican constantes o la implementación. Los tests de texto verifican entrega de instrucciones y se etiquetan como tales.

## Corpus inicial

La entrega 1 arranca con fixtures sintéticos acotados. El caso de continuación se prepara para su entrega y las dos tareas reales se seleccionan antes de la evaluación que las use; no son requisitos para empezar. Propuesta de control rápido completo:

| Caso | Origen | Cubre |
|---|---|---|
| Arreglo pequeño conocido | fixture sintético en el repo | A01 |
| Bug reproducible con regresión | fixture sintético | A03 |
| Cambio visual o de copy | fixture sintético | A04 |
| SQLSTATE ausente tras verify | reconstruido de los informes de Ein | A08 |
| Tarea real 1 | `planificador-didactico` o `berro`, commit fijado | A05 o A03 |
| Tarea real 2 | `planificador-didactico` o `berro`, commit fijado | A02 o A05 |

El agente propone a Samu dos tareas reales con commit de base, resultado esperado y comprobaciones. Samu puede elegir o ajustar cuáles representan mejor su uso ([pendientes](08-pendientes.md)); mientras tanto, se puede construir y probar el arranque con los fixtures.

## Diseño del experimento

Control rápido con el corpus inicial antes de invertir en una comparación más amplia. Después doce casos: dos triviales, tres regresiones, tres features verticales, dos investigaciones y dos recuperaciones. Al menos dos ejecuciones por configuración candidata; repetir discrepancias. Es un piloto supervisado, no prueba estadística concluyente.

Comparar:

- A: capaz directo con instrucciones breves.
- B: n_ein con capaz directo y skills adaptadas.
- C: n_ein con trabajador barato alojado.
- D posterior: misma tarea con trabajador local.

Una ablación pequeña sin skills nuevas permite distinguir valor de las skills y de la coordinación. Usar Ein actual solo en la muestra necesaria para comprobar regresiones, sin multiplicar toda la matriz.

La revisión barata se evalúa por separado del ahorro de implementación. Preparar diffs con defectos conocidos y cambios correctos: medir hallazgos válidos, defectos omitidos, falsos positivos, contexto necesario y tiempo de triaje humano. Entregar un informe no equivale a haber revisado bien; una revisión de solo lectura puede validar transporte sin acreditar capacidad de revisión.

Misma base, entorno y criterios; herramientas equivalentes cuando se comparen rutas. Tests reservados fuera del alcance del ejecutor hasta la evaluación; revisión humana o independiente del resultado. No reutilizar una solución previa como contexto privilegiado de un solo participante.

Medir éxito, defectos, uso de todas las llamadas/intentos, primera edición, tiempo hasta aceptación, contexto, rescates humanos y tareas administrativas. Aprovechar `usage.cost` en los registros de Pi, contando cada mensaje del asistente/hijo una sola vez. Distinguir estimación de catálogo, importe facturado y coste desconocido; conservar tarifa/procedencia y cobertura. Una suscripción no proporciona necesariamente coste marginal por tarea. Caché, endpoint, versión, esfuerzo y parámetros quedan registrados. Alternar orden y no mezclar una ronda con instrucciones cambiadas en el mismo porcentaje sin distinguirla.

## Promoción propuesta

Ningún defecto crítico adicional, ninguna pérdida de autorización/alcance/decisiones y cero reparación manual de artefactos en casos simples. Para la ruta barata, ahorro total orientativo del 20 % en una clase sin aumentar rescates y con latencia aceptada. El umbral es una propuesta de arranque, no una preferencia expresa de Samu ni una garantía estadística.

Ante empate, escoger menos piezas. Reportar coste desconocido como desconocido, nunca cero. No confundir euros API, tokens y coste humano. Un modelo local tampoco cuesta cero.

## Evidencia anterior disponible

- Piloto de cinco módulos: ahorro API atribuible de 58,01 % para planificación común+Luna frente a planificación común+Astra; 4/5 baratos pasaron inicialmente, quinto tras reparación. Falta el comparador capaz directo. [Informe](archive/ein-workspace/evals/simple-pilot-2026-09-08.md).
- pi-lens: experimentos registraron cambios fuera del alcance por autoformato y ningún ahorro general demostrado. [Informe](archive/ein-workspace/evals/pi-lens-2026-09-09.md).
- Engram: ensayo corregido de trabajo pequeño quedó en empate práctico; algunos diagnósticos mejoraron y otros empeoraron. No acredita necesidad de memoria obligatoria. [Informe](archive/ein-workspace/evals/engram-decision-2026-09-11.md).
- Auditoría de 28 de septiembre: 61 tests focales pasaron en snapshot de Ein main con dependencias existentes enlazadas; no fue instalación limpia ni benchmark nuevo de modelos. [Log](evidence/ein-audit-focused-20260928.log).

Los tres tarballs contienen la evidencia previa preservada. Sus hashes se verifican al preparar este paquete; no se vuelven a ejecutar sus modelos aquí.
