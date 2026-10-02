---
name: tdd
description: Desarrollo guiado por tests (TDD). Úsala al construir funcionalidad o corregir fallos test primero, cuando el usuario mencione rojo-verde-refactor o pida tests de integración, y cuando el proyecto tenga TDD activo.
---

# Desarrollo guiado por tests

TDD es el bucle rojo → verde. Esta skill es la referencia que hace que ese bucle produzca tests que merece la pena conservar: qué es un buen test, dónde van los tests, los antipatrones y las reglas del bucle. Cada sección aplica en cada ciclo: consúltalas antes y durante el bucle, no después.

Al explorar el código, lee `GLOSSARY.md` si existe, para que los nombres de los tests y el vocabulario de las interfaces coincidan con el lenguaje del dominio, y respeta los ADR de la zona que tocas.

## Qué es un buen test

Los tests verifican comportamiento a través de interfaces públicas, no detalles de implementación. El código puede cambiar por completo; los tests no deberían. Un buen test se lee como una especificación: «el usuario puede pagar con un carrito válido» dice exactamente qué capacidad existe, y sobrevive a los refactors porque no le importa la estructura interna.

Mira [tests.md](tests.md) para ejemplos y [mocking.md](mocking.md) para cuándo usar dobles.

## Costuras: dónde van los tests

Una **costura** (_seam_) es la frontera pública en la que pruebas: la interfaz donde observas el comportamiento sin meter la mano dentro. Los tests viven en costuras, nunca contra lo interno.

**Prueba solo en costuras declaradas.** Antes del primer test, escribe en una línea las costuras que vas a probar y sigue; si ya figuran en `## Criterios` de `WORK.md`, úsalas. Pregunta al usuario solo cuando elegir la costura es una decisión material de alcance o comportamiento: «¿Cuál es la interfaz pública y qué costuras deberíamos probar?». No se puede probar todo: fijar las costuras al principio es lo que lleva el esfuerzo de test a los caminos críticos y a la lógica compleja en lugar de a cada caso límite.

Cuando la forma de esa interfaz está en duda (qué profundidad tiene el módulo, dónde va la costura, qué debe exponer), carga la skill `codebase-design` para el vocabulario. Es la fuente común de los términos módulo, interfaz, profundidad, costura, adaptador, palanca y localidad, y se consulta como referencia, no se ejecuta como sesión.

## Antipatrones

- **Acoplado a la implementación**: dobla colaboradores internos, prueba métodos privados o verifica por un canal lateral (consulta la base de datos en vez de usar la interfaz). La señal: el test se rompe al refactorizar aunque el comportamiento no haya cambiado.
- **Tautológico**: la aserción recalcula el valor esperado igual que el código (`expect(add(a, b)).toBe(a + b)`, un snapshot derivado a mano del mismo modo, una constante comparada consigo misma), así que pasa por construcción y nunca puede discrepar del código. Los valores esperados salen de una fuente de verdad independiente: un literal conocido, un ejemplo resuelto, la especificación.
- **Corte horizontal**: escribir primero todos los tests y luego toda la implementación. Los tests en bloque verifican comportamiento _imaginado_: prueban la _forma_ de las cosas en vez del comportamiento que ve el usuario, se vuelven insensibles a cambios reales y te atan a una estructura de tests antes de entender la implementación. Trabaja en **cortes verticales**: un test → una implementación → repetir, cada test una **bala trazadora** (_tracer bullet_) que responde a lo que enseñó el ciclo anterior.

## Reglas del bucle

- **Rojo antes que verde.** Primero el test que falla, y lo observas fallar; después solo el código justo para que pase. Sin anticipar tests futuros ni añadir funcionalidad especulativa.
- **Un corte cada vez.** Una costura, un test, una implementación mínima por ciclo.
- **Refactorizar no es parte del bucle.** Pertenece a la revisión (skill `code-review`), no al ciclo rojo → verde.
- **Cuando no hay rojo posible** (documentación, cambios que no se pueden probar, sin runner), dilo y haz la comprobación funcional o estructural proporcionada.
