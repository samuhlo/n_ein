# Marca 004 Panel en launcher e instalador

Samu eligió el logo 004 Panel y pidió vestir launcher e instalador con él y con el resto de estilos de Ein. También señaló que el launcher no dejaba elegir Pi ni Claude. Commits `6ad8dde` y `69545c9`.

## Causa del menú inaccesible

Pi y Claude solo eran seleccionables en la quinta pestaña, Runtime. La vista inicial, Estado, no tenía ninguna fila con acción. Ahora la portada es el menú: Pi (`p`), Claude Code (`c`), Codex sin adaptador y no seleccionable, sesiones (`s`) y estado (`e`). `--view runtime` sigue abriendo la portada.

## Comprobado

- `go/internal/brand`: el Panel asentado dibuja `n_ein` en 39 × 6 celdas; en t=0 no hay palas; el monocromo no emite ANSI; los colores base coinciden con `brand.json`.
- Launcher: atajos de la portada, Codex no lanza nada, `s` cambia de vista sin salir, una tecla asienta la apertura, salida sin TTY legible. En un pty de 80 × 30: pantalla alternativa, fondos de pala, banda de foco `#1F1A0F` y salida limpia con `q`.
- Instalador: `setup --dry-run` no crea el hogar y marca los pasos con `·`; `setup` instala Pi, código, entrada y doctor; repetirlo no reinstala ni crea backup. Sin TTY no hay ANSI. En un pty, con Bun y Pi reales en un hogar temporal, la marca pequeña giró y se asentó y cada paso mostró la pala viva antes de su `✓`.
- `./scripts/check.sh` pasó.
- La preview personal se actualizó con `hotfix-preview.sh plan` + `nein-setup` a `0.1.0-preview.1+hotfix.6ad8dded8196`, con backup del anterior; doctor verificó 25 archivos, Pi 0.87.1 y Bun.

## Pendiente

- Nadie ha mirado aún la TUI a color con ojos humanos: la comprobación del color se hizo sobre las secuencias emitidas.
- El cambio de `✓` a `·` en el plan (`69545c9`) no está en la preview instalada; solo afecta a `--dry-run`.
- El tema de la sesión de Pi (`pi-package/themes`) no lleva todavía la marca pequeña ni el indicador de pala.
