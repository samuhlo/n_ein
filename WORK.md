# Agentes en paralelo y continuidad

## Objetivo

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

## Límites

Un proyecto Git y trabajadores Pi. Claude continúa secuencialmente. Sin equipos anidados, agentes de varios proyectos, servicios desatendidos ni cambios de cuenta para eludir límites de proveedor. Worktrees y control de procesos no son un sandbox para código hostil o procesos que escapen deliberadamente del control.

## Criterios

- Encargo pequeño → ejecución directa sin entrevista ni workers innecesarios.
- Frentes independientes → dos procesos y worktrees, coordinación e integración comprobada, sin memorizar comandos.
- Interrupción → conservar rama, base, cambios sin commit, modelo, sesión, evidencia y pendiente; no sustituir un escritor vivo.
- Relevo → parar antes de habilitar destino, preservar todas las ramas y una nueva indicación del usuario.
- Adopción → contar principal e hijos; aceptación funcional y de alcance primero, tiempo hasta el conjunto comprobado y consumo después.

## Tareas

- [x] P Investigación y plan — fuentes y decisiones conservadas.
- [x] P0 Transporte — RPC público, host Go, bash supervisado y pruebas de EOF/SIGKILL con Pi real.
- [x] P1 Estado e integración — dos activos, cola, Git real, recuperación, continuidad de sesión, modelos y conflictos preservados.
- [x] P2 Evaluación — nueve ensayos registrados; decisión de no adoptar automáticamente con la evidencia actual.
- [x] P3 Controles y transporte — menú y conversación, resultados compactos, bus nativo para parada y relevo desde varios árboles.
- [ ] P3 proveedor real — terminar Pi→Claude→Pi con ambos frentes. Bloqueado por `429 usage_limit_reached` de Claude; parada y transporte ya comprobados con destino controlado.
- [ ] P4 Candidato — paquete instalado en hogar aislado y recorrido comprobado desde ese artefacto. No actualizar la preview personal al no pasar el criterio de adopción.

## Evidencia

- Seis ensayos autónomos: aceptación, suites y tipos correctos; no lanzaron hijos. No atribuir sus diferencias al paralelismo.
- Dirigido r1 detenido al descubrir la incompatibilidad de Vite bajo `.git`; datos preservados. Regresión sin modelos: rojo bajo `.git`, verde fuera con jsdom.
- Dirigidos r2/r3: dos hijos integrados, S3 3/3 y ambos mutantes detectados. Último: 528 s frente a 559 s del control; +24 % tokens y +34 % estimación de catálogo. No se amplía el banco buscando un resultado favorable.
- `scripts/check.sh` comprueba regresiones, procesos, Git, UI, relevo, paquete, Go/vet y tipos estrictos contra Pi 1.0.2. Los tests de Pi con proveedor determinista comprueban mecanismos, no capacidad de modelos alojados.
- Pi real abrió Claude con el estado de ambos frentes, pero Claude no infirió por cuota. Su mensaje indica reinicio a las 00:20 de Europe/Madrid; no se cambió de cuenta ni facturación.

## Siguiente paso

Cerrar el candidato aislado y su revisión. Conservar la preview `0.1.0-preview.2+hotfix.3bc9b8006cc0`. Cuando exista cuota, el único recorrido de proveedor pendiente es `bun evals/bench/conversation.ts handoff-team <id-nuevo>`; no repetir la entrevista ni el banco completo por rutina.

## Corte anterior cerrado

Flujo conversacional instalado: `0.1.0-preview.2+hotfix.3bc9b8006cc0`; cierre `a82b00b`. Acuerdo inicial de paralelismo `febbbb5`, plan `b619eaa`. Evidencia anterior en [flujo conversacional](evals/results/2026-10-06-flujo-conversacional.md) y [calidad y continuidad](evals/results/2026-10-06-fiabilidad.md).
