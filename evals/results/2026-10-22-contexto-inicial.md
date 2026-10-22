# Contexto inicial y qué llena el contexto después

22 de octubre de 2026. Medición sobre sesiones ya grabadas, sin llamadas nuevas a ningún modelo.

## Por qué

En gentle-ai, la issue [#5139](https://github.com/Gentleman-Programming/gentle-ai/issues/5139) y el commit `991c3d06` cambiaron la regla de cuándo delegar: antes contaban archivos y ahora usan un presupuesto de evidencia. Su medición encontró dos cosas:

- Gentle arranca cada sesión con unos **124k tokens de contexto fijo**. El 30 % es su `AGENTS.md` gestionado y el 23 % son esquemas de herramientas.
- En sus sesiones, la salida de bash llenaba el contexto tanto como las lecturas: una mediana de unos 10k tokens frente a unos 8k por sesión.

Antes de copiar sus remedios (acotar la salida de los comandos y adelgazar el contexto fijo), aquí se comprueba si n_ein tiene los mismos problemas.

## Método

- Script: `bun evals/bench/context-load.ts <sesiones>`. Lee las sesiones de Pi y de Claude Code.
- **Prefijo:** la entrada del primer turno, contando la caché. Incluye el primer mensaje del usuario.
- **Salida de herramientas:** caracteres devueltos, agrupados por tipo de herramienta.
- **Arrastre:** tamaño de cada salida × turnos que quedan después. Es lo que se vuelve a leer de la caché.
- **Límite en Pi:** la sesión guarda el resultado original, así que lo que `context.ts` retira después no se descuenta. En NR6–NR10 el arrastre real es menor que el medido.
- **Pi:** banco `n_ein-bench/homes/s*-NR*`, separado antes (NR–NR5) y después (NR6–NR10) de la retirada de contexto del 6 de octubre.
- **Claude:** las 21 sesiones de `~/.n_ein/{dev,preview}/claude/projects`. Casi todas son pruebas cortas.
- **Desglose de Claude:** sale de las entradas `api-request-shape` y `api-request-blob`, que Claude Code 2.1.304 guarda en la sesión.

## Pi: el contexto fijo es pequeño y la salida de los checks no pesa

| Grupo | Sesiones | Prefijo mediano | Turnos medianos |
|---|---:|---:|---:|
| NR–NR5 | 42 | 4.264 tokens | 26 |
| NR6–NR10 | 34 | 4.922 tokens | 56 |

| Grupo | CodeGraph | Leer archivo entero | Leer por rangos | Búsquedas | Checks | Git |
|---|---:|---:|---:|---:|---:|---:|
| NR–NR5, salida | 40 % | 11 % | 26 % | 12 % | 2 % | 6 % |
| NR–NR5, arrastre | 40 % | 13 % | 28 % | 14 % | 1 % | 3 % |
| NR6–NR10, salida | 28 % | 15 % | 27 % | 17 % | 3 % | 7 % |
| NR6–NR10, arrastre | 31 % | 16 % | 25 % | 19 % | 2 % | 3 % |

- **El prefijo de Pi es unas 25 veces menor que el de Gentle.** No hay margen que recortar ahí.
- **Los tests, tipos y builds aportan un 2–3 % de la salida.** No se repite lo que Gentle vio con bash, así que pedir salida acotada a los comandos casi no ahorraría nada.
- **Las lecturas ya son pequeñas.** Mediana de 3–4k caracteres; dos de cada tres usan rango; las de más de 12k caracteres suman un 9–16 % de lo leído.
- **CodeGraph es el elemento más grande.** Cada `codegraph_explore` devuelve unos 24–25k caracteres; el percentil 90 está en 24.983, justo en el tope de la herramienta. Hay unas 3,3 llamadas por sesión. Tras la retirada del 6 de octubre su peso baja del 40 al 28–31 %.

## Claude: el contexto fijo lo llena sobre todo lo ajeno a n_ein

En proyectos temporales, fuera de la carpeta personal, el prefijo es de 15–23k tokens. En proyectos reales bajo `~` sube a 49–59k: `n_ein` 59.476 y `planificador-didactico` 55.423.

Desglose de la sesión en `n_ein` del 22 de octubre (59.476 tokens, unos 162k caracteres):

| Parte | Caracteres | Parte del total | Origen |
|---|---:|---:|---|
| Esquemas de herramientas incorporadas (17) | 67.409 | 42 % | Claude Code. Solo `Artifact` ya son 37.199 (23 %) |
| Nombres de herramientas diferidas (481) | 20.581 | 13 % | Conectores de claude.ai: Vercel 239, Neon 119, Figma 44, Chrome 22… |
| Lista de skills (43) | 18.180 | 11 % | 17 de n_ein; el resto, de Claude Code y de claude.ai |
| Instrucciones de servidores MCP | 14.600 | 9 % | Mismos conectores, más CodeGraph |
| Persona, flujo e idioma de n_ein | ~13.800 | 9 % | `persona.md`, `flow.md`, idioma |
| `~/.claude/CLAUDE.md` y estado de Git | 10.637 | 7 % | Lo encuentra al subir por las carpetas desde el proyecto |
| Base de Claude Code, memoria y tipos de agente | ~15.400 | 9 % | Claude Code |

El reparto de tokens se aproxima por caracteres: los esquemas JSON se tokenizan de otra manera, así que estos porcentajes son orientativos.

- **Unos 31k caracteres (cerca del 19 %) vienen de los conectores de la cuenta de claude.ai:** 20,2k de nombres diferidos más unos 10,5k de sus instrucciones. Nada en n_ein los pide: `CLAUDE_CONFIG_DIR` aísla la configuración, pero no la cuenta. En suscripción, ese bloque se vuelve a leer de la caché en cada turno.
- **El `CLAUDE.md` global del usuario entra como «instrucciones del proyecto».** Claude Code lo encuentra al subir por las carpetas porque el proyecto vive bajo `~`. Su sección de CodeGraph está duplicada y pide inicializar el índice con otra herramienta, mientras que n_ein ya lo gestiona por su cuenta.
- **Lo propio de n_ein es el 9 %.**

## Conclusión

- **Acotar la salida de comandos en el flujo no está respaldado por estos datos:** los checks son el 2–3 % y las lecturas ya van por rangos. No se cambia `flow.md`.
- **Las palancas medidas son dos:**
  - **En Pi**, el tamaño fijo de cada respuesta de CodeGraph (unos 25k caracteres).
  - **En Claude**, lo que la cuenta y la carpeta personal añaden al contexto fijo de cada sesión.
- **Las dos tocan comportamiento o configuración del usuario.** Necesitan decisión y comprobación aparte; esta medición no las cambia.

## Pendiente

- **Conectores de claude.ai en Claude:** decidir si deben estar disponibles. Si no, comprobar el mecanismo; la documentación consultada vía Context7 no lo confirmó.
- **`~/.claude/CLAUDE.md`:** decidir si debe entrar en las sesiones de n_ein.
- **`Artifact`:** decidir si su esquema compensa en el recorrido ordinario.
- **CodeGraph en Pi:** medir si respuestas más cortas mantienen la calidad antes de cambiar el tope.
- **Sesiones largas de Claude:** casi no hay grabadas, así que el reparto de su arrastre no es representativo.
