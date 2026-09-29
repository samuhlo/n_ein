---
name: handoff-pi
description: Prepara desde Claude el relevo de un encargo en curso a Pi cuando Samu pida cambiar de runtime.
---

# Relevo Claude → Pi

Úsala solo si Samu pide cambiar a Pi. Termina o detén antes las herramientas y agentes de fondo que puedan seguir escribiendo. Conserva en el documento de trabajo activo lo hecho, las decisiones, el pendiente y las comprobaciones con su vigencia; no crees otro tablero.

Revisa Git y redacta una nota breve para Pi con el resultado real, las decisiones que no debe reabrir y el siguiente paso. Ejecuta `"$N_EIN_ROOT/bin/n-ein-prepare-pi" "<nota>"` desde el proyecto. La utilidad añade commit, diff y rutas sin confiar solo en tu relato. Si falla, explica el error y no declares listo el relevo.

Cuando la utilidad confirme la ruta, di a Samu que cierre esta sesión con `/exit`. El lanzador esperará la salida del proceso Claude antes de arrancar Pi con el resumen. No inicies Pi tú ni mantengas escritores de fondo. Si había una sesión solo de diseño, el relevo no convierte el acuerdo en permiso para implementar.
