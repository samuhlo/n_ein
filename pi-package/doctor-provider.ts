// [CHECK] Proveedor local de `doctor --runtime`: responde una vez, sin red ni modelo, con las
// herramientas activas. Prueba que el Pi instalado carga las extensiones de n_ein y contesta.
import { createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
  pi.registerProvider("nein-doctor", {
    api: "nein-doctor",
    apiKey: "local",
    baseUrl: "http://127.0.0.1",
    models: [{
      id: "ok",
      name: "ok",
      reasoning: false,
      input: ["text"],
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
      contextWindow: 32000,
      maxTokens: 1000,
    }],
    streamSimple(model) {
      const stream = createAssistantMessageEventStream();
      const message = {
        role: "assistant" as const,
        api: model.api,
        provider: model.provider,
        model: model.id,
        timestamp: Date.now(),
        content: [{ type: "text" as const, text: JSON.stringify({ doctor: "nein-doctor-ok", tools: pi.getActiveTools() }) }],
        stopReason: "stop" as const,
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
      };
      queueMicrotask(() => {
        stream.push({ type: "done", reason: "stop", message });
        stream.end();
      });
      return stream;
    },
  });
}
