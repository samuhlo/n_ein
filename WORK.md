# Flujo conversacional

## Objetivo

«Que el flujo sea fluido», ayude a diseñar lo que falta, elija el modelo, entregue código fiable con coste y tiempo razonables y sea intuitivo «sin memorizar mil comandos». Implementación autorizada por «Hazlo» tras la propuesta de seis recorridos conversacionales.

## Autorización

Implementar, probar y hacer commits de este corte. Actualizar la preview local comprobada con backup. Sin publicación remota ni promoción estable.

## Decisiones

- Conversación como entrada ordinaria; los comandos siguen siendo atajos.
- Petición de ayuda para definir o diseñar activa intent; las ideas vagas reciben una oferta concreta. Peticiones claras van directas.
- El agente usa las skills pertinentes y organiza su trabajo; no exige que el usuario encadene spec/tasks/review.
- Un modelo por encargo, estable durante las continuaciones, con corrección visible al aclarar alcance, empezar otro encargo o descubrir riesgo.
- Comprobaciones proporcionales y reutilización de evidencia vigente; cierre breve y completo.
- Un mecanismo de relevo, con el origen terminado antes del destino. La salida manual que exija Claude se explica en ese momento.

## Límites

- Conservar el trabajo previo de 7e18da8, incluida la detección por HEAD.
- Los acuerdos de diseño no autorizan código. No perder trabajos pendientes al empezar otro.
- Ein legado y proyectos habituales intactos; ensayos en copias aisladas, sin copiar credenciales entre hogares.

## Criterios

- Diseño abierto → preguntas útiles con recomendaciones y sin escrituras prematuras.
- Petición clara → cambio comprobado, sin entrevista ni pedir una skill.
- «Hazlo» → ejecutar el acuerdo sin otra aprobación administrativa.
- «Otra cosa» → nueva elección de modelo; una corrección del mismo encargo conserva su clase.
- «Sigue donde lo dejamos» → conservar decisiones, evidencia y trabajo terminado.
- Relevo en lenguaje natural → preparar estado, terminar origen y arrancar destino; sin pedir al usuario el nombre de la skill.
- Medir resultado, preguntas evitables, coste estimado y tiempo; no equiparar pocos tokens con aceptación.

## Tareas

- [x] F1 · Método conversacional — intent, guía y tareas automáticas, checks proporcionales y cierre breve.
- [x] F2 · Modelo por encargo — nuevo objetivo y selección según alcance conocido, con anuncios y atajos existentes.
- [x] F3 · Relevo conversacional — Pi y Claude reciben la petición natural y usan el mecanismo existente con cierre ordenado.
- [ ] F4 · Evaluación y preview — seis recorridos reales, evidencia y paquete actualizado reversible.

## Evidencia

- F3: regresión roja de relevo desde herramienta; verde con señal escrita solo en agent_end, cancelación, nueva entrada y cambio de sesión. El comando y la conversación comparten prepare; Claude carga to-pi ante petición natural explícita. `./scripts/check.sh` correcto.
- F2: rojo observado en «Otra cosa» y paso de diseño a implementación; tests del modelo virtual comprueban conservación de riesgo, cita real del usuario y respeto de selección manual. `./scripts/check.sh` correcto.
- F1: `tests/skills.ts` valida las instrucciones entregadas y el catálogo; la efectividad conversacional se comprobará en F4 con modelos.
- Base limpia: 7e18da8. El trabajo anterior y sus decisiones se conservan en Git, docs/01-decisiones.md y evals/results/2026-10-06-fiabilidad.md.

## Siguiente paso

F4: ejecutar los recorridos completos con modelos y medir resultado, preguntas, tiempo y coste.
