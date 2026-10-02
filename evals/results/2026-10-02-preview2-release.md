# Release 0.1.0-preview.2

Publicada como prerelease: <https://github.com/samuhlo/n_ein/releases/tag/v0.1.0-preview.2>. Tag anotado `v0.1.0-preview.2` sobre `f95a11a`, con los 16 commits desde `v0.1.0-preview.1.hotfix.1` a nombre de `samuhlo` y sin líneas de coautoría.

## Comprobado

- **CI de `main`** (run 36998032366) y **CI del tag** (run 36998174841) en verde. Es la primera vez que CI instala Pi y CodeGraph con `n-ein-install runtime` en Linux, incluida la verificación del SHA-256 de la release de CodeGraph para `linux-x64`. El tag generó el candidato Linux amd64.
- **macOS arm64** construido de forma nativa desde el mismo commit con `scripts/build-preview.sh 0.1.0-preview.2`.
- **Paridad entre plataformas:** misma versión y commit, 56 archivos en cada manifest; solo difieren `bin/n-ein` y `bin/n-ein-install`, los binarios Go de cada plataforma.
- **Hashes publicados:** macOS `0538a5de039809c6c8b8e1de4654b226fe57e4ea3843faaaad05c2aca572a4fe`; Linux comprobado con su `.sha256` tras descargar el artefacto de CI.
- **Recorrido de usuario nuevo:** descarga desde GitHub, `shasum -c`, extracción y `nein-setup` en un hogar temporal vacío: instaló Pi y CodeGraph reales, el código y la entrada; doctor verificó 58 archivos, Pi, CodeGraph y Bun; Sistema mostró `0.1.0-preview.2`.
- **Preview personal** actualizada del hotfix `+hotfix.68a9ce850022` a `0.1.0-preview.2` publicado, con backup del anterior.

## No comprobado

- Una sesión de trabajo con modelos sobre esta versión (cuota de Codex agotada al publicar).
- El recorrido interactivo en Linux; allí solo corre el smoke de CI.
