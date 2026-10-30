# Aceptación de experiencia y ejecución

Rama `feat/encargo-visible`, desde `b0f6f27`. El producto conserva Pi 1.0.2, CodeGraph 1.6.1, Claude 2.1.302 y la versión publicada 0.4.0-alpha.1. Esta entrega es una PR para revisión, no una release ni una actualización personal.

## Recorridos comprobados

- Paleta: búsqueda local por nombre/descripción/intención, disponibilidad, preparación sin envío, borrador y anchura limitada. El plugin de Claude se prueba con su versión fijada: 15 casos, incluida interacción de buscador y botón.
- Procesos: backend real, salida, error, monitor limitado, cancelación y parada antes del relevo. Prueba adicional con Pi real en RPC y proveedor determinista: devuelve al principal un resultado en segundo plano; un hook nativo de bash rechaza el comando y el archivo marcador no se crea. La presentación no determina el resultado del proceso.
- Sesiones: identidades independientes, ámbito de proyecto, búsqueda explícita en otros proyectos, conservación al cerrar y registro corrupto sin sobrescritura. El Panel amplía de cinco a cien sesiones recientes.
- Evidencia: comando real con resultado, criterio existente, cambios durante la ejecución, archivo nuevo y cambios posteriores. Los datos desconocidos no se presentan como éxito vigente. El alcance funcional de una prueba sigue siendo una declaración que hay que revisar.
- Diseño: variantes, diez comentarios concurrentes, rutas y enlaces confinados, transición elegir → implementar → aceptar, y aceptación histórica cuando cambian código o HTML. Capturas PNG/JPEG limitadas; HTML aislado del padre y sin red externa.
- Navegador real (Zen, fixture aislado): objetivo y tabla cargan, el token desaparece de la barra, señalar «Guardar borrador» conserva su referencia en un comentario, el comentario persiste y elegir la dirección marca la variante. El recorrido detectó una etiqueta de script incompatible con ESM; se corrigió y se añadió la regresión.
- Contexto: desconocido separado de cero, aviso sin delegación, continuidad explícita con autorización y elección de modelo, y conservación del borrador. Si no se puede restaurar el modelo, la sesión nueva no empieza con otro silenciosamente.

## Verificación integrada

`scripts/check.sh` completo pasa sobre el código de `40c02a1`, con Claude 2.1.302 en PATH: lógica, motor y sondas de p_reviewer, Go test/vet, sesiones nativas, equipo experimental, tipos contra Pi fijado, plugin de Claude y smoke del paquete instalado. Log local: `/private/tmp/nein-experience-final-check.log`.

La revisión posterior detectó que una historia válida de comentarios podía superar el límite genérico de 64 KiB. La regresión con 45 comentarios falló antes y pasó después de dar a ese archivo su límite propio de 2 MiB, conservando el máximo de 200 comentarios.

El primer pase encontró un fixture de relevo al que faltaba la identidad de sesión ahora necesaria; se completó sin debilitar la parada de procesos. El segundo pase termina `checks locales: OK`. El aviso de CodeGraph ausente en el smoke corresponde al hogar simulado sin descarga de runtimes: no es un ensayo de indexación fallido presentado como éxito.

Las pruebas alojadas se registran separadamente: [foco del revisor](2026-10-30-review-focus.md), candidata no promovida; [contexto](2026-10-30-context.md), ruta delegada incompleta dentro del plazo. No se anuncia una mejora general de detección ni ahorro.

## Límites de producto

Alt+K es propio de Pi. Claude expone `/nein-comandos` y mantiene sus tareas y compactación nativas. Los resúmenes son históricos y no prueban actividad ni exclusividad. El fingerprint no certifica archivos ignorados, servicios externos o un despliegue distinto. El botón de diseño prepara un encargo para la conversación; no ejecuta implementación por haber elegido una variante. La aplicación puede requerir abrirse aparte si rechaza iframes.

Omarchy físico y las valoraciones humanas generales de p_reviewer siguen pendientes del encargo previo. La CI multiplataforma y el estado de la PR se registran al cerrar la entrega. No se ha modificado la instalación personal ni el proyecto legado.
