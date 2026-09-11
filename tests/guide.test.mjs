import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { GUIDE_DOCUMENT_IDS, GUIDE_PACK_ID, GUIDE_PAGE_IDS, openGamemasterGuide } from "../scripts/guide/gamemaster-guide.mjs";

// The example module builds the demo from a private constant, so the guides are
// compared against its source rather than against a second hand-copied literal.
const EXAMPLE_SOURCE = await readFile(new URL("../scripts/examples/security-console-example.mjs", import.meta.url), "utf8");
const DEMO_PASSWORD = EXAMPLE_SOURCE.match(/const PASSWORD = "([^"]+)"/)?.[1];
const PASSWORD_SHAPE = /[A-Z][A-Z0-9]{2,}-[0-9]{2,}/g;

test("both guides quote the password the demo terminal actually accepts", async () => {
  assert.ok(DEMO_PASSWORD, "the demo password could not be read from the example module");
  for (const language of ["en", "fr"]) {
    const guide = await readFile(new URL(`../packs-src/gm-guide/guide-${language}.json`, import.meta.url), "utf8");
    const quoted = [...guide.matchAll(PASSWORD_SHAPE)].map(match => match[0]);
    assert.ok(quoted.length >= 3, `guide-${language} should walk the reader through the archive password`);
    for (const secret of quoted) {
      assert.equal(secret, DEMO_PASSWORD, `guide-${language} tells the Gamemaster to type ${secret}`);
    }
  }
});

// Foundry v14 renders every <code> as a nowrap inline chip, which folds a multi-line markup
// sample onto one line: "::menu children ::end" no longer shows the reader where lines break.
test("every markup sample in the guides keeps its line breaks under Foundry's inline code styling", async () => {
  const stylesheet = await readFile(new URL("../styles/retro-crt-terminal.css", import.meta.url), "utf8");
  const rule = stylesheet.match(/\.rct-code\s*>\s*code\s*\{([^}]*)\}/);
  assert.ok(rule, "the stylesheet must style the guide's code samples");
  assert.match(rule[1], /white-space:\s*(?!nowrap)/, "the sample's <code> must not inherit Foundry's nowrap");

  for (const language of ["en", "fr"]) {
    const guide = JSON.parse(await readFile(new URL(`../packs-src/gm-guide/guide-${language}.json`, import.meta.url), "utf8"));
    const blocks = guide.pages.flatMap(page => page.text?.content?.match(/<pre\b[^>]*>/g) ?? []);
    assert.ok(blocks.length >= 5, `guide-${language} should carry multi-line markup samples`);
    for (const block of blocks) assert.match(block, /class="rct-code"/, `guide-${language}: ${block} is unstyled`);
    const samples = guide.pages.flatMap(page => page.text?.content?.match(/<pre class="rct-code"><code>[\s\S]*?<\/code>/g) ?? []);
    assert.ok(samples.every(sample => sample.includes("\n")), `guide-${language}: a sample lost its line breaks`);
  }
});

test("the localized Gamemaster Guide opens directly to a requested section", async () => {
  let requestedDocument;
  let renderOptions;
  const guide = { sheet: { render: async options => { renderOptions = options; } } };
  globalThis.game = {
    user: { isGM: true },
    i18n: { lang: "fr-CA", localize: key => key },
    packs: new Map([[GUIDE_PACK_ID, {
      getDocument: async id => {
        requestedDocument = id;
        return guide;
      }
    }]])
  };
  globalThis.ui = { notifications: { warn: () => {} } };

  const result = await openGamemasterGuide("synchronization");
  assert.equal(result, guide);
  assert.equal(requestedDocument, GUIDE_DOCUMENT_IDS.fr);
  assert.equal(renderOptions.pageId, GUIDE_PAGE_IDS.synchronization);
  assert.equal(renderOptions.force, true);
});

test("the Gamemaster Guide is not exposed through its API to players", async () => {
  game.user.isGM = false;
  assert.equal(await openGamemasterGuide(), false);
});
