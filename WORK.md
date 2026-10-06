# Calidad, contexto y continuidad

## Objetivo

«Sacar todo esto adelante» tras la auditoría del 6 de octubre: código y resultados fiables, memoria entre sesiones, relevo entre agentes, ahorro sin perder calidad y ayuda para definir y diseñar encargos. «Ve haciendo commits cuando funcione y esté comprobado».

## Decisiones

- Un agente por encargo; conservar el flujo y las capacidades nativas de Pi.
- Retirar únicamente lecturas recuperables; preservar instrucciones, errores y comprobaciones.
- Memoria portable en documentos existentes y preferencias propias del hogar aislado, con recuperación selectiva.
- Publicación remota y promoción estable quedan fuera de este encargo; actualizar la preview local con backup tras validarla.

## Límites

- Preservar Ein legado y los árboles habituales de otros proyectos.
- Las pruebas reales se ejecutan en copias aisladas; no copiar credenciales entre hogares.
- No atribuir un ahorro a una ejecución incompleta ni declarar equivalencia de calidad con dos muestras.

## Criterios

- Fronteras: proyección de contexto de Pi, modelo virtual, resumen y lanzadores de relevo, archivos portables de memoria y aceptación independiente del banco.
- Cada petición conserva sus consumidores y criterios; límites nuevos requieren acuerdo.
- Pi y Claude reciben las mismas decisiones y preferencias relevantes en español o inglés.
- Suite local y paquete instalado pasan; el ensayo con modelos registra omisiones, defectos sembrados y coste de corrección.

## Tareas

- [x] T1 · Recorte seguro — instrucciones por shell, referencias de skills, errores y evidencia conservados; commits reales distinguidos de lecturas.
- [x] T2 · Modelo por encargo — peticiones mixtas conservadoras y nuevo encargo explícito sin arrastrar el modelo caro.
- [x] T3 · Relevo portable — títulos ingleses y españoles, criterios completos y cierre ordenado del origen.
- [ ] T4 · Alcance y memoria — contrato por petición, conocimiento duradero selectivo y preferencias compartidas por Pi y Claude.
- [ ] T5 · Evaluación — aceptación y mutantes visibles, coste hasta aceptación, ensayo de alcance y continuidad con modelos.
- [ ] T6 · Preview — candidato comprobado, actualización local reversible y diagnóstico de la instalación efectiva.

## Evidencia

- Base: `2e09886`; auditoría con `./scripts/check.sh` correcto y regresiones reproducidas.
- T3: rojo observado con WORK.md en inglés; `tests/handoff.ts` comprueba los criterios finales de un documento largo y las tareas pendientes junto al siguiente paso; ambos lanzadores prueban salida antes de destino. Escritores externos no supervisados quedan explícitos. Suite completa correcta.
- T2: rojo observado en petición mixta y nuevo encargo; `tests/router.ts` comprueba las reglas, `/nein:nuevo`, compactación y ausencia de órdenes pendientes entre sesiones; suite completa correcta.
- T1: rojo observado en instrucciones por shell y falso commit; `tests/context.ts` cubre conservación de errores, checks, comandos mixtos/dinámicos y scripts; suite completa y paquete instalado correctos.

## Siguiente paso

T4: conservar el alcance original y recuperar conocimiento duradero.
