export function parsePort(raw: string): number | undefined {
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    return undefined;
  }
  return port;
}
