# Candidata 0.2.0-alpha.1 — revisión antes de publicar

## Encargo y límites

Samu aprobó implementar el plan de distribución y pidió revisar cuando la alpha estuviera lista. Rama `feat/alpha-distribution`, base `ed9f7c9`. No se crea tag, release ni merge a main, ni se actualiza la instalación personal. La rama se sube únicamente para ejecutar CI y revisar el diff.

## Resultado implementado

- SemVer compartido por el instalador: alpha/rc/estable, orden numérico de identificadores, compatibilidad de lectura con previews/hotfixes anteriores y metadata local sin precedencia. Canales preview/stable conservados.
- Node 24.21.0 y Bun 1.3.14 propios, versiones/hashes fijados, reparación recuperable y PATH de los procesos n_ein. Pi 1.0.2 y CodeGraph 1.6.1 se mantienen. Git y ripgrep se comprueban antes de mutar el hogar; no se ejecutan gestores de paquetes del sistema del usuario.
- Instalador remoto Go y bootstrap curl, canal/versión explícitos y dry-run. SHA antes de extraer o ejecutar; se ejecuta el instalador de la release elegida. Solo archivos declarados en el manifiesto entran en la instalación.
- Matriz nativa macOS arm64 y Ubuntu amd64; contenedores Ubuntu 24.04 y Arch actual con el mismo tarball Linux. Usuario de pruebas sin privilegios, hogar vacío, sin Node/Bun globales en PATH.
- Release por tag: valida versión, espera todos los jobs, comprueba manifiestos entre plataformas y publica los mismos adjuntos con attestation. Ese job de publicación aún no se ejecuta porque requiere la revisión del usuario.

## Fallos encontrados y corregidos

1. Dependencia de Node ocultada por runners ya preparados. Se fija y gestiona, y el E2E arranca sin Node/Bun en PATH.
2. Bun podía localizar el package.json del proyecto padre al instalar Pi. Reproducido durante la instalación real en dist; se restauraron únicamente package.json/bun.lock modificados por esa prueba. Pi tiene ahora un manifest privado y el E2E comprueba el padre byte a byte.
3. El instalador añadía archivos no declarados encontrados al recorrer el paquete. Regresión roja/verde: un archivo adicional no entra. Los tarballs macOS omiten AppleDouble; ambos manifiestos se contrastan.
4. Un test de trabajadores buscaba Pi en ~/.n_ein en vez del hogar de prueba. CI lo detectó; respeta el binario/hogar aislado.
5. El fixture HTTP no estuvo preparado a tiempo en un runner macOS. Espera acotada de 60 segundos y diagnóstico de salida/timeout, sin declarar éxito si no arranca.
6. El contenedor Arch no traía cmp; se añade diffutils al entorno de pruebas. El ensayo de upgrade también presuponía shasum; usa sha256sum o shasum como el bootstrap.
7. La prueba del canal stable usaba un doctor con canal preview por defecto. El harness ahora selecciona explícitamente el canal probado.
8. Un primer arranque podía recomendar `nein` sin estar en PATH. Se muestra la ruta ejecutable utilizable y cómo hacer disponible el nombre corto.

## Evidencia local

- Suite completa local sobre `39f1570` (antes del mensaje PATH y los últimos ajustes del harness): `/tmp/nein-alpha-final-check.log`, checks locales OK, incluido host Claude con 8 tests y proveedor Pi determinista; sin inferencia pagada.
- E2E alpha: `/tmp/nein-alpha-e2e2.log`, instalación curl, repetición, Pi, indexación/consulta CodeGraph, descarga corrupta rechazada, actualización desde preview.3, restore, uninstall y auth/sesiones/modelos/preferencias idénticos.
- E2E stable con candidato ficticio sin publicar: `/tmp/nein-alpha-stable-e2e2.log`, mismo recorrido completo y canal stable. No se creó una versión estable pública.
- Tests Go focales después de cada corrección, incluyendo diagnóstico de prerrequisitos sin mutación y ruta de launcher utilizable.
- `actionlint` 1.7.7: workflows válidos. La publicación externa y la generación efectiva de attestation quedan para el tag aprobado.
- Preview personal comprobada: `0.1.0-preview.3`, doctor 75 archivos; continúa siendo la instalación activa.

## Spec

Implementación y recorridos locales completos. Publicación y uso interactivo real de Omarchy pendientes de la revisión de Samu. El contenedor Arch acredita instalación, ejecutables, indexación y recuperación; no equivale a una sesión gráfica de Omarchy.

## Standards

Instalación/launcher en Go, lógica de interfaz en TS, shell limitado al bootstrap y scripts operativos. Se reutilizan setup/update/restore y los hogares existentes; no se crea otro gestor de tareas ni runtime de agentes. Los tests trabajan con fixtures y hogares propios. La revisión no encontró bloqueantes restantes en los recorridos comprobados; la matriz final sobre la fuente exacta está registrada debajo.

## Cierre de CI y paquetes

**Candidata lista para revisión**, fuente `d9ab0323b97c867370b83d961b0cb043bb505af9`. [CI completa](https://github.com/samuhlo/n_ein/actions/runs/37907381998): los seis jobs pasan (versión, dos plataformas nativas, Ubuntu limpio, Arch limpio y comparación de archivos). Todos los paquetes se descargaron de ese run y se volvieron a verificar localmente con verify-release-assets.py.

| Artefacto | SHA-256 |
|---|---|
| macOS arm64 | `ec60e13706e083cac442adc766166d27fa0f0a52fe86e29104bc7eb5edd2559f` |
| Linux amd64 | `8c624e0f6bb6ecc05156dbd9f6f56506ca562301e83470a83e6dfa5a502e3bad` |

[Registro de paquetes y jobs](2026-10-09-alpha-candidate.json). Assets conservados en `dist/alpha-review-d9ab032/assets`. La instalación de revisión procede del tarball macOS de CI, no de una reconstrucción local; doctor verifica **86 archivos**, runtimes y launcher. Hogar aislado: `dist/alpha-home`. Para abrirla desde el checkout:

```sh
N_EIN_HOME="$PWD/dist/alpha-home" ./dist/alpha-home/review-entry/nein
```

Ese hogar no contiene credenciales personales; para una conversación alojada necesitará su propio login. El proveedor determinista y el plugin se comprobaron sin inferencia pagada. La selección real de GitHub se comprobó además con `fetch --channel preview --dry-run`: elige la preview.3 publicada, sin tratar la candidata como pública.

La preview personal continúa intacta en preview.3. No se publicó ningún tag ni release, ni se cambió main. El commit posterior a la fuente solo registra evidencia/continuidad. Pendiente de Samu: revisión del diff y recorrido interactivo en Omarchy, después autorizar publicación y, por separado si lo desea, actualización personal.
