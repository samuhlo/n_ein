# Entrada `nein` y Pi gestionado en el hogar n_ein

Samu pidió arrancar con `nein` y tener Pi y n_ein dentro de `~/.n_ein`, separados del Pi global y de Ein legado. El trabajo empezó en una sesión anterior y se cerró en esta; los commits son `1477c60` y `fd31264`.

## Comprobado en destinos temporales

- Bun instala Pi 0.87.1 con `BUN_INSTALL_GLOBAL_DIR`/`BUN_INSTALL_BIN` propios; el binario resultante devuelve `0.87.1` y su ruta real queda dentro del directorio elegido.
- Tests Go: `runtime --dry-run` no escribe; la instalación es idempotente; un Pi con versión alterada se respalda y se reinstala; un `runtimes` enlazado fuera del hogar se rechaza sin escribir fuera. `activate --dry-run` no crea enlaces, la repetición es idempotente, otro canal se rechaza y un `nein` ajeno en el directorio de enlaces no se sustituye ni deja enlace parcial.
- `smoke-package.sh` activa `nein` desde el paquete instalado y abre Configuración a través del enlace con `N_EIN_CHANNEL=dev` en el entorno.
- `nein-setup --channel stable` en un hogar vacío instaló Pi, el código y los enlaces; `nein` mostró canal `stable` y Sistema `Pi 0.87.1 [runtime Pi de n_ein]`.
- `./scripts/check.sh` pasó tras cada cambio.

## Defectos encontrados al cerrar

1. `bin/nein` tomaba el canal de `N_EIN_CHANNEL` con `preview` por defecto. Un `nein` enlazado a stable abría preview (o fallaba si no existía), y dentro de una sesión dev heredaba `dev` y salía con `CHANNEL_BAD`. Ahora sigue sus enlaces y lee `.n-ein-channel` de la instalación. El smoke cubre el caso del entorno.
2. `nein-setup --dry-run` sobre una preview anterior sin `bin/nein` fallaba en `activate --dry-run` con el código viejo. Apareció en el ensayo en seco contra el hogar real, sin mutar nada. Ahora el plan anuncia la activación posterior.

## Instalación real

`hotfix-preview.sh plan` construyó `0.1.0-preview.1+hotfix.fd31264fc6ce` (checks incluidos). `nein-setup --dry-run` no creó `~/.n_ein/runtimes` ni `~/.local/bin/nein`. La ejecución real:

```
// 000 PI INSTALADO · 0.87.1 · ~/.n_ein/runtimes/pi/0.87.1
// 000 INSTALADO · preview · ~/.n_ein/installations/preview
// 000 ACTIVADO · nein · ~/.local/bin/nein
// 000 ESTADO · preview · 0.1.0-preview.1+hotfix.fd31264fc6ce · 25 archivos verificados
// 001 RUNTIME · Pi 0.87.1 · Bun disponible · autenticación no comprobada
```

- fish resuelve `nein` → `~/.n_ein/bin/nein` → `installations/preview/bin/nein`; Sistema muestra el paquete hotfix y el Pi gestionado.
- El Pi global sigue en `~/.bun/install/global/...`, versión 0.87.1, sin cambios.
- Repetir `nein-setup` no reinstaló Pi ni el paquete. El update dejó backup de `+hotfix.19650ed7eaa7` en `installations/preview.backups`.
- Con el hogar dev, el Pi gestionado lista `openai-codex/gpt-6-sol` y `gpt-6-luna`.

## Pendiente

- El hogar de preview no tiene sesión iniciada: su `auth.json` está vacío desde el 30 de septiembre y el Pi global da el mismo «No models available» con ese hogar. Es anterior a este cambio. Hace falta `/login` (OpenAI Codex) dentro de `nein` antes de una sesión real.
- No se hizo una llamada al modelo ni se abrió la TUI interactiva desde `nein`.
- Los commits no están publicados; la próxima release llevará `nein-setup`. La release `0.1.0-preview.1.hotfix.1` no lo incluye.
- Cambiar `nein` de canal requiere quitar `~/.n_ein/bin/nein`: `activate` no reemplaza un enlace que apunta a otra instalación.
