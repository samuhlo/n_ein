# Mejoras de experiencia y ejecución

## Objetivo

Samu pide «un plan para incorporar todas estas mejoras», desarrollar «haciendo commits en una rama nueva» y montar «una PR explicando todas las mejoras incluidas». La PR #22 ya está integrada; ahora pide «Saca nueva version». Publicar 0.5.0-alpha.1 del canal preview, con las mejoras revisadas y sus límites explícitos.

## Autorización

Implementación, pruebas aisladas, commits, push de `feat/encargo-visible` y PR hacia main autorizados el 30 de octubre. La petición posterior «Saca nueva version» autoriza preparar e integrar la versión, push, tag y release necesarios. Sin actualización personal; legado intacto. Alcance: propuesta de la auditoría de esta conversación y [plan](docs/13-experiencia.md).

## Decisiones

- Un agente y un modelo por encargo siguen siendo el recorrido ordinario. Procesos en segundo plano no son subagentes.
- Una paleta de acciones con adaptación a cada host y solo APIs comprobadas.
- WORK.md sigue siendo la guía; procesos, sesiones y evidencia son registros técnicos y vistas, no otra lista de tareas.
- Sol 6.1 high se mantiene en p_reviewer. Evaluar antes de promover instrucciones; conservar resultados desfavorables.
- Delegación por contexto: experimento explícito, sin activarla por defecto ni prometer ahorro.
- El encargo previo se conserva íntegro en [su archivo](docs/archive/work/2026-10-30-previewer.md). T7 (Omarchy real) y T9 (detección general/valoración humana) siguen abiertos.

## Límites

Sin nuevo motor de orquestación, memoria obligatoria ni copia de credenciales. Música, Vim, dictado y YOLO se investigaron pero no formaron parte de las mejoras recomendadas. Las funciones nuevas también se usan por conversación.

## Criterios

- «todas estas mejoras» → paleta, ejecución, continuidad, evidencia, revisor, diseño y experimento → recorridos y pruebas del plan.
- «haciendo commits» → una unidad útil por commit, con documentación y comprobaciones.
- «PR explicando» → cambios, demostraciones, pruebas y límites; publicación posterior a revisión.

## Tareas

- [x] T1 · Confianza — continuidad de correcciones, consumo desconocido y versión de Claude en CI.
- [x] T2 · Paleta — catálogo, búsqueda, descripciones, disponibilidad, borrador y acceso por host.
- [x] T3 · Procesos — segundo plano, monitores acotados, vista, avisos y parada antes del relevo.
- [x] T4 · Sesiones — objetivo/avance/siguiente paso, búsqueda, estado fechado y consulta sin inferencia.
- [x] T5 · Encargo — peticiones, tareas y comprobaciones con identidad de archivos y vigencia.
- [x] T6 · Revisor — cobertura por riesgos y evaluación con control y casos reservados.
- [x] T7 · Diseño — variantes, comentarios, dirección elegida y comprobación visual.
- [x] T8 · Contexto — observación y ensayo de directo/continuación/delegación.
- [x] T9 · Entrega — revisión integrada, suite/tipos, paquete, documentación, push y PR con CI.

- [x] R1 · Preparar 0.5.0-alpha.1, bootstrap, notas y candidato instalado.
- [x] R2 · Verificar e integrar la preparación en main y publicar el tag con su matriz.
- [x] R3 · Comprobar adjuntos publicados y bootstrap de Pages; registrar entrega.

## Evidencia

Base `b0f6f27`; árbol limpio y origin/main sin commits adicionales. Auditoría previa: diez scripts pasan, incluido Pi con proveedor determinista. No acredita el código nuevo.

T1: regresión nueva de consumo en rojo antes del módulo; usage, engine y web pasan. CI deriva Claude de runtime.json. Instrucciones de revisión continúan correcciones recuperables dentro del alcance.

T2: búsqueda local, disponibilidad, borrador y terminal estrecha comprobados; 15 pruebas del plugin pasan con Claude 2.1.302, incluida interacción del panel. Diferencia de acceso por host documentada.

T3: procesos reales con backend nativo Pi, códigos de salida, monitor ruidoso, cancelación de grupo y parada sin despertar al origen pasan. Tipos contra Pi 1.0.2 pasan. Claude conserva sus tareas nativas.

T4: sesiones de Pi y Claude con identidad independiente, búsqueda por proyecto/todos, conservación al cerrar y rechazo de registro corrupto comprobados. CLI empaquetada y notas incorporadas al Panel.

T5: comando real, error, criterio inexistente, cambios durante la comprobación y archivo nuevo invalidando evidencia pasan. Web real compila; API comprueba Host/Origin/token y dibuja contenido como texto. Se añade al smoke instalado.

T7: variantes, diez comentarios concurrentes, elección/implementación/aceptación, rutas y captura comprobados. En Zen real: encargo visible, token retirado, elemento señalado, comentario persistido y elección de dirección. Se corrigió la carga ESM detectada en ese recorrido y se añadió regresión.

T6: [comparación de foco](evals/results/2026-10-30-review-focus.md), doce intentos. Base 3/4 referencias; candidata 2/4 y un timeout. Candidata no promovida, revisor ordinario intacto; 1,38044 USD estimados.

Revisión integrada: los trabajos pasan ahora por `executeTool` para conservar los hooks/permisos de bash, además de su backend. Una prueba con Pi real confirma entrega en segundo plano y rechazo nativo sin ejecutar el comando.

T8: [piloto de contexto](evals/results/2026-10-30-context.md), tres rutas. Código aceptado en las tres, pero la delegada agotó plazo y dejó la guía pendiente; no se promueve. Directo fue más rápido/barato.

T9: suite completa y paquete instalado pasan sobre `40c02a1`; la regresión posterior de comentarios largos pasa en `4fc2eaf`. [PR #22](https://github.com/samuhlo/n_ein/pull/22) integrada en `72b64ab`; su árbol coincide con el head revisado `6f22636`. [Matriz CI](https://github.com/samuhlo/n_ein/actions/runs/41045558424) completa en verde sobre `4fc2eaf`: macOS, Linux, payload común y artefacto instalado como usuario sin privilegios en Ubuntu y Arch. [Aceptación y límites](evals/results/2026-10-30-experience.md).

Corrección de CI: la ejecución posterior `41046772452` detectó una carrera entre el sondeo y el arranque en la prueba de lectores. Se sustituye el polling que adquiere flock por una señal de preparación del hijo, sin cambiar los bloqueos del producto; el test nativo pasa localmente. La PR conserva ambas ejecuciones.

R1: versión/ bootstrap/enlaces comprobados; `build-release.sh 0.5.0-alpha.1` pasó sobre `7f5a025`, incluida instalación desde tarball y doctor. Candidato local macOS arm64 SHA-256 `5115251552fcdf377a49cc1f94b98bbcc795d7e34fed80bba944769fcc2635b9`. La publicación construirá y verificará sus propios adjuntos desde el tag definitivo.

R2–R3: [0.5.0-alpha.1 publicada](https://github.com/samuhlo/n_ein/releases/tag/v0.5.0-alpha.1), prerelease preview, tag en `99e0d0642ecd10d124eef21c6662c6dc9ef27309`. [PR #23](https://github.com/samuhlo/n_ein/pull/23) integrada tras [matriz verde](https://github.com/samuhlo/n_ein/actions/runs/41083397059). [Workflow del tag](https://github.com/samuhlo/n_ein/actions/runs/41084441165) completo, incluidos publicación, attestation y Pages.

Los nueve adjuntos descargados se verificaron con `verify-release-assets.py`: mismas fuentes, manifiestos, modos, hashes e instaladores. `gh attestation verify` validó ambos tarballs y `install.sh`, exigiendo repositorio, workflow de release, ref del tag, commit de origen y runners alojados. SHA-256 de los tarballs publicados: macOS `58e85dff2e18e12892454533bc3fec1dfe4b1cd0ae6360ea3fb39a196f1f0c61`; Linux `476d0c509eb27eba79e389b3d475b850e59b5a193d75f61f82d627230630a09e`. El bootstrap público coincide byte a byte con el adjunto y su dry-run selecciona 0.5.0-alpha.1 sin crear el hogar ni el enlace del ensayo. Assets locales en `dist/published-0.5.0/`; log del dry-run en `/private/tmp/nein-050-public-dryrun.log`. No se actualizó la instalación personal ni se tocó el legado.

## Siguiente paso

Versión publicada. La actualización personal queda para cuando Samu la pida. Continúan los pendientes ya declarados de Omarchy gráfico y cobertura/valoraciones humanas de p_reviewer; no bloquean ni se presentan como resueltos por esta release.
