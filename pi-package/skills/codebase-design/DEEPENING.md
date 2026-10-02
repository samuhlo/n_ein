# Profundizar

Cómo profundizar con seguridad un grupo de módulos superficiales según sus dependencias. Usa el vocabulario de [SKILL.md](SKILL.md): **módulo**, **interfaz**, **costura**, **adaptador**.

## Categorías de dependencias

Al evaluar un candidato, clasifica sus dependencias. La categoría decide cómo se prueba el módulo profundizado a través de su costura.

### 1. En proceso

Cálculo puro, estado en memoria, sin E/S. Siempre se puede profundizar: une los módulos y prueba directamente por la nueva interfaz. Sin adaptador.

### 2. Sustituibles en local

Dependencias con sustituto local para tests (PGLite para Postgres, un sistema de archivos en memoria). Se puede profundizar si el sustituto existe. El módulo se prueba con el sustituto corriendo en la suite. La costura es interna; no hay puerto en la interfaz externa.

### 3. Remotas pero propias (puertos y adaptadores)

Servicios tuyos al otro lado de la red (microservicios, APIs internas). Define un **puerto** (interfaz) en la costura. El módulo profundo posee la lógica; el transporte se inyecta como **adaptador**. Los tests usan un adaptador en memoria; producción, uno HTTP, gRPC o de colas.

Forma de la recomendación: *«Define un puerto en la costura, con un adaptador HTTP para producción y uno en memoria para tests, para que la lógica viva en un módulo profundo aunque se despliegue a través de la red.»*

### 4. Externas de verdad (doble)

Servicios de terceros (Stripe, Twilio…) que no controlas. El módulo profundizado recibe la dependencia externa como puerto inyectado; los tests le dan un adaptador doble.

## Disciplina de costuras

- **Un adaptador es una costura hipotética. Dos adaptadores, una real.** Introduce un puerto solo cuando se justifican al menos dos adaptadores (normalmente producción + test). Una costura de un solo adaptador es indirección.
- **Costuras internas frente a externas.** Un módulo profundo puede tener costuras internas (privadas de su implementación, usadas por sus tests) además de la externa de su interfaz. Las internas se quedan dentro aunque los tests las usen.

## Estrategia de test: reemplazar, no apilar

- Los tests unitarios viejos de los módulos superficiales sobran en cuanto existen tests en la interfaz del módulo profundizado: bórralos.
- Escribe los tests nuevos en la interfaz del módulo profundizado. La **interfaz es la superficie de test**.
- Los tests comprueban resultados observables a través de la interfaz, no estado interno.
- Los tests sobreviven a refactors internos porque describen comportamiento, no implementación. Si un test tiene que cambiar cuando cambia la implementación, está probando más allá de la interfaz.
