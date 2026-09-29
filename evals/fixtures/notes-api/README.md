# Caso: notas por HTTP

La base solo expone `GET /health`. El encargo es añadir una pequeña API de notas en memoria: `POST /notes` crea una nota con texto recortado y devuelve `201` con `{id, text}`; `GET /notes/:id` la recupera o devuelve `404`. JSON mal formado devuelve `400` y texto vacío, `422`. Una instancia nueva de `createApp()` empieza vacía.

`bun check.ts` cubre el recorrido petición → validación → almacenamiento → lectura. El fixture de base debe fallar en la primera creación con `404`; se ejecuta sobre una copia para conservarlo como entrada de evaluación.
