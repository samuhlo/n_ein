---
name: to-spec
description: "Convierte la conversación actual en una especificación dentro de WORK.md: sin entrevista, solo síntesis de lo ya hablado."
disable-model-invocation: true
---

Esta skill toma el contexto de la conversación y lo que sabes del código y produce una especificación. Sin entrevistar al usuario: sintetiza lo que ya sabes. (Si aún hay decisiones abiertas, eso es trabajo de `intent`, no de esta skill.)

## Proceso

1. Explora el repo para entender el estado actual del código, si no lo has hecho ya (CodeGraph primero). Usa en toda la especificación el vocabulario del glosario del dominio y respeta los ADR de la zona.

2. Esboza las costuras en las que vas a probar la funcionalidad. Prefiere las costuras existentes a las nuevas y la más alta posible. Si hacen falta costuras nuevas, propónlas en el punto más alto que puedas. Cuantas menos costuras en el código, mejor: lo ideal es una.

   Comprueba con el usuario que esas costuras coinciden con lo que espera.

3. Escribe la especificación con la plantilla de abajo en el documento de trabajo del proyecto, o en `WORK.md` si no hay otro. Si ya existe, completa sus secciones en vez de duplicarlas.

<plantilla>

## Objetivo

**Problema:** el problema que tiene el usuario, desde su punto de vista.

**Solución:** la solución, desde su punto de vista.

## Historias de usuario

Una lista LARGA y numerada de historias de usuario, cada una con el formato:

1. Como <actor>, quiero <funcionalidad>, para <beneficio>

<ejemplo>
1. Como cliente de banca móvil, quiero ver el saldo de mis cuentas, para decidir mejor en qué gasto
</ejemplo>

La lista tiene que ser muy extensa y cubrir todos los aspectos de la funcionalidad.

## Decisiones

Las decisiones de implementación tomadas, con su motivo. Pueden incluir:

- Los módulos que se construyen o modifican
- Las interfaces de esos módulos que cambian
- Aclaraciones técnicas del desarrollador
- Decisiones de arquitectura
- Cambios de esquema
- Contratos de API
- Interacciones concretas

Sin rutas de archivos ni fragmentos de código: se quedan viejos muy rápido.

Excepción: si un prototipo produjo un fragmento que fija una decisión con más precisión que la prosa (máquina de estados, reducer, esquema, forma de un tipo), inclúyelo dentro de esa decisión indicando que viene de un prototipo. Recórtalo a lo que lleva la decisión, no una demo que funcione.

## Criterios

Las decisiones de test y los criterios observables. Incluye:

- Qué hace bueno a un test (solo comportamiento externo, no detalles de implementación)
- Las costuras acordadas y qué módulos se prueban
- Precedentes de tests parecidos en el código

## Límites

Lo que queda fuera del alcance de esta especificación.

## Notas

Cualquier otra nota sobre la funcionalidad.

</plantilla>

Las tareas no son parte de esta skill: cuando el usuario quiera trocear el trabajo, `/skill:to-tickets` las añade bajo `## Tareas`.
