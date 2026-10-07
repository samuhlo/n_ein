# Agentes en paralelo y continuidad

## Objetivo

Continuación autorizada el 7 de octubre: «Vamos probar a implementarla entonces, a ver si logramos que funcione y mejore nuestro agente». Implementar investigación acotada con el mismo equipo y reparto temprano; medir utilidad con calidad, tiempo y consumo total, sin activar la preview por inferencia.

«Implementa todo para que funcione perfecto y ve haciendo commits, cuando acabes lo reviso.» Incorporar trabajadores generalistas visibles y recuperables al flujo conversacional, con calidad y coste y tiempo razonables.

## Autorización

Implementación, pruebas y commits autorizados. Probar en copias e instalaciones aisladas; conservar el trabajo del usuario y Ein legado. Activar la preview solo si la evidencia del piloto lo justifica. Sin push, PR, publicación remota ni promoción estable.

## Decisiones

- Un coordinador, una conversación y hasta dos trabajadores Pi simultáneos. El coordinador puede programar y responde por la integración y la aceptación.
- Un escritor por worktree, contratos compartidos con responsable y resultados por eventos. Un resultado de trabajador no completa el encargo por sí solo.
- Modelos de las clases existentes; respetar selección manual y conservar el modelo al retomar, salvo cambio explícito.
- `WORK.md` o el documento configurado conserva el acuerdo. Registro técnico en Git y sesiones persistentes de Pi; los worktrees viven fuera de `.git` para ser compatibles con Vite.
- Cerrar detiene los procesos supervisados; reanudar conserva cambios y decisiones. El relevo lleva todos los frentes y vuelve al proyecto coordinador.
- El piloto no acredita una mejora suficiente para activar automáticamente esta capacidad en la preview personal. Se entrega como experimento revisable.

Diseño: [docs/10-paralelismo.md](docs/10-paralelismo.md). Evidencia y límites: [evals/results/2026-10-06-paralelismo.md](evals/results/2026-10-06-paralelismo.md).

Revisión del 7 de octubre: [auditoría frente a Gentle](evals/results/2026-10-07-auditoria-paralelismo.md). El piloto no compara productos ni evalúa sesiones largas; se identifica investigación solapada y se separa contención del contexto de aceleración. Propuesto mejorar el reparto y comparar de forma equivalente, sin declarar ahorro demostrado ni cambiar la preview. Investigación realizada con trazas existentes, sin nuevas ejecuciones de modelos.

## Límites

Un proyecto Git y trabajadores Pi. Claude continúa secuencialmente. Sin equipos anidados, agentes de varios proyectos, servicios desatendidos ni cambios de cuenta para eludir límites de proveedor. Worktrees y control de procesos no son un sandbox para código hostil o procesos que escapen deliberadamente del control.

## Criterios

- Encargo pequeño → ejecución directa sin entrevista ni workers innecesarios.
- Frentes independientes → dos procesos y worktrees, coordinación e integración comprobada, sin memorizar comandos.
- Interrupción → conservar rama, base, cambios sin commit, modelo, sesión, evidencia y pendiente; no sustituir un escritor vivo.
- Relevo → parar antes de habilitar destino, preservar todas las ramas y una nueva indicación del usuario.
- Adopción → contar principal e hijos; aceptación funcional y de alcance primero, tiempo hasta el conjunto comprobado y consumo después.

## Tareas

- [x] C1 Investigación recuperable — herramienta de equipo con encargos de lectura, sin WORK.md, rama ni árbol limpio obligatorios; herramientas sin escritura y propiedad de proceso independiente del escritor. Git y Pi reales: dos lectores con coordinador bloqueado, intentos de bash/write rechazados, cambios locales preservados, sesión y consumo recuperados.
- [x] C2 Reparto y comprobación — investigar con quien implementa, reutilizar evidencia y evitar checks concurrentes sobre recursos generados compartidos; resultados disponibles en cuanto termine un frente también en print. Rojo/verde nativo: se retoma T2 antes de terminar T1. Instrucciones comprobadas estructuralmente; beneficio autónomo pendiente de C3.
- [x] C3 Piloto comparativo — ocho ejecuciones congeladas, 7,310642 USD estimados, todos los resultados conservados. Seis autónomas sin hijos; lectores explícitos reducen contexto y tokens con más latencia; dos escritores se integran, pero no acreditan ahorro. El directo nuevo S3 falla la comprobación posterior de mensajes (3/5), frente a 5/5 del control y del paralelo; no son entregas equivalentes en calidad.
- [ ] C4 Revisión y entrega — comprobaciones pertinentes, paquete aislado y commits; explicar beneficios observados y pendientes.

Fronteras de prueba: `nein_team` y Pi real (herramientas permitidas, entrega, continuación y parada), TeamStore con Git real (sin mutar el árbol de lectura), y aceptación externa del banco. Base de revisión de este corte: `e74e6c0`. Modelos alojados solo después de checks locales; presupuesto de ingeniería propuesto para esta tanda, no preferencia permanente del usuario.

- [x] P Investigación y plan — fuentes y decisiones conservadas.
- [x] P0 Transporte — RPC público, host Go, bash supervisado y pruebas de EOF/SIGKILL con Pi real.
- [x] P1 Estado e integración — dos activos, cola, Git real, recuperación, continuidad de sesión, modelos y conflictos preservados.
- [x] P2 Evaluación — nueve ensayos registrados; decisión de no adoptar automáticamente con la evidencia actual.
- [x] P3 Controles y transporte — menú y conversación, resultados compactos, bus nativo para parada y relevo desde varios árboles.
- [ ] P3 proveedor real — terminar Pi→Claude→Pi con ambos frentes. Bloqueado por `429 usage_limit_reached` de Claude; parada y transporte ya comprobados con destino controlado.
- [x] P4 Candidato — paquete instalado en hogar aislado y recorrido comprobado desde ese artefacto. No actualizar la preview personal al no pasar el criterio de adopción.

## Evidencia

- Corte del 7 de octubre: `./scripts/check.sh` completo pasa (log `/tmp/nein-context-check.log`), incluidos Git, permisos de lectura con Pi real y proveedor determinista, recuperación, EOF/SIGKILL, resultado temprano, relevo, tipos contra Pi 1.0.2 y paquete. No confundir estas comprobaciones con rendimiento del modelo alojado.
- Revisión C1: se reprodujo y corrigió la contención cuando `N_EIN_WORKTREE_ROOT` vive dentro del proyecto. La identidad del lector se bloquea por directorio, sin heredar el repo contenedor. Pasan Go, lectura nativa, RPC, muerte abrupta, entrega temprana, relevo y tipos; se conserva el bloqueo del coordinador.
- Revisión C4: lector sin primer commit reproducido en rojo y corregido, con Git y Pi reales. El banco original pasó S3, pero una comprobación posterior del error real a través del traductor de UI detectó que el directo nuevo devuelve un mensaje de avería ante un rechazo de cuenta (3/5); control anterior y paralelo pasan 5/5. Se conserva la evidencia original y se informa esta diferencia de calidad. La guía de reparto asigna comportamiento y consumidores, con exclusiones reales; la revisión sigue también el mensaje y la acción de recuperación del rechazo. Estas correcciones posteriores al banco no tienen una nueva medición con modelos.

- Seis ensayos autónomos: aceptación, suites y tipos correctos; no lanzaron hijos. No atribuir sus diferencias al paralelismo.
- Dirigido r1 detenido al descubrir la incompatibilidad de Vite bajo `.git`; datos preservados. Regresión sin modelos: rojo bajo `.git`, verde fuera con jsdom.
- Dirigidos r2/r3: dos hijos integrados, S3 3/3 y ambos mutantes detectados. Último: 528 s frente a 559 s del control; +24 % tokens y +34 % estimación de catálogo. No se amplía el banco buscando un resultado favorable.
- `scripts/check.sh` comprueba regresiones, procesos, Git, UI, relevo, paquete, Go/vet y tipos estrictos contra Pi 1.0.2. Los tests de Pi con proveedor determinista comprueban mecanismos, no capacidad de modelos alojados.
- Pi real abrió Claude con el estado de ambos frentes, pero Claude no infirió por cuota. Su mensaje indica reinicio a las 00:20 de Europe/Madrid; no se cambió de cuenta ni facturación.

## Siguiente paso

Corte del 7 de octubre: runtime en `738a3ab` y `fc1bf6f`, correcciones finales en `61cf7ba`. [Informe de coordinación y contexto](evals/results/2026-10-07-coordinacion-contexto.md), con revisión de calidad y límites, y [datos](evals/results/2026-10-07-coordinacion-contexto.json). El banco comparó `e74e6c0` y `fc1bf6f`, Sol medium, seis ejecuciones autónomas y dos explícitas. Las instrucciones corregidas después no tienen una segunda tanda alojada. Cerrar C4 con paquete aislado y mantener la preview personal; no repetir el banco buscando cifras favorables.

Candidato `0.1.0-preview.2+hotfix.087eaa8835a9` instalado desde tarball y comprobado (71 archivos; test nativo de equipo, reanudación y relevo controlado). Código y evidencia listos para revisión. Conservar la preview `0.1.0-preview.2+hotfix.3bc9b8006cc0`. Cuando exista cuota, el único recorrido de proveedor pendiente es `bun evals/bench/conversation.ts handoff-team <id-nuevo>`; no repetir la entrevista ni el banco completo por rutina.

## Corte anterior cerrado

Flujo conversacional instalado: `0.1.0-preview.2+hotfix.3bc9b8006cc0`; cierre `a82b00b`. Acuerdo inicial de paralelismo `febbbb5`, plan `b619eaa`. Evidencia anterior en [flujo conversacional](evals/results/2026-10-06-flujo-conversacional.md) y [calidad y continuidad](evals/results/2026-10-06-fiabilidad.md).
