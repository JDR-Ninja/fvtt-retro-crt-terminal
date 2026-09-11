import assert from "node:assert/strict";
import test from "node:test";
import { PAGE_TYPE } from "../scripts/constants.mjs";

stubFoundry();

const { ThemeRegistry } = await import("../scripts/themes/theme-registry.mjs");
const { TerminalApplication } = await import("../scripts/applications/terminal-application.mjs");
const { TerminalAPI, openTerminals } = await import("../scripts/api/terminal-api.mjs");
const { sharedSessionManager } = await import("../scripts/sync/shared-session-manager.mjs");

ThemeRegistry.initialize();

test("reopening a terminal fronts the window already showing it instead of stacking a second one", async () => {
  const { journal, pages } = terminal();
  reset({ documents: [journal, ...pages] });

  const first = await TerminalAPI.open(journal.uuid);
  const second = await TerminalAPI.open(pages[1].uuid);

  assert.equal(second, first);
  assert.equal(openTerminals.size, 1);
  assert.equal(first.fronted, 1);
  assert.equal(first.session.currentPageUuid, pages[1].uuid);
});

test("a synchronized session never adopts a window opened outside it", async () => {
  const { journal, pages } = terminal();
  reset({ documents: [journal, ...pages] });

  const solo = await TerminalAPI.open(journal.uuid);
  sharedSessionManager.state = sessionState(journal.uuid, pages[0].uuid);
  const shared = await TerminalAPI.open(journal.uuid, { sharedSessionId: "session", page: pages[0].uuid });

  assert.notEqual(shared, solo);
  assert.equal(openTerminals.size, 2);
  assert.equal(solo.sharedSessionId, null);
  assert.equal(shared.sharedSessionId, "session");

  const again = await TerminalAPI.open(journal.uuid, { sharedSessionId: "session", page: pages[0].uuid });
  assert.equal(again, shared);
  assert.equal(openTerminals.size, 2);
});

test("gamemaster debug visibility is suspended during a synchronized session", async () => {
  const { journal, pages } = terminal();
  reset({ documents: [journal, ...pages], isGM: true, gmDebug: true });

  const app = await TerminalAPI.open(journal.uuid);
  assert.equal(app.gmDebug, true);

  sharedSessionManager.state = sessionState(journal.uuid, pages[0].uuid);
  app.sharedSessionId = "session";
  assert.equal(app.synchronized, true);
  assert.equal(app.gmDebug, false, "the gamemaster would otherwise see extra menu rows and desync every observer");
});

test("a terminal the user cannot observe is refused instead of opening an empty window", async () => {
  const { journal, pages } = terminal({ observer: false });
  reset({ documents: [journal, ...pages] });

  await assert.rejects(TerminalAPI.open(journal.uuid), /permission/);
  await assert.rejects(TerminalAPI.open(pages[1].uuid), /permission/, "a page target is bound by its Journal's permission");
  assert.equal(openTerminals.size, 0);

  game.user.isGM = true;
  assert.ok(await TerminalAPI.open(journal.uuid), "the Gamemaster always passes");
});

test("the keyboard returns to the screen once a password prompt is torn down", async () => {
  const { journal, pages } = terminal();
  pages[1].system.lock = { type: "password", secret: "ORPHEE-79", failureMessage: "" };
  reset({ documents: [journal, ...pages] });
  globalThis.ui = { notifications: { warn: () => {} } };
  const prompts = [];
  let answer = "wrong";
  foundry.applications.api.DialogV2.input = async config => {
    prompts.push(config);
    return { password: answer };
  };

  const app = await TerminalAPI.open(journal.uuid);
  const screen = { focused: 0, focus() { this.focused += 1; } };
  app.element = { querySelector: selector => selector === "[data-terminal-screen]" ? screen : null };

  assert.equal(await app.requestUnlock(pages[1]), false);
  assert.equal(screen.focused, 0, "the modal is still on screen when the prompt resolves; focusing now would be inert");
  assert.equal(typeof prompts[0].close, "function");
  prompts[0].close();
  assert.equal(screen.focused, 1, "a refused code must not strand keyboard navigation");

  answer = "ORPHEE-79";
  assert.equal(await app.requestUnlock(pages[1]), true);
  assert.ok(app.session.sessionUnlocks.has(pages[1].uuid));
  prompts[1].close();
  assert.equal(screen.focused, 2);

  sharedSessionManager.state = sessionState(journal.uuid, pages[0].uuid, { controllerUserId: "other" });
  app.sharedSessionId = "session";
  assert.equal(app.focusScreen(), false, "a spectator's window is never focused");
  assert.equal(screen.focused, 2);
});

test("the screen's accessible name never spells out a page the reader may not see", async () => {
  const { journal, pages } = terminal();
  pages[1].name = "Incident 1979";
  pages[1].system.release = { visibility: "hidden", access: "available" };
  reset({ documents: [journal, ...pages] });

  const app = await TerminalAPI.open(pages[1].uuid);
  const hidden = await app._prepareContext({});
  assert.equal(hidden.title, "RETRO_CRT_TERMINAL.Errors.FileUnavailable");

  app.session.currentPageUuid = pages[0].uuid;
  const visible = await app._prepareContext({});
  assert.equal(visible.title, pages[0].name);
});

test("the unavailable-file screen is still themed", async () => {
  const { journal, pages } = terminal();
  reset({ documents: [journal, ...pages] });

  const app = await TerminalAPI.open(journal.uuid);
  app.session.currentPageUuid = "JournalEntryPage.gone";
  const context = await app._prepareContext({});

  assert.equal(context.missing, true);
  assert.match(context.themeStyle, /--terminal-bg:/);
  assert.equal(typeof context.themeClasses, "string");
  assert.equal(typeof context.reduceMotion, "boolean");
  assert.equal(typeof context.typewriterSpeed, "number");
});

function sessionState(terminalRootUuid, currentPageUuid, overrides = {}) {
  return {
    active: true,
    sessionId: "session",
    terminalRootUuid,
    currentPageUuid,
    homePageUuid: currentPageUuid,
    history: [],
    selectedIndex: 0,
    sessionUnlocks: [],
    controllerUserId: "gm",
    audienceUserIds: ["gm", "other"],
    managerUserId: "gm",
    revision: 1,
    updatedAt: 1,
    ...overrides
  };
}

function terminal({ observer = true } = {}) {
  const journal = {
    documentName: "JournalEntry",
    uuid: "JournalEntry.root",
    name: "Orpheus",
    getFlag: () => ({}),
    testUserPermission: () => observer
  };
  const pages = ["home", "files"].map((id, index) => ({
    documentName: "JournalEntryPage",
    type: PAGE_TYPE,
    uuid: `JournalEntryPage.${id}`,
    name: id,
    sort: index,
    parent: journal,
    testUserPermission: () => observer,
    system: { pageId: id, pageType: "menu", navigation: { sort: index }, presentation: {} }
  }));
  journal.pages = { contents: pages };
  return { journal, pages };
}

function reset({ documents = [], isGM = false, gmDebug = false } = {}) {
  const byUuid = new Map(documents.map(document => [document.uuid, document]));
  globalThis.foundry.utils.fromUuid = async uuid => byUuid.get(uuid) ?? null;
  const settings = {
    effectsEnabled: false,
    typewriterSpeed: 0,
    defaultTheme: "green-crt",
    gmDebug
  };
  globalThis.game = {
    user: { id: "gm", isGM, getFlag: () => null, setFlag: async () => {} },
    users: new Map([["gm", { id: "gm", name: "GM", active: true }]]),
    settings: { get: (_scope, key) => settings[key] },
    i18n: { localize: key => key, format: key => key },
    modules: { get: () => ({ api: TerminalAPI }) }
  };
  openTerminals.clear();
  sharedSessionManager.state = null;
  sharedSessionManager.applications.clear();
}

function stubFoundry() {
  class ApplicationV2 {
    constructor(options = {}) {
      this.options = options;
      this.id = options.id;
      this.rendered = false;
      this.renders = 0;
      this.fronted = 0;
    }
    async _prepareContext() { return {}; }
    async render() { this.rendered = true; this.renders += 1; return this; }
    bringToFront() { this.fronted += 1; }
    async close() { this.rendered = false; }
  }
  globalThis.Hooks = { on: () => {}, once: () => {}, callAll: () => {} };
  globalThis.foundry = {
    applications: {
      api: {
        ApplicationV2,
        HandlebarsApplicationMixin: Base => class extends Base { _renderHTML() {} _replaceHTML() {} },
        DialogV2: class {}
      },
      instances: new Map()
    },
    utils: { fromUuid: async () => null }
  };
  globalThis.game = { settings: { get: () => false }, modules: { get: () => ({}) } };
}
