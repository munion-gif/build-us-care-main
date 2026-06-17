import { rmSync } from "node:fs";
import { resolve } from "node:path";

const workspace = process.cwd();
const target = resolve(workspace, ".next");

if (!target.startsWith(workspace)) {
  throw new Error(`Refusing to remove a path outside the workspace: ${target}`);
}

rmSync(target, { recursive: true, force: true });
