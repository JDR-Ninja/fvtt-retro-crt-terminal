export const MODULE_ID = "retro-crt-terminal";
export const PAGE_SUBTYPE = "terminal";
export const PAGE_TYPE = `${MODULE_ID}.${PAGE_SUBTYPE}`;
export const FLAG_SCOPE = MODULE_ID;
export const TERMINAL_FLAG = "terminal";

export const PAGE_TYPES = Object.freeze([
  "menu",
  "document",
  "email",
  "directory",
  "login",
  "system",
  "image",
  "command"
]);

export const VISIBILITY = Object.freeze({ HIDDEN: "hidden", VISIBLE: "visible" });
export const ACCESS = Object.freeze({ AVAILABLE: "available", LOCKED: "locked" });
export const LOCK_TYPES = Object.freeze(["none", "gm", "password"]);

export const DEFAULT_TERMINAL_CONFIG = Object.freeze({
  enabled: true,
  terminalId: "",
  label: "",
  startPageUuid: "",
  themeId: "green-crt",
  themeOverrides: {},
  launcher: {
    published: false,
    sort: 0,
    icon: "fa-solid fa-computer",
    audience: "observers"
  },
  behavior: {
    rememberPage: false,
    showBootSequence: true,
    closeOnEscapeAtRoot: false
  }
});
