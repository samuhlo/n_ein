# Tests buenos y malos

## Tests buenos

**Estilo integración**: prueban a través de interfaces reales, no de dobles de piezas internas.

```typescript
// BIEN: prueba comportamiento observable
test("el usuario puede pagar con un carrito válido", async () => {
  const cart = createCart();
  cart.add(product);
  const result = await checkout(cart, paymentMethod);
  expect(result.status).toBe("confirmed");
});
```

Rasgos:

- Prueban el comportamiento que importa a usuarios o llamantes
- Usan solo la API pública
- Sobreviven a refactors internos
- Describen QUÉ, no CÓMO
- Una aserción lógica por test

## Tests malos

**Tests de detalle de implementación**: acoplados a la estructura interna.

```typescript
// MAL: prueba detalles de implementación
test("checkout llama a paymentService.process", async () => {
  const mockPayment = jest.mock(paymentService);
  await checkout(cart, payment);
  expect(mockPayment.process).toHaveBeenCalledWith(cart.total);
});
```

Señales de alarma:

- Dobles de colaboradores internos
- Pruebas de métodos privados
- Aserciones sobre número u orden de llamadas
- El test se rompe al refactorizar sin cambio de comportamiento
- El nombre del test describe CÓMO, no QUÉ
- Verificación por medios externos en vez de la interfaz

```typescript
// MAL: se salta la interfaz para verificar
test("createUser guarda en la base de datos", async () => {
  await createUser({ name: "Alice" });
  const row = await db.query("SELECT * FROM users WHERE name = ?", ["Alice"]);
  expect(row).toBeDefined();
});

// BIEN: verifica a través de la interfaz
test("createUser deja el usuario recuperable", async () => {
  const user = await createUser({ name: "Alice" });
  const retrieved = await getUser(user.id);
  expect(retrieved.name).toBe("Alice");
});
```

**Tests tautológicos**: el valor esperado repite la implementación, así que el test pasa por construcción.

```typescript
// MAL: el esperado se recalcula como lo calcula el código
test("calculateTotal suma las líneas", () => {
  const items = [{ price: 10 }, { price: 5 }];
  const expected = items.reduce((sum, i) => sum + i.price, 0);
  expect(calculateTotal(items)).toBe(expected);
});

// BIEN: el esperado es un literal conocido e independiente
test("calculateTotal suma las líneas", () => {
  expect(calculateTotal([{ price: 10 }, { price: 5 }])).toBe(15);
});
```
