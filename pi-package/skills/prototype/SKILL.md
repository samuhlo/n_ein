---
name: prototype
description: Construye un prototipo desechable para responder una pregunta de diseño. Úsala cuando el usuario quiera comprobar si un modelo de estado o una lógica se sienten bien, o explorar cómo debería verse una interfaz.
---

# Prototipo

Un prototipo es **código desechable que responde una pregunta**. La pregunta decide la forma.

## Elige la rama

Identifica qué pregunta se responde, por la petición del usuario, el código alrededor o preguntándole si está:

- **«¿Se siente bien esta lógica o este modelo de estado?»** → [LOGIC.md](LOGIC.md). Un único HTML que se puede compartir (botones de juego libre y recorridos guiados en pestañas) que lleva la máquina de estados por los casos difíciles de razonar en papel, y que puede manejar alguien que no programa.
- **«¿Cómo debería verse esto?»** → [UI.md](UI.md). Varias variantes de interfaz radicalmente distintas en una sola ruta, intercambiables con un parámetro de la URL y una barra flotante abajo.

Las dos ramas producen artefactos muy distintos: equivocarse tira el prototipo entero. Si la pregunta es ambigua de verdad y el usuario no está, elige la rama que mejor encaje con el código de alrededor (un módulo de backend → lógica; una página o componente → interfaz) y declara el supuesto al principio del prototipo.

## Reglas comunes

1. **Desechable desde el primer día, y bien marcado.** Ponlo cerca de donde se usará de verdad (junto al módulo o la página que prototipa) para que el contexto sea obvio, pero con un nombre que deje claro a cualquiera que es un prototipo, no producción. Para rutas de interfaz desechables, sigue la convención de rutas del proyecto; sin inventar estructura nueva de primer nivel.
2. **Trivial de ejecutar.** Un prototipo de interfaz arranca con un comando del gestor de tareas del proyecto: `pnpm <nombre>`, `python <ruta>`, `bun <ruta>`, etc. Una demo de lógica es un único HTML que se abre con doble clic. En ambos casos, arrancarlo no exige pensar.
3. **Sin persistencia por defecto.** El estado vive en memoria. La persistencia es lo que el prototipo _comprueba_, no algo de lo que dependa. Si la pregunta va de base de datos, usa una de pruebas o un archivo local con un nombre claro como «PROTOTIPO, bórrame».
4. **Sin pulir.** Ni tests, ni manejo de errores más allá de lo que lo hace _ejecutable_, ni abstracciones. Se trata de aprender algo rápido.
5. **Enseña el estado.** Tras cada acción (lógica) o en cada cambio de variante (interfaz), imprime o pinta todo el estado relevante para que el usuario vea qué cambió.
6. **Consérvalo al terminar.** Lleva al código real cada decisión validada y conserva el prototipo como **fuente primaria**: commit en una rama desechable, fuera de la principal, y un puntero a esa rama en `WORK.md`. Anota también la respuesta (el veredicto y la pregunta que resolvió) en `WORK.md` o en un commit. La rama principal se queda solo con la decisión validada.
