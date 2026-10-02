# Test doubles

Use doubles only at **system boundaries**: external APIs (payments, email), databases (sometimes; prefer a test database), time and randomness, the file system (sometimes). What you control is tested for real: your own modules and their internal collaborators.

## Design boundaries to be doubled

**Inject dependencies** instead of creating them inside:

```typescript
// Easy to double
function processPayment(order, paymentClient) {
  return paymentClient.charge(order.total);
}

// Hard to double
function processPayment(order) {
  const client = new StripeClient(process.env.STRIPE_KEY);
  return client.charge(order.total);
}
```

**Prefer SDK-style interfaces** (one function per external operation) over a generic fetcher:

```typescript
// GOOD: each function doubles on its own
const api = {
  getUser: (id) => fetch(`/users/${id}`),
  getOrders: (userId) => fetch(`/users/${userId}/orders`),
  createOrder: (data) => fetch("/orders", { method: "POST", body: data }),
};

// BAD: the double needs conditional logic
const api = { fetch: (endpoint, options) => fetch(endpoint, options) };
```

Each double then returns one shape, test setup has no branching, and you can see which endpoints a test touches.
