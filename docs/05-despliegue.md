# Repositorio, desarrollo y despliegue

Objetivo solicitado: repositorio limpio, pruebas mejores y canales comprensibles. El [repositorio público](https://github.com/samuhlo/n_ein), el [instalador y los canales locales](../README.md#instalación-local-de-prueba), y los checks ya existen. La distribución de releases sigue pendiente. Las secciones siguientes conservan los criterios originales de diseño; consulta el README y la evidencia para distinguirlos de lo ya implementado.

## Repositorio nuevo

El repositorio tendrá dos lenguajes con una frontera clara ([diseño](02-diseno.md#frontera-entre-lenguajes)): TypeScript/Bun para el paquete Pi y Go para launcher e instalador. Los contratos compartidos (`brand.json`, formatos del documento de trabajo y del resumen de relevo, `runtimes.toml`) viven como archivos neutros, no como código duplicado.

Mantener código, pruebas y herramientas de desarrollo separados cuando aparezcan; no crear directorios vacíos para una arquitectura imaginada. Las fuentes de `docs/sources/` son material de investigación, no dependencias productivas. No publicar los archives en el paquete runtime.

Conservar este handoff como documentación de origen. Al comenzar desarrollo, el README del producto describe comportamiento realmente disponible; no presenta todo el plan como implementado. Changelog por cambios relevantes. Una pequeña lista de decisiones duraderas basta; no un ADR por detalle reversible.

La carpeta nueva no estaba inicializada en Git cuando se creó el paquete; ahora `main` se sigue desde `samuhlo/n_ein` público. No se ha elegido licencia propia. Los ejecutables locales se llaman `n-ein` y `n-ein-install`; eso no supone disponibilidad en registros.

## Canales propuestos

| Canal | Origen | Uso | Condición de entrada |
|---|---|---|---|
| Desarrollo | Checkout explícito | Probar el siguiente corte | Home/configuración propios; versión y origen visibles. |
| Preview | Artefacto candidato inmutable | Uso supervisado | Checks del cambio, paquete instalable y smoke del recorrido esencial. |
| Estable | Promoción del artefacto ya probado | Uso habitual | Evidencia de preview y recuperación comprobada. |

El canal `alpha` de Ein corresponde a preview. Como en Ein, el canal elegido se guarda solo tras un update correcto.

Promover el mismo artefacto/bytes, no reconstruir silenciosamente otro con dependencias distintas. Registrar identificador de release, commit, versiones runtime/dependencias y hash. No hace falta una plataforma de releases propia.

## Instalación aislada

Pi vanilla, Ein legado, desarrollo n_ein y estable n_ein deben tener identidades claras. Proponer hogares separados; confirmar y comprobar resolución de rutas antes de escribir. No copiar credenciales en paquetes ni migrar sign-ins automáticamente por conveniencia.

La primera instalación es local y acotada: un lanzador de shell que exporta `PI_CODING_AGENT_DIR` hacia el hogar de n_ein y carga el paquete local. Ein ya usa lanzadores con configuración propia para Pi y Claude ([ejemplo Pi archivado](archive/ein-workspace/ein-pi/launchers/ein-pi.fish)). En otras integraciones, comprobar las ubicaciones y la precedencia reales: `CLAUDE_CONFIG_DIR`, `CODEX_HOME` y `OPENCODE_CONFIG_DIR` no son contratos intercambiables. En particular, `OPENCODE_CONFIG_DIR` añade configuración a fuentes globales/de proyecto; no basta para afirmar aislamiento completo ([documentación oficial](https://opencode.ai/docs/config/#custom-directory)). Probar también instrucciones/skills, sesiones y credenciales antes de declarar una integración aislada.

El instalador es un binario Go separado del launcher, con `package`, `install`, `update`, `doctor`, `restore` y `uninstall` comprobados en destinos temporales ([evidencia](../evals/results/2026-09-29-installer.md)). `doctor` valida el paquete; `doctor --runtime` añade presencia de Bun y versión de Pi, pero no confirma autenticación ni acceso al modelo. Se reescribió a partir de los comportamientos útiles de Ein, sin portar sus migraciones SDD. Distribución por script o brew: pendiente.

Update se prepara antes de reemplazar la versión activa, comprueba el resultado y conserva una recuperación entendible. `install` y `update` rechazan un destino existente sin marcador y manifest de n_ein, incluso en dry-run; no impiden reparar una instalación identificada con archivos dañados. Dry-run no debe mutar. Un fallo deja identificable qué versión y datos quedaron. Desinstalación separa código gestionado, configuración propia y datos del usuario.

## CI proporcional

Al principio: chequeo de tipos si aplica, pruebas relevantes y smoke determinista del paquete. Añadir jobs según superficies reales. No declarar soporte Windows/Linux/macOS sin ejercitar la ruta de cada plataforma.

Las evaluaciones pagadas van separadas, con modelo/endpoint/configuración y presupuesto explícitos. Un test de proveedor simulado es válido para transporte y errores, pero no se etiqueta como evaluación de capacidad real.

`scripts/smoke-package.sh` ya empaqueta, instala en un destino temporal, comprueba hashes, abre la vista Configuración del binario instalado y verifica las rutas de Pi con un ejecutable simulado. Los ensayos con modelo real y el relevo Pi↔Claude siguen registrados aparte. Mantener el entorno independiente de las instalaciones personales del desarrollador.

## Versiones y evolución

Fijar una combinación conocida de Pi, runner y extensiones. Actualizarla en preview con compatibilidad observada. Evitar `latest` como promesa implícita de soporte perpetuo: Ein instala hoy los paquetes de su hogar Pi con `@latest`, y eso no se hereda. Pi pasó de 0.84 a 0.87 en un mes con cambios incompatibles en su API de extensiones.

Si una dependencia cambia un payload, corregir un único borde y comprobarlo con el paquete real. No añadir parsers o adaptadores generales para versiones hipotéticas. La configuración efectiva se puede inspeccionar sin leer archivos internos a mano.

## Fuera de alcance inicial

Marketplace, instalador multiplataforma sofisticado, telemetría remota, autoactualizaciones silenciosas y hosting de modelos. Primero una versión útil y reversible. Samu autorizó publicar este repositorio en GitHub; publicar paquetes o releases requiere decidir antes su canal y contenido.
