---
name: logging-style
description: Aplica el estilo de logs de Samu al añadir o revisar eventos de ejecución en código propio.
---

# Logs de eventos

Un registro representa un evento, no prosa. Usa `[TAG] SEP ACCION :: clave: valor | clave: valor`: tag de hasta seis caracteres, acción de hasta doce, ambos en mayúsculas. `::` indica evento general, `>>` inicio, `++` éxito, `->` salida a otro sistema.

```text
[DATA] >> COPY_START :: week_id: wk_42
[DATA] ++ COPIED :: activities: 12 | duration_ms: 34
[ERR] :: COPY_FAIL :: reason: invalid_date | attempt: 1
```

Registra decisiones, fallos y operaciones relevantes o lentas; evita el ruido por iteración y los éxitos triviales. Cada error lleva contexto para diagnosticarlo sin secretos ni datos personales. Usa el logger y niveles del proyecto. Conserva campos estructurados si el sistema los consume, con la gramática como mensaje legible. Los logs técnicos van al canal de diagnóstico, nunca al stdout JSON/RPC ni mezclados con la TUI.

Adapta el formato a las convenciones explícitas del proyecto y al lenguaje. No inventes logs para cumplir una cuota.

Adaptado de la skill personal `logging-style` de Ein, conservada en `docs/archive/ein-workspace/runtime/skills/local/logging-style/SKILL.md` del repositorio n_ein.
