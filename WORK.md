# Agente único: calidad, contexto y conversación

## Objetivo

«Venga, pues vamos a implementar todo, y sacar un pepinazo. Dale caña». Consolidar el recorrido ordinario de un agente y un modelo por encargo; revisar de extremo a extremo; explorar con menos contexto redundante; conservar el acuerdo al diseñar y corregir; validar el selector y preparar una preview comprobada.

## Autorización

Implementación, pruebas y commits autorizados. Sin push ni publicación. Trabajar en `fix/agente-unico-consolidado`, worktree `n_ein-single-agent`, desde `2b821ae`. Otro agente sigue trabajando en la interfaz y recibos del checkout original; preservar sus cambios y coordinar la integración al acabar. Paquete y pruebas en destinos aislados; no sustituir la instalación personal mientras se integra el trabajo concurrente.

## Decisiones

- Un agente y un modelo por encargo. El equipo queda experimental y solo se habilita explícitamente; conservar la recuperación y parada de trabajos anteriores.
- Mantener un catálogo, WORK.md como guía y los mecanismos nativos de Pi.
- Conservar hechos, decisiones, instrucciones, errores y checks. Reducir la exploración antes de recurrir a recortes más agresivos.
- El acuerdo de intent no autoriza construir; «hazlo» sí dentro de ese acuerdo. Una corrección modifica solo lo afectado y no reinicia la entrevista ni descarta lo hecho.
- Revisión por comportamiento completo, incluidos rechazo esperado, mensaje y recuperación en sus consumidores.

## Criterios y fronteras de prueba

- Arranque y herramientas de Pi: sin capacidad de delegar ni instrucciones de equipo por defecto; opt-in experimental funciona; datos anteriores preservados.
- CodeGraph: consulta enfocada, amplitud explícita, salida completa recuperable si se recorta y fallos del índice visibles sin bloquear lecturas.
- Enrutador: modelo apropiado para el alcance; nueva tarea permite elegir otra vez; aclaraciones elevan riesgo cuando corresponde; una elección manual no se rebaja ni se sustituye automáticamente.
- Conversación: diseñar sin escribir, ejecutar el acuerdo autorizado, incorporar una corrección sin reabrir decisiones resueltas y retomar con contexto suficiente.
- Caso real de código: cumplir backend, consumidores, mensajes y recuperación, pruebas pertinentes, documentación y commit.

## Tareas

- [x] U1 Consolidar agente único — equipo solo con N_EIN_TEAM=1, instrucciones experimentales separadas, recuperación conservada y documentación vigente. Rojo/verde en registro de herramienta; launcher ordinario y experimental, catálogo y formato pasan.
- [x] U2 Calidad y contexto — aceptación desde el rechazo real hasta mensaje/recuperación; CodeGraph con 3 archivos por defecto, amplitud explícita y salida íntegra recuperable. Rojo/verde de argumentos y conservación de fuente; consulta real con CodeGraph 1.6.1; aviso de sync fallido y fallback comprobados. Efecto sobre encargos alojados pendiente de U4.
- [x] U3 Acuerdo y modelo — guía de correcciones sin reentrevista; clases explícitas conservadas ante riesgo, revaloración y llamadas auxiliares. Rojo/verde del defecto de elección manual y prefijos naturales; Pi real con proveedor determinista confirma escalado automático, elección manual y ausencia de equipo por defecto. Conversación real pendiente de U4.
- [x] U4 Validación real — S3 5/5, dos mutantes, suite y tipos; diseño sin cambios, implementación, corrección sin entrevista repetida y nueva errata en Luna sin tocar código. Ningún hijo. Coste observado 1,5452089 USD de catálogo, dentro de 4 USD. Producto congelado 993dc09; logs single-agent-s3-r2 y single-agent-intent-r1.
- [ ] U5 Integración final — revisión y paquete completados: candidato fd2699527ea0 instalado desde tarball, Pi ordinario y regresiones de equipo pasan, doctor verifica 73 archivos. Falta integrar cuando termine el agente de interfaz; se conserva la entrega en fix/agente-unico-consolidado.

## Evidencia

Revisión final: Pi omite `state` en peticiones auxiliares; se reprodujo en rojo la compactación inmediatamente después de reabrir una selección manual. Se recupera la elección desde la entrada pública de sesión de Pi y se verifica con datos de una sesión nativa y una instancia nueva del enrutador. La corrección posterior al banco tiene regresión local; no se repite la tanda alojada.

Checks completos del recorrido consolidado pasan (`/tmp/nein-single-agent-check.log`), incluido Pi real con proveedor determinista y paquete.

La preparación de U4 falló antes de inferir por disco lleno. Se conservaron diagnósticos y archivos congelados; se retiraron copias de preparación propias y dependencias regenerables de correcciones terminadas. Manifest de limpieza en `../n_ein-bench/logs/single-agent-storage-cleanup.json`. El arnés comprueba espacio antes de preparar y limpia solo dependencias de su copia de corrección. No se tocaron código, commits, sesiones ni resultados de los ensayos.

Banco terminado sobre `993dc09`, automático: `single-agent-s3-r2` y `single-agent-intent-r1`. S3 eligió Sol high; intent eligió Sol high, la implementación pasó a Sol medium, la corrección lo conservó y la nueva errata eligió Luna high. Sin hijos. El intento single-agent-s3-r1 no llegó a llamar a modelos.

El experimento anterior queda conservado en `evals/results/2026-10-07-coordinacion-contexto.md` y en Git, incluido su candidato `00dab7096225`. No repetir aquel banco. El relevo real con equipos queda aplazado junto con el experimento; el relevo ordinario Pi↔Claude ya tiene evidencia en `evals/results/2026-10-06-flujo-conversacional.md`.

## Siguiente paso

Entrega comprobada en este worktree y en dist/single-review-fd2699527ea0/preview. Candidato fuente fd2699527ea0, hash y resultados en evals/results/2026-10-07-agente-unico.md. La instalación personal sigue en 3bc9b8006cc0.

Cuando el agente de interfaz termine, integrar conservando su atajo Ctrl+Shift+E para el equipo y nuestros opt-in/instrucciones; combinar en typecheck las entradas de receipts/tools-view con codegraph y conservar ambos grupos de tests. No hacer stash, reset ni incluir su trabajo inacabado en nuestros commits. Se pidió confirmar el estado de esa integración; mientras siga trabajando se mantiene esta rama aislada. No repetir el banco: ambos casos pasan.
