# Plan de incorporación de experiencia y ejecución

Autorizado el 30 de octubre de 2026. Rama `feat/encargo-visible`, base `b0f6f27`. La entrega es una PR; Samu revisa antes de decidir versión e instalación. WORK.md mantiene el avance.

## Fundamento

Investigación de Gentle Shell main `f2427a987c597b651207effa741868447b5d640b`, 47 commits tras 4.5.1. Se adaptan ideas y comportamientos: Go fuera del runtime, TypeScript dentro de Pi, archivos neutros entre hosts. Código propio salvo atribución explícita en NOTICE.md; sin adoptar su motor RDD ni sus instrucciones como políticas activas.

Fuentes: [paleta](https://github.com/Gentleman-Programming/gentle-shell/blob/f2427a987/lib/command-palette.ts), [procesos](https://github.com/Gentleman-Programming/gentle-shell/blob/f2427a987/lib/background-jobs.ts), [sesiones](https://github.com/Gentleman-Programming/gentle-shell/blob/f2427a987/docs/gentle-agents-activity.md), [diseño](https://github.com/Gentleman-Programming/gentle-shell/blob/f2427a987/skills/design/SKILL.md), [contexto](https://github.com/Gentleman-Programming/gentle-shell/blob/f2427a987/lib/context-backstop.ts).

## Secuencia y aceptación

| Tramo | Implementación | Comprobación que decide la entrega |
|---|---|---|
| T1 Confianza | Continuar correcciones recuperables; consumo con cobertura; CI desde runtime.json. | Ausencia distinta de cero; datos antiguos conservados e incompletos; mismo host probado. |
| T2 Paleta | Catálogo por intención, búsqueda local, descripciones, acceso Pi y Claude. | Conserva borrador; prepara argumentos; buscar no inicia inferencia; terminal estrecha y disponibilidad. |
| T3 Procesos | Ejecutor nativo Pi, logs fuera del contexto, resultado único, monitores limitados, vista y avisos. | Salida/fallo de proceso real; cancelar descendientes; shutdown/relevo espera parada; sin reintentos automáticos. |
| T4 Sesiones | Resumen por sesión/proyecto, fecha, búsqueda/consulta sin despertar modelos, acceso desde Panel. | Dos sesiones independientes, reinicio, registros antiguos/ilegibles, aislamiento, sin exclusión general. |
| T5 Encargo | Vista de WORK.md y evidencia ejecutada ligada a archivos, dependencias y comando. | Modificar archivo rastreado o nuevo invalida evidencia; error nunca es éxito; continuidad entre hosts. |
| T6 Revisor | Candidata por riesgos y alcance examinado, mismo modelo y bucle. | Control/candidata sobre defectos y cambios correctos, casos reservados; omisiones, avisos, tiempo y consumo. |
| T7 Diseño | Variantes HTML, comentarios, elección y comparación con preview local; vision/prototype. | Comentario dirigido y persistente; rutas confinadas; elegido/implementado/comprobado separados. |
| T8 Contexto | Métrica de contexto y aviso proporcionado; ensayo directo, continuación y unidad delegada. | Mismo modelo/aceptación; intentos e integración contabilizados; ruta ordinaria intacta. |
| T9 Entrega | Documentación, revisión de consumidores, paquete y PR. | Suite/tipos finales, artefacto aislado y CI; sin merge/release/instalación personal. |

## Integración

La paleta usa acciones existentes y las nuevas. Los procesos publican hechos y las sesiones resúmenes acotados. El encargo combina documento y registros sin inferir autorización ni convertir un fallo auxiliar en veto. p_reviewer mantiene invocación explícita con coste. Diseño usa archivos del proyecto y un servidor loopback con acceso acotado.

Se comprueban las APIs de cada host antes de anunciar paridad. Cuando un host aporta procesos/avisos, se conservan sus capacidades nativas. Pi permanece fijado salvo que una necesidad demostrada requiera actualizarlo y se valide el paquete.

## Evaluación y promoción

Fixtures y procesos reales para mecánica determinista. Ensayos alojados secuenciales y acotados, hogares de prueba y credenciales nativas sin copia. Conservar intentos fallidos y resultados negativos. Comparar aceptación completa y consumo/tiempo total; una candidata peor queda experimental y la PR explica el resultado.

Reversión de producto mediante restore. Registros nuevos versionados, lectura tolerante y escrituras atómicas; datos previos nunca se presentan como evidencia nueva. Sin migrar la instalación personal.

## Consumo del revisor

La web distingue estimación completa, parcial y desconocida. El runner conserva escritura de caché y cobertura por mensajes; los importes históricos siguen disponibles pero no acreditan cobertura. Son estimaciones de catálogo, nunca facturación.
