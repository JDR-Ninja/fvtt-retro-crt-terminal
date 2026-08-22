import { THEME_PRESETS } from "./presets.mjs";

export class ThemeRegistry {
  static #themes = new Map();

  static initialize() {
    this.#themes.clear();
    for (const theme of THEME_PRESETS) this.register(theme);
  }

  static register(theme) {
    if (!theme?.id) throw new Error("Theme definitions require an id");
    this.#themes.set(theme.id, structuredClone(theme));
  }

  static get(id) {
    const theme = this.#themes.get(id) ?? this.#themes.get("green-crt");
    return theme ? structuredClone(theme) : null;
  }

  static has(id) {
    return this.#themes.has(id);
  }

  static list() {
    return [...this.#themes.values()].map(theme => structuredClone(theme));
  }
}
