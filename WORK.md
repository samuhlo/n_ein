# Agentes en paralelo y continuidad

## Objetivo

«Investiga bien, y hazme un plan para incorporar esto a n_ein de la forma más óptima, y mejorarlo si se puede.» Incorporar la experiencia de trabajadores visibles de Gentle Agents al flujo conversacional, con calidad, recuperación y coste total razonable.

## Autorización

Diseño confirmado con «Sí a las recomendaciones». Samu pidió después investigar, hacer pruebas e implementar si los resultados compensan, y concretó como siguiente entrega preparar el plan. Samu ha autorizado ejecutar todo el plan, hacer pruebas y commits y dejar el resultado para su revisión. La activación sigue condicionada a la evidencia. Sin publicación remota ni promoción estable. No cambiar la preview antes de superar las pruebas del plan.

## Decisiones

- Una conversación y un coordinador que puede programar y se responsabiliza de integrar y comprobar.
- Hasta dos trabajadores generalistas simultáneos inicialmente, con modelo adecuado a su encargo.
- El coordinador decide cuándo repartir trabajo autorizado, anuncia el reparto y respeta «hazlo con uno».
- Un escritor por worktree, contratos compartidos con responsable y aceptación sobre el resultado integrado.
- Al cerrar se detiene; al volver se recupera el trabajo aunque haga falta otro agente.
- `WORK.md` sigue siendo la guía común. Estado técnico y sesiones asociados sin otro checklist.
- Comparar con ejecución secuencial antes de activar el paralelismo habitual.

Decisiones y motivos: [docs/01-decisiones.md](docs/01-decisiones.md#paralelismo-acordado-el-6-de-octubre--pendiente-de-implementar). Investigación, alternativas, arquitectura y pruebas: [docs/10-paralelismo.md](docs/10-paralelismo.md).

## Límites

- Primer alcance: un proyecto Git, coordinador y trabajadores Pi; Claude puede continuar el trabajo secuencialmente en el relevo.
- Aplazar equipos anidados, agentes de varios proyectos, equipo nativo de Claude y ejecución con la aplicación cerrada.
- Conservar cambios del usuario, Ein legado, credenciales y sesiones. Ensayos en copias aisladas.
- El recorrido instalado sigue siendo de un agente; el diseño y el plan no acreditan implementación.

## Criterios

- «Investiga bien» → Gentle Shell actual, Matt, Pi instalado y superficies reales de n_ein → fuentes fijadas y separación de hechos, propuesta y ensayo pendiente.
- «Un plan para incorporar» → RPC, procesos, worktrees, modelos, memoria, UI, relevo y paquete → entregas con dependencias y aceptación comprobable.
- «Mejorarlo si se puede» → estado previo al lanzamiento, entrega idempotente, cierre real y aceptación integrada → casos de interrupción y comparación de calidad, tiempo y consumo.
- Una tarea pequeña conserva ejecución directa; dos frentes independientes pueden progresar simultáneamente sin exigir comandos.
- Cada frente conserva alcance, dependencias, rama/base/HEAD, cambios sin commit, decisiones, comprobaciones, bloqueo y siguiente paso.
- Recuperar o relevar Pi↔Claude preserva tareas y cambios y evita solapamiento de escritores en el mismo árbol.

## Tareas

- [x] P Investigación y plan — fuentes actuales, alternativas, riesgos, entregas y criterios de utilidad registrados.
- [x] P0 Transporte y ciclo de vida — seleccionar una integración RPC con parada comprobada en procesos reales. Bloqueada por: ninguna.
- [ ] P1 Dos frentes recuperables — worktrees, propiedad, estado duradero, eventos e integración. Bloqueada por: P0.
- [ ] P2 Comparación de utilidad — piloto secuencial/paralelo, ampliación condicionada a aceptación y señal de beneficio. Bloqueada por: P1.
- [ ] P3 Equipo visible y relevo — conversación, widget, controles y Pi↔Claude con trabajo parcial. Bloqueada por: P2 con resultado favorable.
- [ ] P4 Paquete y preview — artefacto instalado comprobado y actualización local reversible. Bloqueada por: P3 y aceptación conjunta.

P0–P4 son el siguiente corte de implementación, no trabajo ya ejecutado. Si el piloto no compensa, registrar el resultado, mantener ejecución directa y revisar solo la causa demostrada; no activar la capacidad por completar infraestructura.

## Evidencia

- P0: adaptador RPC público con host Go y bash con propietario propio. Rojo observado: al matar el grupo del trabajador moría el supervisor antes de parar su bash separado; verde al independizar el grupo del supervisor. Tests de lease, EOF, SIGKILL y Pi 1.0.2 RPC real sin modelo. Se conserva el descriptor hasta que salen los comandos.

- Investigación: Gentle `69c9b5a`, Matt `6fd9479`, Pi instalado `1.0.2`, base n_ein `febbbb5`. Se inspeccionaron código, documentación y casos de prueba; no se ejecutaron suites externas ni nuevas evaluaciones con modelos.
- Gentle Agents completo está acoplado a otras superficies de Gentle. La base recomendada es RPC público de Pi; P0 determinará si basta su cliente exportado o conviene un adaptador acotado.
- `RpcClient.stop()` no acredita por contrato la salida de todas las herramientas descendientes. El relevo actual solo resume el árbol principal. Son puntos de ensayo e implementación, no fallos reproducidos en este corte.
- Plan contrastado con launcher, handoff, flujo, router, memoria, CodeGraph y banco existentes. Referencias documentales y formato comprobados; capacidad y rendimiento siguen pendientes.

## Siguiente paso

P0 comprobado. Continuar P1: estado persistente y dos frentes aislados, con integración y recuperación.

## Corte anterior cerrado

El flujo conversacional quedó terminado e instalado en `0.1.0-preview.2+hotfix.3bc9b8006cc0`; documentación de cierre en `a82b00b`, acuerdo inicial de paralelismo en `febbbb5`. Evidencia del trabajo anterior: [flujo conversacional](evals/results/2026-10-06-flujo-conversacional.md) y [calidad y continuidad](evals/results/2026-10-06-fiabilidad.md). Sus decisiones duraderas se conservan en `docs/01-decisiones.md`. Sin publicación ni promoción estable.
