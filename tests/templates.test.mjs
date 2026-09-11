import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { DEFAULT_TERMINAL_CONFIG, FLAG_SCOPE, TERMINAL_FLAG } from "../scripts/constants.mjs";
import { ThemeRegistry } from "../scripts/themes/theme-registry.mjs";

const PACK_SOURCE = new URL("../packs-src/gm-guide/", import.meta.url);

const templates = [];
for (const directory of ["templates-en", "templates-fr"]) {
  for (const file of await readdir(new URL(directory, PACK_SOURCE))) {
    const journal = JSON.parse(await readFile(new URL(`${directory}/${file}`, PACK_SOURCE), "utf8"));
    if (journal._key?.startsWith("!journal!")) templates.push({ file: `${directory}/${file}`, journal });
  }
}
assert.ok(templates.length >= 6, "both template folders should be populated");

// An unknown id silently falls back to the green preset, so a template asking for a theme
// the registry does not know would ship looking nothing like its description.
test("every Compendium template names a theme the registry knows", () => {
  ThemeRegistry.initialize();
  for (const { file, journal } of templates) {
    const config = journal.flags?.[FLAG_SCOPE]?.[TERMINAL_FLAG];
    assert.ok(ThemeRegistry.has(config?.themeId), `${file} uses the unknown theme "${config?.themeId}"`);
    for (const page of journal.pages ?? []) {
      const override = page.system?.presentation?.themeOverride;
      if (override) assert.ok(ThemeRegistry.has(override), `${file}: page "${page.name}" overrides with the unknown theme "${override}"`);
    }
  }
});

// A key the module never reads is dropped on the first save and misleads anyone reading
// the template as documentation of what can be configured.
test("every Compendium template only stores configuration the module reads", () => {
  for (const { file, journal } of templates) {
    const config = journal.flags?.[FLAG_SCOPE]?.[TERMINAL_FLAG] ?? {};
    for (const key of Object.keys(config)) {
      assert.ok(key in DEFAULT_TERMINAL_CONFIG, `${file} stores the unread terminal key "${key}"`);
    }
    for (const group of ["launcher", "behavior"]) {
      for (const key of Object.keys(config[group] ?? {})) {
        assert.ok(key in DEFAULT_TERMINAL_CONFIG[group], `${file} stores the unread key "${group}.${key}"`);
      }
    }
  }
});
