# Diséñalo dos veces

Cuando el usuario quiera explorar interfaces alternativas para un candidato elegido, usa este patrón de subagentes en paralelo. Basado en «Design It Twice» (Ousterhout): tu primera idea difícilmente es la mejor.

Usa el vocabulario de [SKILL.md](SKILL.md): **módulo**, **interfaz**, **costura**, **adaptador**, **palanca**.

## Proceso

### 1. Plantea el espacio del problema

Antes de lanzar subagentes, escribe para el usuario una explicación del espacio del problema del candidato:

- Las restricciones que debería cumplir cualquier interfaz nueva
- Las dependencias en que se apoyaría y su categoría (ver [DEEPENING.md](DEEPENING.md))
- Un boceto de código ilustrativo para aterrizar las restricciones: no es una propuesta, solo una forma de concretarlas

Enséñaselo al usuario y pasa en seguida al paso 2. El usuario lee y piensa mientras los subagentes trabajan.

### 2. Lanza los subagentes

Lanza 3 o más en paralelo (con el trabajador en modo `explore` si el runtime solo admite uno cada vez, de uno en uno). Cada uno produce una interfaz **radicalmente distinta** para el módulo profundizado.

Dale a cada uno un encargo técnico propio (rutas, acoplamientos, categoría de dependencias según [DEEPENING.md](DEEPENING.md), qué va tras la costura), independiente de la explicación del paso 1. Dale a cada uno una restricción de diseño distinta:

- Agente 1: «Minimiza la interfaz: de 1 a 3 puntos de entrada como mucho. Maximiza la palanca por punto de entrada.»
- Agente 2: «Maximiza la flexibilidad: muchos casos de uso y extensión.»
- Agente 3: «Optimiza para el llamante más común: que el caso por defecto sea trivial.»
- Agente 4 (si aplica): «Diseña con puertos y adaptadores para las dependencias que cruzan la costura.»

Incluye en el encargo el vocabulario de [SKILL.md](SKILL.md) y el de `GLOSSARY.md`, para que cada uno nombre las cosas con el lenguaje de la arquitectura y el del dominio.

Cada subagente devuelve:

1. Interfaz (tipos, métodos, parámetros, más invariantes, orden y modos de error)
2. Ejemplo de uso desde un llamante
3. Qué esconde la implementación tras la costura
4. Estrategia de dependencias y adaptadores (ver [DEEPENING.md](DEEPENING.md))
5. Compromisos: dónde la palanca es alta y dónde se queda fina

### 3. Presenta y compara

Presenta los diseños uno tras otro para que el usuario asimile cada uno, y compáralos después en prosa: **profundidad** (palanca en la interfaz), **localidad** (dónde se concentra el cambio) y **posición de la costura**.

Tras comparar, da tu recomendación: qué diseño te parece más sólido y por qué. Si piezas de diseños distintos combinan bien, propón un híbrido. Ten opinión: el usuario quiere una lectura firme, no un menú.
