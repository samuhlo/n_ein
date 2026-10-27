# Cadenas de PR en p_reviewer

Una cadena comparte los hallazgos y las decisiones del usuario entre varios cambios dependientes. Cada tramo se revisa contra su base y una última revisión recorre el conjunto desde la base inicial hasta el último head. Una cadena de diez tramos supone hasta once llamadas al modelo; no se lanza automáticamente.

La entrada normal es pedir al agente que revise la cadena. El agente obtiene su orden del encargo o de los metadatos de las PR, prepara un manifiesto temporal y valida los rangos. No se infiere una cadena de todas las ramas locales ni se necesitan merges o GitHub para ejecutarla.

```json
{
  "name": "beta",
  "base": "main",
  "steps": [
    { "name": "PR 1", "head": "feature/one", "prUrl": "https://github.com/owner/repo/pull/1" },
    { "name": "PR 2", "base": "feature/one", "head": "feature/two" }
  ]
}
```

`name` identifica la cadena dentro del repositorio. Cada `head` puede ser una rama, tag o SHA. El primer tramo parte de `base`; los demás, del head anterior. Si se incluye una base por tramo, debe resolver al mismo SHA. Todos los rangos deben ser lineales y no vacíos. Se fijan antes de la primera inferencia, sin usar silenciosamente un merge-base distinto.

```sh
nein previewer chain --file serie.json --plan       # solo valida y muestra los SHA
nein previewer chain --file serie.json              # revisa o reanuda
nein previewer chain --file serie.json --again      # vuelve a revisar expresamente
nein previewer chains                              # lista; no consume modelo
nein previewer open --chain beta
nein previewer status --chain beta
nein previewer handoff --chain beta
```

El snapshot conserva nombres, enlaces y SHAs. Reanudar con los mismos rangos y versión del revisor reutiliza los tramos completos. Un cambio crea otro snapshot, conservando hilos y decisiones; se revisan sus tramos de nuevo. Cambiar referencias mientras una revisión está en curso no cambia sus objetivos: la web señala la diferencia. Un fallo o una cancelación deja la cadena parcial y reanudable; una ejecución abandonada queda identificada. Solo se excluyen dos ejecuciones simultáneas de la misma cadena, sin bloquear otras sesiones del proyecto.

Los hallazgos anteriores se vuelven a comprobar, incluidos los resueltos cuando pueden reaparecer. El modelo los identifica mediante sus hilos; el motor también reconoce coincidencias inequívocas de condición, consecuencia y citas. No fusiona por parecido de título. Las valoraciones y selecciones pertenecen al hilo y no se reemplazan al analizar otro tramo.

El historial indica dónde se detectó cada problema y qué evidencia lo mantuvo, dejó sin comprobar o resolvió. **Detectado no significa necesariamente introducido**: si aparece por primera vez en integración, se registra allí sin inventar una PR de origen. Lo resuelto deja de ser tarea pendiente; lo seleccionado sin comprobar se conserva marcado. Una sonda que ya no aplica no confirma por sí sola un arreglo.

La vista principal es el balance de la última revisión completada y distingue si la integración ha terminado. Los enlaces de los tramos permiten leer sus informes y diffs históricos; las decisiones se editan desde el balance actual. Los datos de revisiones individuales existentes permanecen en sus sesiones; iniciar una cadena crea su propia sesión común.

El traspaso señala la referencia y el SHA finales, el último tramo comprobado y cualquier cambio posterior de las ramas. El agente debe establecer la rama de trabajo adecuada preservando lo que ya exista, y reproducir lo seleccionado antes de corregir. La web nunca modifica código, ejecuta inferencia ni publica en GitHub.

El almacén usa esquema 5 para snapshots y asociaciones de tramos. Conserva sesiones, hilos, valoraciones y selecciones anteriores; un binario antiguo rechaza el esquema nuevo. El revisor sigue usando Sol 6.1 high, copias desechables y las comprobaciones de evidencia del recorrido ordinario.
