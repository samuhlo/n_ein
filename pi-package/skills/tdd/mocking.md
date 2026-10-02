# Cuándo usar dobles

Usa dobles solo en las **fronteras del sistema**:

- APIs externas (pagos, correo, etc.)
- Bases de datos (a veces; mejor una base de datos de test)
- Tiempo y aleatoriedad
- Sistema de archivos (a veces)

Lo que controlas se prueba de verdad: tus propias clases y módulos y sus colaboradores internos van sin dobles.

## Diseñar para poder doblar

En las fronteras del sistema, diseña interfaces fáciles de doblar:

**1. Inyecta las dependencias**

Pasa las dependencias externas en lugar de crearlas dentro:

```typescript
// Fácil de doblar
function processPayment(order, paymentClient) {
  return paymentClient.charge(order.total);
}

// Difícil de doblar
function processPayment(order) {
  const client = new StripeClient(process.env.STRIPE_KEY);
  return client.charge(order.total);
}
```

**2. Prefiere interfaces tipo SDK a un fetch genérico**

Una función específica por operación externa en vez de una genérica con lógica condicional:

```typescript
// BIEN: cada función se dobla por separado
const api = {
  getUser: (id) => fetch(`/users/${id}`),
  getOrders: (userId) => fetch(`/users/${userId}/orders`),
  createOrder: (data) => fetch('/orders', { method: 'POST', body: data }),
};

// MAL: el doble necesita lógica condicional
const api = {
  fetch: (endpoint, options) => fetch(endpoint, options),
};
```

Con el estilo SDK:
- Cada doble devuelve una sola forma
- Sin lógica condicional en la preparación del test
- Se ve qué endpoints usa cada test
- Tipos por endpoint
