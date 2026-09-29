# n_ein

n_ein es el nuevo entorno personal de programación de Samu. La versión de desarrollo arranca Pi 0.87.1 con hogar aislado, tema de Ein, voz docente, las skills `intent`, `comment-style` y `logging-style`, y un trabajador Luna high. El launcher y el instalador en Go y la continuidad Pi↔Claude pertenecen a entregas posteriores.

## Arrancar

Con Pi 0.87.1 instalado:

```sh
./bin/n-ein-dev
```

El lanzador conserva el directorio de trabajo actual y pasa los argumentos a Pi. Usa `~/.n_ein/dev/pi-agent` para configuración, autenticación y sesiones. No copia credenciales de Pi normal, Codex CLI ni Ein legado. Si quieres probar con otro hogar aislado, define `N_EIN_AGENT_DIR` antes de arrancar.

El modelo principal es `openai-codex/gpt-6-sol` con razonamiento `high`. Los futuros trabajadores usarán `openai-codex/gpt-6-luna` con razonamiento `high`. Esta elección es explícita: una falta de acceso no debe enviar la petición a otro proveedor. Para usar la suscripción desde Pi, inicia sesión en ese hogar con `/login` y el proveedor OpenAI Codex. El inicio de sesión ya hecho en Codex CLI no se copia automáticamente a Pi.

`/skill:intent` inicia la conversación para concretar una idea. En peticiones claras se trabaja directamente. Las otras skills se cargan según la tarea.

El contexto de origen y el plan están en [docs/START_HERE.md](docs/START_HERE.md). Las fuentes de `docs/archive/` y `docs/sources/` son referencias históricas; el lanzador solo carga `pi-package/`.

El [primer caso de regresión](evals/results/2026-09-29-first-session.md) ya pasó con Sol high y, en una sesión directa separada, con Luna high.

El agente principal puede usar `n_ein_worker` para encargar trabajo completo a Luna high. `work` permite editar y comprobar; `explore` y `review` solo cargan herramientas de lectura. El resultado incluye el modelo realmente usado, estado final, comandos observados y una estimación de catálogo separada del coste facturado. Hay un trabajador activo por sesión de Pi; el padre revisa el diff y la evidencia antes de aceptar el resultado. El [primer recorrido delegado](evals/results/2026-09-29-worker.md) incluye una regresión y una API de notas pequeña.

La cancelación se comprobó con `bun run evals/cancel-smoke.ts`: al interrumpir una herramienta larga, el cambio previo permanece y el proceso hijo deja de escribir. Es una evaluación manual que usa la suscripción.

La [primera evaluación con código real](evals/results/2026-09-29-planificador.md) reprodujo y corrigió en una copia aislada una regresión histórica de `planificador-didactico`. El árbol habitual del proyecto no se tocó.

Para un encargo prolongado, `WORK.md` en la raíz del proyecto conserva objetivo, decisiones, criterios, casillas bajo `## Tareas`, evidencia y siguiente paso. Si el proyecto ya tiene otro documento, `N_EIN_WORK_DOC` puede apuntar a él. Pi muestra la tarea actual debajo del editor; `/todo done N` y `/todo add texto` actualizan el mismo markdown. Sin documento, el TODO no aparece.

En Pi interactivo, `/handoff claude` espera a que termine el trabajo activo, guarda un resumen markdown con objetivo, decisiones, tareas y estado Git, cierra Pi y abre Claude con ese resumen como primer mensaje. Claude usa `~/.n_ein/dev/claude`, separado de la instalación habitual y de Ein legado; cada skill apunta al catálogo único de `pi-package/skills` mientras la caché propia queda en su hogar. El [ensayo de relevo](evals/results/2026-09-29-handoff.md) verificó el cierre, la continuación de solo lectura y la salida en la TUI real de Claude. Una instalación nueva de Claude pide completar su primer arranque.

Para volver desde Claude, usa `/handoff-pi`. Esa skill conserva el resultado en `WORK.md`, prepara un resumen con Git y te indica cerrar Claude con `/exit`. El lanzador espera la salida de Claude antes de abrir Pi con el resumen; [la prueba del lanzador inverso](evals/results/2026-09-29-handoff.md) usa procesos simulados para verificar el orden. Una prueba manual con los dos modelos reales confirmó que Pi leyó el avance escrito por Claude en `WORK.md` sin reabrir la decisión pendiente.
