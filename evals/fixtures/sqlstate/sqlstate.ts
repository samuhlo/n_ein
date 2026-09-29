export function findSqlState(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  if ("sqlState" in error && typeof error.sqlState === "string") return error.sqlState;
  return undefined;
}
