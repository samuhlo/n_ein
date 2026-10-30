// [UI] ACCIONES DEL PRODUCTO
// Catálogo compartido por Pi y Claude. La disponibilidad viene del host;
// una búsqueda nunca ejecuta código ni llama a un modelo.
export type Action = {
  id: string;
  label: string;
  description: string;
  keywords: string;
  pi: string;
  claude: string;
  prepare?: boolean;
};
export const ACTIONS: readonly Action[] = [
  {
    id: "context",
    label: "Ver contexto y modelo",
    description: "Consultar el uso medido y la configuración efectiva.",
    keywords: "tokens contexto modelo esfuerzo",
    pi: "nein:contexto",
    claude: "context",
  },
  {
    id: "continue",
    label: "Continuar con contexto reducido",
    description:
      "Preparar continuación en Pi o compactación nativa en Claude. Usa el modelo.",
    keywords: "continuar retomar limpiar contexto",
    pi: "nein:continuar",
    claude: "compact",
    prepare: true,
  },
  {
    id: "state",
    label: "Ver el encargo",
    description: "Peticiones, tareas y comprobaciones vigentes.",
    keywords: "estado progreso pendiente evidencia",
    pi: "nein:estado",
    claude: "nein-estado",
  },
  {
    id: "jobs",
    label: "Ver procesos",
    description: "Comandos en curso, resultados y logs.",
    keywords: "build ci esperar trabajo segundo plano",
    pi: "nein:procesos",
    claude: "tasks",
  },
  {
    id: "sessions",
    label: "Buscar sesiones",
    description: "Encontrar trabajo por objetivo y siguiente paso.",
    keywords: "retomar continuar historial memoria",
    pi: "nein:sesiones",
    claude: "nein-sesiones",
  },
  {
    id: "open-review",
    label: "Abrir p_reviewer",
    description: "Abrir la revisión guardada; no inicia inferencia.",
    keywords: "revisor revisar resultados",
    pi: "nein:revisor",
    claude: "nein-revisor",
  },
  {
    id: "models",
    label: "Modelos y esfuerzo",
    description: "Configurar modelos por encargo y esfuerzo de Claude.",
    keywords: "modelo pensar razonamiento",
    pi: "nein:models",
    claude: "model",
  },
  {
    id: "todo",
    label: "Ver tareas",
    description: "Consultar las casillas del documento de trabajo.",
    keywords: "lista pendiente checklist",
    pi: "todo",
    claude: "nein-estado",
  },
  {
    id: "new",
    label: "Nuevo encargo",
    description: "Preparar otra petición; se envía cuando tú decidas.",
    keywords: "nuevo otra cosa empezar",
    pi: "nein:nuevo",
    claude: "",
    prepare: true,
  },
  {
    id: "intent",
    label: "Definir el encargo",
    description: "Aclarar decisiones antes de construir. Usa el modelo.",
    keywords: "pensar plan diseñar preguntas",
    pi: "skill:intent",
    claude: "intent",
    prepare: true,
  },
  {
    id: "vision",
    label: "Dar forma a una idea",
    description: "Explorar alcance y bocetos. Usa el modelo.",
    keywords: "idea diseño pantallas",
    pi: "skill:vision",
    claude: "vision",
    prepare: true,
  },
  {
    id: "review",
    label: "Revisar lo pedido",
    description: "Contrastar cambios con el encargo. Usa el modelo.",
    keywords: "review calidad revisar",
    pi: "skill:review",
    claude: "review",
    prepare: true,
  },
  {
    id: "previewer",
    label: "Revisar con p_reviewer",
    description: "Preparar una revisión nueva: consume modelo y minutos.",
    keywords: "fallos bugs revisor revisar",
    pi: "skill:previewer",
    claude: "previewer",
    prepare: true,
  },
  {
    id: "design",
    label: "Ver diseños",
    description: "Variantes, comentarios y comparación con la aplicación.",
    keywords: "visual boceto pantallas prototipo",
    pi: "nein:disenos",
    claude: "nein-disenos",
  },
  {
    id: "diagnose",
    label: "Diagnosticar un fallo",
    description: "Investigar una causa con evidencia. Usa el modelo.",
    keywords: "error bug roto problema",
    pi: "skill:diagnose",
    claude: "diagnose",
    prepare: true,
  },
  {
    id: "handoff",
    label: "Continuar en otro runtime",
    description: "Preparar el relevo conservando decisiones y pendiente.",
    keywords: "claude pi relevo cambiar",
    pi: "handoff",
    claude: "to-pi",
    prepare: true,
  },
];
export const fold = (text: string) =>
  text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
export function actionsFor(
  host: "pi" | "claude",
  registered: readonly string[],
  query = "",
): Action[] {
  const names = new Set(registered.map((n) => n.replace(/^\//, "")));
  const words = fold(query).trim().split(/\s+/).filter(Boolean);
  return ACTIONS.filter(
    (a) =>
      ((a.id === "new" && host === "claude") || names.has(a[host])) &&
      words.every((w) =>
        fold(`${a.label} ${a.description} ${a.keywords} ${a[host]}`).includes(
          w,
        ),
      ),
  );
}
export function actionDraft(
  a: Action,
  host: "pi" | "claude",
  draft: string,
): string {
  const prefix =
    a.id === "new" && host === "claude"
      ? "Otro encargo: "
      : a.id === "handoff" && host === "pi"
        ? "/handoff claude"
        : `/${a[host]} `;
  return `${prefix}${draft ? `\n${draft}` : ""}`;
}
