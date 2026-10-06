import { expect, test } from "bun:test";
import { join } from "node:path";
const root = process.env.N_EIN_FLOW_COPY!;
const phase = process.env.N_EIN_FLOW_PHASE;
const { parsePort } = await import(join(root, "src/parse-port.ts"));

test("the port contract is preserved", () => {
  for (const [raw, expected] of [["0", 0], [" 42 ", 42], ["65535", 65535]] as const) expect(parsePort(raw)).toBe(expected);
  for (const raw of ["", " ", "-1", "1.1", "65536", "1e2", "0x10", "12extra"]) expect(() => parsePort(raw)).toThrow();
});
if (phase !== "parser") {
  const { formatPort } = await import(join(root, "src/format-port.ts"));
  test("the agreed presentation handles zero and ordinary ports", () => {
    expect(formatPort("0")).toBe("Port: 0 (automatic)");
    expect(formatPort(" 443 ")).toBe("Port: 443");
    expect(() => formatPort("bad")).toThrow();
  });
}
if (phase === "resume") {
  const { configurationLabel } = await import(join(root, "src/configuration-label.ts"));
  test("the resumed task reuses the settled contract", () => {
    expect(configurationLabel("0")).toBe("Listening on Port: 0 (automatic)");
    expect(configurationLabel("443")).toBe("Listening on Port: 443");
    expect(() => configurationLabel("")).toThrow();
  });
}
