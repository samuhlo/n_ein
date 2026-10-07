# n_ein

n_ein es el nuevo entorno personal de programación de Samu. La versión de desarrollo arranca Pi 1.0.2 con hogar aislado, tema de Ein, voz docente, sus skills y un modelo por encargo (`nein/auto`): Luna para lo mecánico, Sol para lo ordinario y Sol high para lo arriesgado. El relevo Pi↔Claude, un instalador local y el launcher de cinco vistas en Go ya tienen recorridos verificados.

## Usarlo conversando

Abre `nein`, elige Pi o Claude y cuenta qué necesitas. El agente selecciona las skills, organiza el encargo, comprueba los cambios y conserva lo necesario para continuar.

| Puedes decir | Qué ocurre |
|---|---|
| «Ayúdame a pensar esta idea» | Investiga y plantea las decisiones necesarias con recomendación. |
| «Corrige este fallo» | Trabaja directamente si el encargo está claro. |
| «Vale, hazlo» | Usa el acuerdo y construye dentro del alcance autorizado. |
| «Otra cosa: …» | Inicia otro encargo y elige de nuevo el modelo. |
| «Sigue donde lo dejamos» | Recupera decisiones, evidencia y pendiente antes de continuar. |
| «Quiero continuar con Claude» / «Sigamos con Pi» | Prepara el relevo. Claude muestra la acción de salida que exige su interfaz. |

Los comandos siguen como atajos; el recorrido ordinario no requiere conocer nombres de skills. El cierre de un cambio pequeño muestra resultado, comprobación y commit. Para un trabajo importante añade el detalle que permita revisarlo.

## Equipo experimental

La rama de desarrollo puede repartir un encargo autorizado entre hasta dos trabajadores generalistas, cada uno en su worktree. Puedes pedir «haz estos dos frentes en paralelo», «ver equipo», «detén el calendario» o «trabaja sin ayudantes». El principal conserva el acuerdo, puede avanzar mientras trabajan los hijos y comprueba el resultado integrado. La vista enseña estado, modelo, tiempo y consumo acumulado por tarea; `Ctrl+Shift+G` y `/nein:equipo` son atajos opcionales.

El mismo equipo permite investigar una pregunta amplia con herramientas de lectura, sin crear ramas ni exigir un documento de trabajo o un árbol limpio. El principal reutiliza los hallazgos y puede pedir una continuación. Los lectores observan los archivos actuales: si cambian durante la investigación, se comprueban las referencias afectadas. El reparto se decide antes de estudiar exhaustivamente cada frente; cada escritor investiga su parte. Los resultados llegan al terminar cada hijo, también en ejecuciones no interactivas.

Los resultados llegan por eventos, sin consultar al modelo para refrescar la pantalla. Al cerrar se detienen los procesos supervisados y quedan los cambios y las sesiones. El relevo conserva también ramas y archivos pendientes; «listo para integrar» no significa que el encargo esté aceptado. Se reutilizan las clases de modelos existentes y se respeta una selección manual.

**Esta capacidad no se ha activado en la preview personal:** el [piloto inicial](evals/results/2026-10-06-paralelismo.md) y la [evaluación de coordinación y contexto](evals/results/2026-10-07-coordinacion-contexto.md) no justifican una promoción automática general. Delegar lectura redujo contexto y tokens, con más espera; el ensayo con escritores produjo una entrega más completa que el directo nuevo, pero gastó y tardó más. Los ensayos autónomos no usaron hijos. El regreso completo con Claude real sigue pendiente del corte anterior. La implementación y el candidato se conservan para revisión.

## Arrancar

Con Bun y Go 1.27.1, instala una vez el Pi fijado dentro de `~/.n_ein` y arranca:

```sh
(cd go && go build -o ../dist/n-ein-install ./cmd/n-ein-install && go build -o ../dist/n-ein ./cmd/n-ein)
./dist/n-ein-install runtime --source .
./bin/n-ein-dev
```

Para usar otro binario de Pi, define `N_EIN_PI_BIN`.

El lanzador conserva el directorio de trabajo actual y pasa los argumentos a Pi. Usa `~/.n_ein/dev/pi-agent` para configuración, autenticación y sesiones. No copia credenciales de Pi normal, Codex CLI ni Ein legado. Si quieres probar con otro hogar aislado, define `N_EIN_AGENT_DIR` antes de arrancar.

### Modelos y ajustes avanzados

Por defecto el principal es `nein/auto`, un modelo virtual de Pi que elige el modelo con la primera petición de cada encargo y lo mantiene hasta el final, para no perder la caché: **mecánico** (documentación, textos, estilos, cambios de interfaz sin lógica) va a `gpt-6-luna` high; **ordinario**, a `gpt-6-sol` medium; **riesgo** (datos y migraciones, usuarios y permisos, contratos que otros usan, concurrencia, despliegue) y **abierto** (decisiones sin cerrar), a `gpt-6-sol` high. Dentro del encargo solo sube de clase, nunca baja sola. Para empezar otro puedes decir «Otra cosa: …» o «Nuevo encargo: …»; conserva la conversación y elige de nuevo el modelo. Una corrección del mismo encargo mantiene su clase. Al autorizar un diseño acordado, el agente puede ajustar la capacidad a la implementación concreta; los cambios de riesgo durante el trabajo solo suben de clase. `/nein:nuevo <petición>` sigue como atajo. Las peticiones mixtas que incluyen cambios de permisos o autenticación no se tratan como solo documentación. El pie de Pi enseña el modelo elegido. Para cambiarlo: un prefijo en el mensaje (`[luna]`, `[sol]`, `[sol high]` o el nombre de la clase), `/nein:modo <clase>` durante el encargo, o la herramienta `nein_escalate`, que el agente usa cuando descubre un riesgo. `/nein:models` abre el panel con el principal, el modelo de cada clase y el esfuerzo de Claude, como el de Ein: enter busca en el catálogo (o admite un id personalizado), `e` cicla el esfuerzo, `r` vuelve al valor del paquete y nada se escribe hasta guardar. Se guarda en `~/.n_ein/<canal>/models.json`, fuera del código gestionado. El siguiente encargo o elección explícita carga la tabla nueva; una continuación o reanudación conserva el modelo físico ya elegido. Una configuración inválida se informa al elegir, sin sustituirla silenciosamente por otra. Claude usa el modelo de Claude Code y recibe `--effort`. Configuración muestra el valor efectivo y su origen. Al abrir Pi, el banner enseña la marca Panel, la rama, el índice de CodeGraph, la tarea en curso de `WORK.md` y la tabla de modelos. Un modelo inaccesible da un error visible, sin cambiar de proveedor. Para usar la suscripción, inicia sesión en ese hogar en el proveedor que usa tu tabla: `/login openai-codex` para los valores de paquete. Pi 1.0 también ofrece `/login openai` (ChatGPT subscription): es otro flujo OAuth y no renueva el token de `openai-codex`; para usarlo, selecciona `openai/gpt-6-luna` y `openai/gpt-6-sol` en las clases de `/nein:models`. La elección queda visible y no se copian credenciales ni se cambia de proveedor como fallback. La elección se basa en el [banco del 5 de octubre](evals/results/2026-10-05-modelos-de-trabajo.md) y el [rumbo](docs/09-rumbo.md).

Puedes decir «ayúdame a pensar esta idea» o «diseñémoslo juntos»: el agente usa `intent`, investiga los hechos y plantea pocas decisiones con recomendación. En peticiones claras trabaja directamente. «Vale, hazlo» ejecuta el acuerdo dentro del alcance autorizado; el agente prepara la guía y las tareas necesarias. `/skill:intent` y las demás skills siguen disponibles como atajos. Las consultas no requieren tests; los cambios de documentación reciben comprobaciones de contenido y los cambios de código conservan aceptación, suite y tipos, reutilizando resultados vigentes.

El [ensayo de cierre de intent](evals/results/2026-09-29-intent.md) comprobó varias rondas sin escrituras, síntesis confirmada y un único `WORK.md` posterior sin implementar código.

El contexto de origen y el plan están en [docs/START_HERE.md](docs/START_HERE.md). Las fuentes de `docs/archive/` y `docs/sources/` son referencias históricas; el lanzador solo carga `pi-package/`.

`./scripts/check.sh` instala las dependencias de `bun.lock`, ejecuta los checks locales deterministas de shell, Bun y Go, compila los dos binarios y prueba un paquete instalado fuera del checkout; las evaluaciones con modelos reales se lanzan por separado. El [workflow de GitHub](.github/workflows/check.yml) ejecuta ese mismo recorrido sin credenciales ni llamadas a modelos.

El [primer caso de regresión](evals/results/2026-09-29-first-session.md) ya pasó con Sol high y, en una sesión directa separada, con Luna high.
La [continuación SQLSTATE](evals/results/2026-09-29-sqlstate.md) probó TDD ya elegido, delegación a Luna, regresión roja y verde, y un arreglo posterior en sesión nueva sin repetir la entrevista.

Hasta el 5 de octubre el agente delegaba en roles con otro modelo (`nein-scout`, `nein-worker`, `nein-reviewer`). El banco mostró que eran entre el 45 y el 63 % del coste sin mejorar el resultado, y se retiraron el 6 de octubre.

La cancelación se comprobó con `bun run evals/cancel-smoke.ts`: al interrumpir una herramienta larga, el cambio previo permanece y el proceso hijo deja de escribir. Es una evaluación manual que usa la suscripción.

La [primera evaluación con código real](evals/results/2026-09-29-planificador.md) reprodujo y corrigió en una copia aislada una regresión histórica de `planificador-didactico`. El árbol habitual del proyecto no se tocó.

Para un encargo prolongado, `WORK.md` en la raíz del proyecto conserva objetivo, autorización vigente, decisiones, criterios, casillas bajo `## Tareas`, evidencia y siguiente paso. Si el proyecto ya tiene otro documento, `N_EIN_WORK_DOC` puede apuntar a él. Pi muestra la tarea actual debajo del editor; `/todo done N` y `/todo add texto` actualizan el mismo markdown. Sin documento, el TODO no aparece.

La memoria duradera del proyecto vive en su glosario, decisiones y referencias de `AGENTS.md`; al iniciar una sesión se recupera solo lo pertinente. Antes de sustituir un `WORK.md` terminado, el agente conserva las decisiones reutilizables con su razón y referencia al commit. Las preferencias que pides recordar viven en `~/.n_ein/preferences.md`, común a Pi y Claude y fuera de los canales reemplazables; `N_EIN_PREFERENCES_FILE` permite otro archivo explícito. No se importa la configuración global de otros agentes, no se crea el archivo al leerlo y las preferencias no autorizan operaciones. El idioma elegido y las convenciones explícitas del proyecto prevalecen.

Para reducir la relectura del contexto, Pi sustituye búsquedas recuperables por una nota tras la primera edición y lecturas de código tras un commit con tareas pendientes. Conserva documentación Markdown y referencias de skills, también leídas por shell, errores y resultados de comprobaciones. Los comandos mixtos o dinámicos y los scripts sin llamadas conocidas se conservan; consultar el historial de Git no activa el recorte. Este mecanismo reduce contexto, pero su ahorro y calidad se miden por encargos completos, no por el tamaño retirado.

El launcher mantiene un bloqueo del árbol durante la sesión y su recorrido de relevo. Una segunda sesión abierta desde `nein` en el mismo árbol recibe `RUNTIME_BUSY` antes de arrancar el runtime; otros árboles pueden trabajar a la vez. El shell hereda el bloqueo para conservarlo si muere el launcher y el sistema lo libera al terminar. Para abrir directamente con esa protección: `nein --project <proyecto> --runtime pi -- <argumentos de Pi>` (o `--runtime claude`). Los lanzadores shell de desarrollo y los escritores externos no adquieren ese bloqueo: deben coordinarse antes del relevo.

En Pi puedes decir «quiero continuar con Claude»: el agente prepara el estado y el relevo se ejecuta al terminar su respuesta y sus herramientas. Una cancelación o una indicación nueva cancela el cambio pendiente. `/handoff claude` conserva el mismo recorrido como atajo: espera a que termine el trabajo activo, guarda un resumen markdown con objetivo, decisiones, límites, criterios completos, tareas y estado Git (títulos en español o inglés), cierra Pi y abre Claude con ese resumen como primer mensaje. Claude usa `~/.n_ein/dev/claude`, separado de la instalación habitual y de Ein legado; cada skill apunta al catálogo único de `pi-package/skills` mientras la caché propia queda en su hogar. El [ensayo de relevo](evals/results/2026-09-29-handoff.md) verificó el cierre, la continuación de solo lectura y la salida en la TUI real de Claude. Una instalación nueva de Claude pide completar su primer arranque. El lanzador espera a que salga el proceso de origen; antes del relevo deben detenerse los escritores externos al runtime. El resumen conserva la autorización como decisión del usuario y considera desconocida la vigencia de los checks hasta contrastarla.

Para volver desde Claude, di «sigamos con Pi». El agente carga `to-pi` y conserva el resultado en `WORK.md`, prepara un resumen con Git y muestra la única acción que exige el host: cerrar Claude con `/exit`. No necesitas recordar el comando de relevo; `/to-pi` sigue disponible como atajo. El lanzador espera la salida de Claude antes de abrir Pi con el resumen. El [relevo inverso](evals/results/2026-09-29-handoff.md) pasó tanto con procesos simulados como en las TUI reales de Claude y Pi; Pi recuperó el pendiente sin reabrir decisiones ya fijadas.

## Instalación local de prueba

La [preview 0.1.0-preview.2](https://github.com/samuhlo/n_ein/releases/tag/v0.1.0-preview.2) distribuye un candidato para macOS arm64 y otro para Linux amd64. Solo hace falta Bun: `nein-setup` instala Pi y CodeGraph fijados dentro de `~/.n_ein`.

```sh
gh release download v0.1.0-preview.2 -R samuhlo/n_ein --pattern 'n-ein-0.1.0-preview.2-darwin-arm64.tar.gz*'
shasum -a 256 -c n-ein-0.1.0-preview.2-darwin-arm64.tar.gz.sha256
tar -xzf n-ein-0.1.0-preview.2-darwin-arm64.tar.gz
./n-ein-0.1.0-preview.2-darwin-arm64/bin/nein-setup --dry-run
./n-ein-0.1.0-preview.2-darwin-arm64/bin/nein-setup
nein
```

El primer arranque de Pi en preview requiere `/login` en `~/.n_ein/preview/pi-agent`; esa autenticación no se copia desde desarrollo ni desde Ein. Sobre una preview anterior, `nein-setup` actualiza con backup y `n-ein-install restore --channel preview` vuelve al anterior. La vista Sistema aún no descarga actualizaciones por sí sola. Notas de cada versión en [docs/releases](docs/releases/).

### Entrada `nein` con Pi gestionado

Un candidato extraído se instala completo con un solo comando, solo con Bun disponible:

```sh
./<candidato>/bin/nein-setup --dry-run
./<candidato>/bin/nein-setup            # --channel stable para el canal estable
nein
```

La versión de desarrollo y sus hotfixes locales instalan Pi 1.0.2 en `~/.n_ein/runtimes/pi/1.0.2`; la preview pública `0.1.0-preview.2` todavía fija Pi 0.87.1 y los roles anteriores. En ambos casos, `runtime.json` declara el Pi del candidato. También instalan CodeGraph 1.6.1 en `~/.n_ein/runtimes/codegraph/1.6.1`, el código en `~/.n_ein/installations/<canal>` y enlaza `~/.local/bin/nein`. El `pi` global y Ein legado no se modifican; la autenticación no se copia. Repetirlo no reinstala lo que ya está bien. La [estructura del hogar](docs/05-despliegue.md#hogar-gestionado-y-entrada-nein) detalla cada pieza.

### Flujo, skills e idioma

El agente principal sigue el flujo de n_ein (`pi-package/flow.md`): pide permiso para construir, mira antes de tocar (CodeGraph primero), resuelve dudas con una pregunta o con `intent`, registra en `WORK.md` el trabajo sustancial, construye tarea a tarea con TDD cuando aplica y un commit por tarea en una rama, trabaja directamente por defecto y puede repartir frentes independientes con la capacidad experimental, revisa en línea los cambios de riesgo alto y cierra con lo verificado petición por petición (petición original → consumidores afectados → prueba de aceptación), dónde mirar, cómo comprobarlo y una línea de riesgo. Las skills que usa el agente cuando tocan: `intent`, `tdd`, `diagnose`, `review`, `design`, `glossary`, `research`, `prototype`, `pr`, `agent-docs`, `comments` y `logs`; el agente también organiza la guía y las tareas con `spec` y `tasks` cuando hacen falta. `retro` y `tell-again` siguen siendo atajos manuales; el relevo se explica en su sección. Todo lo que lee el agente está en inglés; te responde en el idioma que elijas. `WORK.md` admite sus títulos en castellano o en inglés. En Configuración del launcher, Enter cambia el idioma de la conversación (español o inglés) y el de los artefactos (el del proyecto, español o inglés). [Detalle](docs/02-diseno.md#recorrido-ordinario).

### CodeGraph en cada proyecto

Al abrir Pi o Claude desde n_ein en un repositorio git, el índice de CodeGraph se crea si falta y se sincroniza si ya existe. Pi lo consulta con `codegraph_explore` y Claude con su MCP y el hook de prompt, configurados solo en su hogar aislado. Estado muestra si el proyecto tiene índice y Sistema la versión. Un fallo avisa con `CODEGRAPH_SKIP` y no impide trabajar. [Detalle](docs/02-diseno.md#codegraph-obligatorio).

### Hotfix local de preview

Cada release publicada es una base inmutable. Para aplicar al canal preview un commit posterior comprobado sin publicar otra prerelease, desde un checkout limpio de n_ein:

```sh
./scripts/hotfix-preview.sh plan
./scripts/hotfix-preview.sh apply
./scripts/hotfix-preview.sh rollback
```

`plan` ejecuta los checks, compila un candidato nativo con versión `<preview instalada>+hotfix.<commit>` y muestra el update sin sustituir la instalación. `apply` verifica el candidato, conserva un backup y ejecuta `doctor`; `rollback` recupera el último backup. Si desde el hotfix instalado solo cambiaron docs o herramientas de desarrollo, `apply` no reinstala el runtime. El archivo de modelos, la autenticación y las sesiones siguen fuera del árbol reemplazado. Hazlo con las sesiones de ese canal cerradas. El hotfix no publica un tag ni modifica la release original.

También hay una **release de hotfix desde rama** para compartir una corrección sin arrastrar lo que esté en `main`: se crea `hotfix/<nombre>` desde el tag publicado, se incorporan solo la corrección y el soporte de build, y se etiqueta `v<base>.hotfix.N`. `scripts/verify-hotfix-branch.sh <tag>` rechaza una rama nacida de `main`, un árbol sucio o un tag sin cambio de runtime. El tag pasa CI y genera el paquete Linux; el paquete macOS se construye nativamente con `scripts/build-preview.sh <versión>`. Ambos adjuntos se publican como prerelease con `gh release create --verify-tag`, conservando `main` y el hotfix local como vías independientes. La [primera release de rama, 0.1.0-preview.1.hotfix.1](https://github.com/samuhlo/n_ein/releases/tag/v0.1.0-preview.1.hotfix.1), contiene el selector `/models`. El [procedimiento](docs/05-despliegue.md#hotfix-desde-rama) y su [evidencia](evals/results/2026-10-01-branch-release.md) documentan el recorrido.

### Desde el checkout

Con Go 1.27.1, construye el instalador separado y mira el plan antes de escribir:

```sh
mkdir -p dist
(cd go && go build -o ../dist/n-ein ./cmd/n-ein)
(cd go && go build -o ../dist/n-ein-install ./cmd/n-ein-install && go build -o ../dist/n-ein ./cmd/n-ein)
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

El código va a `~/.n_ein/installations/<canal>`; Pi y Claude guardan credenciales y sesiones en `~/.n_ein/<canal>/`, fuera del árbol gestionado. `doctor` comprueba hashes y modos; con `--runtime` comprueba además que Bun está disponible y que el Pi gestionado (o `N_EIN_PI_BIN`) tiene la versión de `runtime.json`, sin probar la autenticación. La vista Sistema usa ese diagnóstico ampliado. `install` y `update` rechazan directorios existentes que no sean instalaciones n_ein; una instalación identificada se puede reparar aunque un archivo esté dañado. `update --source`, `restore` y `uninstall` crean o conservan backups del código sin borrar esos datos. El [ensayo del instalador](evals/results/2026-09-29-installer.md) verificó la promoción de un candidato en destinos temporales; todavía no hay releases remotas.

`nein` (o `n-ein`) abre la portada: la marca 004 Panel, el contexto del proyecto y el menú para abrir Pi (`p`), Claude Code (`c`), elegir una sesión (`s`) o ver el estado (`e`). `tab` recorre Estado, Configuración, Sesiones y Sistema; `j/k`, `g/G`, `f` o `/`, `enter` y `q` conservan los atajos de Ein; cualquier tecla salta la apertura y `--no-intro` la omite. `--once` o una salida sin TTY pintan una vez y salen con 0; `--view sesiones` permite inspeccionar otra vista en scripts. En la TUI, la portada abre Pi o Claude, Sesiones reanuda una sesión del proyecto y Sistema ejecuta `doctor --runtime` sobre el paquete instalado. La portada y Sistema respetan `N_EIN_PI_BIN` y `N_EIN_CLAUDE_BIN`; la portada no ofrece abrir Pi si su versión difiere de la fijada. La [prueba del launcher](evals/results/2026-09-29-launcher.md) incluye el binario instalado fuera del checkout y sesiones reales de Pi y Claude abiertas y reanudadas desde el binario Go de desarrollo. La edición de ajustes y las actualizaciones remotas aún no están conectadas a esas vistas.
