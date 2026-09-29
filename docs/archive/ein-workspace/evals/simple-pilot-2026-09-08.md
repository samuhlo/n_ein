# Piloto sencillo — 2026-09-08

Resultado: la reducción acotada de contexto funciona en los tres casos probados.
El ejecutor barato completa cuatro de cinco encargos al primer intento y el
quinto tras reparar el contexto/plan, con menor coste API total en esta muestra.
No se promociona una clase ni se afirma ejecución local o confinamiento.

## Cambio incorporado a Ein

Se retira duplicación de identidad, voz y principios de `persona.ts`; el
orquestador conserva el contrato detallado. También se elimina la instrucción
redundante que activaba TDD por la mera presencia de tests. Las convenciones de
edición se entregan a apply, que escribe, y dejan de inyectarse al padre. Se
amplía el test de presupuesto existente al texto añadido por persona/voz.
Dos archivos de runtime modificados, sin agentes, módulos ni servicios nuevos.
El catálogo nativo de skills y el archivo del orquestador no se modificaron en
esta intervención. Los cambios de scout que ya estaban en curso se preservan.

## Experimento de ejecución

Astra/high produjo `tasks.md`; el compilador y validador existentes de Ein
produjeron cinco packets v2. Cada executor recibió el mismo packet de su caso,
con thinking low, herramientas Pi y el contrato real de `sdd-apply` en modo
ad-hoc. Se usaron sesiones y árboles separados, alternando el orden de modelos.
La atribución es explícita en el piloto; no se cambió el medidor global.

Fuentes: módulos versionados de Planificador y BERRO. Fechas reproduce una
regresión histórica; los otros cuatro son propuestas de endurecimiento sobre
copias de módulos actuales. Son cinco cambios de un archivo, no cinco features
completas. No se modificaron los proyectos originales. Commits, fuentes y hashes
quedan en `cases.json` dentro del archivo de evidencia.

Los ejemplos visibles fallaban antes de los cambios. Tras cada run se restauraron
los tests originales y se incorporaron comprobaciones independientes reservadas;
se verificó el diff y se aplicó typecheck con las opciones estrictas del proyecto.
No se observaron cambios fuera del archivo permitido en las copias inspeccionadas.

| Caso | Astra, primer intento | Luna, primer intento | API Astra USD | API Luna USD |
| --- | --- | --- | ---: | ---: |
| fechas | pass | falla typecheck | 0.158184 | 0.005453 |
| horario | pass | pass | 0.143346 | 0.002519 |
| progreso | pass | pass | 0.162030 | 0.005548 |
| stun | pass | pass | 0.094988 | 0.003511 |
| ice-query | pass | pass | 0.149694 | 0.003302 |

El piloto omitió inicialmente `strict`/`noUncheckedIndexedAccess` del contexto
entregado. La revisión independiente encontró TS2532 en fechas/Luna: una lectura
de array potencialmente undefined. Se añadió el tsconfig, Astra corrigió solo
ese grupo del plan y Luna lo ejecutó desde la fuente inicial. Pasó comportamiento
y tipos en 27 segundos, con 4 turnos y 0,00284828 USD. Se normalizaron mecánicamente
los dos comandos de verificación a dos campos `verify`; no se cambió su contenido.
El fallo inicial permanece contabilizado: 80 % al primer intento, no 100 %.

| Medida para los cinco casos | Astra como ejecutor | Luna como ejecutor |
| --- | ---: | ---: |
| Planificación común, USD | 0,236888 | 0,236888 |
| Ejecuciones iniciales, USD | 0,708242 | 0,02033324 |
| Reparación del plan + repetición, USD | 0 | 0,13961028 |
| Total atribuible del recorrido, USD | **0,945130** | **0,39683152** |
| Tokens totales, incluida planificación y reparación | 165.589 | 213.588 |

El coste API atribuible baja un **58.01 %**, pero el recorrido barato consume
más tokens al contar la reparación. La planificación común se asigna una vez a
cada alternativa; físicamente se ejecutó una vez. Son costes reportados por Pi
con la caché observada, no una factura ni una comparación con caché fría uniforme.
La preparación/revisión de Codex y el tiempo de supervisión no están incluidos;
no se afirma menor coste humano ni menor latencia total.

## Experimento de contexto

Mismo modelo Astra/high y composición común de reglas compartidas, contexto de
proyecto y catálogo de skills; solo cambia la duplicación de persona y las
convenciones del padre. Cada caso pide una respuesta sin ejecutar herramientas.
El prompt controlado pasa de 87.417 a 79.635 bytes (−7.782).

| Caso | Entrada antes, tokens | Entrada después, tokens | Reducción |
| --- | ---: | ---: | ---: |
| conversation | 21,181 | 19,269 | 9.03 % |
| small-change | 21,316 | 19,416 | 8.91 % |
| sdd-routing | 21,280 | 19,376 | 8.95 % |

Las respuestas finales conservan identidad Pi/SDD/subagentes, delegación acotada
sin SDD/TDD innecesario y verify pendiente sin afirmar tests verdes. La primera
versión reducida falló la prueba de identidad; se recuperó una instrucción breve
y se repitieron los tres pares. Ambos intentos están conservados. El primer smoke
de compactación devolvió historial insuficiente; con dos turnos y
`keepRecentTokens: 16` en el hogar de prueba, la compactación real pasó y la
sesión reanudada conservó verify pendiente. No se cambió ese ajuste del usuario.

Estos conteos excluyen esquemas/herramientas de las extensiones instaladas: no
se extrapola el porcentaje al arranque real de 41–44k tokens ni a sesiones largas.
No se afirma que el problema completo del contexto esté resuelto.

## Verificación y reproducción

- Suite completa: 3.175 pass, 0 fail; después del último ajuste de identidad,
  25 pruebas enfocadas pass, 0 fail. Typecheck del repo final correcto.
- 74 pruebas de scout y probe contra pi-subagents instalado correctos.
- Hook comprobado por rol: padre/verify sin convenciones, apply las conserva.
- Empaquetado host correcto; persona y hook del tarball coinciden byte a byte
  con el código final. El tarball se generó; la instalación habitual no se alteró.
- Runtime: Pi 0.84.4, Bun 1.3.14, TypeScript 5.9.3, Zod 4.4.3.
- No se encontró runtime local en PATH ni modelos servidos por los endpoints
  habituales de Ollama/LM Studio. La prueba compara dos modelos API configurados.

[Evidencia local completa](../.pi/ein/evidence/simple-pilot-2026-09-08.tar.gz)
(612,733 bytes), fuera del historial Git. Incluye sources, tests, packets,
planes antes/después, diffs, transcripts, resultados fallidos, scripts del ensayo
y un manifiesto SHA-256 por archivo. Excluye credenciales y node_modules.

SHA-256 del archivo: `4c38b8b82944bcdc4f1aa56c15e7522f8d649b828ff0de4d116c2a02e3e36c17`.

Para auditar sin gastar modelo: extraer, comprobar `evidence-manifest.json`,
consultar `summary.json` y los logs `*-verify.log`/`*-typecheck.log`. Para repetir,
los scripts conservados documentan comandos, flags y orden; ajustar sus rutas,
proveer Zod/TypeScript en las versiones indicadas y un hogar Pi aislado con
credenciales propias. Reejecutar modelos consume cuota y no garantiza el mismo
resultado. El piloto no es un runner de producto ni se incorpora al arranque.

## Decisión

Conservar la reducción comprobada y trabajar con encargos pequeños que incluyan
las opciones reales del proyecto. El fallo encontrado se resolvió completando
el plan y manteniendo el ejecutor barato, sin ampliar el arnés. Cinco casos no
satisfacen el criterio de promoción del ADR. El siguiente experimento local
requiere un modelo disponible; no justifica construir una plataforma adicional.
