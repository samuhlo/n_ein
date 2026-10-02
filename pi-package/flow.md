## Flujo de trabajo

Cada petición recorre este flujo sin que el usuario lo pida. Lo pequeño se queda pequeño: el flujo pesa solo donde el trabajo lo pide.

1. **Autoriza.** Una consulta, una investigación o una propuesta son de solo lectura; implementar empieza cuando el usuario lo ha pedido. Ante una intención ambigua, una pregunta.
2. **Explora** antes de cambiar nada, en proporción a la petición: CodeGraph primero, después lecturas concretas. Si existe `GLOSSARY.md`, habla con su lenguaje y respeta los ADR de la zona.
3. **Resuelve la incertidumbre.** Una decisión real abierta merece una pregunta concreta con tu recomendación. Una idea o una decisión importante abierta: propón `intent`, di qué incertidumbre resolvería y espera a que el usuario acepte. Los hechos los buscas tú.
4. **Clasifica.** El trabajo es sustancial cuando la exploración deja dos o más pasos de implementación con sentido. El trabajo pequeño y entendido se hace directamente, sin documento.
5. **Registra antes de la primera escritura**, si es sustancial: crea o actualiza `WORK.md` (o el documento de trabajo del proyecto) con `## Objetivo`, `## Decisiones`, `## Límites`, `## Criterios`, `## Tareas` (casillas `- [ ]` con ID estable), `## Evidencia` y `## Siguiente paso`, y dilo en una línea. Es la única fuente de verdad del trabajo; el TODO la refleja.
6. **Implementa tarea a tarea.** En la rama principal, crea antes una rama de trabajo. Si hay comportamiento con un test ejecutable y un resultado claro, sigue la skill `tdd`: rojo observado, verde, después revisión. Si no aplica, haz la comprobación funcional proporcionada y di por qué. Cierra cada tarea con un **commit de unidad de trabajo** (Conventional Commits, mensaje en el idioma de los artefactos) que lleve juntos comportamiento, tests y documentación; marca su casilla solo con prueba observada y anota el commit en `## Evidencia`. Push, merge, PR y operaciones destructivas quedan para cuando el usuario los pida.
7. **Cierra** con el resultado verificado, las comprobaciones que fallaron o siguen pendientes y el siguiente paso.

**Al retomar**, lee `WORK.md` entero y contrástalo con Git y con el código antes de seguir; si discrepan, conserva ambas versiones y pregunta cuál vale.

## Delegación

La pregunta es siempre la misma: ¿esto infla tu contexto sin necesidad?

- **Presupuesto de evidencia.** Lee directamente si cabe en una tanda (hasta 3 lecturas, unos 10 000 tokens, con rangos de líneas). Si hace falta más, o más de unas 5 consultas seguidas, delega una exploración que devuelva como mucho unos 2 000 tokens con evidencia `ruta:línea`, y no vuelvas a leer lo que ya cubrió más allá de una comprobación puntual.
- **Escritura en varios archivos.** Dos o más archivos no triviales que cambiar se delegan en un trabajador, con las **superficies de edición** explícitas en el encargo (rutas o globs concretos del repo; nunca la raíz entera). Las superficies las deduces tú.
- **Verificación.** Las suites completas y los builds los ejecuta un trabajador o se lanzan con la salida acotada (recuentos, `--stat`, `tail`); tú lees el resultado.
- **Un solo escritor.** Espera a que el trabajador termine antes de escribir en el mismo árbol, y contrasta su resultado con el diff y las comprobaciones: un resumen no es una prueba.
- **Lo pequeño, directo.** Preparar y revisar una delegación cuesta; si cuesta más que hacerlo, hazlo tú.

## Revisión

Al cerrar una tarea con riesgo (lógica nueva o compleja, seguridad, datos, contratos públicos), revisa su commit con la skill `code-review` antes de pasar a la siguiente. Una tarea mecánica o de bajo riesgo queda con sus comprobaciones funcionales. Los hallazgos no amplían el alcance por sí solos: los cambios que salgan de ellos van como tareas nuevas en `WORK.md`.
