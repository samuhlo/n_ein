# Mejoras de experiencia y ejecución

## Objetivo

Samu pide «un plan para incorporar todas estas mejoras», desarrollar «haciendo commits en una rama nueva» y montar «una PR explicando todas las mejoras incluidas». Revisará antes de sacar versión. Descubrir funciones, trabajar sin vigilancia continua y conectar petición, cambios y evidencia.

## Autorización

Implementación, pruebas aisladas, commits, push de `feat/encargo-visible` y PR hacia main autorizados el 30 de octubre. Sin merge, release ni actualización personal; legado intacto. Alcance: propuesta de la auditoría de esta conversación y [plan](docs/13-experiencia.md).

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
- [ ] T5 · Encargo — peticiones, tareas y comprobaciones con identidad de archivos y vigencia.
- [ ] T6 · Revisor — cobertura por riesgos y evaluación con control y casos reservados.
- [ ] T7 · Diseño — variantes, comentarios, dirección elegida y comprobación visual.
- [ ] T8 · Contexto — observación y ensayo de directo/continuación/delegación.
- [ ] T9 · Entrega — revisión integrada, suite/tipos, paquete, documentación, push y PR con CI.

## Evidencia

Base `b0f6f27`; árbol limpio y origin/main sin commits adicionales. Auditoría previa: diez scripts pasan, incluido Pi con proveedor determinista. No acredita el código nuevo.

T1: regresión nueva de consumo en rojo antes del módulo; usage, engine y web pasan. CI deriva Claude de runtime.json. Instrucciones de revisión continúan correcciones recuperables dentro del alcance.

T2: búsqueda local, disponibilidad, borrador y terminal estrecha comprobados; 15 pruebas del plugin pasan con Claude 2.1.302, incluida interacción del panel. Diferencia de acceso por host documentada.

T3: procesos reales con backend nativo Pi, códigos de salida, monitor ruidoso, cancelación de grupo y parada sin despertar al origen pasan. Tipos contra Pi 1.0.2 pasan. Claude conserva sus tareas nativas.

T4: sesiones de Pi y Claude con identidad independiente, búsqueda por proyecto/todos, conservación al cerrar y rechazo de registro corrupto comprobados. CLI empaquetada y notas incorporadas al Panel.

## Siguiente paso

Implementar T1 y continuar por el plan. Detalle de resultados en `evals/results/`; aquí solo avances y límites útiles.
