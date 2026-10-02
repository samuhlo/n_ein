# Formato de ADR

Los ADR viven en `docs/adr/` con numeración correlativa: `0001-slug.md`, `0002-slug.md`, etc.

Crea `docs/adr/` cuando haga falta el primer ADR.

## Plantilla

```md
# {Título corto de la decisión}

{De 1 a 3 frases: cuál es el contexto, qué decidimos y por qué.}
```

Eso es todo. Un ADR puede ser un solo párrafo. Su valor está en dejar constancia de *que* se tomó una decisión y de *por qué*, no en rellenar apartados.

## Apartados opcionales

Inclúyelos solo cuando aporten de verdad. La mayoría de ADR no los necesitan.

- Frontmatter **Estado** (`propuesta | aceptada | obsoleta | sustituida por ADR-NNNN`): útil cuando se revisan decisiones
- **Opciones consideradas**: solo cuando merece la pena recordar las alternativas descartadas
- **Consecuencias**: solo cuando hay efectos posteriores no obvios que señalar

## Numeración

Busca en `docs/adr/` el número más alto y súmale uno.

## Cuándo ofrecer un ADR

Tienen que cumplirse las tres:

1. **Difícil de revertir**: cambiar de idea más tarde tiene un coste real
2. **Sorprendente sin contexto**: alguien mirará el código y se preguntará «¿por qué demonios lo hicieron así?»
3. **Fruto de un compromiso real**: había alternativas de verdad y se eligió una por motivos concretos

Si se revierte fácil, sin ADR: simplemente se revertirá. Si no sorprende, nadie se preguntará el porqué. Si no había alternativa real, no hay nada que registrar más allá de «hicimos lo obvio».

### Qué merece un ADR

- **Forma de la arquitectura.** «Usamos un monorepo.» «El modelo de escritura usa event sourcing y el de lectura se proyecta en Postgres.»
- **Patrones de integración entre contextos.** «Pedidos y Facturación se comunican por eventos de dominio, no por HTTP síncrono.»
- **Elecciones tecnológicas que atan.** Base de datos, bus de mensajes, proveedor de autenticación, destino de despliegue. No cada librería: solo las que costaría un trimestre cambiar.
- **Decisiones de frontera y alcance.** «Los datos de cliente pertenecen al contexto Cliente; los demás los referencian solo por ID.» Los noes explícitos valen tanto como los síes.
- **Desvíos deliberados del camino obvio.** «Usamos SQL a mano en vez de un ORM por X.» Cualquier cosa donde un lector razonable supondría lo contrario. Evitan que el siguiente «arregle» algo que era deliberado.
- **Restricciones que no se ven en el código.** «No podemos usar AWS por requisitos de cumplimiento.» «Las respuestas deben bajar de 200 ms por el contrato con el socio.»
- **Alternativas descartadas cuando el descarte no es obvio.** Si se consideró GraphQL y se eligió REST por motivos sutiles, regístralo; si no, alguien volverá a proponer GraphQL dentro de seis meses.
