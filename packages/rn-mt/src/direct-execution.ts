import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

function resolvePath(path: string) {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

export function isDirectCliExecution(moduleUrl: string, argvPath?: string) {
  if (!argvPath) {
    return false;
  }

  return resolvePath(fileURLToPath(moduleUrl)) === resolvePath(argvPath);
}
