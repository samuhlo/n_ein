// [UI] PALETA NATIVA DE CLAUDE
// El host conserva foco y borrador. Elegir una skill prepara texto, no lo envía.
import { atom, read, update } from "claude-code";
import type { On } from "claude-code";
import { actionsFor, actionDraft } from "./actions.ts";
const query = atom({ plugin: "n-ein", key: "actionQuery" } as const, "");
const names = atom(
  { plugin: "n-ein", key: "actionNames" } as const,
  [] as string[],
);
export function registerActions(on: On): void {
  on("command.run", { command: "nein-comandos" }, async ($, e) => {
    const commands = await $.command.list();
    await update($, names, () => commands.map((c) => c.name));
    await update($, query, () => e.args);
    await $.ui.open({
      id: "nein-actions",
      title: "004 Comandos",
      focus: true,
      closeOnEscape: true,
      rows: 16,
    });
    return {};
  });
  on(
    "ui.render",
    { component: "Pane", requestId: "nein-actions" },
    async ($, e, next) => {
      if (e.requestId !== "nein-actions") return next(e);
      const ui = $.ui.resolve(e),
        q = await read($, query);
      const items = actionsFor("claude", await read($, names), q);
      const { Box, Text, Button } = ui;
      return (
        <Box flexDirection="column">
          <Text color="warning">// 004 COMANDOS</Text>
          {"Input" in ui ? (
            <ui.Input
              key="action-search"
              label="Buscar"
              value={q}
              autoFocus
              onInput={(value) => {
                void update($, query, () => value);
              }}
              onSubmit={(value) => {
                void update($, query, () => value);
              }}
            />
          ) : (
            <Text>{q}</Text>
          )}
          {items.length ? (
            items.map((a) => (
              <Box flexDirection="column">
                <Button
                  key={`action-${a.id}`}
                  label={a.label}
                  onPress={async () => {
                    if (a.prepare) {
                      const draft = await $.prompt.read();
                      await $.ui.close({ id: "nein-actions" });
                      const filled = await $.prompt.fill({
                        text: actionDraft(a, "claude", draft.text),
                        mode: "replace",
                      });
                      if (!filled.isFilled)
                        $.ui.toast(
                          "No se pudo preparar el texto; conserva tu borrador y usa /" +
                            a.claude,
                        );
                    } else {
                      await $.ui.close({ id: "nein-actions" });
                      const result = await $.command.run({ command: a.claude });
                      if (result.text) $.ui.toast(result.text);
                    }
                  }}
                />
                <Text color="inactive">{a.description}</Text>
              </Box>
            ))
          ) : (
            <Text>Sin coincidencias</Text>
          )}
        </Box>
      );
    },
  );
}
