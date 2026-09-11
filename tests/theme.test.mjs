import assert from "node:assert/strict";
import test from "node:test";
import { ThemeRegistry } from "../scripts/themes/theme-registry.mjs";
import { resolveTheme, themeClasses, themeToStyle } from "../scripts/themes/theme-resolver.mjs";

test("theme overrides merge without mutating presets", () => {
  ThemeRegistry.initialize();
  const theme = resolveTheme({ terminalThemeId: "green-crt", terminalOverrides: { colors: { foreground: "#ffffff" } } });
  assert.equal(theme.colors.foreground, "#ffffff");
  assert.notEqual(ThemeRegistry.get("green-crt").colors.foreground, "#ffffff");
  assert.match(themeToStyle(theme), /--terminal-fg:#ffffff/);
  assert.match(themeClasses(theme), /fx-scanlines/);
});

test("client effects switch disables every effect", () => {
  ThemeRegistry.initialize();
  const theme = resolveTheme({ terminalThemeId: "vhs-security", effectsEnabled: false });
  assert.equal(Object.values(theme.effects).every(effect => effect.enabled === false), true);
  assert.equal(themeClasses(theme), "");
});
