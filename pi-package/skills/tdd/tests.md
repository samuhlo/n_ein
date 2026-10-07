# Good and bad tests

## Good

Integration-style: through real interfaces, not doubles of internal parts.

```typescript
// GOOD: observable behaviour
test("user can check out with a valid cart", async () => {
  const cart = createCart();
  cart.add(product);
  const result = await checkout(cart, paymentMethod);
  expect(result.status).toBe("confirmed");
});
```

Traits: tests what callers care about · public API only · survives internal refactors · says WHAT, not HOW · one logical assertion.

## Bad

**Implementation details**, coupled to internal structure:

```typescript
// BAD
test("checkout calls paymentService.process", async () => {
  const mockPayment = jest.mock(paymentService);
  await checkout(cart, payment);
  expect(mockPayment.process).toHaveBeenCalledWith(cart.total);
});
```

Red flags: doubles of internal collaborators · private methods · call counts or order · breaks on a refactor with no behaviour change · name says HOW · verifies through something other than the interface.

```typescript
// BAD: goes around the interface
test("createUser saves to the database", async () => {
  await createUser({ name: "Alice" });
  const row = await db.query("SELECT * FROM users WHERE name = ?", ["Alice"]);
  expect(row).toBeDefined();
});

// GOOD: through the interface
test("createUser makes the user retrievable", async () => {
  const user = await createUser({ name: "Alice" });
  const retrieved = await getUser(user.id);
  expect(retrieved.name).toBe("Alice");
});
```

**Tautological**, passes by construction:

```typescript
// BAD: expected value recomputed like the code does
test("calculateTotal sums line items", () => {
  const items = [{ price: 10 }, { price: 5 }];
  expect(calculateTotal(items)).toBe(items.reduce((sum, i) => sum + i.price, 0));
});

// GOOD: an independent, known literal
test("calculateTotal sums line items", () => {
  expect(calculateTotal([{ price: 10 }, { price: 5 }])).toBe(15);
});
```

## Expected refusals cross boundaries

A rejected operation may be correct at the HTTP boundary and wrong in its consumer. Use the actual error shape from the handler through the real client mapper or component: a refusal because an account is ineligible must explain that rule and a valid recovery action, rather than claim a network failure or invite the same doomed retry. Exercise a still-eligible case too. Reusing an existing code does not prove that its existing message has the right meaning. Mock external effects, not the mapping behavior this test needs to observe.
