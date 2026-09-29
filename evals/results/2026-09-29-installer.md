# Instalador local en Go

Go 1.27.1 se descargó desde `go.dev` al hogar de desarrollo de n_ein y se verificó contra el SHA-256 oficial de `go1.27.1.darwin-arm64.tar.gz` (`ee215d57e0ec269c60cc9ceca68e6bda321ba9ee5afe24f4b0988703c2d87d12`). No se instaló Go en el sistema.

El módulo Go vive en `go/`, para que `go test ./...` no trate los snapshots históricos de `docs/sources/` como código del producto. Desde ese módulo, las pruebas ejercitaron `--dry-run` sin crear destino ni backups, instalación, update con canal guardado tras éxito, rechazo de update inválido sin cambiar el canal, doctor por hashes y modos, restore, uninstall de código alterado y conservación de datos separados. También rechazaron rutas de Pi/Ein, el hogar del usuario y un alias simbólico hacia Ein legado.

Se compiló un binario real y se instaló el checkout en `/tmp` mediante un destino explícito. El primer corte verificó 18 archivos; tras añadir `runtime.json` y el launcher Go, el paquete completo verificó 20. Se omitieron `docs/` y la caché ajena `skills/synced/`; Pi arrancó desde ese árbol fuera del source y mostró el TODO de un `WORK.md` temporal. Un `uninstall --dry-run` no cambió nada; después `uninstall`, `restore` y `doctor` recuperaron el paquete. El lanzador instalado resolvió su hogar Pi al canal preview, distinto de desarrollo.

Límite: este corte instala desde un directorio local, sin descarga remota ni promoción de bytes entre preview y estable. `doctor` comprueba integridad de archivos gestionados; aún no diagnostica proveedores o permisos de cada runtime. El launcher Go se verificó después, en su [propio ensayo](2026-09-29-launcher.md).
