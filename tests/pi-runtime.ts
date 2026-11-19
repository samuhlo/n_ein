// [CHECK] Pi gestionado de la versión que fija runtime.json; N_EIN_PI_BIN lo sustituye.
import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dir, "..");
export const piVersion: string = JSON.parse(readFileSync(join(root, "runtime.json"), "utf8")).pi.version;
export const piRuntime = join(process.env.N_EIN_HOME || join(homedir(), ".n_ein"), "runtimes/pi", piVersion);
export const piBinary = process.env.N_EIN_PI_BIN || join(piRuntime, "bin/pi");
