# Calidad y continuidad después de la auditoría

Los arreglos conservan instrucciones y comprobaciones al recortar contexto, evitan abaratar peticiones mixtas, transportan acuerdos en ambos idiomas y recuperan conocimiento duradero. En las copias de `planificador-didactico`, todas las nuevas ejecuciones completaron la aceptación independiente; los tests de S3 detectaron los dos defectos sembrados. El relevo con Claude conserva su primer tramo y sigue pendiente de completar tras el límite de sesión del proveedor.

## Cambios comprobados

- El recorte conserva documentación Markdown, referencias de skills, errores y checks. Solo retira lecturas recuperables; un `git log` o un ejemplo entre comillas no cuenta como commit. En las sesiones reales de S2 retiró 19, 20 y 3 resultados, sin retirar Markdown ni errores.
- El enrutador distingue documentar de implementar o cambiar permisos, tanto en español como en inglés. `/nein:nuevo` reclasifica otro encargo sin rebajar el modelo durante una continuación.
- El relevo conserva objetivo, permiso, decisiones, límites, criterios largos, evidencia y tareas pendientes en ambos idiomas. Sin documento, la petición completa aparece una sola vez.
- Pi y Claude reciben el mismo archivo de preferencias, fuera del paquete. El flujo recupera instrucciones, glosario y decisiones relevantes y conserva conocimiento duradero antes de sustituir un encargo terminado.
- El launcher mantiene un bloqueo por árbol durante el recorrido. Dos procesos independientes no escriben a la vez; matar al launcher no libera el bloqueo mientras su shell sigue vivo. Los escritores externos y lanzadores shell directos requieren coordinación.
- El smoke del paquete usa un hogar y ajustes propios: comprueba `nein/auto` sin heredar la selección personal de quien ejecuta el check.

Regresiones rojas observadas antes de los arreglos; verdes después. `./scripts/check.sh` incluye shell, Bun, Go, vet, compilación y un paquete instalado fuera del checkout.

## Banco con modelos

Producto NR10 fijado en `1fa9e33`, Pi 1.0.2 y CodeGraph 1.6.1. Scripts congelados en `n_ein-bench/scripts/fiabilidad-20261006`, hasta cuatro ejecuciones simultáneas y corrección en serie. Copias aisladas, login propio del banco para Pi y ningún cambio en el árbol habitual de planificador. Los refinamientos posteriores de clasificación inglesa, autorización del relevo y bloqueo del launcher tienen sus regresiones locales; el banco no se presenta como una ejecución de esos bytes posteriores.

| Caso | Repeticiones | Aceptación independiente | Calidad del test | Coste estimado medio | Tiempo medio |
|---|---:|---|---|---:|---:|
| S1, bug de importación | 1 | 26/26 | Suite 2177/2177 y tipos | $0,3852 | 188 s |
| S2, exportación guardada en servidor y clientes | 3 | 14/14 en las tres | Suites sin fallos y tipos | $1,2534 | 679 s |
| S3, tres deudas | 3 | 3/3 en las tres | 2/2 mutantes en las tres; documento corregido | $1,2239 | 578 s |
| S5, documentación de scripts | 1 | 16/16 | Ningún archivo de código tocado; suite y tipos | $0,0093 | 92 s |

Las suites de S2, S3 y S5 conservan cuatro tests omitidos del corpus; no tienen fallos nuevos. El 3/3 de S3 mide el alta: los mutantes y la documentación son criterios adicionales, visibles por separado en el informe del banco.

S4a corta a 301 s y retoma en una sesión nueva. Completa las tres entregas, el documento y ambos mutantes; retomar cuesta $0,5327 y tarda 286 s. El total de los dos tramos es $1,1518. El corte tiene salida 143, esperada por la interrupción; la reanudación termina con 0.

Se repitió NR8 en S2 como control de la misma ventana: termina con 14/14. Las dos repeticiones antiguas de NR8 eran 14/14 y 9/14; en S3 eran 3/3 pero solo 1/2 mutantes cada una. Las muestras son pequeñas y el corpus ya sirvió para ajustar el método: estos resultados acreditan las regresiones ejercitadas, no equivalencia estadística ni calidad universal. No se usó la nota variable del juez como sustituto de la aceptación.

Los importes son estimaciones de catálogo de Pi, no lo facturado por una suscripción. El informe muestra también las ejecuciones incompletas y su coste por resultado aceptado; no calcula un ahorro descartando los fallos. [Datos y hashes de la evidencia](2026-10-06-fiabilidad.json).

## Relevo entre runtimes

El fixture tiene tres entregas y una decisión de proyecto que debe sobrevivir: el puerto 0 solicita asignación automática y nunca se convierte en un puerto por defecto. Pi implementó y comprobó T1 en 182 s, hizo su commit y conservó T2 y T3 pendientes. El generador real de `/handoff` produjo el resumen después de que ese proceso terminara.

Claude devolvió límite de sesión con reinicio indicado a las 14:20 de Europe/Madrid; autenticación válida no acredita cuota disponible. El runner conserva la copia, el commit, los logs y las métricas y admite `--resume`, sin repetir etapas correctas ni sobrescribir intentos fallidos. Queda pendiente la ejecución de T2 en Claude, el regreso para T3 y una consulta posterior sin leer el documento del encargo anterior.

El ensayo usa procesos no interactivos; la transición automática de vuelta es la del lanzador y la skill `to-pi`. La primera nota se genera llamando al handler tras la salida de Pi, sin simular que un proceso activo ha terminado. No acredita supervisión de escritores externos.
