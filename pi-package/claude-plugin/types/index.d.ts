declare module 'claude-code' {
  interface PluginState {
    'n-ein': {
      actionQuery: string;
      actionNames: string[];
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
      /** Modo de la última herramienta del bucle principal (coding, testing…); null fuera de turno. */
      activity: "exploring" | "coding" | "documenting" | "planning" | "testing" | "building" | "committing" | "researching" | "orchestrating" | "reviewing" | "asking" | "running" | "working" | null;
      /** El título y las casillas de WORK.md; null sin documento o sin tareas. */
      todo: { title: string; tasks: readonly { index: number; line: number; done: boolean; state: "open" | "done" | "waiting" | "dropped"; text: string }[] } | null;
    };
  }
}
