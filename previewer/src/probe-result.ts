// [CHECK] Un fallo al arrancar la prueba no demuestra el defecto que quería medir.
// Esto reconoce errores habituales de Node/Python; no interpreta la lógica de
// una aserción. La validez del hallazgo sigue requiriendo revisar su evidencia.
export function probeExecutionFailure(exitCode: number | null, output: string): string | null {
  if (exitCode === 126 || exitCode === 127) return "no se pudo ejecutar el comando";
  if (exitCode === null || exitCode === 0) return null;
  if (/^\s*(?:E\s+)?(?:Error(?: \[ERR_MODULE_NOT_FOUND\])?: Cannot find (?:module|package)|ModuleNotFoundError:|ImportError:)/m.test(output))
    return "faltan módulos para ejecutar la sonda";
  if (/^(?:ERROR: file or directory not found:|Could not find ['"].*\.previewer-probes\/)|^.*(?:ENOENT: no such file or directory|can't open file).*\.previewer-probes\//m.test(output))
    return "falta un archivo de la sonda";
  if (/^(?:={3,} .*errors? during collection|no tests ran in )/m.test(output))
    return "la prueba no llegó a ejecutarse";
  if (/^\s*(?:E\s+)?subprocess\.CalledProcessError:.*\.previewer-probes\//m.test(output))
    return "falló un auxiliar de la sonda sin mostrar su aserción";
  return null;
}
