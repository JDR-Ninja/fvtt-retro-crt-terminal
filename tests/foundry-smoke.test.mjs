import assert from "node:assert/strict";
import test from "node:test";

test("module entry point registers against the Foundry v14 public surface", async () => {
  const once = new Map();
  const registeredHooks = [];
  const registeredSettings = [];
  let sheetRegistration = null;
  const moduleRecord = {};

  class Field { constructor(options) { this.options = options; } }
  class ApplicationV2 {}
  const HandlebarsApplicationMixin = Base => class extends Base {
    _renderHTML() {}
    _replaceHTML() {}
  };
  class JournalEntryPageSheet extends ApplicationV2 {}
  class JournalEntryPage {}

  globalThis.Hooks = {
    once: (name, callback) => once.set(name, callback),
    on: (name, callback) => registeredHooks.push([name, callback])
  };
  globalThis.CONFIG = { JournalEntryPage: { dataModels: {}, typeIcons: {} } };
  globalThis.foundry = {
    abstract: { TypeDataModel: class {}, DataModel: class {} },
    data: { fields: { StringField: Field, SchemaField: Field, NumberField: Field, BooleanField: Field } },
    documents: { JournalEntryPage },
    applications: {
      api: { ApplicationV2, HandlebarsApplicationMixin, DialogV2: class {} },
      sheets: { journal: { JournalEntryPageSheet } },
      apps: { DocumentSheetConfig: { registerSheet: (...args) => { sheetRegistration = args; } } },
      instances: new Map()
    },
    utils: { fromUuid: async () => null }
  };
  globalThis.game = {
    settings: { register: (...args) => registeredSettings.push(args) },
    modules: { get: () => moduleRecord }
  };

  await import(`../scripts/main.mjs?smoke=${Date.now()}`);
  assert.equal(typeof once.get("init"), "function");
  once.get("init")();

  assert.equal(typeof CONFIG.JournalEntryPage.dataModels["retro-crt-terminal.terminal"], "function");
  assert.match(CONFIG.fontDefinitions.VT323.fonts[0].urls[0], /^https:\/\/fonts\.gstatic\.com\//);
  assert.equal(sheetRegistration[0], JournalEntryPage);
  assert.equal(sheetRegistration[1], "retro-crt-terminal");
  assert.equal(typeof sheetRegistration[2].prototype._renderHTML, "function");
  assert.equal(typeof sheetRegistration[2].prototype._replaceHTML, "function");
  assert.equal(typeof moduleRecord.api.open, "function");
  assert.equal(typeof moduleRecord.api.openGuide, "function");
  assert.equal(typeof moduleRecord.api.shared.start, "function");
  assert.equal(typeof moduleRecord.api.shared.update, "function");
  assert.equal(typeof moduleRecord.api.shared.stop, "function");
  assert.equal(registeredSettings.length, 7);
  assert.equal(registeredHooks.length, 9);
  assert.ok(registeredHooks.some(([name]) => name === "getSceneControlButtons"));
  // The shared-session state that carries access rides on the controller's User document.
  assert.ok(registeredHooks.some(([name]) => name === "updateUser"));

  // A controller dropping off the server is announced by userConnected, never by a User update:
  // every window showing who is in control must repaint from that hook too.
  const { sharedSessionManager } = await import("../scripts/sync/shared-session-manager.mjs");
  const sharedTerminal = { renders: 0, render() { this.renders += 1; } };
  const launcher = { renders: 0, render() { this.renders += 1; } };
  sharedSessionManager.applications.add(sharedTerminal);
  foundry.applications.instances.set("retro-crt-terminal-launcher", launcher);
  const userConnected = registeredHooks.find(([name]) => name === "userConnected")?.[1];
  assert.equal(typeof userConnected, "function");
  userConnected({ id: "controller", active: false }, false);
  assert.equal(sharedTerminal.renders, 1);
  assert.equal(launcher.renders, 1);
});
