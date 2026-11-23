# TODO legible, modo de actividad y rama

Estado: cerrado · Rama: feat/todo-actividad-rama
Autorización: «hazlo» sobre el plan del 21 de noviembre: implementación en la rama, un commit por tarea; sin integrar ni publicar.
Objetivo: saber por dónde va y qué hace el agente: TODO legible en Pi y Claude, tarea actual correcta, modo de actividad y rama.

## Pedidos

- P1. «En pi, ni colores, ni el resumen o acortacion, aparece todo y queda horrible» → el bloque del TODO de Ein, con color, ancho real y refresco tras cada herramienta.
- P2. En Claude «aparece solo la tarea en si» → el mismo bloque en la franja sobre el prompt y una barra compacta.
- P3. «en la app de Miolo, no se mueve de T5 cuando va por la T33» → la tarea actual es la primera abierta tras la última hecha.
- P4. «si esta orquestando ponga orchesting, si esta con codigo, coding, si esta con test testing» → modo de actividad en el spinner, el mensaje de trabajo y la cabecera del TODO.
- P5. «otro que marque la rama donde esta trabajando» → la rama en la barra de Claude y en el estado de Pi.

## Decisiones

- Modos en inglés, también las palabras del spinner de Claude; el resto de la interfaz sigue en castellano.
- En Claude, el bloque va en la franja sobre el prompt, plegable; la barra de estado nunca pasa de 90 columnas.
- Sin marca nueva de «en curso» en el markdown.

## Tareas

- [x] T1 · Tarea actual compartida — `5c09237`
- [x] T2 · TODO de Pi con el estilo de Ein — `f3ab059`
- [x] T3 · TODO en Claude — `b4fc745`
- [x] T4 · Modo de actividad — `e01e32b`
- [x] T5 · Rama — `2307cdf`
- [x] T6 · Decisión, revisión y suite completa — `f826d46`

## Registro

- R1 (21 nov) Resultado: los cinco pedidos hechos y vistos en Pi 1.5.2 y Claude reales; `scripts/check.sh` OK. La evidencia que no llegó a escribirse se recuperó en `9281576`.
- R2 (23 nov) Migrado del `WORK.md` de la raíz al formato de un documento por encargo; el texto completo sigue en Git.
