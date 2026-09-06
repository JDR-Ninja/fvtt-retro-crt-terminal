import { MODULE_ID } from "../constants.mjs";
import { GOOGLE_FONT_DEFINITIONS } from "./google-fonts.mjs";

/**
 * Declares the curated terminal fonts in CONFIG.fontDefinitions during init, so
 * Foundry loads them during its own font pass and also offers them in its font
 * pickers. A family the world already declares is left untouched: a GM who added
 * their own copy under Configure Settings → Fonts keeps theirs.
 * @returns {string[]} The families this call added.
 */
export function registerGoogleFonts(config = globalThis.CONFIG) {
  if (!config) return [];
  config.fontDefinitions ??= {};
  const added = [];
  for (const [family, definition] of Object.entries(GOOGLE_FONT_DEFINITIONS)) {
    if (config.fontDefinitions[family]) continue;
    config.fontDefinitions[family] = structuredClone(definition);
    added.push(family);
  }
  return added;
}

/**
 * Foundry runs its font pass from initializeCanvas(), so a world with the canvas
 * disabled would never load these. Loading whatever is still missing at ready keeps
 * the themes legible there too. FontConfig.loadFont reports its own failures and
 * resolves false rather than throwing, so an offline world simply falls back to the
 * `monospace` tail of the CSS font stack.
 * @returns {Promise<string[]>} The families that loaded.
 */
export async function loadMissingGoogleFonts() {
  const FontConfig = globalThis.foundry?.applications?.settings?.menus?.FontConfig;
  if (!FontConfig) return [];
  const pending = Object.entries(GOOGLE_FONT_DEFINITIONS)
    .filter(([family]) => !FontConfig.getAvailableFonts().includes(family));
  const loaded = await Promise.all(pending.map(([family, definition]) => FontConfig.loadFont(family, definition)));
  const failed = pending.filter((_entry, index) => !loaded[index]).map(([family]) => family);
  if (failed.length) console.warn(`${MODULE_ID} | Falling back to monospace, fonts unreachable: ${failed.join(", ")}`);
  return pending.filter((_entry, index) => loaded[index]).map(([family]) => family);
}
