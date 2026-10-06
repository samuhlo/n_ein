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
- [x] F2b · Ajustes y descubrimiento — tabla nueva en el siguiente encargo, modelo conservado al continuar y portada orientada a conversación.
- [x] F4 · Evaluación y preview — seis recorridos reales, evidencia y paquete actualizado reversible.

## Evidencia

- F4 (entrega): candidato 0.1.0-preview.2+hotfix.3bc9b8006cc0, tarball y paquete comprobados; doctor correcto y sesión real instalada de diseño sin escrituras. build-preview.sh aísla ahora sus ajustes de smoke tras observar el fallo con la tabla personal.
- F4 (modelos): seis recorridos aceptados, más control negativo de pregunta sobre Claude y segunda ejecución básica. Un único punto de decisión en diseño; ninguna pregunta en arreglo, autorización, nuevo encargo ni reanudación. Relevo hablado Pi→Claude→Pi con proyecto intacto. Evidencia en evals/results/2026-10-06-flujo-conversacional.md.
- F2b: rojo observado al cambiar una clase y empezar otro encargo; verde al recargar ajustes y conservar la ruta física de la continuación. Una configuración inválida no provoca fallback.
- F3: regresión roja de relevo desde herramienta; verde con señal escrita solo en agent_end, cancelación, nueva entrada y cambio de sesión. El comando y la conversación comparten prepare; Claude carga to-pi ante petición natural explícita. `./scripts/check.sh` correcto.
- F2: rojo observado en «Otra cosa» y paso de diseño a implementación; tests del modelo virtual comprueban conservación de riesgo, cita real del usuario y respeto de selección manual. `./scripts/check.sh` correcto.
- F1: `tests/skills.ts` valida las instrucciones entregadas y el catálogo; la efectividad conversacional se comprobará en F4 con modelos.
- Base limpia: 7e18da8. El trabajo anterior y sus decisiones se conservan en Git, docs/01-decisiones.md y evals/results/2026-10-06-fiabilidad.md.

## Siguiente paso

Trabajo terminado. Preview local 0.1.0-preview.2+hotfix.3bc9b8006cc0 instalada y comprobada; no se publicó ni se promovió estable.

## Siguiente encargo: paralelismo recuperable

### Estado y autorización

Investigación y diseño acordados el 6 de octubre tras «Sí a las recomendaciones». Implementación pendiente de autorización; la autorización del flujo conversacional anterior no se extiende por inferencia a este nuevo alcance. El corte cerrado y su evidencia se conservan arriba.

### Objetivo y acuerdo

Reducir la espera en encargos con partes independientes, conservando calidad, continuidad y coste total razonable. Una conversación y un coordinador responsable de la integración; hasta dos trabajadores generalistas simultáneos inicialmente. El coordinador puede programar y decide cuándo repartir el trabajo autorizado, anuncia el reparto y respeta «hazlo con uno».

Decisiones y motivos en [docs/01-decisiones.md](docs/01-decisiones.md#paralelismo-acordado-el-6-de-octubre--pendiente-de-implementar). Contratos compartidos con responsable; escritores en worktrees distintos; comunicación acotada sobre resultados, cambios y bloqueos. Modelos por dificultad, sin delegación obligatoria para abaratar. Al cerrar se detienen los trabajadores; al volver se recupera el trabajo, incluso con agentes nuevos. Ejecutar con la aplicación cerrada queda aplazado.

### Criterios observables para la implementación

- Una tarea pequeña o dependiente puede completarse con un solo agente; una con dos frentes independientes puede avanzar simultáneamente, sin exigir comandos al usuario.
- Cada frente conserva alcance, dependencias, responsable, rama/base/HEAD, cambios sin commit, decisiones, comprobaciones, bloqueo y siguiente paso. El coordinador mantiene el único checklist en `WORK.md`; el runtime conserva las referencias técnicas necesarias.
- El resultado integrado satisface la aceptación del encargo. Haber pasado pruebas en cada rama no basta; cambios de contrato y de código invalidan la evidencia afectada.
- Cierre normal, fallo de un trabajador e interrupción abrupta conservan cambios y permiten reconciliar el estado real al volver, sin declarar terminado trabajo parcial ni asumir que un registro representa un proceso vivo.
- Reanudar o relevar Pi↔Claude no permite dos escritores sobre el mismo árbol. Si el destino no dispone de trabajadores, conserva las tareas y puede continuarlas secuencialmente.
- Comparación secuencial/paralela con mismo encargo, base, aceptación y capacidad de modelos: medir calidad, duración hasta integración comprobada, consumo de todos los agentes, correcciones e intervención humana. Separar beneficio de paralelismo del cambio a modelos baratos; registrar límites y variabilidad.

### Próximo tramo propuesto

Tras autorización de implementación: elegir el mecanismo más pequeño compatible con Pi, demostrar dos frentes aislados y su integración, demostrar interrupción/reanudación y relevo, y comparar con ejecución secuencial antes de activar la capacidad en la preview personal. Detalles técnicos reversibles a cargo del agente; no reabrir las decisiones ya confirmadas.
