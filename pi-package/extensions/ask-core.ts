// =============================================================================
// [CORE] PREGUNTAS CON OPCIONES
// nein_ask recoge decisiones cerradas: de 1 a 4 preguntas con 2 a 4 opciones, una recomendada si
// el agente la tiene y «Otra respuesta» siempre al final. Las preguntas abiertas siguen en texto.
// La lista se ve en castellano, como el resto de Pi; las respuestas vuelven al modelo en inglés.
// =============================================================================

export type AskOption = { label: string; description?: string };
export type AskQuestion = { question: string; options: AskOption[]; recommended?: number };
export type AskAnswer = { kind: "option"; label: string } | { kind: "other"; text: string } | { kind: "none" };

export const OTHER = "Otra respuesta";
export const NO_UI =
  "This session has no interactive UI. Ask these questions in your reply as text, with your recommendation, and wait for the user's answer.";

/** Lo que impide mostrar las preguntas como decisiones cerradas, para que el modelo lo corrija. */
export function askProblem(questions: readonly AskQuestion[]): string | undefined {
  if (questions.length < 1 || questions.length > 4) return "Ask 1-4 questions per call.";
  for (const [index, question] of questions.entries()) {
    const at = `Question ${index + 1}:`;
    if (!question.question.trim()) return `${at} the question is empty.`;
    if (question.options.length < 2 || question.options.length > 4) return `${at} give 2-4 options; ask open questions in text.`;
    const labels = question.options.map((option) => option.label.trim().toLowerCase());
    if (labels.some((label) => !label)) return `${at} an option label is empty.`;
    if (new Set(labels).size !== labels.length) return `${at} options need distinct labels.`;
    if (labels.includes(OTHER.toLowerCase())) return `${at} "${OTHER}" is reserved; the user always has it.`;
    const { recommended } = question;
    if (recommended !== undefined && (!Number.isInteger(recommended) || recommended < 0 || recommended >= question.options.length))
      return `${at} recommended must be the index of one of its options.`;
  }
  return undefined;
}

function choice(option: AskOption, recommended: boolean): string {
  return option.label + (recommended ? " (recomendada)" : "") + (option.description ? ` — ${option.description}` : "");
}

export function choicesFor(question: AskQuestion): string[] {
  return [...question.options.map((option, index) => choice(option, index === question.recommended)), OTHER];
}

/** La opción elegida en la lista; `other` pide el texto aparte y `none` es Esc. */
export function answerFor(question: AskQuestion, selected: string | undefined): AskAnswer | { kind: "other" } {
  if (selected === undefined) return { kind: "none" };
  if (selected === OTHER) return { kind: "other" };
  const index = choicesFor(question).indexOf(selected);
  const option = question.options[index];
  return option ? { kind: "option", label: option.label } : { kind: "none" };
}

export function formatAnswers(questions: readonly AskQuestion[], answers: readonly AskAnswer[]): string {
  return questions.map((question, index) => {
    const answer = answers[index] ?? { kind: "none" };
    const given = answer.kind === "option" ? answer.label
      : answer.kind === "other" ? `other answer: ${JSON.stringify(answer.text)}`
      : "no answer: the user dismissed it. Do not assume one.";
    return `${index + 1}. ${question.question} → ${given}`;
  }).join("\n");
}
