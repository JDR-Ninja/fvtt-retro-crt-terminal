import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const SHOT_DIR = new URL("assets/screenshots/", ROOT);
const FOUNDRY_PREFIX = "modules/retro-crt-terminal/assets/screenshots/";

const files = new Set(await readdir(SHOT_DIR));

test("every screenshot the README links to exists", async () => {
  const readme = await readFile(new URL("README.md", ROOT), "utf8");
  const referenced = [...readme.matchAll(/\]\(assets\/screenshots\/([\w.-]+)\)/g)].map(m => m[1]);

  assert.ok(referenced.length >= 8, `expected the README to be illustrated, found ${referenced.length} images`);
  for (const file of referenced) assert.ok(files.has(file), `README links to a missing ${file}`);
});

test("every README screenshot carries alternative text", async () => {
  const readme = await readFile(new URL("README.md", ROOT), "utf8");
  for (const [, alt, file] of readme.matchAll(/!\[([^\]]*)\]\(assets\/screenshots\/([\w.-]+)\)/g)) {
    assert.ok(alt.trim().length > 20, `${file} needs descriptive alt text, got "${alt}"`);
  }
});

test("every screenshot the guides embed resolves to a real module path", async () => {
  for (const language of ["en", "fr"]) {
    const guide = JSON.parse(await readFile(new URL(`packs-src/gm-guide/guide-${language}.json`, ROOT), "utf8"));
    const html = guide.pages.map(page => page.text?.content ?? "").join("");
    const embedded = [...html.matchAll(/<img src="([^"]+)" alt="([^"]*)"/g)];

    assert.ok(embedded.length >= 6, `guide-${language} should be illustrated, found ${embedded.length} images`);
    for (const [, src, alt] of embedded) {
      assert.ok(src.startsWith(FOUNDRY_PREFIX), `guide-${language} uses a non-module path: ${src}`);
      assert.ok(files.has(src.slice(FOUNDRY_PREFIX.length)), `guide-${language} embeds a missing ${src}`);
      assert.ok(alt.trim().length > 20, `guide-${language}: ${src} needs descriptive alt text`);
    }
  }
});

test("no screenshot is shipped without being referenced anywhere", async () => {
  const readme = await readFile(new URL("README.md", ROOT), "utf8");
  const guides = await Promise.all(["en", "fr"].map(language =>
    readFile(new URL(`packs-src/gm-guide/guide-${language}.json`, ROOT), "utf8")));
  const corpus = [readme, ...guides].join("");

  for (const file of files) assert.ok(corpus.includes(file), `${file} is shipped but never referenced`);
});
