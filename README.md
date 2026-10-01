# n_ein

n_ein es el nuevo entorno personal de programación de Samu. La versión de desarrollo arranca Pi 0.87.1 con hogar aislado, tema de Ein, voz docente, las skills `intent`, `comment-style` y `logging-style`, y un trabajador configurable (Luna high por defecto). El relevo Pi↔Claude, un instalador local y el launcher de cinco vistas en Go ya tienen recorridos verificados.

## Arrancar

Con Pi 0.87.1 instalado:

```sh
./bin/n-ein-dev
```

El lanzador conserva el directorio de trabajo actual y pasa los argumentos a Pi. Usa `~/.n_ein/dev/pi-agent` para configuración, autenticación y sesiones. No copia credenciales de Pi normal, Codex CLI ni Ein legado. Si quieres probar con otro hogar aislado, define `N_EIN_AGENT_DIR` antes de arrancar.

Por defecto, el principal usa `openai-codex/gpt-6-sol` y el trabajador `openai-codex/gpt-6-luna`, ambos con razonamiento `high`. En las instalaciones que incluyen el selector, `/models` dentro de Pi elige modelo y esfuerzo de cada rol desde el catálogo disponible; admite un ID personalizado y restablecer el valor del paquete. Guarda la elección en `~/.n_ein/<canal>/models.json`, fuera del código gestionado: el principal cambia al reiniciar Pi y el trabajador en su siguiente encargo. Configuración muestra el valor efectivo y si procede del paquete o del ajuste del canal. Un modelo inaccesible da un error visible, sin cambiar silenciosamente de proveedor. Para usar la suscripción desde Pi, inicia sesión en ese hogar con `/login` y el proveedor OpenAI Codex. El inicio de sesión ya hecho en Codex CLI no se copia automáticamente a Pi.

`/skill:intent` inicia la conversación para concretar una idea. En peticiones claras se trabaja directamente. Las otras skills se cargan según la tarea.

El [ensayo de cierre de intent](evals/results/2026-09-29-intent.md) comprobó varias rondas sin escrituras, síntesis confirmada y un único `WORK.md` posterior sin implementar código.

El contexto de origen y el plan están en [docs/START_HERE.md](docs/START_HERE.md). Las fuentes de `docs/archive/` y `docs/sources/` son referencias históricas; el lanzador solo carga `pi-package/`.

`./scripts/check.sh` instala las dependencias de `bun.lock`, ejecuta los checks locales deterministas de shell, Bun y Go, compila los dos binarios y prueba un paquete instalado fuera del checkout; las evaluaciones con modelos reales se lanzan por separado. El [workflow de GitHub](.github/workflows/check.yml) ejecuta ese mismo recorrido sin credenciales ni llamadas a modelos.

El [primer caso de regresión](evals/results/2026-09-29-first-session.md) ya pasó con Sol high y, en una sesión directa separada, con Luna high.
La [continuación SQLSTATE](evals/results/2026-09-29-sqlstate.md) probó TDD ya elegido, delegación a Luna, regresión roja y verde, y un arreglo posterior en sesión nueva sin repetir la entrevista.

El agente principal puede usar `n_ein_worker` para encargar trabajo completo al modelo configurado para el trabajador (Luna high por defecto). `work` permite editar y comprobar; `explore` y `review` solo cargan herramientas de lectura. El resultado incluye el modelo realmente usado, estado final, comandos observados y una estimación de catálogo separada del coste facturado. Hay un trabajador activo por sesión de Pi; el padre revisa el diff y la evidencia antes de aceptar el resultado. El [primer recorrido delegado](evals/results/2026-09-29-worker.md) incluye una regresión y una API de notas pequeña.

La cancelación se comprobó con `bun run evals/cancel-smoke.ts`: al interrumpir una herramienta larga, el cambio previo permanece y el proceso hijo deja de escribir. Es una evaluación manual que usa la suscripción.

La [primera evaluación con código real](evals/results/2026-09-29-planificador.md) reprodujo y corrigió en una copia aislada una regresión histórica de `planificador-didactico`. El árbol habitual del proyecto no se tocó.

Para un encargo prolongado, `WORK.md` en la raíz del proyecto conserva objetivo, decisiones, criterios, casillas bajo `## Tareas`, evidencia y siguiente paso. Si el proyecto ya tiene otro documento, `N_EIN_WORK_DOC` puede apuntar a él. Pi muestra la tarea actual debajo del editor; `/todo done N` y `/todo add texto` actualizan el mismo markdown. Sin documento, el TODO no aparece.

En Pi interactivo, `/handoff claude` espera a que termine el trabajo activo, guarda un resumen markdown con objetivo, decisiones, tareas y estado Git, cierra Pi y abre Claude con ese resumen como primer mensaje. Claude usa `~/.n_ein/dev/claude`, separado de la instalación habitual y de Ein legado; cada skill apunta al catálogo único de `pi-package/skills` mientras la caché propia queda en su hogar. El [ensayo de relevo](evals/results/2026-09-29-handoff.md) verificó el cierre, la continuación de solo lectura y la salida en la TUI real de Claude. Una instalación nueva de Claude pide completar su primer arranque.

Para volver desde Claude, usa `/handoff-pi`. Esa skill conserva el resultado en `WORK.md`, prepara un resumen con Git y te indica cerrar Claude con `/exit`. El lanzador espera la salida de Claude antes de abrir Pi con el resumen. El [relevo inverso](evals/results/2026-09-29-handoff.md) pasó tanto con procesos simulados como en las TUI reales de Claude y Pi; Pi recuperó el pendiente sin reabrir decisiones ya fijadas.

## Instalación local de prueba

La [preview 0.1.0-preview.1](https://github.com/samuhlo/n_ein/releases/tag/v0.1.0-preview.1) distribuye un candidato para macOS arm64 y otro para Linux amd64. En el Mac de Samu, con Bun y Pi 0.87.1 disponibles:

```sh
gh release download v0.1.0-preview.1 -R samuhlo/n_ein --pattern 'n-ein-0.1.0-preview.1-darwin-arm64.tar.gz*'
shasum -a 256 -c n-ein-0.1.0-preview.1-darwin-arm64.tar.gz.sha256
tar -xzf n-ein-0.1.0-preview.1-darwin-arm64.tar.gz
./n-ein-0.1.0-preview.1-darwin-arm64/bin/n-ein-install install --source ./n-ein-0.1.0-preview.1-darwin-arm64 --channel preview --dry-run
./n-ein-0.1.0-preview.1-darwin-arm64/bin/n-ein-install install --source ./n-ein-0.1.0-preview.1-darwin-arm64 --channel preview
~/.n_ein/installations/preview/bin/n-ein-install doctor --channel preview --runtime
~/.n_ein/installations/preview/bin/n-ein
```

El primer arranque de Pi en preview requiere `/login` en `~/.n_ein/preview/pi-agent`; esa autenticación no se copia desde desarrollo ni desde Ein. Para actualizar una preview posterior, descarga su candidato y usa `n-ein-install update --source <directorio-extraído> --channel preview`; `restore --channel preview` vuelve al backup anterior. La vista Sistema aún no descarga actualizaciones por sí sola.

### Hotfix local de preview

La release `v0.1.0-preview.1` es una base inmutable. Para aplicar al canal preview un commit posterior comprobado —por ejemplo, el selector `/models`— sin publicar otra prerelease, desde un checkout limpio de n_ein:

```sh
./scripts/hotfix-preview.sh plan
./scripts/hotfix-preview.sh apply
./scripts/hotfix-preview.sh rollback
```

`plan` ejecuta los checks, compila un candidato nativo con versión `0.1.0-preview.1+hotfix.<commit>` y muestra el update sin sustituir la instalación. `apply` verifica el candidato, conserva un backup y ejecuta `doctor`; `rollback` recupera el último backup. Si desde el hotfix instalado solo cambiaron docs o herramientas de desarrollo, `apply` no reinstala el runtime. El archivo de modelos, la autenticación y las sesiones siguen fuera del árbol reemplazado. Hazlo con las sesiones de ese canal cerradas. El hotfix no publica un tag ni modifica la release original.

También hay una **release de hotfix desde rama** para compartir una corrección sin arrastrar lo que esté en `main`: se crea `hotfix/<nombre>` desde el tag publicado, se incorporan solo la corrección y el soporte de build, y se etiqueta `v<base>.hotfix.N`. `scripts/verify-hotfix-branch.sh <tag>` rechaza una rama nacida de `main`, un árbol sucio o un tag sin cambio de runtime. El tag pasa CI y genera el paquete Linux; el paquete macOS se construye nativamente con `scripts/build-preview.sh <versión>`. Ambos adjuntos se publican como prerelease con `gh release create --verify-tag`, conservando `main` y el hotfix local como vías independientes. El [procedimiento](docs/05-despliegue.md#hotfix-desde-rama) y la [primera nota de mantenimiento](docs/releases/0.1.0-preview.1.hotfix.1.md) concretan el recorrido.

### Desde el checkout

Con Go 1.27.1, construye el instalador separado y mira el plan antes de escribir:

```sh
mkdir -p dist
(cd go && go build -o ../dist/n-ein ./cmd/n-ein)
(cd go && go build -o ../dist/n-ein-install ./cmd/n-ein-install)
./dist/n-ein-install install --source . --channel preview --dry-run
./dist/n-ein-install install --source . --channel preview
./dist/n-ein-install doctor --channel preview --runtime
./dist/n-ein --project . --once
```

La instalación directa desde `.` sirve para desarrollo. Para probar y promover exactamente el mismo paquete local, crea un candidato nuevo y úsalo como fuente en ambos canales:

```sh
./dist/n-ein-install package --source . --output dist/candidato-1
./dist/candidato-1/bin/n-ein-install install --source dist/candidato-1 --channel preview
./dist/candidato-1/bin/n-ein-install install --source dist/candidato-1 --channel stable
```

El código va a `~/.n_ein/installations/<canal>`; Pi y Claude guardan credenciales y sesiones en `~/.n_ein/<canal>/`, fuera del árbol gestionado. `doctor` comprueba hashes y modos; con `--runtime` comprueba además que Bun está disponible y que la versión de Pi coincide con `runtime.json`, sin probar la autenticación. La vista Sistema usa ese diagnóstico ampliado. `install` y `update` rechazan directorios existentes que no sean instalaciones n_ein; una instalación identificada se puede reparar aunque un archivo esté dañado. `update --source`, `restore` y `uninstall` crean o conservan backups del código sin borrar esos datos. El [ensayo del instalador](evals/results/2026-09-29-installer.md) verificó la promoción de un candidato en destinos temporales; todavía no hay releases remotas.

`n-ein` abre Estado, Configuración, Sesiones, Sistema y Runtime. `tab` cambia de vista; `j/k`, `g/G`, `f` o `/`, `enter` y `q` conservan los atajos de Ein. `--once` o una salida sin TTY pintan una vez y salen con 0; `--view sesiones` permite inspeccionar otra vista en scripts. En la TUI, Runtime abre Pi o Claude, Sesiones reanuda una sesión del proyecto y Sistema ejecuta `doctor --runtime` sobre el paquete instalado. Las vistas Sistema y Runtime respetan `N_EIN_PI_BIN` y `N_EIN_CLAUDE_BIN`; Runtime no ofrece abrir Pi si su versión difiere de la fijada. La [prueba del launcher](evals/results/2026-09-29-launcher.md) incluye el binario instalado fuera del checkout y sesiones reales de Pi y Claude abiertas y reanudadas desde el binario Go de desarrollo. La edición de ajustes y las actualizaciones remotas aún no están conectadas a esas vistas.
