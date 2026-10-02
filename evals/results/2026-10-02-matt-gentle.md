# Método de Matt y flujo de Gentle

El usuario veía n_ein flojo frente a sus dos referencias: Matt Pocock (37 skills pequeñas) y Gentle Shell 4.0.0 (flujo ODD). Decisiones de la ronda: commit por tarea en una rama; `WORK.md` como única fuente por ser lo más barato en tokens; idioma elegible en el launcher; método y flujo antes que roles y revisión.

## Hecho

- **Idioma.** `lang.json` del canal con dos ejes (conversación es/en; artefactos proyecto/es/en). Configuración del launcher los cicla con Enter sin salir de la TUI y los guarda de forma atómica. Los dos lanzadores lo convierten en una instrucción del prompt; un `lang.json` inválido no arranca Pi.
- **Fase A.** Trece skills de Matt (revisión `d81f3a1`) adaptadas al español, con sus palabras guía, `WORK.md` en lugar del gestor de incidencias y sin dependencias de su `setup`: `tdd` (con `tests.md` y `mocking.md`), `diagnosing-bugs` (con el script para una persona en el bucle), `code-review`, `codebase-design` (con `DEEPENING.md` y `DESIGN-IT-TWICE.md`), `domain-modeling` (formatos de glosario y ADR), `research`, `prototype` (ramas de lógica e interfaz), `pr` (con créditos de `show-me`), `writing-for-agents`, `to-spec`, `to-tickets`, `retro` y `wait-what`. Licencia MIT en `pi-package/NOTICE.md`.
- **Fase B.** `pi-package/flow.md` con el ODD de Gentle adaptado (autorizar, explorar, resolver incertidumbre, clasificar, registrar, implementar tarea a tarea con commit, cerrar, retomar) y sus reglas de delegación por presupuesto de evidencia. Lo reciben solo Pi principal y Claude; un trabajador hijo no recibe ni el flujo ni las instrucciones de delegación, y en modo `work` se le pide dejar los cambios sin commitear.

## Comprobado

- `tests/launcher.sh`: el principal recibe `pi-only.md`, `flow.md` y la instrucción de idioma; el hijo, no; el idioma en inglés llega tal cual; un `lang.json` inválido para el arranque.
- Test Go: Enter cicla conversación y artefactos, guarda y repinta; un `lang.json` inválido se ve en la fila.
- `tests/skills.ts`: 17 skills con frontmatter válido y sin nombres propios. En el Pi real cargan las 17.
- Coste fijo en el prompt: persona ≈ 345 tokens, flujo ≈ 960, delegación de Pi ≈ 104, descripciones de las 12 skills invocables por el modelo ≈ 670.
- `./scripts/check.sh` pasó.

## No comprobado

- Ningún modelo ha trabajado aún con el flujo y las skills nuevas (cuota de Codex agotada). Es la prueba que decide si la mezcla mejora el trabajo.
