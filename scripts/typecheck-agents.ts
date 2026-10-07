// [CHECK] Comprueba el nuevo borde contra el SDK de Pi realmente fijado.
// Las herramientas de tipos son temporales: no entran en el paquete distribuido.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
const root = resolve(import.meta.dir, "..");
const version = JSON.parse(readFileSync(join(root, "runtime.json"), "utf8")).pi
  .version;
const modules = join(
  process.env.N_EIN_HOME || join(homedir(), ".n_ein"),
  "runtimes/pi",
  version,
  "global/node_modules",
);
const actual = JSON.parse(
  readFileSync(
    join(modules, "@earendil-works/pi-coding-agent/package.json"),
    "utf8",
  ),
).version;
if (actual !== version)
  throw new Error(`Expected Pi ${version}, found ${actual}`);
const area = mkdtempSync(join(tmpdir(), "nein-agent-types-"));
try {
  execFileSync(
    "bun",
    [
      "add",
      "--cwd",
      area,
      "--exact",
      "--dev",
      "typescript@5.9.3",
      "@types/bun@1.3.14",
    ],
    { stdio: "pipe" },
  );
  const paths = Object.fromEntries(
    [
      "@earendil-works/pi-coding-agent",
      "@earendil-works/pi-ai",
      "@earendil-works/pi-tui",
    ].map((name) => [name, [join(modules, name, "dist/index.d.ts")]]),
  );
  paths.typebox = [join(root, "node_modules/typebox")];
  writeFileSync(
    join(area, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2023",
        module: "Preserve",
        moduleResolution: "Bundler",
        allowImportingTsExtensions: true,
        noEmit: true,
        strict: true,
        skipLibCheck: true,
        types: ["bun"],
        typeRoots: [join(area, "node_modules/@types")],
        paths,
      },
      include: [
        join(root, "pi-package/agents/*.ts"),
        join(root, "pi-package/extensions/team.ts"),
        join(root, "pi-package/extensions/handoff.ts"),
        join(root, "pi-package/extensions/router.ts"),
        join(root, "pi-package/extensions/receipts.ts"),
        join(root, "pi-package/extensions/tools-view.ts"),
      ],
    }),
  );
  execFileSync(
    join(area, "node_modules/.bin/tsc"),
    ["-p", join(area, "tsconfig.json")],
    { stdio: "inherit" },
  );
  console.log(`agent types against Pi ${version}: OK`);
} finally {
  rmSync(area, { recursive: true, force: true });
}
