# Pendientes y límites vigentes

Actualizado tras decidir el 7 de octubre consolidar un agente y un modelo por encargo. WORK.md mantiene las tareas activas; esta página no es otro checklist.

## Prioridades

1. **Calidad completa.** Comprobar cambios desde su entrada hasta el consumidor, mensaje y recuperación. Las suites y un juez no sustituyen la aceptación del encargo.
2. **Exploración proporcionada.** Consultas concretas, lecturas acotadas, reutilización de hallazgos y acceso al detalle cuando sea necesario. Medir el ahorro junto con calidad y tiempo.
3. **Conversación y modelo.** Incorporar correcciones sin reabrir decisiones resueltas; conservar permisos y pendientes. Validar selección, continuación y escalado en uso real.
4. **Entrega.** Paquete instalado y checks antes de promover una preview. Conservar configuraciones, sesiones y credenciales; coordinar cambios concurrentes.

## Ya comprobado

Intent y ejecución por conversación, nuevo encargo, memoria selectiva, recuperación de trabajo y relevo ordinario Pi↔Claude tienen [evidencia](../evals/results/2026-10-06-flujo-conversacional.md). El código experimental del equipo tiene pruebas de transporte y recuperación; su [banco](../evals/results/2026-10-07-coordinacion-contexto.md) no justifica adoptarlo por defecto. No reconstruir estas capacidades ni repetir bancos completos por rutina.

## Aplazado o fuera del alcance actual

- Equipo de agentes y relevo con equipo hacia Claude real: experimento conservado, sin promoción automática.
- Codex/OpenCode como nuevos runtimes: solo cuando se decida incorporarlos y se compruebe cada relevo.
- Canal estable, distribución remota y actualización automática: decisiones y verificación de entrega propias.
- Licencia propia del proyecto: pendiente de decisión antes de ampliar su distribución.
- Modelo local: descartado por Samu el 5 de octubre.

## Riesgos a vigilar

Contexto excesivo; instrucciones que se contradicen; tests que no observan el comportamiento pedido; ahorro aparente por entregas incompletas; regresiones de continuación; compatibilidad accidental con el checkout; y cambios de Pi sin comprobar el paquete instalado. Un fallo auxiliar de presentación o contabilidad no debe vetar el trabajo seguro.

No está demostrado un porcentaje estable de ahorro ni calidad universal frente al agente nativo. Ampliar pruebas solo para una pregunta concreta, con versiones y presupuesto definidos, conservando los resultados desfavorables.
