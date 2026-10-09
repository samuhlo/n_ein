# Alpha: instalación y distribución

## Objetivo y autorización

Samu aprobó el plan del 9 de octubre: «Dale, cuando este lista para sacar la alpha miro y reviso todo». Implementar y comprobar la candidata `0.2.0-alpha.1`, con commits y rama de revisión. Publicación, tag público, merge a main y actualización personal esperan su revisión. Subir la rama para ejecutar la matriz de GitHub forma parte de la comprobación; no crear una release.

Base: `ed9f7c9` (main remoto con estética Claude y README). Rama `feat/alpha-distribution`. La entrega anterior y su evidencia permanecen en `evals/results/2026-10-07-preview3.md`.

## Decisiones

- SemVer: alpha.N → rc.N → 0.2.0; parche estable 0.2.1. Tags viejos inmutables; metadata local no decide actualizaciones.
- Canales preview y stable; alpha vive en preview, sin mover hogares ni datos.
- macOS arm64 y Linux amd64. Ubuntu y Arch consumen el mismo paquete Linux. Omarchy necesita además comprobación interactiva real.
- Bootstrap pequeño de shell; resolución de releases e instalación en Go. Dependencias propias fijadas en el hogar; no sustituir binarios globales.
- Construir una vez, comprobar esos bytes y publicar solo después de todos los checks. CI sin inferencia pagada.

## Tareas y aceptación

- [x] A1 Versiones: validar/ordenar SemVer, preservar tags legacy, build y hotfix coherentes.
- [x] A2 Dependencias: instalación limpia con Node y Bun gestionados, checksums, dry-run, reparación, entorno efectivo al lanzar.
- [x] A3 Distribución: curl, canal/versión explícita, SHA antes de ejecutar, descarga fallida sin sustituir instalación, setup/update existentes.
- [x] A4 Matriz: macOS, Ubuntu limpio y Arch limpio; instalar, repetir, actualizar desde preview.3, restaurar y preservar datos; pruebas nativas Claude explícitas.
- [x] A5 Candidata: paquete y CI comprobados, notas y guía de revisión; sin publicación ni actualización personal.

## Fronteras de prueba

CLI y artefacto instalado; repositorio HTTP simulado para errores/selección; runtimes fijados reales en hogares temporales; tests de Pi sin modelos; plugin Claude con su host. Contenedor Arch acredita instalación/CLI, no una sesión gráfica Omarchy. No hay Docker daemon local al iniciar; usar CI para Linux.

## Evidencia en curso

Go y suite completa local pasan con hogar aislado `dist/alpha-home` y Node 24.21.0/Bun 1.3.14 propios. La instalación limpia detectó que Bun podía usar un package.json padre: Pi ahora tiene manifest privado dentro de su runtime y no modifica el proyecto padre. Cliente de releases probado con HTTP simulado, checksum y versión de manifest antes de extraer/ejecutar. E2E completo de curl y matriz final superados; cierre abajo.

## Entrega para revisión

Fuente candidata `d9ab0323b97c867370b83d961b0cb043bb505af9`. CI 37907381998 completamente verde: macOS arm64, Ubuntu nativo, contenedores Ubuntu 24.04 y Arch actual sin privilegios, comparación de artefactos. Misma fuente y payload; solo difieren los ejecutables nativos. Paquetes descargados y verificados en `dist/alpha-review-d9ab032/assets`; instalada la copia macOS de CI en `dist/alpha-home`, doctor 86 archivos y launcher comprobados. La preview personal sigue en 0.1.0-preview.3.

[Informe y límites](evals/results/2026-10-09-alpha-candidate.md), [registro de hashes y jobs](evals/results/2026-10-09-alpha-candidate.json). No hay tag ni release alpha y no se ha integrado en main. La rama está subida para revisar. Siguiente acción: Samu revisa diff/candidato y prueba la sesión interactiva Omarchy. No convertir el verde del contenedor Arch en una afirmación de prueba gráfica real; no publicar ni actualizar la instalación personal sin la revisión pedida.
