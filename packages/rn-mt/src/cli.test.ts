import { mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import { describe, expect, it } from "vitest";

import { isDirectCliExecution } from "./direct-execution";

describe("public cli entrypoint", () => {
  it("detects direct npm bin execution through a symlink", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "rn-mt-public-cli-"));
    const targetPath = join(tempDir, "dist-cli.js");
    const binPath = join(tempDir, "rn-mt");

    try {
      writeFileSync(targetPath, "#!/usr/bin/env node\n");
      symlinkSync(targetPath, binPath);

      expect(
        isDirectCliExecution(pathToFileURL(targetPath).href, binPath),
      ).toBe(true);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("does not run when imported as a module", () => {
    const moduleUrl = pathToFileURL("/tmp/rn-mt/dist/cli.js").href;

    expect(isDirectCliExecution(moduleUrl)).toBe(false);
    expect(isDirectCliExecution(moduleUrl, "/tmp/other.js")).toBe(false);
  });
});
