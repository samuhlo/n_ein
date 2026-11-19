# Runtimes al día: comprobados en CI y actualizables desde el launcher

## Objetivo

Samu detectó que Pi y Claude Code se quedan atrás y que usar un modelo nuevo exige subir esa base en n_ein. El 19 de noviembre había Pi 1.0.2 frente a 1.5.2, el puente 0.9.3 frente a 0.13.0 (que exige Pi ≥ 1.5.1), Claude Code 2.1.302 frente a 2.1.311 estable y CodeGraph 1.6.1 frente a 1.6.3.

Rechazó el aviso solo informativo: «la idea es que comprobara si la actualización rompe algo, y si no rompe nada, apareciera para actualizar en el launcher y lo hiciera desde ahí». Pidió «un plan con arquitectura profesional (tampoco te pases, que es un proyecto personal)» y «sugerencias y recomendaciones». Aprobó el plan: «Me encanta, hazlo. Y sí, autorizo todo».

Pedidos:
1. Comprobar automáticamente si una versión nueva de Pi, el puente, Claude Code o CodeGraph rompe n_ein.
2. Si no rompe, que aparezca en el launcher y se actualice desde ahí.
3. Las recomendaciones aceptadas: Claude Code por su canal estable, cuarentena de 3 días, revisión del puente si trae red nueva, grupos con publicación parcial, aviso de sesiones al volver atrás y pendiente de adaptar en Sistema.

## Autorización

«Hazlo» y «autorizo todo» sobre el plan de cinco tramos: implementación en esta rama con commit por tarea, PR e integración en main, publicar la preview con la primera subida y el vigía que publica previews solo cuando la matriz pasa. La estable sigue siendo manual. Cambiar el ajuste del repositorio que deja a Actions abrir PR entra en «todo». No autoriza actualizar la instalación personal: eso es pulsar `u`.

## Decisiones

- **La subida de runtimes es una versión normal de n_ein.** Reutiliza matriz macOS+Linux, `check.sh` sin modelos, instalación limpia con upgrade y restore, attestation y el `u` del launcher. Descartados: comprobar en la máquina (el paquete no lleva los tests) y conjuntos de runtimes aparte del paquete (segunda vía de instalación).
- **El vigía publica preview sin aprobación previa;** la puerta es `u`. La estable no se publica sola.
- **Versión:** siguiente prerelease desde el último tag publicado del canal (alpha.1 → alpha.2), en una rama `hotfix/runtimes-<versión>`. La PR a main lleva el mismo commit.
- **Guarda contra bajadas:** ninguna release publica runtimes más antiguos que el tag anterior.
- **Reglas de selección:** Pi y puente van juntos (el puente más nuevo cuyo peer admite ese Pi); Claude Code por la etiqueta `stable`; CodeGraph por su última release con el SHA-256 que publica GitHub; 3 días de cuarentena salvo Claude Code, cuya etiqueta ya va con retraso.
- **Memoria del vigía en issues con la etiqueta `runtimes`:** una versión que rompe queda bloqueada hasta cerrar su issue; un puente con red nueva espera a que su issue de revisión se cierre como completado.
- **Herramientas en TypeScript con Bun** (`scripts/runtimes/`), como el resto de scripts; el launcher en Go.

## Límites

- Sin actualizar nada sin pulsar `u`; sin avisos fuera del launcher; sin Renovate ni Dependabot.
- Sin turnos con modelos reales en CI ni credenciales de suscripción en GitHub.
- El vigía solo publica en preview.

## Criterios

- «comprobara si la actualización rompe algo» → `scripts/runtimes/`, `.github/workflows/runtimes.yml`, `candidate.yml` → tests de la selección con registro falso (cuarentena, peer, stable, bloqueos, sin bajadas); el vigía ejecuta la matriz completa sobre la rama del bump y solo publica si pasa; si falla, prueba por grupos y abre un issue.
- «apareciera para actualizar en el launcher» → `go/cmd/n-ein/update.go`, `ui.go`, `state.go` → test: con una release nueva, la portada ofrece `u` y dice qué runtimes trae; Sistema muestra la versión nueva por runtime.
- «lo hiciera desde ahí» → `fetch`/`setup` del instalador → test: una actualización cuyo doctor falla restaura sola la anterior; doctor arranca Pi con las extensiones de n_ein y un proveedor de prueba; Sistema ofrece volver a la versión anterior con confirmación y aviso de sesiones.
- Guarda → `release.yml` → test: bajar Pi respecto al tag anterior falla con mensaje claro.
- Limpieza → setup → test: tras actualizar se conservan los runtimes de la instalación actual y de su backup más reciente; los backups se recortan a 3.
- Primera subida → `runtime.json`, lockfiles → `check.sh` verde con las versiones que elige la propia regla (cuarentena incluida).

## Tareas

- [x] T1 · Selección y aplicación de versiones — `scripts/runtimes/` con plan, apply, guard y revisión del puente; tests con registro falso. Blocked by: none.
- [x] T2 · Primera subida — Pi 1.5.2, puente 0.12.0, Claude Code 2.1.311 y CodeGraph 1.6.2 con T1 (0.13.0 y 1.6.3 seguían en cuarentena); arreglar lo que rompa Pi 1.5. Blocked by: T1.
- [x] T3 · Vigía — workflow diario, candidato sobre otra rama, publicación reutilizable, guarda en release, grupos, issues y PR a main. Blocked by: T1.
- [ ] T4 · Launcher — qué trae la versión, doctor con Pi real y restore automático, volver a la anterior. Blocked by: none.
- [ ] T5 · Limpieza — runtimes sin uso y backups. Blocked by: T4.
- [ ] T6 · Documentación, PR, release y prueba del vigía. Blocked by: T1-T5.

## Evidencia

- Investigación (19 nov): npm `dist-tags` de Pi, Claude Code y puente; release de CodeGraph v1.6.3 con `digest` por asset; changelog de Pi 1.0.2→1.5.2 con cambios incompatibles en 1.2.0 y 1.5.0.
- T1: `bun run tests/runtimes.ts` OK (selección, cuarentena, peer, stable, bloqueos, issues, red nueva, apply, tags y guarda); `scripts/typecheck-agents.ts` OK con `scripts/runtimes/`. `plan` contra los registros reales: Pi 1.5.2, puente 0.12.0, Claude Code 2.1.311, CodeGraph 1.6.2; 0.13.0 y 1.6.3 siguen en cuarentena. Revisión manual del puente 0.9.3→0.12.0: sin red nueva, como el escáner.
- T2: `cli.ts apply` sobre el repo; `n-ein-install runtime` en un hogar aislado instala Pi 1.5.2, Claude 2.1.311, puente 0.12.0 y CodeGraph 1.6.2 con lockfile congelado (20 s). `check.sh` completo con ese hogar y el Claude fijado en PATH: `checks locales: OK` (incluye plugin de Claude y tipos contra Pi 1.5.2). Pi 1.5 no rompió nada de n_ein; sí rompían los tests con `runtimes/pi/1.0.2` escrito a mano: ahora leen `runtime.json` (`tests/pi-runtime.ts`), igual que `installer-e2e.sh` con CodeGraph. README, NOTICE y START_HERE dejan de citar versiones que el vigía cambiará.
- T3: `runtimes.yml` (plan → candidato sobre `hotfix/runtimes-<v>` → guarda y tag → `publish.yml` → PR a main; si falla, ramas por grupo, issue de bloqueo y relanzamiento), `publish.yml` reutilizable desde `release.yml`, guarda en `release.yml`, `candidate.yml` con `ref` y prefijo de artefacto. Tests del CLI con las invocaciones del workflow: OK. Los seis workflows se leen como YAML; `actionlint` no se pudo ejecutar (el permiso de la sesión no deja descargar y ejecutar la herramienta). La prueba real es la release de T6 y un disparo manual del vigía.

## Siguiente paso

T4: launcher (qué trae la versión, doctor con Pi real, restore automático y volver a la anterior).
