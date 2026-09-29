# Roadmap de Ein

El [manifiesto](../MANIFIESTO.md) manda. Las decisiones duraderas viven en
`docs/adr/`; el comportamiento actual, en `openspec/specs/`.

## Estado — piloto inicial terminado

El [piloto del 2026-09-08](../evals/simple-pilot-2026-09-08.md) probó cinco
encargos cerrados sobre copias de módulos de Planificador y BERRO. Astra/high
preparó el plan; Astra/low y Luna/low ejecutaron los mismos packets v2.
Astra pasó 5/5 al primer intento; Luna, 4/5 y el quinto tras completar el
contexto de compilación en el plan. Los costes API atribuibles, incluida la
reparación, fueron 0,9451 y 0,3968 USD respectivamente. Luna gastó más tokens.
Son resultados de un piloto pequeño, no una promoción de modelo ni una prueba
con IA local.

Se retiró duplicación de persona/voz y la inyección de convenciones de edición
al padre. Tres pruebas de contexto controlado redujeron la entrada alrededor
del 9 %, conservando el comportamiento tras una corrección de identidad.
Reanudación y compactación se comprobaron en una sesión aislada. El catálogo
nativo de skills y los contratos de fase siguen como estaban. El ahorro no se
extrapola al total de la instalación ni a sesiones largas.

El informe conserva intentos fallidos, costes, límites, comprobaciones y un
archivo local reproducible. El cambio de código y el paquete host están
preparados; la instalación habitual no se ha modificado.

## Siguiente — usarlo en proyectos

El recorrido sigue siendo: modelo capaz concreta un grupo pequeño → ejecutor
barato aplica → herramientas comprueban → Samu revisa el diff y la explicación.
El encargo incluye las opciones reales de compilación y los checks pertinentes;
la prueba mostró que omitir contexto útil transfiere problemas al ejecutor.
Se reutilizan tareas, packets, routing, skills y contabilidad existentes.

Los defectos del observador global (`ambiguous-change` y llamadas mixtas) siguen
identificados. El piloto los evitó con atribución explícita por tarea/intento;
no están corregidos ni deben interpretarse sus tasas como calidad de los planes.
Reparar ese borde cuando impida medir el trabajo real, sin ampliar la telemetría.

El siguiente ensayo local depende de disponer de un modelo servido. No se
construye una capa de proveedores para anticiparlo. El
[ADR 0005](adr/0005-make-cheap-apply-verifiable.md) conserva las garantías y los
criterios de promoción de ejecución habitual; el piloto supervisado no demuestra
confinamiento ni los sustituye.

## Límite de trabajo en el arnés

Se retira la secuencia de nueve cortes como trabajo comprometido. Nuevos
presupuestos por fase, runners, sistemas de evidencia, integraciones, perfiles
para terceros y más paridad quedan fuera de prioridad. Se conserva lo que ya
funciona y se modifica Ein ante un problema concreto de uso.

Un cambio activo cada vez, entregado por comportamiento revisable. Los cambios
de scout ya en curso se preservan y se revisan antes de tocar sus superficies.
Al sustituir un mecanismo se retira su duplicación cuando sea seguro. No se abre
otra campaña de limpieza ni se necesita completar una arquitectura ideal para
volver al trabajo en proyectos.
