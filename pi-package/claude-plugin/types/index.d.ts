declare module 'claude-code' {
  interface PluginState {
    'n-ein': {
      /** true: Claude dibuja sus filas nativas (comando completo, salida, diff). */
      detail: boolean;
      /** Segundos de la apertura del Panel; null cuando la marca ya no se muestra. */
      intro: number | null;
    };
  }
}
