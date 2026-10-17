# Repositorio, desarrollo y despliegue

Objetivo solicitado: repositorio limpio, pruebas mejores y canales comprensibles. El [repositorio público](https://github.com/samuhlo/n_ein), el [instalador y los canales locales](../README.md#instalación-local-de-prueba), los checks y una primera preview en archivos nativos ya existen. La distribución estable sigue pendiente. Las secciones siguientes conservan los criterios originales de diseño; consulta el README y la evidencia para distinguirlos de lo ya implementado.

## Repositorio nuevo

El repositorio tendrá dos lenguajes con una frontera clara ([diseño](02-diseno.md#frontera-entre-lenguajes)): TypeScript/Bun para el paquete Pi y Go para launcher e instalador. Los contratos compartidos (`brand.json`, formatos del documento de trabajo y del resumen de relevo, `runtimes.toml`) viven como archivos neutros, no como código duplicado.

Mantener código, pruebas y herramientas de desarrollo separados cuando aparezcan; no crear directorios vacíos para una arquitectura imaginada. Las fuentes de `docs/sources/` son material de investigación, no dependencias productivas. No publicar los archives en el paquete runtime.

Conservar este handoff como documentación de origen. Al comenzar desarrollo, el README del producto describe comportamiento realmente disponible; no presenta todo el plan como implementado. Changelog por cambios relevantes. Una pequeña lista de decisiones duraderas basta; no un ADR por detalle reversible.

La carpeta nueva no estaba inicializada en Git cuando se creó el paquete; ahora `main` se sigue desde `samuhlo/n_ein` público. No se ha elegido licencia propia. Los ejecutables locales se llaman `n-ein` y `n-ein-install`; eso no supone disponibilidad en registros.

## Actualización del 9 de octubre

El [contrato de distribución](11-distribucion.md) concreta ahora SemVer, alpha en preview, bootstrap curl, Node/Bun gestionados, matriz macOS/Ubuntu/Arch y publicación de bytes comprobados. La implementación se prepara en rama para revisión; todavía no hay alpha pública. Los apartados siguientes conservan el diseño y la evidencia de las previews anteriores.

## Canales propuestos

| Canal | Origen | Uso | Condición de entrada |
|---|---|---|---|
| Desarrollo | Checkout explícito | Probar el siguiente corte | Home/configuración propios; versión y origen visibles. |
| Preview | Artefacto candidato inmutable | Uso supervisado | Checks del cambio, paquete instalable y smoke del recorrido esencial. |
| Estable | Promoción del artefacto ya probado | Uso habitual | Evidencia de preview y recuperación comprobada. |

El canal `alpha` de Ein corresponde a preview. Como en Ein, el canal elegido se guarda solo tras un update correcto.

Promover el mismo artefacto/bytes, no reconstruir silenciosamente otro con dependencias distintas. Registrar identificador de release, commit, versiones runtime/dependencias y hash. No hace falta una plataforma de releases propia.

Entre previews públicas, `scripts/hotfix-preview.sh` puede aplicar un commit limpio al canal preview local sin crear otro tag: usa `scripts/check.sh`, un candidato versionado con `+hotfix.<commit>` y el mismo `update`/backup/`restore` del instalador. `plan` deja revisar el candidato sin reemplazar la instalación. El paquete publicado continúa inmutable.

### Hotfix desde rama

Para compartir un arreglo de una preview publicada, crear `hotfix/<nombre>` desde su tag, sin incorporar lo que esté acumulado en `main`. La rama contiene solo el cambio y, si el tag base aún no lo tenía, el soporte de build/verificación. `scripts/verify-hotfix-branch.sh v<base>.hotfix.N` comprueba árbol limpio, tag base ancestro, bifurcación desde ese tag, pertenencia a una rama `hotfix/*` y cambio de runtime. La rama corre los checks normales. El tag `.hotfix.N` vuelve a ejecutar checks y genera el candidato Linux en CI; el macOS se construye de forma nativa desde el mismo tag. Comparar versión, commit, lista de archivos y hashes de cada plataforma antes de adjuntarlos a una prerelease. Publicar con `gh release create --verify-tag --prerelease --latest=false` evita que GitHub invente un tag desde `main`.

El arreglo se incorpora o se comprueba equivalente en `main` después de publicar, sin obligar a una rama `dev`. Una release de rama no aplica automáticamente el hotfix al canal personal ni cambia estable. La ruta local anterior permanece disponible para iterar sin publicación.

La primera prueba real siguió esta ruta: `hotfix/model-selector` partió de `v0.1.0-preview.1`, llevó solo el selector y el soporte mínimo de release, y publicó [v0.1.0-preview.1.hotfix.1](https://github.com/samuhlo/n_ein/releases/tag/v0.1.0-preview.1.hotfix.1) tras checks de rama y tag. `main` ya tenía el mismo código de runtime, comprobado por diff, así que no hizo falta un merge que duplicase commits. La preview personal continuó con su hotfix local.

## Instalación aislada

Pi vanilla, Ein legado, desarrollo n_ein y estable n_ein deben tener identidades claras. Proponer hogares separados; confirmar y comprobar resolución de rutas antes de escribir. No copiar credenciales en paquetes ni migrar sign-ins automáticamente por conveniencia.

La primera instalación es local y acotada: un lanzador de shell que exporta `PI_CODING_AGENT_DIR` hacia el hogar de n_ein y carga el paquete local. Ein ya usa lanzadores con configuración propia para Pi y Claude ([ejemplo Pi archivado](archive/ein-workspace/ein-pi/launchers/ein-pi.fish)). En otras integraciones, comprobar las ubicaciones y la precedencia reales: `CLAUDE_CONFIG_DIR`, `CODEX_HOME` y `OPENCODE_CONFIG_DIR` no son contratos intercambiables. En particular, `OPENCODE_CONFIG_DIR` añade configuración a fuentes globales/de proyecto; no basta para afirmar aislamiento completo ([documentación oficial](https://opencode.ai/docs/config/#custom-directory)). Probar también instrucciones/skills, sesiones y credenciales antes de declarar una integración aislada.

El instalador es un binario Go separado del launcher, con `package`, `install`, `update`, `doctor`, `restore` y `uninstall` comprobados en destinos temporales ([evidencia](../evals/results/2026-09-29-installer.md)). `doctor` valida el paquete; `doctor --runtime` añade presencia de Bun y versión de Pi, pero no confirma autenticación ni acceso al modelo. Se reescribió a partir de los comportamientos útiles de Ein, sin portar sus migraciones SDD. La primera distribución usa `.tar.gz` por plataforma con SHA-256; script o brew siguen pendientes.

### Hogar gestionado y entrada `nein`

```
~/.n_ein/
  bin/nein                    → installations/<canal>/bin/nein
  installations/<canal>/      código gestionado (reemplazable por update/restore)
  runtimes/pi/<versión>/      Pi fijado, instalado con Bun en directorios propios
  runtimes/codegraph/<versión>/  CodeGraph fijado: release oficial verificada por SHA-256
  cache/bun/                  caché de esas instalaciones
  <canal>/                    pi-agent, claude, models.json: datos del usuario
~/.local/bin/nein             → ~/.n_ein/bin/nein
```

`n-ein-install runtime` instala la versión de Pi de `runtime.json` con `BUN_INSTALL_GLOBAL_DIR`/`BUN_INSTALL_BIN` en un directorio temporal del propio hogar, comprueba paquete, marcador y `pi --version`, y solo entonces lo mueve a su sitio; si ya existe uno dañado con marcador propio, lo respalda antes. Rechaza destinos que salgan del hogar por un enlace. `activate` crea la cadena de enlaces solo hacia una instalación gestionada y no sustituye un `nein` ajeno. `bin/nein-setup`, incluido en el paquete, encadena runtime, install/update, activate y `doctor --runtime`; con `--dry-run` no escribe. `nein` deduce el canal de la instalación enlazada, no del entorno. Launcher, `doctor` y los scripts usan el Pi gestionado salvo que `N_EIN_PI_BIN` indique otro; `check.sh` recurre al `pi` del PATH si no hay runtime gestionado y prueba CodeGraph con binarios falsos; `build-preview.sh` exige el CodeGraph gestionado. CI instala ambos runtimes con el propio `n-ein-install runtime`. `N_EIN_HOME` y `N_EIN_LINK_DIR` permiten ensayar todo en un directorio temporal. Un runtime nuevo, como Codex, ocuparía `runtimes/<nombre>/<versión>` cuando exista su adaptador.

Update se prepara antes de reemplazar la versión activa, comprueba el resultado y conserva una recuperación entendible. `install` y `update` rechazan un destino existente sin marcador y manifest de n_ein, incluso en dry-run; no impiden reparar una instalación identificada con archivos dañados. Dry-run no debe mutar. Un fallo deja identificable qué versión y datos quedaron. Desinstalación separa código gestionado, configuración propia y datos del usuario.

## CI proporcional

Al principio: chequeo de tipos si aplica, pruebas relevantes y smoke determinista del paquete. Añadir jobs según superficies reales. No declarar soporte Windows/Linux/macOS sin ejercitar la ruta de cada plataforma.

Las evaluaciones pagadas van separadas, con modelo/endpoint/configuración y presupuesto explícitos. Un test de proveedor simulado es válido para transporte y errores, pero no se etiqueta como evaluación de capacidad real.

`scripts/smoke-package.sh` ya empaqueta, instala en un destino temporal, comprueba hashes, abre la vista Configuración del binario instalado y verifica las rutas de Pi con un ejecutable simulado. Los ensayos con modelo real y el relevo Pi↔Claude siguen registrados aparte. Mantener el entorno independiente de las instalaciones personales del desarrollador.

## Versiones y evolución

Fijar una combinación conocida de Pi, runner y extensiones. Actualizarla en preview con compatibilidad observada. Evitar `latest` como promesa implícita de soporte perpetuo: Ein instala hoy los paquetes de su hogar Pi con `@latest`, y eso no se hereda. Pi pasó de 0.84 a 0.87 en un mes con cambios incompatibles en su API de extensiones.

Si una dependencia cambia un payload, corregir un único borde y comprobarlo con el paquete real. No añadir parsers o adaptadores generales para versiones hipotéticas. La configuración efectiva se puede inspeccionar sin leer archivos internos a mano.

## Fuera de alcance inicial

Marketplace, instalador multiplataforma sofisticado, telemetría remota, autoactualizaciones silenciosas y hosting de modelos. Primero una versión útil y reversible. Samu autorizó terminar este primer corte: el canal elegido para el paquete público es preview, con binarios nativos y sin migración de hogares. La promoción a estable sigue pendiente de uso supervisado.
