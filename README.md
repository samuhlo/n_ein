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
