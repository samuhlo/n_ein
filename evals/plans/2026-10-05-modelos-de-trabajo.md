# Plan: comparar modelos de trabajo (n_ein, Gentle Shell, Matt)

Samu quiere saber si la manera de trabajar de Gentle Shell o la de Matt gasta menos o funciona mejor que la de n_ein, y si le conviene un solo documento de trabajo, varios o la memoria. Este plan define cómo medirlo. Todavía no se ha ejecutado nada.

## La pregunta y lo que decide

¿Qué combinación de flujo y artefacto da más trabajo aceptado por token y por minuto, y cuál retoma mejor un encargo interrumpido? El resultado decide cinco cosas de n_ein:

1. **Documento:** mantener `WORK.md`, adoptar el formato de Gentle (Specs, Tasks, Log) o pasar a varios archivos.
2. **Memoria:** si merece la pena una copia en Engram.
3. **Trabajo pequeño:** qué hace n_ein en él, si Pi sin arnés gana ahí.
4. **Delegación:** si `nein-worker`/`nein-scout` con un modelo barato compensan o conviene trabajar en línea por defecto.
5. **Relevo:** qué artefacto deja mejor contexto para un agente nuevo (Pi→Claude).

## Lo que ya se sabe

Leído el 5 de octubre de 2026 en los repositorios actuales: Gentle Shell `0da07ce9` (paquete `gentle-pi` 4.0.0 publicado el 1 de octubre, con 209 commits más en `main`), Matt `24fe0ef` y Engram `e5c2277`.

**Gentle Shell**
- Quitó SDD y OpenSpec el 24 de septiembre (`cc5fbd94`), y con ellos el «Completed-cycle session summary».
- El trabajo grande tiene un documento en el repo, `odd/tasks/<feature>.md`, y una copia en Engram solo si el paquete `gentle-engram` está instalado (`assets/orchestrator-memory.md`).
- Formato: cabecera; `## Specs` con las frases del usuario literales; `## Tasks` con evidencia; `## Log` que crece al final. Se edita por trozos.
- Es «grande» solo si no se podría retomar con la petición y el `git diff`. El trabajo pequeño no deja documento ni commits (`assets/orchestrator.md`).
- Exige Pi ≥ 0.99.1. n_ein sigue en Pi 0.87.1, y la última publicada es la 1.0.2.

**Engram** sigue pidiendo `mem_session_summary` al cerrar sesión. En Pi archiva solo el resumen de cada compactación (`plugin/pi/README.md`).

**Matt**
- Flujo que lanza el usuario: `grill-with-docs` → `to-spec` → `to-tickets` → `implement`/`implement-spec`.
- Spec y tickets van al gestor de incidencias. En local son Markdown bajo `.scratch/<feature>/`, configurado por `setup-matt-pocock-skills`.
- `handoff` escribe el relevo en el directorio temporal, sin repetir lo que ya está en specs o commits.
- No publica medidas.

**El banco de Gentle** (privado, una ejecución por celda; resultados en `odd/tasks/proportional-task-routing.md` y `delegate-for-reason.md`):
- **Bug de tres líneas:**

  | Arnés | Tiempo | Coste |
  |---|---:|---:|
  | Pi sin arnés | 56 s | $0,062 |
  | Gentle antes | 335 s | $0,339 |
  | Gentle tras recortar | 77 s | $0,105 |

- **Codex sin arnés** costó $0,52 en cuatro tareas frente a $1,59 de Gentle, y quedó mejor en la revisión a ciegas.
- **Delegar en Luna** nunca compensó ($3,12 frente a $1,59) y se desactivó el 4 de octubre.
- **Tests:** los de Codex eran más fuertes; Gentle añadió una lista de comprobación de tests.

**Lo nuestro:**
- **Piloto del 29 de septiembre:** delegar en Luna resolvió a la primera y costó $0,053, frente a $0,10 de Sol directo, que tampoco terminó.
- **Prueba con Claude del 2 de octubre:** n_ein mejoró el método (rama, rojo observado, commit) sin coste extra, pero no la corrección.

## Hipótesis

- **H1.** En trabajo pequeño, cualquier arnés cuesta más que no usar ninguno, sin mejorar la aceptación.
- **H2.** Durante el trabajo, un documento o varios cambia poco los tokens; la diferencia aparece al retomar y al pasar el relevo.
- **H3.** Las citas literales y el orden «estable primero» del formato de Gentle reducen la deriva al retomar y abaratan la caché.
- **H4.** La copia en Engram no añade nada para un solo usuario con Git, y cuesta tokens.
- **H5.** Con el mismo modelo en todos los roles, trabajar en línea es más barato que delegar. Con un trabajador barato, el resultado puede invertirse; nuestro piloto y el banco de Gentle discrepan.
- **H6.** Los arneses debilitan los tests frente a Codex sin arnés.

## Variantes

Todas trabajan sobre la misma copia del corpus, con el mismo modelo y el mismo esfuerzo en todos los roles, salvo en el bloque de delegación de la fase 5.

| Id | Variante | Cómo se monta |
|---|---|---|
| A | Pi sin arnés | Pi en un hogar vacío, `--no-extensions --no-skills`. Sin CodeGraph, igual que la referencia de Gentle. |
| N1 | n_ein actual | `n-ein-dev` de una copia de la instalación preview, con `WORK.md`. |
| N2 | n_ein con el formato de Gentle | La misma copia con un `flow.md` que define cabecera, `## Specs` con citas literales, `## Tasks` y `## Log`, y edición por trozos. Solo cambia la sección del documento. |
| N3 | n_ein con varios archivos | `flow.md` con `work/<feature>/spec.md`, `tasks.md` y `log.md`, al estilo OpenSpec pero sin fases. |
| G | Gentle Shell | `gentle-pi` construido desde el `main` fijado (`git archive` + `npm pack` en un directorio del banco, nunca `-g`). `GENTLE_SHELL_NO_AUTO_SETUP=1`, sin Engram, persona `neutral` en `.pi/gentle-ai/persona.json` de la copia y RDD apagado. |
| G+E | Gentle con Engram | G con `gentle-shell setup` en su propio hogar, que instala `gentle-engram`. Solo en S3 y S4. |
| M | Skills de Matt | Pi en un hogar vacío con `--skill` a las skills de Matt fijadas. La configuración de `setup-matt-pocock-skills` (gestor en Markdown local) va escrita en la copia antes de empezar. |
| C | Codex CLI sin arnés | `codex exec --json` con `CODEX_HOME` aislado y el mismo modelo. Referencia externa. |
| E | Ein legado (opcional) | Solo si Samu lo autoriza. Se ejecuta su instalación sin tocar su repositorio, en un hogar copiado. |

Productos fijados: n_ein en un commit concreto, Gentle Shell en `0da07ce9` y Matt en `24fe0ef`. Si alguno cambia a mitad del banco, se sigue con el fijado.

## Escenarios

Todo sobre `planificador-didactico`, exportado con `git archive` sin historia, `.env` ni cambios locales, como en la prueba del 2 de octubre. Cada encargo lleva una aceptación oculta preparada antes de la primera ejecución, que el agente no ve.

**S1 · Bug pequeño.** Base `111489af`; encargo E1 del 2 de octubre, literal. Aceptación: `evals/reserved/planificador-anexo4.patch` (T10, T11, T10b, T11b) y typecheck. Mide el peso del arnés en trabajo pequeño (H1). N2 y N3 no corren: sin documento son idénticas a N1.

**S2 · Medio, servidor y cliente.** Base `4d66007`.
> Haz que el Anexo III lea la planificación guardada del curso en el servidor en vez del cuerpo que manda el cliente, y que el cliente deje de mandarla cuando hay curso.

Aceptación oculta (nueva, en `evals/reserved/`):
- con `cursoId`, docx, pdf y json salen de `config.planningSnapshot.resultado`;
- un cuerpo manipulado no cambia el resultado;
- un curso sin planificación válida responde con un 4xx sin usar el cuerpo;
- sin `cursoId` se sigue usando el cuerpo;
- el cliente no envía la planificación cuando hay curso.

Los tests van al nivel del manejador HTTP, con los helpers del propio proyecto, para no depender de cómo se implemente. Mide la corrección, la fuerza de los tests (H6) y si se crea documento: n_ein lo crearía, Gentle no.

**S3 · Grande, tres entregas separadas.** Base `4d66007`.
> Cierra las deudas de `docs/alpha-v1/estado-actual.md`: que al dar de alta un centro se rechace a quien ya tiene cursos propios o módulos asignados; que `tests/pages/anexo-iv-codigo.test.ts` monte el componente en vez de leerlo como texto; y corrige el documento, que todavía da en gris el botón «Crear un curso» del centro.

Aceptación oculta:
- el alta de centro devuelve el error esperado en los dos casos y sigue funcionando en el caso limpio;
- el test del Anexo IV monta el componente, comprobado con un mutante que debe hacerlo fallar;
- el documento ya no dice que el botón está en gris.

Antes de escribirla, se confirma que las tres deudas siguen abiertas en `4d66007`. Mide el documento, los commits por tarea, la delegación y el paralelismo.

**S4 · Retomar y relevar S3.**
- **S4a:** cada ejecución de S3 se corta tras su primer commit, matando el proceso para simular una interrupción. Una sesión nueva de la misma variante recibe solo «Continúa el trabajo pendiente». Se mide si identifica la tarea siguiente, si respeta lo hecho y si conserva las decisiones, más los tokens gastados antes de la primera escritura.
- **S4b:** el artefacto de cada variante se entrega a un agente distinto (Claude Code sin n_ein, en un hogar aislado), con la indicación «El trabajo está descrito en `<artefacto>`; continúa». El artefacto es `WORK.md`, `odd/tasks/…`, `work/…` o `.scratch/…` más el relevo de `handoff`. Mide qué artefacto se sostiene solo (H2, H3, H4).

## Control de variables

- **Modelo.** El mismo en todas las variantes y en todos los roles. Propuesta: Sol medium. En C, su equivalente en Codex, cuyo nombre se comprueba en la fase 0.
- **Versión de Pi.** Todas las variantes de Pi usan la misma versión: la última publicada al empezar (hoy, 1.0.2). Samu decidió el 5 de octubre seguir las versiones de Pi en vez de quedarse en una antigua, así que subir n_ein a esa versión es un requisito de la fase 0, no una variable del banco. Si sale otra versión a mitad del banco, se termina con la de partida.
- **Hogar aislado por ejecución.**
  - `HOME`, `PI_CODING_AGENT_DIR`, `GENTLE_SHELL_HOME`, `GENTLE_SHELL_CONFIG`, `CODEX_HOME` y el directorio de sesiones apuntan dentro del banco.
  - Hay un `.gitconfig` mínimo con la identidad de Samu, y la caché de Bun se reutiliza para no descargar dependencias.
  - Nada escribe en el `~` real: Gentle guarda su persona en `~/.pi/gentle-ai` y su configuración en `~/.gentle-shell`.
- **Credenciales.**
  - Samu hace un login de banco una vez. Antes de cada ejecución se copia `auth.json` del maestro y, si Pi lo renovó, se devuelve al maestro.
  - Las ejecuciones van en serie por defecto. Se permiten hasta 3 en paralelo solo con el token recién renovado.
- **Idioma.** Conversación en castellano; artefactos en el idioma del proyecto.
- **TDD.** El corpus declara `strict_tdd: true` (`openspec/config.yaml`), y Gentle lo lee. Se deja así en todas las variantes.
- **Orden.** Las variantes se alternan dentro de cada escenario para que la hora o la carga del proveedor no favorezcan siempre a la misma.
- **Repeticiones.** Dos por celda. Si las dos discrepan en aceptación, se lanza una tercera.

## Métricas

Por ejecución, en un JSON en `evals/results/bench/<run>.json`:

| Grupo | Qué se recoge |
|---|---|
| Aceptación | Tests ocultos (n/total), typecheck, suite completa y rondas de corrección necesarias. |
| Coste | Tokens de entrada, caché leída y escrita, salida y razonamiento; coste estimado del catálogo. Se suman todas las sesiones del hogar de la ejecución, incluidas las hijas. |
| Ritmo | Tiempo de pared, turnos, llamadas a herramientas, subagentes por rol y si fueron en paralelo. |
| Método | Rama, número de commits, push intentado, rojo observado antes del código y llamadas a CodeGraph frente a grep o lectura. |
| Artefactos | Archivos y bytes de documento creados, y bytes reescritos por edición. Comprueba la regla de editar por trozos. |
| S4 | Tarea siguiente correcta (sí/no), trabajo deshecho (sí/no), decisiones conservadas (n/total) y tokens antes de la primera escritura. |

**Revisión a ciegas** de S2 y S3:
- **Juez:** Claude Opus, de otra familia que el modelo que trabaja, para evitar que se prefiera a sí mismo.
- **Qué recibe:** los diffs anonimizados y barajados, el encargo y una rúbrica (corrección, fuerza de los tests, alcance, legibilidad, documentación).
- **Qué devuelve:** una puntuación de 1 a 5 por criterio y defectos con `path:line`.
- **Control:** se le incluye un diff limpio y uno con un defecto sembrado, para medir su precisión.

## Banco

- **Código del banco**, en el repo: `evals/bench/` con `run.sh`, `analyze.ts`, `judge.ts` y los `flow.md` de N2 y N3. Toma de la prueba del 2 de octubre los scripts que ya funcionaron: copias con `git archive` y `node_modules` clonado, `origin` bare para detectar push, y `analyze.ts` sobre los eventos.
- **Material de trabajo**, fuera del repo y fuera de temporales: `/Users/samu/Documents/01_Proyectos/n_ein-bench/`, con `products/`, `homes/`, `copies/` y `logs/`. CodeGraph se niega a indexar temporales, y el banco dura varios días.
- **Aceptación oculta** en `evals/reserved/`, como el parche del Anexo IV.
- **Resultados** en `evals/results/`: un JSON por ejecución y un informe final con lo comprobado, las hipótesis y lo pendiente.

## Fases

Cada fase termina con un resultado que Samu revisa antes de pasar a la siguiente.

| Fase | Trabajo | Modelo | Criterio de salida |
|---|---|---|---|
| 0 | Subir n_ein a la última versión de Pi, con sus tests y `./scripts/check.sh`, en un commit propio. Montar los productos fijados. Comprobar el nombre del modelo en Codex, el login de banco y dónde guarda sesiones cada producto. | Una llamada mínima por variante | n_ein pasa sus checks en la nueva versión de Pi. Las ocho variantes arrancan en su hogar y escriben sesiones que `analyze.ts` suma. |
| 1 | Escribir la aceptación oculta de S2 y S3. Debe fallar en la base y pasar con una solución de referencia escrita a mano. Montar `run.sh`, `analyze.ts` y `judge.ts`. | Ninguno | Las tres aceptaciones validadas: rojo en la base, verde con la referencia. |
| 2 | Piloto: S1 con A, N1, G, M y C, una vez cada una. | 5 ejecuciones | Métricas completas y comparables; ningún fallo de montaje. |
| 3 | Matriz: S1 (5 variantes), S2 (7) y S3 (8), dos repeticiones. | ≈ 40 ejecuciones | Todas las celdas con dato, o el motivo de la que falta. |
| 4 | S4a y S4b sobre los estados de S3 que tienen artefacto (N1, N2, N3, G, G+E, M). | ≈ 18 ejecuciones | Puntuación de retomar por variante. |
| 5 | Delegación: N1 con roles por defecto (Luna) frente a N1 con Sol en todos los roles, en S2 y S3. | ≈ 8 ejecuciones | Coste y aceptación de cada configuración. |
| 6 | Revisión a ciegas, informe y propuesta de cambios para n_ein. | ≈ 10 llamadas de Claude | Decisión sobre los cinco puntos del principio. |

**Recorte tras la fase 2:** si una variante falla por montaje y no por método, se arregla o se retira. Si N2 y N3 no difieren de N1 en S2, en S3 solo se ejecuta la que mejor retome en un S4a de prueba.

**Coste estimado:** unas 70–80 ejecuciones con modelo. La estimación del catálogo, que no es lo facturado, es de 40–80 USD, y el límite real es la cuota de Codex. El tiempo de máquina, en serie, ronda las 10–12 horas, repartidas en dos o tres días.

## Paradas y seguridad

El banco se detiene y avisa si:
- un error de cuota o de límite de uso;
- un modelo distinto del pedido en los eventos;
- un fallo al renovar credenciales;
- un push que llega al `origin` bare;
- cualquier escritura fuera del hogar o de la copia de la ejecución.

Nunca se toca el checkout de `planificador-didactico`, ni Ein legado, ni `~/.pi`, ni `~/.claude`, ni `~/.codex`. Los productos se instalan solo dentro del banco.

## Cómo se decide

Una variante gana un punto si mejora la aceptación sin perder en las otras dos, o si iguala la aceptación con al menos un 20 % menos de coste o de tiempo en las dos repeticiones. Con diferencias menores, se declara empate y se elige la opción más simple. En S4 gana quien retome bien en 2 de 2 frente a quien lo haga en 1 de 2 o menos. Con dos repeticiones el informe habla de indicios, no de conclusiones: lo comprobado, las hipótesis y lo pendiente van por separado.

## Decisiones abiertas

1. **Ein legado (E):** recomiendo dejarlo fuera; N3 aproxima el trabajo con varios archivos sin tocar su instalación.
2. **Modelo común:** recomiendo Sol medium, para que la matriz quepa en la cuota. Sol high es el predeterminado de n_ein y encarecería todo por igual.
3. **Juez:** Claude Opus, con suscripción de Claude. La alternativa es Sol high, más barato pero del mismo proveedor que el modelo que trabaja.
4. **CodeGraph:** las variantes van tal como se distribuyen (N y G lo traen; A, M y C no). Si N1 gana a A, la fase 3 añade «N1 sin CodeGraph» en S2 para separar el efecto.
