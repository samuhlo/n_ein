import { expect, test } from "bun:test";
import { join } from "node:path";

const root = process.env.N_EIN_CONTINUITY_COPY!;
const { parsePort } = await import(join(root, "src/parse-port.ts"));
const { formatPort } = await import(join(root, "src/format-port.ts"));
const { configurationLabel } = await import(join(root, "src/configuration-label.ts"));

test("all valid boundaries preserve their value", () => {
  for (const [raw, port] of [["0", 0], [" 0 ", 0], ["1", 1], ["0042", 42], ["65535", 65535]] as const) expect(parsePort(raw)).toBe(port);
});
test("malformed values never become ports", () => {
  for (const raw of ["", " ", "-1", "1.2", "42suffix", "65536", "Infinity", "0x10", "1e2"]) expect(() => parsePort(raw)).toThrow();
});
test("the second runtime retains the zero decision", () => {
  expect(formatPort("0")).toBe("Port: 0 (automatic)");
  expect(formatPort("443")).toBe("Port: 443");
  expect(() => formatPort("bad")).toThrow();
});
test("the returning runtime reuses the contract", () => {
  expect(configurationLabel("0")).toBe("Listening on Port: 0 (automatic)");
  expect(configurationLabel("443")).toBe("Listening on Port: 443");
  expect(() => configurationLabel("")).toThrow();
});
