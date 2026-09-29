---
name: comment-style
description: Aplica el estilo de comentarios de Samu al escribir o revisar código propio, incluidos TypeScript y Go.
---

# Comentarios que ayudan a recorrer el código

Comenta decisiones, reglas y trampas que no se deducen fácilmente; nunca narres líneas obvias. Prefiere nombres claros. En archivos no triviales, una cabecera breve y secciones permiten encontrar el flujo. Usa etiquetas como `[CORE]`, `[FLOW]`, `[DATA]`, `[AUTH]` o `[UI]` cuando orienten.

```ts
// =============================================================================
// [FLOW] REANUDAR TRABAJO
// Recupera el pendiente y contrasta la evidencia con los archivos actuales.
// =============================================================================

// BLINDAJE -> Una edición posterior invalida la comprobación anterior.
```

Las notas cortas pueden usar un motivo en mayúsculas y `->` para causa y efecto. Como máximo un acento de ese vocabulario por bloque lógico. Sin emojis, relleno o cabeceras para archivos triviales. Conserva el idioma y las convenciones del archivo. Aplica el estilo al código nuevo y a los bloques tocados; no reescribas archivos fuera del encargo ni código generado.

En Go, conserva comentarios de documentación y directivas válidos: las etiquetas visuales los acompañan, nunca los sustituyen.

Adaptado de la skill personal `comment-style` de Ein, conservada en `docs/archive/ein-workspace/runtime/skills/local/comment-style/SKILL.md` del repositorio n_ein.
