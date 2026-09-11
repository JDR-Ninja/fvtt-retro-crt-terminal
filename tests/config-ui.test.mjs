import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { setTimeout as wait } from "node:timers/promises";
import { DEFAULT_TERMINAL_CONFIG } from "../scripts/constants.mjs";

stubFoundry();

const { TerminalConfigApplication, createSaveScheduler, openConfigApplications, structureRows } = await import("../scripts/applications/terminal-config-application.mjs");
const { TerminalPageSheet } = await import("../scripts/applications/terminal-page-sheet.mjs");
const { TerminalConfigModel } = await import("../scripts/data/terminal-config-model.mjs");
const { TerminalPageDataModel } = await import("../scripts/data/terminal-page-data-model.mjs");

const CONFIG_PATHS = schemaPaths(TerminalConfigModel.defineSchema());
const PAGE_PATHS = schemaPaths(TerminalPageDataModel.defineSchema());

// Fields the schema carries but the window deliberately does not expose. Theme
// controls are generated from the schema itself, so they cannot drift apart.
const INTERNAL_PATHS = new Set(["launcher", "behavior", "themeOverrides"]);

test("the configuration window edits every field the schema declares, and nothing else", async () => {
  const names = new Set(inputNames(await readParts(TerminalConfigApplication.PARTS)));

  for (const name of names) assert.ok(CONFIG_PATHS.has(name), `${name} is not a TerminalConfigModel field`);
  for (const path of CONFIG_PATHS) {
    if (path.startsWith("themeOverrides") || INTERNAL_PATHS.has(path)) continue;
    assert.ok(names.has(path), `${path} exists in the schema but no control edits it`);
  }
  assert.ok(names.has("launcher.icon"), "the launcher icon is silently dropped again");
});

test("every control in the page sheet targets a real page schema field", async () => {
  const markup = await readParts(TerminalPageSheet.PARTS);
  for (const name of inputNames(markup)) {
    if (name === "name") continue;
    assert.ok(name.startsWith("system."), `${name} is not a page field`);
    assert.ok(PAGE_PATHS.has(name.slice("system.".length)), `${name} is not a TerminalPageDataModel field`);
  }
});

test("every themed control is bounded, so no slider can be dragged out of range", async () => {
  const markup = await readParts(TerminalConfigApplication.PARTS);
  for (const [, attributes] of markup.matchAll(/<input([^>]*type="range"[^>]*)>/g)) {
    for (const bound of ["min=", "max=", "step="]) {
      assert.ok(attributes.includes(bound), `a range control is missing ${bound}`);
    }
  }
  const effects = TerminalConfigModel.defineSchema().themeOverrides.fields.effects.fields;
  for (const [group, field] of Object.entries(effects)) {
    for (const [key, sub] of Object.entries(field.fields)) {
      if (key === "enabled") continue;
      assert.equal(typeof sub.options.min, "number", `effects.${group}.${key} has no minimum`);
      assert.equal(typeof sub.options.max, "number", `effects.${group}.${key} has no maximum`);
    }
  }
});

// ApplicationV2 handles these itself; registering one shadows the framework or is
// silently swallowed, with no console error to point at the cause.
const RESERVED_ACTIONS = new Set(["tab", "attach", "detach", "close", "minimize", "maximize", "toggleControls"]);

test("no window registers an action name ApplicationV2 reserves", () => {
  for (const application of [TerminalConfigApplication, TerminalPageSheet]) {
    for (const action of Object.keys(application.DEFAULT_OPTIONS.actions)) {
      assert.ok(!RESERVED_ACTIONS.has(action), `${application.name}: "${action}" is reserved by ApplicationV2`);
    }
  }
});

test("template actions and registered handlers stay in sync", async () => {
  for (const application of [TerminalConfigApplication, TerminalPageSheet]) {
    const markup = await readParts(application.PARTS);
    const used = new Set([...markup.matchAll(/data-action="([^"]+)"/g)].map(match => match[1]));
    const registered = new Set(Object.keys(application.DEFAULT_OPTIONS.actions));
    for (const action of used) assert.ok(registered.has(action), `${application.name}: ${action} has no handler`);
    for (const action of registered) assert.ok(used.has(action), `${application.name}: ${action} is never triggered`);
  }
});

test("every template part renders exactly one root element", async () => {
  for (const application of [TerminalConfigApplication, TerminalPageSheet]) {
    for (const [partId, part] of Object.entries(application.PARTS)) {
      const markup = await readPart(part);
      assert.equal(
        rootElementCount(markup),
        1,
        `${application.name}: part "${partId}" must render a single root element for ApplicationV2`
      );
    }
  }
});

test("every tab panel has a matching tab button", async () => {
  for (const application of [TerminalConfigApplication, TerminalPageSheet]) {
    const markup = await readParts(application.PARTS);
    const panels = [...markup.matchAll(/class="tab [^"]*"\s+data-tab="([^"]+)"/g)].map(match => match[1]);
    const buttons = [...markup.matchAll(/data-action="selectTab"\s+data-tab="\{\{(\w+)\}\}"/g)];
    assert.ok(panels.length >= 2, `${application.name} should expose at least two tabs`);
    assert.equal(new Set(panels).size, panels.length, `${application.name} has duplicate tab panels`);
    assert.ok(buttons.length > 0, `${application.name} has no tab navigation`);
  }
});

test("the configuration schema keeps the stored defaults it replaces", () => {
  const schema = TerminalConfigModel.defineSchema();
  assert.equal(schema.enabled.options.initial, DEFAULT_TERMINAL_CONFIG.enabled);
  assert.equal(schema.themeId.options.initial, DEFAULT_TERMINAL_CONFIG.themeId);
  assert.equal(schema.startPageUuid.options.initial, DEFAULT_TERMINAL_CONFIG.startPageUuid);
  assert.equal(schema.launcher.fields.published.options.initial, DEFAULT_TERMINAL_CONFIG.launcher.published);
  assert.equal(schema.launcher.fields.sort.options.initial, DEFAULT_TERMINAL_CONFIG.launcher.sort);
  assert.equal(schema.launcher.fields.icon.options.initial, DEFAULT_TERMINAL_CONFIG.launcher.icon);
  for (const [key, value] of Object.entries(DEFAULT_TERMINAL_CONFIG.behavior)) {
    assert.equal(schema.behavior.fields[key].options.initial, value, `behavior.${key} drifted`);
  }
});

test("the launcher schema declares no field the module never reads", () => {
  assert.ok(!("audience" in DEFAULT_TERMINAL_CONFIG.launcher), "launcher.audience is back in the stored defaults");
  const launcher = TerminalConfigModel.defineSchema().launcher.fields;
  assert.ok(!("audience" in launcher), "launcher.audience is back in the schema");
});

test("a burst of changes collapses into a single write that keeps the last value", async () => {
  const written = [];
  const scheduler = createSaveScheduler(payload => written.push(payload), { delay: 20 });

  for (const value of ["#101010", "#202020", "#303030"]) scheduler.schedule({ background: value });
  assert.deepEqual(written, [], "a change was written before the burst settled");

  await wait(60);
  assert.deepEqual(written, [{ background: "#303030" }], "the last change did not survive the burst");
});

test("flushing writes the queued change once and cancels the pending timer", async () => {
  const written = [];
  const scheduler = createSaveScheduler(payload => written.push(payload), { delay: 20 });

  scheduler.schedule({ background: "#404040" });
  assert.equal(scheduler.pending, true);
  await scheduler.flush();
  assert.equal(scheduler.pending, false);

  await wait(60);
  assert.deepEqual(written, [{ background: "#404040" }], "the flushed change was written twice");
});

test("closing the window writes a change still inside the debounce window", async () => {
  const { application, written } = configApplication();

  submitColour(application, "#050505");
  await wait(60);
  assert.deepEqual(written, [], "the production delay does not group a colour drag");

  application._onClose({});
  await wait(0);
  assert.deepEqual(
    written,
    [{ themeOverrides: { colors: { background: "#050505" } } }],
    "an unsaved change was dropped when the window closed"
  );
});

test("re-rendering writes a queued change before rebuilding the form from the flag", async () => {
  const { application, written } = configApplication();

  submitColour(application, "#060606");
  await application._preRender({}, {});
  assert.deepEqual(
    written,
    [{ themeOverrides: { colors: { background: "#060606" } } }],
    "a re-render discarded an edit that was still queued"
  );
});

test("a player who cannot own the Journal never queues a write", async () => {
  const { application, written } = configApplication({ isOwner: false });

  submitColour(application, "#070707");
  application._onClose({});
  await wait(60);
  assert.deepEqual(written, []);
});

function configApplication({ isOwner = true } = {}) {
  const application = new TerminalConfigApplication({ journal: { id: "journal-1", isOwner } });
  const written = [];
  application.persistConfig = async submitted => { written.push(submitted); };
  return { application, written };
}

function submitColour(application, value) {
  TerminalConfigApplication.onSubmit.call(application, null, null, {
    object: { "themeOverrides.colors.background": value }
  });
}

// Sorted flat, the demo reads "Main Menu, Public Access, Lena Voss, Laboratory Index…": every
// branch interleaved by sort value, which is exactly the hierarchy the tab is meant to show.
test("the Structure tab lists every page under its parent, in the terminal's own order", () => {
  globalThis.game = { i18n: { has: () => false, localize: key => key } };
  const page = (pageId, parent, sort, name = pageId) => ({
    uuid: `Page.${pageId}`,
    name,
    sort: 0,
    system: { pageId, navigation: { parent, sort }, release: { visibility: "visible", access: "available" } }
  });
  const pages = [
    page("laboratory-index", "science-deck", 100),
    page("main", "", 0),
    page("archives", "main", 500),
    page("science-deck", "public-access", 100),
    page("public-access", "main", 50),
    page("status", "main", 100),
    page("orphan", "ghost", 10),
    page("loop-a", "loop-b", 1),
    page("loop-b", "loop-a", 2),
    page("Quarantine", "ARCHIVES", 100) // parent ids match regardless of case, like menus do
  ];

  const rows = structureRows(pages).map(row => [row.pageId, row.depth]);

  assert.deepEqual(rows, [
    ["main", 0],
    ["public-access", 1],
    ["science-deck", 2],
    ["laboratory-index", 3],
    ["status", 1],
    ["archives", 1],
    ["Quarantine", 2],
    ["orphan", 0],
    ["loop-a", 0],
    ["loop-b", 1]
  ]);
  assert.equal(rows.length, pages.length, "a page caught in a parent cycle must still be listed");
  assert.equal(structureRows(pages)[0].isChild, false);
  assert.equal(structureRows(pages)[1].isChild, true);
});

test("the open-window lookup tolerates a Foundry surface without an instance registry", () => {
  const registry = globalThis.foundry.applications.instances;
  globalThis.foundry.applications.instances = undefined;
  assert.deepEqual(openConfigApplications(), []);
  globalThis.foundry.applications.instances = registry;
});

function readPart(part) {
  const path = part.template.replace("modules/retro-crt-terminal/", "");
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

async function readParts(parts) {
  return (await Promise.all(Object.values(parts).map(readPart))).join("\n");
}

const VOID_ELEMENTS = new Set(["input", "br", "hr", "img", "meta", "link", "source", "area", "col"]);

/**
 * Counts top-level elements, ignoring Handlebars expressions. ApplicationV2 rejects a
 * part whose template renders anything other than a single root, with an error that
 * names the part but not the cause.
 */
function rootElementCount(markup) {
  const tags = markup.replace(/\{\{[^}]*\}\}/g, "").matchAll(/<(\/?)([a-zA-Z][\w-]*)[^>]*?(\/?)>/g);
  let depth = 0;
  let roots = 0;
  for (const match of tags) {
    const closing = match[1] === "/";
    const name = match[2].toLowerCase();
    const selfClosing = match[3] === "/";
    if (VOID_ELEMENTS.has(name) || selfClosing) continue;
    if (closing) depth -= 1;
    else {
      if (depth === 0) roots += 1;
      depth += 1;
    }
  }
  return roots;
}

/** Both the hand-written controls and the names handed to the {{formGroup}} helper. */
function inputNames(markup) {
  return [
    ...markup.matchAll(/<(?:input|select|textarea)[^>]*\sname="([^"{}]+)"/g),
    ...markup.matchAll(/\{\{formGroup[^}]*\sname="([^"]+)"/g)
  ].map(match => match[1]);
}

function schemaPaths(schema, prefix = "") {
  const paths = new Set();
  for (const [key, field] of Object.entries(schema)) {
    const path = prefix ? `${prefix}.${key}` : key;
    paths.add(path);
    if (field?.fields) for (const nested of schemaPaths(field.fields, path)) paths.add(nested);
  }
  return paths;
}

function stubFoundry() {
  class Field {
    constructor(options = {}) { this.options = options; }
    get label() { return this.options.label; }
    get min() { return this.options.min; }
    get max() { return this.options.max; }
    get step() { return this.options.step; }
  }
  class SchemaField extends Field {
    constructor(fields, options = {}) { super(options); this.fields = fields; }
  }
  class ApplicationV2 {}
  globalThis.foundry = {
    abstract: { DataModel: class {}, TypeDataModel: class {} },
    data: { fields: { StringField: Field, NumberField: Field, BooleanField: Field, SchemaField } },
    applications: {
      api: {
        ApplicationV2,
        HandlebarsApplicationMixin: Base => class extends Base { _renderHTML() {} _replaceHTML() {} }
      },
      sheets: { journal: { JournalEntryPageSheet: class extends ApplicationV2 {} } },
      instances: new Map()
    },
    utils: { fromUuid: async () => null, expandObject }
  };
}

function expandObject(flat) {
  const expanded = {};
  for (const [path, value] of Object.entries(flat)) {
    const keys = path.split(".");
    let node = expanded;
    while (keys.length > 1) node = node[keys.shift()] ??= {};
    node[keys[0]] = value;
  }
  return expanded;
}
