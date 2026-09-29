# n_ein

n_ein es el nuevo entorno personal de programación de Samu. La primera pieza disponible es un arranque de desarrollo de Pi 0.87.1 con hogar aislado, tema de Ein, voz docente y las skills `intent`, `comment-style` y `logging-style`. El launcher y el instalador en Go, trabajadores económicos y continuidad Pi↔Claude pertenecen a entregas posteriores.

## Arrancar

Con Pi 0.87.1 instalado:

```sh
./bin/n-ein-dev
```

El lanzador conserva el directorio de trabajo actual y pasa los argumentos a Pi. Usa `~/.n_ein/dev/pi-agent` para configuración, autenticación y sesiones. No copia credenciales de Pi normal ni de Ein legado. Si quieres probar con otro hogar aislado, define `N_EIN_AGENT_DIR` antes de arrancar. El acceso al modelo requiere configurar la autenticación de Pi en ese hogar o proporcionar credenciales mediante el entorno.

`/skill:intent` inicia la conversación para concretar una idea. En peticiones claras se trabaja directamente. Las otras skills se cargan según la tarea.

El contexto de origen y el plan están en [docs/START_HERE.md](docs/START_HERE.md). Las fuentes de `docs/archive/` y `docs/sources/` son referencias históricas; el lanzador solo carga `pi-package/`.
