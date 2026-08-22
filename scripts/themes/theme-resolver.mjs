import { ThemeRegistry } from "./theme-registry.mjs";

export function resolveTheme({ worldThemeId = "green-crt", terminalThemeId = "", pageThemeId = "", terminalOverrides = {}, effectsEnabled = true } = {}) {
  const theme = ThemeRegistry.get(pageThemeId || terminalThemeId || worldThemeId || "green-crt");
  const resolved = pageThemeId ? theme : mergeTheme(theme, terminalOverrides);
  if (!effectsEnabled && resolved) {
    for (const effect of Object.values(resolved.effects ?? {})) effect.enabled = false;
  }
  return resolved;
}

export function mergeTheme(base, overrides) {
  if (!base) return null;
  const output = structuredClone(base);
  mergeInto(output, overrides ?? {});
  return output;
}

function mergeInto(target, source) {
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      target[key] ??= {};
      mergeInto(target[key], value);
    } else if (value !== undefined) target[key] = value;
  }
}

export function themeToStyle(theme) {
  if (!theme) return "";
  const typography = theme.typography ?? {};
  const colors = theme.colors ?? {};
  const effects = theme.effects ?? {};
  const variable = (name, value) => value === undefined ? "" : `${name}:${value}`;
  return [
    variable("--terminal-font", JSON.stringify(typography.font ?? "monospace")),
    variable("--terminal-font-size", `${typography.size ?? 20}px`),
    variable("--terminal-line-height", typography.lineHeight ?? 1.35),
    variable("--terminal-letter-spacing", `${typography.letterSpacing ?? 1}px`),
    variable("--terminal-text-transform", typography.uppercase ? "uppercase" : "none"),
    variable("--terminal-bg", colors.background),
    variable("--terminal-fg", colors.foreground),
    variable("--terminal-muted", colors.muted),
    variable("--terminal-highlight", colors.highlight),
    variable("--terminal-border", colors.border),
    variable("--terminal-error", colors.error),
    variable("--fx-scanline-opacity", effects.scanlines?.opacity ?? 0),
    variable("--fx-scanline-size", `${effects.scanlines?.size ?? 3}px`),
    variable("--fx-glow-strength", effects.glow?.strength ?? 0),
    variable("--fx-flicker-strength", effects.flicker?.strength ?? 0),
    variable("--fx-flicker-speed", `${Math.max(1000, (effects.flicker?.speed ?? 140) * 20)}ms`),
    variable("--fx-noise-strength", effects.noise?.strength ?? 0),
    variable("--fx-vhs-tracking", effects.vhs?.tracking ?? 0),
    variable("--fx-vhs-jitter", `${effects.vhs?.jitter ?? 0}px`),
    variable("--fx-chromatic-offset", `${effects.vhs?.chromaticOffset ?? 0}px`),
    variable("--fx-curvature", effects.curvature?.strength ?? 0)
  ].filter(Boolean).join(";");
}

export function themeClasses(theme) {
  const effects = theme?.effects ?? {};
  return [
    effects.scanlines?.enabled && "fx-scanlines",
    effects.glow?.enabled && "fx-glow",
    effects.flicker?.enabled && "fx-flicker",
    effects.noise?.enabled && "fx-noise",
    effects.vhs?.enabled && "fx-vhs",
    effects.curvature?.enabled && "fx-curvature"
  ].filter(Boolean).join(" ");
}
