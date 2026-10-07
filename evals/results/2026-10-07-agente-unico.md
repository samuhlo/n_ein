# Consolidación del agente único

## Resultado

Recorrido ordinario de un agente y un modelo por encargo, con el experimento de equipo desactivado por defecto. Comprobados la exploración acotada, la elección manual, el escalado automático y la conversación con correcciones. Dos encargos en copias de `planificador-didactico` pasan su aceptación ampliada, sin hijos, con **1,5452089 USD estimados de catálogo**.

Desarrollo en `fix/agente-unico-consolidado`, worktree `n_ein-single-agent`, desde `2b821ae`. El checkout original tiene trabajo concurrente de otro agente sobre interfaz y recibos; se conserva sin mezclarlo con estos commits.

## Cambios comprobados

- **Un agente por defecto.** Sin `nein_team` salvo `N_EIN_TEAM=1`. Las instrucciones experimentales se cargan solo con esa activación. La inspección y parada de asignaciones anteriores se conserva. Launcher normal y experimental probados; Pi real confirma las herramientas disponibles.
- **Calidad hasta el consumidor.** El flujo y TDD incluyen el rechazo real, el mensaje y la acción de recuperación, aunque se reutilice un código de error. La aceptación de S3 incluye dos casos del handler a su traductor de UI, además de los tres casos originales.
- **Exploración acotada.** CodeGraph devuelve fuente de tres archivos por defecto, ampliable hasta doce. Lo recortado se conserva íntegro en un temporal privado; no hace falta repetir la consulta para recuperar un tramo. Un sync fallido avisa y deja contrastar los archivos. Comprobado con binario simulado y consulta real de CodeGraph 1.6.1.
- **Acuerdo y correcciones.** Intent conserva lo decidido y el trabajo válido, modifica solo los criterios afectados y pregunta por dependencias materiales abiertas. El cambio claro y autorizado continúa sin reiniciar la entrevista.
- **Modelo elegido.** Se corrigió en rojo/verde que una clase explícita pudiera ser sustituida por detección de riesgo o llamadas auxiliares. La selección manual se conserva; el modo automático puede escalar. Se reconocen también «Otra cosa, …» y «Ahora otra cosa: …», conservando «otra cosa del mismo encargo». Pi real con proveedor determinista atraviesa estos caminos.
- **Documentación vigente.** Entrada y pendientes distinguen el recorrido directo del experimento y eliminan decisiones desfasadas del resumen operativo. La historia y los resultados anteriores siguen conservados.

## Ensayos alojados

Producto congelado: `993dc0989e3016ebe07fa14e007d482c2544b098`. Pi 1.0.2; principal `nein/auto`, tabla de clases con `openai/gpt-6-luna` high y `openai/gpt-6-sol` medium/high. Autenticación nativa existente, sin copiar credenciales. Copias y sesiones aisladas; ejecuciones en serie; presupuesto inicial máximo de 4 USD estimados.

| Caso | Modelo observado | Resultado | Tiempo del agente | USD estimados |
|---|---|---|---:|---:|
| S3: alta, consumidores, Anexo IV y documentación | Sol high, elegido automáticamente | 5/5; ambos mutantes detectados; suite 3153 correctos y 4 omitidos; tipos correctos | 686,9 s | 1,1621 |
| Diseño del contador | Sol high | Dos preguntas con recomendación y hechos del código; proyecto intacto | 44,3 s | Incluido abajo |
| Ejecutar el acuerdo | Sol high → Sol medium | Contador también con cero, actualización 3→0→1 y resto del panel conservado | 135,3 s | Incluido abajo |
| Corregir solo el caso vacío | Sol medium | Oculta (0), conserva lo demás y comprueba el cambio sin otra entrevista | 97,0 s | Incluido abajo |
| Nuevo encargo: errata de documentación | Luna high | Solo la errata; diff de código idéntico al anterior | 31,6 s | Incluido abajo |
| Conversación completa | Selección por alcance | S6 4/4, suite y tipos; cero hijos | 308,2 s | 0,3831 |

La errata se sembró en un documento de la copia para observar el cambio a un encargo mecánico. El diseño y el contador usan el panel real. La validación conserva la conversación completa y los modelos de cada respuesta; no se infiere elección de modelo a partir del texto del asistente.

### Revisión de S3

El resultado actualiza el handler con filtro por usuario y curso propio sin academia, o asignaciones de módulo; añade el código de error al catálogo y al consumidor exhaustivo; y explica al usuario que necesita otra cuenta de gestor. También corrige la cabecera de `/acceso`, que antes pedía corregir datos del centro ante ese rechazo. El test de Anexo IV monta la página y conserva garantías de guardado y navegación; la documentación deja de describir como inactivo el botón existente.

Commits del resultado en su copia: `18f754c`, `06eaa4b`, `a117391` y la corrección de revisión `e6f0a79`. El agente declara la carrera entre consulta e inserción y los tests de PostgreSQL omitidos sin su variable de entorno. No se ha verificado ese caso concurrente contra una base de datos real.

### Revisión de conversación

Antes del acuerdo no cambia HEAD, diff ni status. La corrección afecta solo al estado vacío del título. El nuevo encargo se reconoce con la formulación natural «Ahora otra cosa, …», elige Luna y conserva el código. El diff final contiene el componente, sus pruebas y la errata; no crea WORK.md para este cambio pequeño.

## Comprobaciones locales y revisión

`./scripts/check.sh` completo pasa: shell, catálogo, contexto, enrutador, Git, procesos, Pi nativo con proveedor determinista, tipos estrictos contra el SDK instalado, Go/test/vet y smoke del paquete. Log de la implementación: `/tmp/nein-single-agent-check.log`.

**Spec:** cubiertos el modo ordinario, el opt-in conservando datos, la selección explícita/automática, la salida de CodeGraph recuperable, el acuerdo y sus correcciones y el rechazo explicado en sus consumidores. Los ensayos no muestran ahorro universal ni fiabilidad para cualquier encargo.

En la revisión final se comprobó el contrato instalado de Pi: las peticiones auxiliares omiten `state`. Se añadió una regresión que falla si una instancia recién abierta pierde la elección manual y se corrigió la recuperación desde la entrada pública de sesión. Se verificó también usando datos guardados por Pi real, sin fabricar el estado del router. Esta corrección es posterior al banco y tiene comprobación local.

**Standards:** un catálogo y el mecanismo existente; capacidades nativas de Pi; sin nueva dependencia de producción ni motor de fases. Se mantienen idioma, estilo, autorización y aislamiento. Los cambios concurrentes del checkout original quedan fuera de estos commits.

## Incidente de preparación y conservación

El primer intento de S3 se detuvo durante la preparación, antes de iniciar un modelo. Un segundo intento de preparación confirmó falta de espacio en disco. Se retiraron copias de preparación propias, productos extraídos idénticos a sus archivos congelados y dependencias regenerables de copias de corrección terminadas. Se conservaron fuentes, commits, sesiones, resultados y archivos originales. Manifest: `../n_ein-bench/logs/single-agent-storage-cleanup.json`.

El arnés comprueba al menos 512 MiB libres antes de preparar y valida el identificador de corrección antes de crear o retirar directorios. `grade.sh` limpia `node_modules` y `.nuxt` de su copia desechable al terminar; `N_EIN_KEEP_GRADE_DEPS=1` permite conservarlos para diagnóstico. El resultado del agente y sus dependencias permanecen separados de esa copia. Las preparaciones fallidas no se presentan como llamadas de modelo ni se ocultan en los resultados.

## Evidencia y límites

[Datos de la tanda](2026-10-07-agente-unico.json). Trazas y copias: `../n_ein-bench/logs/single-agent-s3-r2/`, `single-agent-intent-r1/` y sus directorios en `copies/`. Los logs guardan peticiones, modelos, herramientas, uso y resultados; los productos están congelados en `product.tar`.

Una observación por caso, sin juez independiente a ciegas ni comparación estadística. S3 usa Sol high; los ensayos anteriores con medium no son controles equivalentes de velocidad o coste. Se ha demostrado comportamiento en estos recorridos y corregido fallos concretos; no un porcentaje general de ahorro. El coste es de catálogo observado, no factura ni cuota de suscripción, y no incluye esta conversación de desarrollo.

El relevo ordinario Pi↔Claude tiene [evidencia previa](2026-10-06-flujo-conversacional.md) y conserva sus regresiones locales. No se reabrió el ensayo de relevo con equipos aplazado.
