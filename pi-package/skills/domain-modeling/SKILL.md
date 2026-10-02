---
name: domain-modeling
description: Construir y afinar el modelo de dominio de un proyecto. Úsala al hablar de la terminología del código, al escribir o editar un GLOSSARY.md y al registrar o editar un ADR.
---

# Modelado del dominio

Construye y afina activamente el modelo de dominio del proyecto mientras diseñas. Es la disciplina *activa*: cuestionar términos, inventar escenarios límite y escribir el glosario y las decisiones en cuanto cristalizan. (Solo *leer* `GLOSSARY.md` para el vocabulario no es esta skill: es un hábito de una línea que cualquier skill puede tener. Esta es para cuando cambias el modelo, no solo cuando lo consumes.)

## Estructura de archivos

La mayoría de repos tienen un solo contexto:

```
/
├── GLOSSARY.md
├── docs/
│   └── adr/
│       ├── 0001-pedidos-con-event-sourcing.md
│       └── 0002-postgres-para-el-modelo-de-escritura.md
└── src/
```

Si en la raíz hay un `GLOSSARY-MAP.md`, el repo tiene varios contextos. El mapa dice dónde vive cada uno:

```
/
├── GLOSSARY-MAP.md
├── docs/
│   └── adr/                          ← decisiones de todo el sistema
├── src/
│   ├── ordering/
│   │   ├── GLOSSARY.md
│   │   └── docs/adr/                 ← decisiones del contexto
│   └── billing/
│       ├── GLOSSARY.md
│       └── docs/adr/
```

Crea los archivos cuando haga falta: solo cuando tengas algo que escribir. Sin `GLOSSARY.md`, créalo al resolver el primer término. Sin `docs/adr/`, créalo con el primer ADR.

## Durante la sesión

### Contrasta con el glosario

Cuando el usuario use un término que choca con el lenguaje de `GLOSSARY.md`, señálalo en el momento. «Tu glosario define "cancelación" como X, pero parece que quieres decir Y. ¿Cuál es?»

### Afina el lenguaje difuso

Cuando el usuario use términos vagos o sobrecargados, propón un término canónico preciso. «Dices "cuenta": ¿te refieres al Cliente o al Usuario? Son cosas distintas.»

### Discute escenarios concretos

Cuando se hable de relaciones del dominio, ponlas a prueba con escenarios concretos. Inventa escenarios que tanteen los casos límite y obliguen al usuario a precisar las fronteras entre conceptos.

### Contrasta con el código

Cuando el usuario explique cómo funciona algo, comprueba si el código está de acuerdo. Si encuentras una contradicción, sácala: «Tu código cancela pedidos enteros, pero acabas de decir que se puede cancelar en parte. ¿Qué es lo correcto?»

### Actualiza GLOSSARY.md en el momento

Cuando se resuelva un término, actualiza `GLOSSARY.md` ahí mismo, uno a uno según ocurren. Usa el formato de [GLOSSARY-FORMAT.md](./GLOSSARY-FORMAT.md).

`GLOSSARY.md` contiene solo lenguaje: definiciones de términos del dominio, sin detalles de implementación. Especificaciones, notas y decisiones de implementación viven en otro sitio (`WORK.md`, los ADR).

### Ofrece ADR con mesura

Ofrece crear un ADR solo cuando se cumplen las tres:

1. **Difícil de revertir**: cambiar de idea más tarde tiene un coste real
2. **Sorprendente sin contexto**: alguien en el futuro se preguntará «¿por qué lo hicieron así?»
3. **Fruto de un compromiso real**: había alternativas de verdad y se eligió una por motivos concretos

Si falta una, no hay ADR. Usa el formato de [ADR-FORMAT.md](./ADR-FORMAT.md).
