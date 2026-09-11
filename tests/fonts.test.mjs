import assert from "node:assert/strict";
import test from "node:test";
import { CURATED_FONTS, THEME_PRESETS } from "../scripts/themes/presets.mjs";
import { GOOGLE_FONT_DEFINITIONS } from "../scripts/themes/google-fonts.mjs";
import { loadMissingGoogleFonts, registerGoogleFonts } from "../scripts/themes/font-loader.mjs";

test("every offered font is declared, so the picker never lists an unloadable family", () => {
  for (const family of CURATED_FONTS) {
    assert.ok(GOOGLE_FONT_DEFINITIONS[family], `${family} has no Google Fonts definition`);
  }
  for (const preset of THEME_PRESETS) {
    assert.ok(GOOGLE_FONT_DEFINITIONS[preset.typography.font], `${preset.id} uses an undeclared font`);
  }
});

test("each face declares exactly one reachable woff2", () => {
  for (const [family, definition] of Object.entries(GOOGLE_FONT_DEFINITIONS)) {
    assert.equal(definition.editor, true, `${family} must be offered in Foundry font pickers`);
    assert.ok(definition.fonts.length, `${family} declares no face`);
    for (const face of definition.fonts) {
      // FontConfig._createFontFace returns null unless `urls` is an array, and it joins
      // the entries into one FontFace source list — so a second URL would shadow the
      // first as an alternative source rather than add a subset.
      assert.ok(Array.isArray(face.urls), `${family} face is missing a urls array`);
      assert.equal(face.urls.length, 1, `${family} face must declare a single source`);
      assert.match(face.urls[0], /^https:\/\/fonts\.gstatic\.com\/.+\.woff2$/);
      assert.match(face.weight, /^\d{3}( \d{3})?$/, `${family} face has an invalid weight`);
    }
  }
});

test("registration fills a bare CONFIG but never overrides a font the world already defines", () => {
  const config = {};
  const added = registerGoogleFonts(config);
  assert.equal(added.length, Object.keys(GOOGLE_FONT_DEFINITIONS).length);
  assert.deepEqual(config.fontDefinitions.VT323, GOOGLE_FONT_DEFINITIONS.VT323);
  assert.notEqual(config.fontDefinitions.VT323, GOOGLE_FONT_DEFINITIONS.VT323, "definitions must be cloned");

  const custom = { editor: true, fonts: [{ urls: ["fonts/local.woff2"], weight: "400" }] };
  const owned = { fontDefinitions: { VT323: custom } };
  assert.equal(registerGoogleFonts(owned).includes("VT323"), false);
  assert.equal(owned.fontDefinitions.VT323, custom);
});

test("a font the world already loaded is not requested twice, and an unreachable one is reported", async t => {
  const requested = [];
  const previousFoundry = globalThis.foundry;
  t.after(() => { globalThis.foundry = previousFoundry; });
  globalThis.foundry = {
    applications: {
      settings: {
        menus: {
          FontConfig: {
            getAvailableFonts: () => ["VT323"],
            loadFont: async family => {
              requested.push(family);
              return family !== "Rajdhani";
            }
          }
        }
      }
    }
  };

  const loaded = await loadMissingGoogleFonts();
  assert.equal(requested.includes("VT323"), false, "an available font must not be reloaded");
  assert.equal(requested.length, Object.keys(GOOGLE_FONT_DEFINITIONS).length - 1);
  assert.equal(loaded.includes("Rajdhani"), false, "a failed font must not be reported as loaded");
  assert.equal(loaded.includes("Roboto Mono"), true);
});

test("loading is skipped without throwing when the Foundry font API is absent", async t => {
  const previousFoundry = globalThis.foundry;
  t.after(() => { globalThis.foundry = previousFoundry; });
  globalThis.foundry = undefined;
  assert.deepEqual(await loadMissingGoogleFonts(), []);
  assert.deepEqual(registerGoogleFonts(null), []);
});
