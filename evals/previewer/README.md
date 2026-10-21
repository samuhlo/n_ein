# Banco del revisor

Mide si p_reviewer encuentra fallos conocidos sin inventar otros. Son quince casos, congelados el 21 de octubre antes de afinar nada:

| Origen | Fallos | Cambios correctos | Falta contexto |
|---|---:|---:|---:|
| `lang-pr-review` (Python, propios) | 2 | 2 | 2 |
| Planificador (Nuxt y TypeScript) | 2 | 1 | — |
| n_ein (TypeScript) | 2 | 1 | — |
| Ein (TypeScript) | 2 | 1 | — |

Cada fallo real se tomó de un `fix` del historial y del commit que introdujo la línea arreglada, comprobado con `git blame`. Se descartó un candidato, la versión prerelease de Ein, porque en su commit de origen el instalador excluía las prereleases a propósito: allí aún no era un fallo. Los cambios correctos son esos mismos arreglos, revisados por separado, para contar las falsas alarmas.

## Partes

`dev` (7 casos, 4 fallos) sirve para montar y comparar. `reserved` (8 casos, 4 fallos) solo mide: no se ajustan prompts ni el modelo por defecto con sus resultados. Cada fallo y su arreglo van en la misma parte, porque el arreglo enseña el fallo.

## Sin filtrar la respuesta

- El caso se reconstruye como un repositorio nuevo con dos commits, `main` (base) y `change` (cambio), con el mensaje de commit original. La historia posterior, donde está el arreglo, no existe en esa copia.
- Las referencias (`references/`) se quedan en n_ein y solo las ve el juez.
- Tras cada revisión se buscan en las herramientas que usó el revisor las rutas de los repositorios de origen, de `evals/` y de `lang-pr-review`, y la marca de referencia. Una coincidencia marca el caso como CONTAMINADO en el informe.

## Uso

```sh
bun evals/previewer/bench.ts run --split dev [--model openai-codex/gpt-6-sol | claude-code/claude-opus-5-5] [--thinking high]
bun evals/previewer/bench.ts run --resume ~/.n_ein/dev/bench/previewer/<ejecución>   # repite lo que no terminó
bun evals/previewer/bench.ts grade ~/.n_ein/dev/bench/previewer/<ejecución> [--judge pi:openai-codex/gpt-6-sol]
bun evals/previewer/bench.ts agree ~/.n_ein/dev/bench/previewer/<ejecución> opus pi:openai-codex/gpt-6-sol
bun evals/previewer/bench.ts build plan-horario <carpeta>   # mirar un caso sin revisarlo
```

Los casos reales se reconstruyen desde los repositorios locales de Ein, el Planificador y n_ein, en solo lectura (`git archive`).

`grade` pide a Claude (`claude -p`, Opus por defecto, sin herramientas) que decida qué defectos conocidos encontró cada revisión y si cada hallazgo es válido, inválido o dudoso. El juez no sabe qué modelo revisó. Su veredicto se guarda y no se repite.

## Umbrales (WORK.md, «Criterios»)

Medidos en `reserved`:

- encuentra al menos 7 de cada 10 fallos conocidos;
- al menos 7 de cada 10 avisos son válidos;
- todas las citas existen en el SHA revisado (el motor rechaza las demás antes de enseñarlas);
- una revisión típica tarda 10 minutos o menos.

Con 4 fallos por parte, cada fallo pesa 25 puntos: el banco sirve para ver diferencias grandes, no finas. T9 lo amplía con las valoraciones reales.
