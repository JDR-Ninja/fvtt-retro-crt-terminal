import { MODULE_ID } from "../constants.mjs";
import { getTerminalConfig, setTerminalConfig } from "../data/terminal-config.mjs";
import { CURATED_FONTS } from "../themes/presets.mjs";
import { ThemeRegistry } from "../themes/theme-registry.mjs";
import { resolveTheme } from "../themes/theme-resolver.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class TerminalThemeEditorApplication extends HandlebarsApplicationMixin(ApplicationV2) {
  static HELP_SECTION = "themes";
  static DEFAULT_OPTIONS = {
    classes: ["retro-crt-terminal", "terminal-theme-editor"],
    tag: "form",
    position: { width: 700, height: 760 },
    window: { title: "RETRO_CRT_TERMINAL.ThemeEditor.Title", icon: "fa-solid fa-palette", resizable: true },
    form: { handler: TerminalThemeEditorApplication.onSubmit, closeOnSubmit: false },
    actions: { loadPreset: TerminalThemeEditorApplication.onLoadPreset }
  };

  static PARTS = { form: { template: `modules/${MODULE_ID}/templates/terminal-theme-editor.hbs` } };

  constructor({ journal }) {
    super({ id: `${MODULE_ID}-theme-${journal.id}` });
    this.journal = journal;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const config = getTerminalConfig(this.journal);
    const theme = resolveTheme({ terminalThemeId: config.themeId, terminalOverrides: config.themeOverrides });
    return {
      ...context,
      config,
      theme,
      themes: ThemeRegistry.list().map(item => ({ ...item, selected: item.id === config.themeId })),
      fonts: CURATED_FONTS.map(font => ({ name: font, selected: font === theme.typography.font })),
      editable: this.journal.isOwner
    };
  }

  static async onSubmit(_event, _form, formData) {
    const data = formData.object;
    const overrides = {
      typography: {
        font: data.font,
        size: clampNumber(data.fontSize, 10, 72, 20),
        lineHeight: clampNumber(data.lineHeight, 0.8, 3, 1.35),
        letterSpacing: clampNumber(data.letterSpacing, -2, 12, 1),
        uppercase: Boolean(data.uppercase)
      },
      colors: {
        foreground: data.foreground,
        background: data.background,
        muted: data.muted,
        highlight: data.highlight,
        border: data.border,
        error: data.error
      },
      effects: {
        scanlines: { enabled: Boolean(data.scanlinesEnabled), opacity: clampNumber(data.scanlineOpacity, 0, 1, 0.14), size: clampNumber(data.scanlineSize, 1, 10, 3) },
        glow: { enabled: Boolean(data.glowEnabled), strength: clampNumber(data.glowStrength, 0, 1, 0.35) },
        flicker: { enabled: Boolean(data.flickerEnabled), strength: clampNumber(data.flickerStrength, 0, 0.4, 0.03), speed: clampNumber(data.flickerSpeed, 20, 1000, 140) },
        noise: { enabled: Boolean(data.noiseEnabled), strength: clampNumber(data.noiseStrength, 0, 0.4, 0.04) },
        vhs: { enabled: Boolean(data.vhsEnabled), tracking: clampNumber(data.vhsTracking, 0, 1, 0), jitter: clampNumber(data.vhsJitter, 0, 8, 0), chromaticOffset: clampNumber(data.chromaticOffset, 0, 8, 0) },
        curvature: { enabled: Boolean(data.curvatureEnabled), strength: clampNumber(data.curvatureStrength, 0, 1, 0) }
      }
    };
    await setTerminalConfig(this.journal, { themeId: data.themeId, themeOverrides: overrides });
    ui.notifications.info(game.i18n.localize("RETRO_CRT_TERMINAL.Notifications.Saved"));
    await this.render();
  }

  static onLoadPreset(_event, target) {
    const form = target.closest("form");
    const theme = ThemeRegistry.get(form.elements.themeId.value);
    if (!theme) return;
    const values = flattenTheme(theme);
    for (const [name, value] of Object.entries(values)) {
      const field = form.elements[name];
      if (!field) continue;
      if (field.type === "checkbox") field.checked = Boolean(value);
      else field.value = value;
    }
  }
}

function flattenTheme(theme) {
  return {
    font: theme.typography.font, fontSize: theme.typography.size, lineHeight: theme.typography.lineHeight,
    letterSpacing: theme.typography.letterSpacing, uppercase: theme.typography.uppercase,
    foreground: theme.colors.foreground, background: theme.colors.background, muted: theme.colors.muted,
    highlight: theme.colors.highlight, border: theme.colors.border, error: theme.colors.error,
    scanlinesEnabled: theme.effects.scanlines.enabled, scanlineOpacity: theme.effects.scanlines.opacity, scanlineSize: theme.effects.scanlines.size,
    glowEnabled: theme.effects.glow.enabled, glowStrength: theme.effects.glow.strength,
    flickerEnabled: theme.effects.flicker.enabled, flickerStrength: theme.effects.flicker.strength, flickerSpeed: theme.effects.flicker.speed,
    noiseEnabled: theme.effects.noise.enabled, noiseStrength: theme.effects.noise.strength,
    vhsEnabled: theme.effects.vhs.enabled, vhsTracking: theme.effects.vhs.tracking, vhsJitter: theme.effects.vhs.jitter, chromaticOffset: theme.effects.vhs.chromaticOffset,
    curvatureEnabled: theme.effects.curvature.enabled, curvatureStrength: theme.effects.curvature.strength
  };
}

function clampNumber(value, minimum, maximum, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
}
