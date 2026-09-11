import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import test from "node:test";

const SCRIPTS = resolve(import.meta.dirname, "../scripts");
const ENTRY = join(SCRIPTS, "main.mjs");
const BUILD_TOOLING = join(SCRIPTS, "dev");

// Static imports plus the one dynamic import the terminal window uses to open the
// configuration window without a circular dependency.
const SPECIFIER = /(?:from|import)\s*\(?\s*"(\.[^"]+\.mjs)"/g;

test("every shipped module is reachable from the module entry point", () => {
  const reachable = new Set();
  const queue = [ENTRY];
  while (queue.length) {
    const file = queue.pop();
    if (reachable.has(file)) continue;
    reachable.add(file);
    for (const [, specifier] of readFileSync(file, "utf8").matchAll(SPECIFIER)) {
      const target = resolve(dirname(file), specifier);
      assert.ok(existsSync(target), `${relative(SCRIPTS, file)} imports a missing ${specifier}`);
      queue.push(target);
    }
  }

  for (const file of modules(SCRIPTS)) {
    if (file.startsWith(BUILD_TOOLING)) continue;
    assert.ok(reachable.has(file), `${relative(SCRIPTS, file)} is bundled and shipped but never imported`);
  }
});

function modules(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return modules(path);
    return extname(path) === ".mjs" ? [path] : [];
  });
}
