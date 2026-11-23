// Running the repo's CLI scripts (scripts/*.mjs) with the same Node as the server.
import path from "node:path";
import { ROOT } from "./paths.mjs";

export const node = process.execPath;
export const script = (...p) => path.join(ROOT, "scripts", ...p);
