# Distribución y versiones

## Contrato aprobado el 9 de octubre

Samu pidió preparar la alpha para revisar antes de publicarla. Base `ed9f7c9`: incluye README/skill y estética Claude. `VERSION` identifica la próxima entrega; `runtime.json` fija las dependencias. Estado/evidencia de esta entrega en WORK.md.

| Tipo | Ejemplo | Canal |
|---|---|---|
| Alpha | 0.2.0-alpha.1 | preview |
| Siguiente alpha, también para hotfix | 0.2.0-alpha.2 | preview |
| Candidata de release | 0.2.0-rc.1 | preview |
| Entrega estable | 0.2.0 | stable |
| Parche estable | 0.2.1 | stable |
| Build local | 0.2.0-alpha.1+hotfix.abcdef1 | preview, instalación explícita |

`v` se usa en tags; el número SemVer completo tiene tres componentes. 0.x sigue siendo desarrollo inicial, aunque distribuido por el canal stable. Empezar en 0.2.0 evita retroceder desde 0.1.0-preview.3 al ordenar versiones. Tags y adjuntos publicados son inmutables. Se soporta la lectura de versiones antiguas, incluido `.hotfix.N`; no se crean nuevas series de ese tipo.

Una corrección urgente parte del tag afectado en `hotfix/*`, recibe el siguiente alpha.N o parche estable, y se incorpora a main. `scripts/verify-hotfix-branch.sh <tag-nuevo> <tag-base>` verifica la base explícita; la forma legacy sigue infiriéndola del nombre. El script local `hotfix-preview.sh` mantiene plan/apply/rollback y acepta alphas.

## Instalación

`install.sh` descarga un instalador de una release fijada y verifica SHA-256 antes de ejecutarlo. Su única labor de producto es invocar `n-ein-install fetch` con los argumentos originales. Go consulta las releases publicadas, descarta drafts/incompletas y versiones de otro canal, ordena SemVer y comprueba el paquete antes de ejecutar el instalador incluido en él. Una selección por canal no retrocede de versión; `--version` permite elegir explícitamente una anterior. No se usa `/releases/latest` para preview.

El bootstrap de cada release fija su propio tag. Al preparar VERSION, actualizar también la referencia del bootstrap de la raíz; el build genera el adjunto con la versión recibida. Esto permite conservar un bootstrap versionado y comprobarlo contra los mismos assets antes de publicar. El instalador no necesita gh ni jq. `N_EIN_BOOTSTRAP_BASE_URL` y `N_EIN_RELEASE_API` se reservan a pruebas locales con un servidor de fixtures; no aparecen en el recorrido normal.

Node y Bun se descargan con URL/hash fijados y se extrae solo el ejecutable declarado. Se comprueba la versión antes de promover el stage. El marcador registra también el hash del binario para diagnosticar corrupción; una reparación conserva backup. Pi tiene su package.json privado. El launcher y los scripts del paquete encuentran Node/Bun gestionados sin alterar instalaciones globales ni archivos de configuración del shell.

Requisitos externos comprobados: Bash, curl, certificados CA, Git y ripgrep; SHA-256 mediante `shasum` o `sha256sum`. Ubuntu: paquetes `curl ca-certificates git ripgrep`; Arch: mismos nombres mediante pacman, tras actualizar el sistema. El programa se instala como usuario, sin sudo. El contenedor usa privilegios solo para preparar esos requisitos y ejecuta n_ein con un usuario sin privilegios. No se ejecuta pacman/apt sobre la máquina del usuario de forma implícita.

## Comprobaciones

- `scripts/check.sh`: suite de Go/TS/shell, Pi determinista, tipos y smoke. `N_EIN_REQUIRE_CLAUDE=1` convierte un host Claude ausente en fallo explícito; localmente, la omisión se registra como pendiente.
- `scripts/build-release.sh <versión> [salida]`: binarios nativos, manifiesto, instalación desde tarball, bootstrap y ejecutable de instalación con hashes. `build-preview.sh` continúa como entrada compatible.
- `scripts/installer-e2e.sh <assets> <versión>`: servidor local con el contrato de releases; el curl real descarga esos bytes. El PATH inicial no contiene Node ni Bun. Instala, arranca Pi con proveedor determinista, crea/consulta índice CodeGraph, repite, rechaza una descarga corrupta, actualiza desde preview.3, restaura y desinstala. Comprueba auth/sesiones/modelos/preferencias con fixtures propios, sin credenciales reales.
- `scripts/verify-release-assets.py <assets> <versión> <commit>`: compara manifiestos de ambas plataformas, todo el contenido declarado, modos y hashes, y que los instaladores del bootstrap sean los mismos del paquete.

GitHub `check.yml` llama a `candidate.yml`: macOS-15 arm64 y Ubuntu-24.04 amd64; después contenedores limpios Ubuntu 24.04 y Arch actual con el mismo tarball Linux y comparación de assets. Hay disparo manual y semanal para detectar cambios de Arch/red/dependencias externas. La imagen usada queda registrada por digest. No se ejecuta Omarchy gráfico dentro de ese contenedor: su recorrido interactivo es una comprobación separada.

## Publicación tras revisión

1. Revisar la rama, notas, checks y el candidato instalado; completar el recorrido Omarchy cuando esté disponible.
2. Integrar en main. Ajustar VERSION y bootstrap si se cambia el número. Eliminar de las notas el estado de candidata pendiente.
3. Crear el tag inmutable en el commit aprobado. `release.yml` exige coincidencia de VERSION y tag, y rechaza metadata local.
4. La misma matriz construye y verifica los paquetes. Ninguna release se publica si falla uno de los jobs requeridos.
5. El job de publicación descarga esos mismos bytes, vuelve a verificar los hashes/manifest y genera attestation. Publica los assets comprobados, sin reconstruirlos en ese job. Alpha/rc son prereleases; solo stable puede ser latest.
6. Actualización personal con sesiones cerradas, backup y doctor. Las instalaciones de revisión tienen otro hogar y no sustituyen la preview personal.

La rama actual no crea tags, publica releases ni actualiza el hogar personal. Una revisión de candidato no autoriza por sí sola esos pasos.
