declare module 'claude-code' {
  interface PluginState {
    'n-ein': {
      /** true: Claude dibuja sus filas nativas (comando completo, salida, diff). */
      detail: boolean;
      /** Segundos de la apertura de la marca pequeña; null cuando ya no se muestra. */
      intro: number | null;
      /** Ventanas de la suscripción de la última lectura: 5 horas y semanal. */
      limits: { kind: string; percentUsed: number; resetsAt?: string }[];
      /** Contador que repinta la cuenta atrás del medidor. */
      tick: number;
      /** Tokens del último turno del bucle principal; null antes del primero. */
      turn: { input: number; output: number } | null;
      /** Tokens sumados desde que empezó la sesión. */
      session: { input: number; output: number };
    };
  }
}
