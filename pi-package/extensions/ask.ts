// [UI] PREGUNTAS CON OPCIONES EN PI
// Pi no trae herramienta de preguntas, solo los diálogos de las extensiones: nein_ask los usa para
// que el agente recoja decisiones cerradas como hace Claude con AskUserQuestion.
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { NO_UI, OTHER, answerFor, askProblem, choicesFor, formatAnswers, type AskAnswer } from "./ask-core.ts";

const option = Type.Object({ label: Type.String(), description: Type.Optional(Type.String()) });
const question = Type.Object({
  question: Type.String(),
  options: Type.Array(option, { minItems: 2, maxItems: 4 }),
  recommended: Type.Optional(Type.Integer({ description: "Index of your recommended option" })),
});

// BLINDAJE -> Nombre, descripción y parámetros viajan en cada turno: tests/ask.ts los limita a 1.200 bytes.
export const ASK_TOOL = {
  name: "nein_ask",
  description:
    "Ask the user 1-4 decisions that are genuinely theirs, each with 2-4 closed options and your recommendation when you have one; they can always type another answer. Ask open questions and explanations in text. Returns each answer, or that the user dismissed it.",
  parameters: Type.Object({ questions: Type.Array(question, { minItems: 1, maxItems: 4 }) }),
};

export default function (pi: ExtensionAPI): void {
  pi.registerTool({
    ...ASK_TOOL,
    label: "Pregunta",
    async execute(_id, params, signal, _update, ctx) {
      const problem = askProblem(params.questions);
      if (problem) return { isError: true, content: [{ type: "text", text: problem }], details: undefined };
      if (!ctx.hasUI) return { content: [{ type: "text", text: NO_UI }], details: { answered: 0 } };
      const answers: AskAnswer[] = [];
      for (const current of params.questions) {
        let answer = answerFor(current, await ctx.ui.select(current.question, choicesFor(current), { signal }));
        if (answer.kind === "other") {
          const text = (await ctx.ui.input(current.question, OTHER, { signal }))?.trim();
          answer = text ? { kind: "other", text } : { kind: "none" };
        }
        answers.push(answer);
        // Esc cierra todas: las siguientes quedan sin respuesta, sin seguir preguntando.
        if (answer.kind === "none") break;
      }
      const answered = answers.filter((answer) => answer.kind !== "none").length;
      return { content: [{ type: "text", text: formatAnswers(params.questions, answers) }], details: { answered } };
    },
  });
}
