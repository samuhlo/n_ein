# Flujo conversacional comprobado

El recorrido ordinario acepta peticiones en lenguaje normal para diseñar, construir, empezar otro encargo, continuar y cambiar de runtime. Los comandos siguen como atajos. Las pruebas reales completaron los seis recorridos propuestos sin pedir nombres de skills ni una segunda aprobación para construir el acuerdo.

## Comportamiento

- `intent` reconoce pedir ayuda para pensar o diseñar y plantea primero pocas decisiones materiales con recomendación. La guía conserva objetivo, comportamiento, límites, enfoque y aceptación.
- `spec` y `tasks` se pueden cargar por el agente para un trabajo autorizado. No exigen aprobar rutinariamente seams o tamaños de tareas.
- Un encargo claro va directo. Consultas y diseño no activan suites de código; documentación y copy reciben sus comprobaciones pertinentes. Los cambios de código conservan aceptación, suite y tipos sobre el resultado final, reutilizando evidencia vigente.
- El agente puede ajustar la capacidad a un alcance aclarado; otro encargo lee los ajustes actuales. Las continuaciones conservan su ruta física. El selector ya aplica lo guardado al siguiente encargo sin reiniciar Pi.
- Pi prepara el relevo conversacional al terminar el bucle de herramientas. Cancelación, nueva entrada o cambio de sesión cancelan la petición pendiente. Claude puede cargar `to-pi` cuando el usuario pide explícitamente volver, conservando la autorización de lectura cuando corresponde.
- La portada invita a explicar la necesidad. El cierre de un trabajo pequeño es resultado, comprobación y commit; el trabajo de riesgo o mayor tamaño conserva detalle revisable.

## Ensayo real

Runner: `evals/bench/conversation.ts`, con proyectos y sesiones del banco. Usa los hogares autenticados existentes sin copiar sus credenciales. Pi 1.0.2, modelos `openai/gpt-6-sol` y `openai/gpt-6-luna`; Claude con su modelo nativo y esfuerzo medium. Las pruebas reservadas viven fuera de las copias que recibe el agente.

| Recorrido | Resultado observado | Tiempo | Coste estimado |
|---|---|---:|---:|
| Arreglo claro, r1 / r2 | Sin preguntas ni WORK.md; aceptación del parser, pruebas propias y tipos correctos | 87 / 77 s | $0,0984 / $0,0878 |
| Otro encargo, r1 / r2 | Una errata, Luna; parser intacto; sin suite ajena ni entrevista | 90 / 21 s | $0,0046 / $0,0030 |
| Preguntar por Claude, r1 / r2 | Explicación sin relevo ni cambios | 7 / 9 s | $0,0058 / $0,0055 |
| Diseñar primero | Una decisión con recomendación; ningún archivo cambiado | 38 s | $0,0336 |
| «Me encaja: hazlo» | Implementa el acuerdo sin reconfirmar; parser conservado; aceptación del formato correcta | 99 s | $0,1119 |
| Guardar para después | Conserva pendiente y autorización sin implementar anticipadamente | 40 s | $0,0192 |
| «Sigue donde lo dejamos» | Sesión nueva, sin entrevista; contrato y tarea pendientes recuperados y comprobados | 93 s | $0,0815 |
| Pi→Claude→Pi hablado | Un cambio a Claude, regreso real a Pi, revisión de lectura y proyecto intacto | 76 s | $0,4818 total |

El contador de interrogaciones no equivale al de decisiones: la pregunta de diseño llevaba título interrogativo y cuerpo con opciones, pero era una sola decisión. Se registran ambos cuando corresponde. El coste del relevo incluye $0,0418 de Pi y $0,4399 de Claude, con el total acumulado de cada sesión contabilizado una sola vez.

La segunda tanda básica usó `cbc2792`; la primera y los recorridos de diseño y relevo usaron `25db0c2`. En la segunda se eliminó una llamada redundante de selección para la errata. Los 90 frente a 21 segundos son una observación de dos ejecuciones, no una garantía de latencia ni una estimación causal aislada. Las estimaciones de catálogo tampoco son el importe facturado por una suscripción.

El primer montaje de relevo no llegó a llamar a un modelo: la ruta del Pi gestionado omitía el directorio `pi`. Se corrigió el arnés y se conservó el fallo, sin modificar el producto para ocultarlo.

## Límites y entrega

Son fixtures pequeños de aceptación del flujo; complementan el banco de calidad anterior, no lo sustituyen ni prueban calidad universal en repositorios grandes. En Claude interactivo sigue haciendo falta salir del host: el agente muestra `/exit` cuando el relevo está listo. El ensayo no interactivo sale al terminar la respuesta y abre Pi automáticamente. No se añadió un supervisor ni se simularon respuestas de los modelos.

Las regresiones locales comprueban selección y permanencia del modelo, ajustes entre encargos, errores de configuración visibles y relevo cancelado antes de habilitar el destino. `./scripts/check.sh` verifica además los lanzadores, Go, el catálogo y el paquete instalado. [Resultados y hashes](2026-10-06-flujo-conversacional.json).


Instalada la preview local `0.1.0-preview.2+hotfix.3bc9b8006cc0`, con backup. Su candidato pasó el check completo, la instalación desde tarball y `doctor --runtime`: 61 archivos, Pi 1.0.2 y CodeGraph 1.6.1. La sesión del artefacto instalado respondió en `openai/gpt-6-sol` a una petición natural de diseño: leyó el código, planteó una decisión con recomendación y conservó intactos ambos archivos. La tabla y preferencias personales siguen fuera del paquete.

La preparación del candidato encontró otra dependencia de ajustes personales en `build-preview.sh`: el smoke heredaba la tabla de modelos del usuario. Se aisló en archivos temporales; el candidato completo pasó después. Esto no cambió las selecciones del usuario.
