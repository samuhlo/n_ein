import { parsePort } from "./parse-port.ts";

export function formatPort(raw: string): string {
  return `Port: ${parsePort(raw) || 3000}`;
}
