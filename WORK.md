# Agente único: calidad, contexto y conversación

## Objetivo

«Venga, pues vamos a implementar todo, y sacar un pepinazo. Dale caña». Consolidar el recorrido ordinario de un agente y un modelo por encargo; revisar de extremo a extremo; explorar con menos contexto redundante; conservar el acuerdo al diseñar y corregir; validar el selector y preparar una preview comprobada.

## Autorización

Implementación, pruebas y commits autorizados. El 7 de octubre Samu pidió «Vale, integra todo y saca nueva version»: integrar la consolidación y los recibos de interfaz, publicar `0.1.0-preview.3` y actualizar la preview personal con backup. Mantener el canal preview y preservar ajustes, autenticación, sesiones y Ein legado.

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
- [x] U5 Integración final — recibos y consolidación en main, checks completos y paquete desde tarball: doctor verifica 75 archivos, Pi ordinario, recibos nativos y regresiones de equipo pasan. Preview personal actualizada con backup; 560 archivos personales idénticos. Fuente de release 936e682.

## Evidencia

Revisión final: Pi omite `state` en peticiones auxiliares; se reprodujo en rojo la compactación inmediatamente después de reabrir una selección manual. Se recupera la elección desde la entrada pública de sesión de Pi y se verifica con datos de una sesión nativa y una instancia nueva del enrutador. La corrección posterior al banco tiene regresión local; no se repite la tanda alojada.

Checks completos del recorrido consolidado pasan (`/tmp/nein-single-agent-check.log`), incluido Pi real con proveedor determinista y paquete.

La preparación de U4 falló antes de inferir por disco lleno. Se conservaron diagnósticos y archivos congelados; se retiraron copias de preparación propias y dependencias regenerables de correcciones terminadas. Manifest de limpieza en `../n_ein-bench/logs/single-agent-storage-cleanup.json`. El arnés comprueba espacio antes de preparar y limpia solo dependencias de su copia de corrección. No se tocaron código, commits, sesiones ni resultados de los ensayos.

Banco terminado sobre `993dc09`, automático: `single-agent-s3-r2` y `single-agent-intent-r1`. S3 eligió Sol high; intent eligió Sol high, la implementación pasó a Sol medium, la corrección lo conservó y la nueva errata eligió Luna high. Sin hijos. El intento single-agent-s3-r1 no llegó a llamar a modelos.

El experimento anterior queda conservado en `evals/results/2026-10-07-coordinacion-contexto.md` y en Git, incluido su candidato `00dab7096225`. No repetir aquel banco. El relevo real con equipos queda aplazado junto con el experimento; el relevo ordinario Pi↔Claude ya tiene evidencia en `evals/results/2026-10-06-flujo-conversacional.md`.

## Publicación de preview.3

Integrados los recibos del otro agente (`abf1a4d`) y la consolidación (`13a68a3`), conservando Ctrl+Shift+E, opt-in de equipo y ambos grupos de checks. La prueba con el componente real de Pi detectó desbordamiento en terminal estrecha; se corrige con el recorte nativo y se sanea la ruta visible. La evidencia del modelo se conserva intacta y el detalle se despliega completo.

La primera suite falló en la espera de arranque del coordinador del test de lectores (3 segundos); el caso aislado pasó. Se amplía el margen a 10 segundos y se asegura limpieza incluso si falla la espera. La repetición completa pasa: `/tmp/nein-preview3-check-final.log`, «checks locales: OK».

Entrega terminada: main y tag publicados, CI Linux y macOS correctos, manifiestos comparados y cuatro adjuntos publicados con digest remoto verificado. Preview personal actualizada con backup y datos intactos. [Evidencia de publicación](evals/results/2026-10-07-preview3.md). No repetir el banco alojado ya aceptado.
