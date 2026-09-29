# Primera sesión real de n_ein

Pi 0.87.1, hogar aislado `~/.n_ein/dev/pi-agent`, autenticación OAuth del proveedor `openai-codex`. Base del fixture: commit `79e5b03`, carpeta `evals/fixtures/port`. Se ejecutaron dos copias temporales independientes, fuera del repositorio; la base intencionadamente defectuosa sigue intacta.

| Ejecución | Modelo | Resultado observado |
|---|---|---|
| Agente principal | `gpt-6-sol`, razonamiento `high` solicitado por el lanzador | Reprodujo `bun check.ts` en rojo por aceptar `0`, cambió `port < 0` por `port < 1` y repitió el check en verde. |
| Prueba directa del modelo ejecutor | `gpt-6-luna`, razonamiento `high` solicitado por el lanzador con `--model` explícito | Reprodujo el mismo fallo, hizo el mismo cambio y obtuvo el check en verde. |
| Consulta de solo lectura | `gpt-6-sol`, razonamiento `high` solicitado por el lanzador | Localizó el defecto en `parse-port.ts:3`, lo reprodujo con `bun check.ts` y respondió sin editar los archivos. Sus hashes SHA-256 quedaron iguales antes y después. |
| `intent` solicitado | `gpt-6-sol`, razonamiento `high` solicitado por el lanzador | Leyó la skill, formuló dos preguntas dependientes de la idea de ordenar fotos, dio recomendaciones concretas y esperó respuesta. No creó artefactos ni implementó. |

En ambas sesiones el registro JSON de Pi identificó `openai-codex` y el modelo correspondiente, sin fallback. El paquete anunció solo `intent`, `comment-style` y `logging-style`. Tras cada sesión, una comprobación independiente ejecutó `bun check.ts` y comparó el archivo resultante con el fixture de base: una sola condición cambió.

Límite: Luna actuó aquí en una sesión directa, no a través del trabajador de la entrega 2. La prueba de `intent` cubre su primera ronda, no el cierre de un acuerdo confirmado. Estas ejecuciones acreditan el arranque, la autenticación, la consulta sin edición, la edición y la comprobación del caso sintético; no acreditan todavía cambios visuales ni rendimiento en proyectos reales. La suscripción no se interpreta como coste API cero por tarea.
