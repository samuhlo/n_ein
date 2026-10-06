# Calidad, contexto y continuidad

## Objetivo

«Sacar todo esto adelante» tras la auditoría del 6 de octubre: código y resultados fiables, memoria entre sesiones, relevo entre agentes, ahorro sin perder calidad y ayuda para definir y diseñar encargos. «Ve haciendo commits cuando funcione y esté comprobado».

## Autorización

Implementar y comprobar los arreglos de la auditoría en n_ein, hacer commits y actualizar la preview local reversible, según «Venga, dale caña y sácame todo esto adelante». Publicación remota y promoción estable siguen fuera del encargo.

## Decisiones

- Un agente por encargo; conservar el flujo y las capacidades nativas de Pi.
- Retirar únicamente lecturas recuperables; preservar instrucciones, errores y comprobaciones.
- Memoria portable en documentos existentes y preferencias propias del hogar aislado, con recuperación selectiva.
- Publicación remota y promoción estable quedan fuera de este encargo; actualizar la preview local con backup tras validarla.

## Límites

- Preservar Ein legado y los árboles habituales de otros proyectos.
- Las pruebas reales se ejecutan en copias aisladas; no copiar credenciales de instalaciones habituales al banco ni entre runtimes; las copias Pi usan exclusivamente el login propio del banco.
- No atribuir un ahorro a una ejecución incompleta ni declarar equivalencia de calidad con dos muestras.

## Criterios

- Fronteras: proyección de contexto de Pi, modelo virtual, resumen y lanzadores de relevo, archivos portables de memoria y aceptación independiente del banco.
- Cada petición conserva sus consumidores y criterios; límites nuevos requieren acuerdo.
- Pi y Claude reciben las mismas decisiones y preferencias relevantes en español o inglés.
- Suite local y paquete instalado pasan; el ensayo con modelos registra omisiones, defectos sembrados y coste de corrección.

## Tareas

- [x] T1 · Recorte seguro — instrucciones por shell, referencias de skills, errores y evidencia conservados; commits reales distinguidos de lecturas.
- [x] T2 · Modelo por encargo — peticiones mixtas conservadoras y nuevo encargo explícito sin arrastrar el modelo caro.
- [x] T2c · Idiomas — permisos y contratos en inglés no se abaratan por mencionar README; documentar sin cambiar código sigue siendo mecánico.
- [x] T6a · Paquete y comandos — smoke aislado de ajustes personales y compatibilidad de --once con el arranque directo.
- [x] T2b · Clasificación conservadora — implementar y documentar no equivale a trabajo mecánico.
- [x] T3b · Sesiones independientes — bloqueo por árbol desde el launcher, conservado por el runtime si muere el padre.
- [x] T3c · Acuerdo y permiso — autorización transportada en ambos idiomas y petición larga conservada sin duplicarla; intent pendiente no escribe glosario.
- [x] T3 · Relevo portable — títulos ingleses y españoles, criterios completos y cierre ordenado del origen.
- [x] T4 · Alcance y memoria — contrato por petición, conocimiento duradero selectivo y preferencias compartidas por Pi y Claude.
- [x] T5a · Banco revisable — aceptación completa, mutantes y coste de las ejecuciones incompletas visibles; runner y reanudación reproducibles.
- [ ] T5b · Relevo real — tres entregas en Pi→Claude→Pi y recuperación en otro encargo sin WORK.md anterior.
- [x] T5 · Evaluación — aceptación y mutantes visibles, coste hasta aceptación, ensayo de alcance y continuidad con modelos.
- [ ] T6 · Preview — candidato comprobado, actualización local reversible y diagnóstico de la instalación efectiva.

## Evidencia

- Base: `2e09886`; auditoría con `./scripts/check.sh` correcto y regresiones reproducidas.
- T5: NR10 S1 26/26; S2 14/14 en tres repeticiones; S3 3/3 y dos mutantes detectados en tres repeticiones; S5 16/16 sin tocar código. Suites y tipos correctos. S4a corta a 301 s y retoma por $0,5327, final 3/3 y dos mutantes. Costes estimados de catálogo; evidencia en evals/results/2026-10-06-fiabilidad.json.
- T3c: rojo observado con Authorization de diseño y duplicación de la petición sin WORK.md; regresiones verdes y suite completa.
- T2c: rojo observado con «Change permissions and update the README»; reglas bilingües y conjunto etiquetado correctos.
- T6a: rojo observado al exigir nein/auto en el paquete limpio; se aísla su configuración y el smoke entrega auto/medium. El launcher rechaza --runtime junto a --once antes de cualquier escritura. Suite completa correcta.
- T5b (primer tramo): Pi completó T1 en 182 s con la decisión duradera guardada. Claude devolvió límite de sesión (reinicio indicado a las 14:20); se conserva el intento y el runner permite `--resume` sin rehacer T1 ni sobrescribir los logs. El relevo completo sigue pendiente.
- T5b (preparación): fixture de tres entregas con contrato de puerto 0, pruebas reservadas y runner no interactivo. El runner conserva procesos, comandos y logs y usa el generador real de resumen tras la salida del primer Pi. Se comprobaron su compilación y la suite local; los resultados del ensayo siguen pendientes.
- T3b: dos procesos independientes prueban que el segundo no llega a escribir, que matar al launcher no libera el bloqueo mientras sigue su runtime y que, tras terminar este, puede entrar otra sesión. Rojo observado antes del bloqueo y antes de heredar el descriptor; verde y suite completa correctos.
- T2b: rojo observado con «Implementa el parser y escribe su documentación»; el enrutador conserva la clasificación ordinaria y las peticiones etiquetadas siguen pasando.
- T5a: `tests/bench.ts` comprueba que 9/14, un mutante superviviente, una suite rota o evidencia ausente no cuentan como aceptación completa. El informe recupera todas las repeticiones, expone mutantes y coste por aceptada; se corrigió la omisión del informe histórico. Suite completa correcta.
- T4: rojo observado en preferencias ausentes del relevo; ambos lanzadores entregan el mismo archivo. `tests/memory.ts` verifica lectura sin mutación, actualización entre sesiones y fuente explícita. El flujo conserva petición, consumidores y aceptación; evita límites inventados y manda preservar decisiones antes de reemplazar WORK.md. La efectividad con modelos se mide en T5. Suite completa correcta.
- T3: rojo observado con WORK.md en inglés; `tests/handoff.ts` comprueba los criterios finales de un documento largo y las tareas pendientes junto al siguiente paso; ambos lanzadores prueban salida antes de destino. Escritores externos no supervisados quedan explícitos. Suite completa correcta.
- T2: rojo observado en petición mixta y nuevo encargo; `tests/router.ts` comprueba las reglas, `/nein:nuevo`, compactación y ausencia de órdenes pendientes entre sesiones; suite completa correcta.
- T1: rojo observado en instrucciones por shell y falso commit; `tests/context.ts` cubre conservación de errores, checks, comandos mixtos/dinámicos y scripts; suite completa y paquete instalado correctos.

## Siguiente paso

T5: evaluar aceptación completa, mutantes y relevo con modelos en copias aisladas.
