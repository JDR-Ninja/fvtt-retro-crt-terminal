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

// A client that joins over plain HTTP, at an address other than localhost, is outside a secure
// context: crypto has no randomUUID() and navigator no clipboard. The terminal window threw before
// it could open (issue #1), and the configuration window's copy buttons before they copied anything.
const SECURE_CONTEXT_ONLY = [
  { api: "randomUUID", pattern: /\.randomUUID\b/, instead: "randomId() from utils/random-id.mjs" },
  { api: "navigator.clipboard", pattern: /\bnavigator\.clipboard\b/, instead: "game.clipboard.copyPlainText()" }
];

test("no shipped module reaches for an API that only a secure context exposes", () => {
  for (const file of modules(SCRIPTS)) {
    if (file.startsWith(BUILD_TOOLING)) continue;
    const source = readFileSync(file, "utf8");
    for (const { api, pattern, instead } of SECURE_CONTEXT_ONLY) {
      assert.doesNotMatch(source, pattern, `${relative(SCRIPTS, file)} uses ${api}, which only a secure context exposes; use ${instead}`);
    }
  }
});

function modules(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return modules(path);
    return extname(path) === ".mjs" ? [path] : [];
  });
}
