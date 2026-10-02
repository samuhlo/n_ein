---
name: codebase-design
description: Vocabulario común para diseñar módulos profundos. Úsala cuando el usuario quiera diseñar o mejorar la interfaz de un módulo, buscar oportunidades de profundizar, decidir dónde va una costura o hacer el código más testeable o navegable por agentes, y cuando otra skill necesite este vocabulario.
---

# Diseño del código

Diseña **módulos profundos**: mucho comportamiento detrás de una interfaz pequeña, situada en una costura limpia y testeable a través de esa interfaz. Usa este lenguaje y estos principios dondequiera que se diseñe o reestructure código. El objetivo es palanca para quien llama, localidad para quien mantiene y testabilidad para todos.

## Glosario

Usa estos términos tal cual: sin cambiarlos por «componente», «servicio», «API» o «frontera». La gracia está en el lenguaje constante.

**Módulo** (_module_): cualquier cosa con interfaz e implementación. Independiente de la escala a propósito: una función, una clase, un paquete o un corte que cruza capas. _Evita_: unidad, componente, servicio.

**Interfaz** (_interface_): todo lo que un llamante debe saber para usar bien el módulo: la firma de tipos, pero también invariantes, restricciones de orden, modos de error, configuración necesaria y características de rendimiento. _Evita_: API, firma (demasiado estrechas: solo nombran la superficie de tipos).

**Implementación**: lo que hay dentro de un módulo, su cuerpo de código. Distinta de **adaptador**: algo puede ser un adaptador pequeño con una implementación grande (un repositorio Postgres) o un adaptador grande con una implementación pequeña (un doble en memoria). Di «adaptador» cuando el tema es la costura y «implementación» en lo demás.

**Profundidad** (_depth_): palanca en la interfaz. Cuánto comportamiento puede ejercitar un llamante (o un test) por cada unidad de interfaz que tiene que aprender. Un módulo es **profundo** cuando hay mucho comportamiento tras una interfaz pequeña, y **superficial** cuando la interfaz es casi tan compleja como la implementación.

**Costura** (_seam_, Michael Feathers): un sitio donde puedes alterar el comportamiento sin editar en ese sitio; el *lugar* donde vive la interfaz de un módulo. Dónde poner la costura es una decisión de diseño propia, distinta de qué va detrás. _Evita_: frontera (cargada por el contexto delimitado de DDD).

**Adaptador** (_adapter_): algo concreto que cumple una interfaz en una costura. Describe *papel* (qué hueco ocupa), no sustancia (qué lleva dentro).

**Palanca** (_leverage_): lo que obtienen los llamantes de la profundidad. Más capacidad por unidad de interfaz aprendida. Una implementación se amortiza en N llamadas y M tests.

**Localidad** (_locality_): lo que obtienen los mantenedores de la profundidad. Los cambios, los fallos, el conocimiento y la verificación se concentran en un sitio en vez de repartirse entre llamantes. Se arregla una vez y queda arreglado en todas partes.

## Profundo frente a superficial

**Módulo profundo** = interfaz pequeña + mucha implementación:

```
┌─────────────────────┐
│  Interfaz pequeña   │  ← Pocos métodos, parámetros simples
├─────────────────────┤
│                     │
│ Implementación      │  ← Lógica compleja escondida
│ profunda            │
└─────────────────────┘
```

**Módulo superficial** = interfaz grande + poca implementación (evítalo):

```
┌─────────────────────────────────┐
│        Interfaz grande          │  ← Muchos métodos, parámetros complejos
├─────────────────────────────────┤
│  Implementación fina            │  ← Solo pasa la llamada
└─────────────────────────────────┘
```

Al diseñar una interfaz, pregúntate:

- ¿Puedo reducir el número de métodos?
- ¿Puedo simplificar los parámetros?
- ¿Puedo esconder más complejidad dentro?

## Principios

- **La profundidad es propiedad de la interfaz, no de la implementación.** Un módulo profundo puede estar hecho por dentro de piezas pequeñas, doblables e intercambiables; simplemente no forman parte de la interfaz. Un módulo puede tener **costuras internas** (privadas de su implementación, usadas por sus propios tests) además de la **costura externa** de su interfaz.
- **La prueba del borrado.** Imagina borrar el módulo. Si la complejidad desaparece, solo pasaba llamadas. Si reaparece en N llamantes, se ganaba el sitio.
- **La interfaz es la superficie de test.** Llamantes y tests cruzan la misma costura. Si quieres probar *más allá* de la interfaz, probablemente el módulo tiene la forma equivocada.
- **Un adaptador es una costura hipotética. Dos adaptadores, una real.** Introduce una costura solo cuando algo varía de verdad a través de ella.

## Diseñar para testear

Las buenas interfaces hacen natural el test:

1. **Recibe las dependencias, no las crees.**

   ```typescript
   // Testeable
   function processOrder(order, paymentGateway) {}

   // Difícil de testear
   function processOrder(order) {
     const gateway = new StripeGateway();
   }
   ```

2. **Devuelve resultados, no produzcas efectos.**

   ```typescript
   // Testeable
   function calculateDiscount(cart): Discount {}

   // Difícil de testear
   function applyDiscount(cart): void {
     cart.total -= discount;
   }
   ```

3. **Superficie pequeña.** Menos métodos = menos tests. Menos parámetros = preparación más simple.

## Relaciones

- Un **módulo** tiene exactamente una **interfaz** (la superficie que presenta a llamantes y tests).
- La **profundidad** es propiedad de un **módulo**, medida contra su **interfaz**.
- Una **costura** es donde vive la **interfaz** de un **módulo**.
- Un **adaptador** está en una **costura** y cumple la **interfaz**.
- La **profundidad** produce **palanca** para los llamantes y **localidad** para los mantenedores.

## Enfoques descartados

- **Profundidad como cociente entre líneas de implementación y de interfaz** (Ousterhout): premia inflar la implementación. Aquí profundidad es palanca.
- **«Interfaz» como la palabra clave `interface` de TypeScript o los métodos públicos de una clase**: demasiado estrecho; aquí interfaz incluye todo lo que un llamante debe saber.
- **«Frontera»**: cargada por el contexto delimitado de DDD. Di **costura** o **interfaz**.

## Para profundizar

- **Profundizar un grupo de módulos según sus dependencias**: [DEEPENING.md](DEEPENING.md), con categorías de dependencias, disciplina de costuras y tests que reemplazan en vez de apilarse.
- **Explorar interfaces alternativas**: [DESIGN-IT-TWICE.md](DESIGN-IT-TWICE.md), con varios diseños radicalmente distintos en paralelo, comparados por profundidad, localidad y posición de la costura.
