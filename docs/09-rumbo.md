# Rumbo: n_ein ligero con un modelo por encargo

Actualización del 6 de octubre: el recorrido directo de este corte sigue en la preview. La capacidad de paralelismo recuperable se desarrolló después como experimento; [su evaluación](../evals/results/2026-10-06-paralelismo.md) no justifica todavía activarla automáticamente. Este documento conserva el motivo del cambio del 5 de octubre.

Aprobado por Samu el 5 de octubre de 2026 y ejecutado ese mismo día hasta la fase 4 ([resultados](../evals/results/2026-10-05-rumbo-resultados.md)), tras el [banco de modelos de trabajo](../evals/results/2026-10-05-modelos-de-trabajo.md). La decisión se registra en [01-decisiones](01-decisiones.md); este documento guarda el razonamiento y el plan.

## Por qué cambiar

El banco comparó n_ein con Pi sin arnés, Gentle Shell, Matt y Codex, con el mismo modelo (Sol medium):

- **n_ein es el más caro y el más lento sin ser mejor.** Cuesta 2,6× lo de Pi sin arnés en un bug, 3,4–4,6× en un encargo medio y unas 4,5× en uno grande, con la misma aceptación oculta. En la revisión a ciegas queda por detrás en S2 y por delante en S3.
- **De dónde sale el coste:**
  - los subagentes son entre el 45 y el 63 % del total;
  - sin ellos, el principal de n_ein sigue costando 1,4–1,8× lo de Pi sin arnés, por la rama, los commits, `WORK.md`, las skills y CodeGraph;
  - el prompt fijo no es el problema: 4,4k tokens en el primer turno.
- **Delegar en un modelo barato no compensa.** Con Luna en los roles, S3 baja un 41 %, pero S2 tarda el doble y empeora. El principal en Sol sigue explorando, supervisando y revisando lo que hace Luna. Gentle llegó a lo mismo y desactivó delegar por precio el 4 de octubre.
- **Lo que sí demostró valor:**
  - `WORK.md` para retomar: en S4a solo las variantes con documento recuperaron el encargo completo;
  - tests más fuertes en el encargo grande: los de n_ein mataron los dos mutantes.
- **Lo que falló de forma repetida:**
  - no actualiza la documentación afectada (1–2 de 5);
  - deja partes del encargo sin hacer (N1 en S2);
  - cierra con la suite en rojo (N2 y N3 en S2).
- **Luna cuesta 20 veces menos** que Sol por token (0,1 y 0,5 USD por millón frente a 2 y 10). Un encargo entero en Luna costaría en torno al 5 % que en Sol, si se resuelve en los mismos tokens. En el piloto del 29 de septiembre, Luna resolvió S1 a la primera.

El modelo local queda descartado: Samu no va a montar la máquina.

## La idea

**Un agente, un modelo por encargo, elegido al principio según el riesgo y la complejidad, y método solo donde demostró valor.**

### 1. Sin subagentes en el recorrido ordinario

- `nein-scout`, `nein-worker` y `nein-reviewer` salen del recorrido por defecto: sus herramientas no se registran.
- La revisión se queda como skill en línea. Se usa solo si el usuario la pide o si el riesgo es alto, y como una pasada única.
- El código de los roles se borra si la fase 4 confirma que no hacen falta. Así queda un solo mecanismo y no dos.

### 2. Modelo por encargo

n_ein registra un **modelo virtual de Pi** (`nein/auto`, con `registerVirtualModel` de Pi 1.0; ver `docs/virtual-models.md` y `examples/extensions/jev-router.ts` en el paquete de Pi). Elige el modelo y el esfuerzo con la primera petición del usuario y lo mantiene durante todo el encargo. Así no se pierde la caché del prompt, que es 10 veces más barata.

Tabla de partida (la fase 2 la ajusta con datos):

| Tipo de encargo | Ejemplos | Modelo |
|---|---|---|
| Mecánico | Documentación, textos, renombrados, estilos o botones sin diseño ni lógica nueva | Luna medium |
| Ordinario | Una funcionalidad acotada, un bug con test reproducible | Luna high o Sol medium (lo decide la fase 2) |
| Riesgo alto | Datos y migraciones, usuarios, permisos y autenticación, contratos que otros consumen, concurrencia, despliegue | Sol high |
| Abierto | Decisiones de producto o diseño sin cerrar | Sol high, con `intent` antes de construir |

- **Quién decide:**
  - unas reglas sobre la petición, con palabras clave de riesgo y las rutas que señale CodeGraph;
  - si las reglas no bastan, una clasificación corta con Luna low (unos pocos miles de tokens);
  - el usuario puede forzarlo con un prefijo o un comando (`/nein:modo`).
  - El modelo elegido se ve en el pie de Pi (`auto → gpt-6-luna`) y en el TODO.
- **Escalado:**
  - si Luna falla dos veces la misma comprobación, el encargo pasa a Sol una sola vez, aceptando una pérdida de caché;
  - si al explorar aparece un riesgo alto que la clasificación no vio, también pasa a Sol, y se dice en una línea.
- **Claude:** sigue con su modelo. Como mucho, se ajusta el esfuerzo por encargo con la misma tabla; se decide aparte.

### 3. Método mínimo y en línea

El flujo se reescribe más corto y se queda con lo que dio resultado:

- **`WORK.md` solo para trabajo de varias entregas**, actualizado (marca y evidencia) en el mismo commit de cada tarea. El corte entre commit y marca paró a N2 al retomar.
- **Rama y un commit por tarea** cuando el encargo está autorizado, como hasta ahora.
- **TDD** cuando hay comportamiento con test ejecutable.
- **Cierre con una lista corta**, en línea y sin subagentes:
  1. cada parte del encargo, citada, está hecha o explicada;
  2. la suite completa y el typecheck pasan;
  3. la documentación afectada está al día;
  4. una línea de riesgo.

  Cubre los tres fallos repetidos del banco.

### Calidad y revisión, al mismo nivel que el coste

Samu lo pidió el 5 de octubre: no vale un código más barato que él daría por bueno sin serlo, y tiene que poder revisarlo y saber dónde falla. En la revisión a ciegas, cada práctica aportó esto:

| Práctica | Qué mostró el banco | Se queda |
|---|---|---|
| TDD | Tests de 3,8–4,2 sobre 5 en n_ein, frente a 2,5 sin arnés; los de n_ein matan los dos mutantes. | Sí, en línea |
| Alcance y documentación (reglas de Gentle) | Gentle: alcance 4,5, documentación 4,0 y cero bloqueantes. | Sí, en la lista de cierre |
| `WORK.md`, rama y commit por tarea | Lo único que recupera el encargo al retomar, y lo que permite revisar paso a paso. | Sí |
| Revisión delegada en cada tarea | La mitad del coste; aun así N2 y N3 cerraron con 4 tests en rojo. | No; se sustituye por la siguiente |
| Revisión dirigida (Gentle tras su banco) | En su banco pasó de 0 a 8 de 9 defectos sembrados detectados. | Solo en riesgo alto, si la medición lo confirma |

- **Facilidad de revisión.** El cierre de cada encargo dice dónde mirar y cómo comprobarlo: archivos, por qué y qué comando o test lo demuestra. Los commits son por tarea y con mensaje claro. Los logs siguen la skill `logs`, para que un fallo diga dónde ocurrió.
- **El juez gana una dimensión, «revisabilidad»:** commits, mensajes, y si el cierre permite verificar el cambio en minutos.
- **La revisión en riesgo alto** es una pasada en línea basada en el encargo, no en el diff, con severidad clara y una sola ronda de corrección. Antes de adoptarla se mide cuántos defectos sembrados detecta.

### 4. Lo que se conserva tal cual

Persona y voz, estilo de comentarios y logs, idioma, `intent` y `research`, las demás skills bajo demanda, launcher, instalador, TODO, relevo Pi↔Claude y CodeGraph. El efecto de CodeGraph se mide en la fase 2; su obligatoriedad no cambia sin datos.

### Objetivo medible

**Calidad**, frente a la mejor variante del banco en cada dimensión:
- igual o mejor en corrección, tests, alcance, legibilidad y documentación;
- la mejor nota de revisabilidad;
- cero bloqueantes;
- ningún cierre con la suite en rojo.

**Continuidad:** en S4a, 100 % del encargo recuperado.

**Coste:** como mucho 1,3 veces el de Pi sin arnés con Sol medium. Si ahorrar empeora la calidad, gana la calidad.

## Plan

| Fase | Trabajo | Modelo | Criterio de salida |
|---|---|---|---|
| 1 · N0 | Construir n_ein ligero: flujo corto, roles fuera del recorrido, lista de cierre con «dónde mirar y cómo comprobarlo», `WORK.md` en el mismo commit, revisión dirigida en riesgo alto. Tests del lanzador y de las skills al día. Juez con la dimensión de revisabilidad. | Ninguno | `./scripts/check.sh` pasa. El prompt no lista los roles. |
| 2 · ¿Dónde basta Luna? | N0 con Luna medium, Luna high, Sol medium y Sol high en S1, S2, S3 y dos escenarios nuevos con aceptación oculta: S5 (cambio de documentación) y S6 (cambio de interfaz sin diseño). Dos repeticiones. Además: N0 sin CodeGraph en S2, N0 con y sin revisión dirigida en S2 y S3, y la detección de la revisión sobre diffs con defectos sembrados. | ≈ 50 ejecuciones | Tabla de enrutado con datos: el modelo más barato que iguala calidad y aceptación en cada tipo. Decisión sobre la revisión dirigida. |
| 3 · Enrutador | `nein/auto` con reglas y clasificación por Luna, `/nein:modo`, escalado y pie visible. Precisión medida sin ejecutar encargos, con 20–30 peticiones reales sacadas por el agente del historial de los proyectos de Samu (solo lectura) y etiquetadas por él; Samu solo valida las etiquetas. | Solo clasificaciones | Ningún encargo de riesgo alto enrutado a Luna; al menos un 80 % de acierto en el resto. |
| 4 · Banco final | N0 con enrutador frente a A, G, C y N1 en S1–S6 y S4a, con dos repeticiones. | ≈ 50 ejecuciones | Se cumple el objetivo medible, o se sabe por qué no. |
| 5 · Entrega | Preview con el nuevo recorrido, decisión registrada en `01-decisiones` y retirada del código de roles si la fase 4 lo confirma. | Ninguno | Preview instalada y usada por Samu en un proyecto real. |

**Coste estimado:** las fases 2 y 4 suman unas 90 ejecuciones. Con Luna en buena parte, la estimación de catálogo debería quedar por debajo de los 42 USD del banco anterior. El banco ya existe (`evals/bench/`); hace falta añadir las variantes de modelo, S5 y S6.

**Lecciones del banco anterior** que se aplican desde el principio:
- scripts congelados mientras corren las ejecuciones;
- corrección siempre en serie;
- aceptación oculta probada contra más de una implementación;
- credenciales propias del banco;
- como máximo 4 ejecuciones en paralelo.

## Riesgos

- **Luna en un encargo mal clasificado.** Lo mitigan las reglas de riesgo antes que el clasificador, el escalado y el modelo visible en el pie. Mal clasificar hacia Sol solo cuesta dinero; hacia Luna puede costar calidad.
- **Luna puede necesitar muchos más tokens o turnos** en encargos ordinarios y perder la ventaja de precio. Lo mide la fase 2.
- **El juez varía unos ±4 puntos** entre tandas. Se mantienen los controles y se compara dentro de una misma tanda.
- **La API de modelos virtuales de Pi es nueva.** Cuanto menos código, menos que rehacer cuando cambie.

## Decisiones de Samu (5 de octubre)

1. **Rumbo aprobado:** sin subagentes por defecto y un modelo por encargo, sin perder calidad ni facilidad de revisión.
2. **Elección del modelo:** automática y visible, con anulación (recomendación aceptada con su «venga»).
3. **Claude:** sigue como está hasta la fase 4.
4. **El agente hace todas las pruebas**, incluidas las peticiones de la fase 3; Samu valida las etiquetas.
