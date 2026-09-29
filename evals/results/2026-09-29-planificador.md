# Regresión real: rechazo del catálogo del Anexo IV

**Origen:** `planificador-didactico` en `111489af6100d236ff22ef7b0277e03a635b2c20`. Se exportó el árbol a dos repositorios temporales sin enlazarlos al Git original ni incluir los commits posteriores que contenían la solución. El checkout habitual seguía en `4d6600718480a6c37115523883aba22bf93e40a6`, con sus cambios locales intactos al terminar.

**Encargo:** si falta el enlace normativo o no pasa la allowlist BOE, responder 422 sin tocar la red ni poner `importing`, pero marcar el certificado `failed` para no reintentar indefinidamente. Conservar el 404 sin mutación cuando no existe el certificado. Solo se autorizó editar `server/utils/anexo4/ingest.ts` en las copias.

El test focal original pasaba 24/24 y no detectaba este defecto. Dos aserciones sobre el marcado `failed` lo dejaron en rojo: T10 y T11 fallaban, los otros 22 pasaban. El [parche de aceptación](../reserved/planificador-anexo4.patch) se aplica al commit base; T10b y T11b se reservaron hasta después de cada primer intento para comprobar qué se comunica si también falla la escritura de `failed`.

| Ruta | Resultado observado | Comprobaciones |
|---|---|---|
| Sol high → trabajador Luna high | Luna editó solo `ingest.ts`; el padre inspeccionó el diff. | 24/24 visibles, luego 26/26 con T10b y T11b; typecheck y `git diff --check` pasaron. |
| Sol high directo, primer intento | Marcó `failed`, pero ignoró el valor `false` de `safeMarkFailed`. | 24/24 visibles; T11b falló al ocultar el fallo secundario. |
| Sol high directo, rescate nuevo | Añadió el diagnóstico secundario solo para `normativeUrl` ausente. | 25/25 con T11b; al añadir T10b, 25/26 y fallo en enlace BOE inválido. Typecheck pasó. |

| Ruta | Tiempo de modelo hasta respuesta final | Estimación de catálogo de Pi |
|---|---:|---:|
| Sol padre + Luna trabajador, un intento | 125 s | USD 0,050794 + 0,00265338 = 0,05344738 |
| Sol directo + un rescate, aún incompleto | 51 s + 23 s | USD 0,0696348 + 0,03093 = 0,1005648 |

La estimación es metadato del catálogo, **no** gasto facturado ni coste marginal de la suscripción. La latencia excluye preparar los tests y revisar manualmente. Una sola regresión histórica no prueba que delegar sea mejor en general; aquí produjo el resultado completo a la primera, con más espera y menor estimación de catálogo. No se trasladó ningún cambio al proyecto original.
