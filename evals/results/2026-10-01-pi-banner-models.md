# Banner de Pi, /nein:models y paridad con Claude

Samu decidió que Claude no delega en Luna ni elige modelo (usa el de Claude Code, hoy Opus 5.5), pero sí lleva el TODO y un esfuerzo configurable. Después pidió el banner de arranque de Ein con la marca nueva y el selector como `/nein:models`, más elaborado.

## Comprobado

- **Claude.** `tests/handoff-launcher.sh`: con `claude.effort = xhigh` en `models.json`, Claude recibe `--effort xhigh`; su `--settings` lleva la `statusLine` de `bin/n-ein-todo` y el hook de CodeGraph. La barra muestra `n_ein   Opus 5.5 · xhigh   ▸ tarea · 1/3` con un `WORK.md` de prueba. Configuración del launcher enseña la fila `claude` y rechaza un esfuerzo inválido.
- **Marca compartida.** El Panel de TS y el de Go coinciden con `tests/fixtures/panel-final.txt`.
- **Banner (vista).** `tests/banner.ts`: en t=0 no hay estado; sin respuesta de Git dice «consultando Git…»; asentado muestra el Panel, el lema, las versiones, proyecto, trabajo y modelos; sin `WORK.md` no hay sección de trabajo; en terminal baja o estrecha cede al wordmark.
- **`/nein:models` (panel).** `tests/models.ts` lo conduce con teclas crudas: busca «luna», cicla esfuerzo, elige trabajador, ajusta Claude, guarda; cancelar no escribe; el id personalizado pasa por el input de Pi y vuelve al panel; `r` restablece.
- **Pi real (hogar dev, pty 120×40 reconstruido con pyte).** El banner sale con estado real (rama, 19 cambios, índice al día, modelos). `/nein:models` abre el panel sobre la conversación; enter en trabajador muestra el catálogo real con `gpt-6-luna` marcado; esc cierra sin guardar. Con `quietStartup` el banner completo cabe en 40 filas; a 100×28 sale el modo compacto.
- `./scripts/check.sh` pasó.

## Observado aparte

- Pi anunciaba «New version 0.99.2 is available. Run pi update»; el lanzador exporta ahora `PI_SKIP_VERSION_CHECK=1`.
- Una de mis capturas cerró Pi matando la pseudo-terminal y Pi registró «pi crashed (read EIO)» en el hogar dev. Es un artefacto de la prueba, no de n_ein; las capturas posteriores salieron limpias.

## No comprobado

- Ver el color real del banner y del panel con ojos humanos.
- Guardar desde el panel dentro del Pi real (los tests sí lo cubren) y una sesión de Claude completa con la barra de estado.
