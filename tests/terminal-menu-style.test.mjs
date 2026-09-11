import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("menu selection is instantaneous and hidden while typewriter text is pending", async () => {
  const css = await readFile(new URL("../styles/retro-crt-terminal.css", import.meta.url), "utf8");

  assert.match(css, /\.terminal-menu-item\s*\{[^}]*transition:\s*none;/s);
  assert.match(css, /\.terminal-screen\.is-typing \.terminal-menu-item\.is-selected\s*\{[^}]*background:\s*transparent;/s);
});
