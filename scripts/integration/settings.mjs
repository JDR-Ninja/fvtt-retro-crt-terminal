import { MODULE_ID } from "../constants.mjs";
import { ThemeRegistry } from "../themes/theme-registry.mjs";
import { sharedSessionManager, SHARED_SESSION_SETTING } from "../sync/shared-session-manager.mjs";
import { GUIDE_DISABLED_SETTING, GUIDE_SEEN_SETTING } from "../guide/gamemaster-guide.mjs";

export function registerSettings() {
  const choices = Object.fromEntries(ThemeRegistry.list().map(theme => [theme.id, theme.name]));
  game.settings.register(MODULE_ID, "defaultTheme", {
    name: "RETRO_CRT_TERMINAL.Settings.DefaultTheme.Name",
    hint: "RETRO_CRT_TERMINAL.Settings.DefaultTheme.Hint",
    scope: "world",
    config: true,
    type: String,
    choices,
    default: "green-crt"
  });
  game.settings.register(MODULE_ID, "effectsEnabled", {
    name: "RETRO_CRT_TERMINAL.Settings.Effects.Name",
    hint: "RETRO_CRT_TERMINAL.Settings.Effects.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });
  game.settings.register(MODULE_ID, "typewriterSpeed", {
    name: "RETRO_CRT_TERMINAL.Settings.TypewriterSpeed.Name",
    hint: "RETRO_CRT_TERMINAL.Settings.TypewriterSpeed.Hint",
    scope: "client",
    config: true,
    type: Number,
    range: { min: 0, max: 60, step: 2 },
    default: 18
  });
  game.settings.register(MODULE_ID, "gmDebug", {
    name: "RETRO_CRT_TERMINAL.Settings.GmDebug.Name",
    hint: "RETRO_CRT_TERMINAL.Settings.GmDebug.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
    restricted: true
  });
  game.settings.register(MODULE_ID, SHARED_SESSION_SETTING, {
    name: "Synchronized terminal session",
    hint: "Internal synchronized terminal state.",
    scope: "world",
    config: false,
    type: Object,
    default: {},
    onChange: value => sharedSessionManager.acceptPersistedState(value)
  });
  game.settings.register(MODULE_ID, GUIDE_SEEN_SETTING, {
    name: "Gamemaster guide version seen",
    scope: "client",
    config: false,
    type: String,
    default: ""
  });
  game.settings.register(MODULE_ID, GUIDE_DISABLED_SETTING, {
    name: "Disable gamemaster onboarding",
    scope: "client",
    config: false,
    type: Boolean,
    default: false
  });
}
