# Formato de GLOSSARY.md

## Estructura

```md
# {Nombre del contexto}

{Una o dos frases sobre qué es este contexto y por qué existe.}

## Lenguaje

**Pedido**:
{Una o dos frases que describan el término}
_Evitar_: compra, transacción

**Factura**:
Una petición de pago enviada al cliente tras la entrega.
_Evitar_: recibo, cobro

**Cliente**:
Una persona u organización que hace pedidos.
_Evitar_: comprador, cuenta
```

## Reglas

- **Ten opinión.** Si hay varias palabras para el mismo concepto, elige la mejor y pon las demás en `_Evitar_`.
- **Definiciones cortas.** Una o dos frases como mucho. Define lo que ES, no lo que hace.
- **Solo términos propios del contexto del proyecto.** Los conceptos generales de programación (timeouts, tipos de error, patrones utilitarios) se quedan fuera aunque el proyecto los use mucho. Antes de añadir un término, pregúntate: ¿es un concepto único de este contexto o uno general de programación? Solo entra el primero.
- **Agrupa en subapartados** cuando surjan grupos naturales. Si todos los términos son de una sola área coherente, una lista plana vale.

## Repos de uno o varios contextos

**Un contexto (la mayoría):** un `GLOSSARY.md` en la raíz.

**Varios contextos:** un `GLOSSARY-MAP.md` en la raíz enumera los contextos, dónde viven y cómo se relacionan:

```md
# Mapa de glosarios

## Contextos

- [Pedidos](./src/ordering/GLOSSARY.md): recibe y sigue los pedidos de clientes
- [Facturación](./src/billing/GLOSSARY.md): genera facturas y procesa pagos
- [Logística](./src/fulfillment/GLOSSARY.md): gestiona la preparación y el envío en almacén

## Relaciones

- **Pedidos → Logística**: Pedidos emite eventos `OrderPlaced`; Logística los consume para empezar la preparación
- **Logística → Facturación**: Logística emite eventos `ShipmentDispatched`; Facturación los consume para generar facturas
- **Pedidos ↔ Facturación**: tipos compartidos `CustomerId` y `Money`
```

Cómo saber qué estructura aplica:

- Si existe `GLOSSARY-MAP.md`, léelo para encontrar los contextos
- Si solo hay un `GLOSSARY.md` en la raíz, un contexto
- Si no hay ninguno, crea un `GLOSSARY.md` en la raíz al resolver el primer término

Con varios contextos, deduce a cuál pertenece el tema actual. Si no está claro, pregunta.
