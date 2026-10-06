# Agentes en paralelo y continuidad

## Resultado

La rama incorpora un equipo de hasta dos trabajadores Pi, worktrees separados, sesiones persistentes, controles por conversación y menú, resultados por eventos, integración y relevo con estado de cada frente. Los recorridos deterministas atraviesan Pi real, procesos, Git y el paquete; S3 se completó con dos trabajadores y modelos reales.

**No se activa en la preview personal.** El último ensayo dirigido reduce el tiempo hasta aceptación aproximadamente un 5 % frente al control y usa un 24 % más de tokens; no alcanza el objetivo provisional de un 20 % menos de tiempo. El coste de catálogo sube un 34 %. El recorrido ordinario de la instalación personal sigue siendo directo. El candidato sirve para revisión y experimentación, no como promesa de ahorro.

**El recorrido completo con Claude real queda pendiente:** Pi preparó el relevo y abrió Claude, pero el proveedor devolvió `429 usage_limit_reached` antes de inferir. El mensaje indica reinicio de cuota a las 00:20 de Europe/Madrid. No se cambió de cuenta ni de facturación. La parada, el transporte de ambos frentes y el regreso desde otro cwd se comprobaron con Pi real y destino controlado.

## Método

Se ejecutó el [plan](../../docs/10-paralelismo.md) sobre copias de `planificador-didactico`, con Pi 1.0.2 y `openai/gpt-6-sol` medium en principal e hijos. Credenciales en el hogar existente de preview, sin copiarlas. Productos congelados por commit; escenarios y aceptación del banco anterior. Las variantes y sus correcciones se ejecutaron en serie. Es un piloto en la máquina de desarrollo, no un estudio estadístico ni una máquina dedicada a benchmarking.

Los tokens incluyen entrada, salida y caché, principal e hijos y sus intentos observados. USD es estimación del catálogo de Pi, no factura de suscripción. La duración hasta aceptación incluye la corrección independiente final. La cifra de inferencia observada del banco y del relevo parcial es aproximadamente **$7,81**; no incluye esta conversación de desarrollo y puede omitir consumo en vuelo del ensayo interrumpido. [Datos](2026-10-06-paralelismo.json).

## Piloto autónomo

Control `b619eaa`; candidato `edb6968`. La petición del encargo es la misma en cada pareja. El candidato tiene disponible el equipo y decide si usarlo.

| Caso | Variante | Tiempo del agente | Hasta aceptación | Tokens | USD catálogo | Hijos |
|---|---|---:|---:|---:|---:|---:|
| S6 cambio pequeño | Control | 103 s | 139 s | 245.010 | 0,145 | 0 |
| S6 cambio pequeño | Candidato | 109 s | 146 s | 217.286 | 0,123 | 0 |
| S2 servidor y cliente | Control | 631 s | 668 s | 2.984.668 | 1,036 | 0 |
| S2 servidor y cliente | Candidato | 468 s | 505 s | 2.256.990 | 0,783 | 0 |
| S3 entregas independientes | Control | 559 s | 597 s | 2.844.079 | 1,020 | 0 |
| S3 entregas independientes | Candidato | 449 s | 488 s | 2.254.127 | 0,875 | 0 |

Las seis pasan aceptación: S6 4/4, S2 14/14 y S3 3/3 con prueba montada y los dos mutantes detectados. Las suites no tienen fallos y los tipos pasan; se conservan cuatro tests omitidos de la base. **Ninguna lanzó trabajadores**, por lo que estas diferencias no demuestran aceleración por paralelismo. Son una observación por variante y caso.

## Ensayos dirigidos

Se añade explícitamente a S3 el reparto de alta de centro y prueba montada entre dos trabajadores; el principal conserva documentación e integración. Esta intervención se registra por separado del piloto autónomo.

| Ejecución | Fuente | Resultado | Tiempo del agente | Tokens | USD catálogo |
|---|---|---|---:|---:|---:|
| `parallel-s3-directed-r1` | `0806ef5` | Interrumpida por incompatibilidad de ubicación | 377 s hasta interrupción | 2.969.659 observados | 1,137 observados |
| `parallel-s3-directed-r2` | `f0ecfc7` | Dos hijos integrados; aceptación completa | 656 s | 3.090.156 | 1,292 |
| `parallel-s3-directed-r3` | `f0d77f4` | Dos hijos integrados; aceptación completa | 528 s | 3.525.838 | 1,362 |

R2 y R3 pasan S3 3/3, los dos mutantes, suite sin fallos y tipos. En R3 la variación frente al control es −5,41 % en tiempo del agente, −4,88 % hasta aceptación, +23,97 % en tokens y +33,54 % en estimación de catálogo. Las revisiones dirigidas cambiaron código y no son tres repeticiones de un mismo tratamiento; tampoco se atribuye toda la diferencia R2→R3 al cambio del runner.

No se amplía a dieciocho ejecuciones: no hay señal suficiente para adoptar la ruta automática con estos encargos. Un encargo mayor o con otra división podría comportarse de otra manera; eso queda como hipótesis, no como ahorro demostrado.

## Fallos encontrados y corregidos

1. **Descendientes que seguían escribiendo.** El primer host mataba al supervisor de bash antes de que limpiara su grupo separado. Ahora cada comando supervisado conserva su propio pipe de vida y el descriptor del bloqueo. Se prueban EOF, SIGKILL de Pi y muerte del host; el watchdog del test no puede suplir una parada fallida.
2. **Worktrees bajo `.git`.** Vitest con jsdom no resolvía su setup. Se detuvo R1 en vez de pagar más intentos de adaptación del proyecto. Los árboles nuevos viven fuera de `.git`; el registro permanece en el directorio Git común. La [regresión](2026-10-06-paralelismo-vite.json) usa los mismos archivos y dependencias: falla bajo `.git` y pasa fuera. Un caso mínimo en entorno node no reproducía el fallo; el de jsdom sí. No se relajó la protección de Vite ([referencia](https://vite.dev/config/server-options.html#server-fs-deny)).
3. **Principal bloqueado en print.** El cierre nativo espera resultados y pide la continuación; el principal puede hacer trabajo independiente antes de esa frontera. Un proveedor determinista sobre Pi real comprueba el orden de las escrituras, dos procesos simultáneos, recepción de resultados, continuación de una sesión de trabajador e integración.
4. **Estado compartido entre extensiones.** Pi carga módulos con `moduleCache: false`; un Map importado no conectaba correctamente el relevo y el gestor. La parada se coordina por el bus nativo de eventos y sus promesas, antes del cierre. La prueba real detectó el fallo y ahora el destino solo arranca después de parar ambos trabajadores activos.
5. **Paquete incompleto.** El instalador omitía el directorio nuevo de agentes. Un test rojo de instalación detectó la ausencia; ahora forma parte del manifest.
6. **Registro o presentación no deben impedir parar.** La parada usa los procesos que el coordinador posee en memoria incluso si un JSON está roto. Se conserva el archivo para recuperación. La vista usa instantáneas y muestra estado no disponible sin convertir un error de pintura en un fallo de ejecución.
7. **Relevo desde otro cwd.** Los lanzadores conservan el proyecto coordinador. Preparar el regreso desde un árbol de trabajador mantiene el documento y todos los frentes del proyecto original.

## Qué se comprueba

| Superficie | Evidencia |
|---|---|
| Propiedad y parada | `go/cmd/n-ein/worker_test.go`, `tests/agents-rpc.ts`, `tests/agents-pi.ts`: locks, comandos que resisten TERM, pérdida de padre, fallo antes de finalizar, Unicode y errores de registro. |
| Estado e integración | `tests/agents-store.ts`, `tests/agents-manager.ts`: Git real, máximo dos activos con tercero en cola, conflictos conservados, HEAD posterior rechazado, parciales, modelo conservado o cambiado explícitamente y consumo acumulado. |
| Pi completo | `tests/team-pi.ts`: principal y dos trabajadores reales con proveedor determinista, avance concurrente, sesión retomada, integración, parada antes de Claude y resumen de regreso desde un worker cwd. No mide capacidad de un modelo alojado. |
| UI | `tests/team-view.ts`, `tests/team-extension.ts`: anchura, actividad, vista local sin inferencia, resultados compactos y controles. |
| Relevo | `tests/handoff.ts` y scripts de launcher: quietud, nueva entrada durante parada, writer vivo, varias ramas y cambios sin commit. `team-handoff-r1`: Pi real→Claude; retorno real bloqueado por cuota. |
| Tipos | `scripts/typecheck-agents.ts`: TypeScript estricto contra el SDK Pi 1.0.2 instalado. Herramientas de comprobación temporales, fuera del paquete. |
| Regresiones | `scripts/check.sh`: recorridos anteriores, tests nuevos, Go test/vet y smoke del paquete. |

### Revisión de alcance

El sistema conserva una conversación, un catálogo, un mecanismo de trabajadores y `WORK.md` o el documento configurado como guía. Los hijos no tienen las herramientas de orquestación, relevo ni ajustes del principal. Las integraciones son locales en la rama de trabajo; no se hizo push, PR ni promoción remota. El coste de los hijos no se omite al comparar. El dato `integrated` acredita integración Git, no aceptación funcional del encargo.

Pendiente material: confirmar Pi→Claude→Pi completo con el proveedor real cuando haya cuota. La decisión de adopción automática queda negativa con este piloto; una ampliación futura necesitará nueva evidencia.

### Revisión de código y límites

Se usa el RPC público, el bus de Pi, sus herramientas y sus sesiones; no se accede a campos privados de `RpcClient` ni se instala Gentle Shell. Los supervisores están en Go y lo que corre en Pi, en TypeScript. Los datos sobreviven al reemplazo del paquete. No se impone un rol ni una llamada extra por fase.

El aislamiento por worktree y el control de procesos son cooperativos, no un sandbox. Los procesos externos o que escapen deliberadamente de los grupos y cierren los descriptores heredados no quedan acreditados por estas pruebas. No se admiten servicios desatendidos como parte de un trabajador. Las garantías de proceso se probaron en macOS; no se presenta un recorrido Linux real como ejecutado aquí.

## Reproducir y localizar

- Checks locales: `./scripts/check.sh`.
- Vite sin modelos: `bun evals/bench/worktree-vite.ts <node_modules con Vitest 4.1.8>`.
- Comparación: `bun evals/bench/parallel.ts s3 serial <id>` y `bun evals/bench/parallel.ts s3 team <id> directed`. Los identificadores existentes nunca se sobrescriben.
- Relevo con dos frentes: `bun evals/bench/conversation.ts handoff-team <id>`; requiere cuota de los hogares autenticados existentes. `N_EIN_FIXTURE_ONLY=1` comprueba solo la preparación sin modelos alojados.
- Logs completos: `../n_ein-bench/logs/parallel-*/`; relevo: `../n_ein-bench/conversation/team-handoff-r1/logs/`. Productos congelados en `../n_ein-bench/products/` y árboles en `../n_ein-bench/worktrees/`.

## Candidato para revisión

Pendiente de empaquetar el último corte y ejecutar el recorrido desde la instalación aislada. La preview personal permanece en `0.1.0-preview.2+hotfix.3bc9b8006cc0`.
