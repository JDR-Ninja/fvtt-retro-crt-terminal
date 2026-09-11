import assert from "node:assert/strict";
import test from "node:test";
import { PAGE_TYPE } from "../scripts/constants.mjs";
import { parseInline } from "../scripts/parser/inline-parser.mjs";
import { parseTerminalMarkup } from "../scripts/parser/parser.mjs";
import { resolveMenu } from "../scripts/resolver/menu-resolver.mjs";
import { resolveInlineLabels } from "../scripts/resolver/page-resolver.mjs";
import { renderTerminalBlocks } from "../scripts/render/terminal-renderer.mjs";

const ARCHIVE_UUID = "JournalEntry.a.JournalEntryPage.b";
const ARCHIVE_TOKEN = `@UUID[${ARCHIVE_UUID}]`;

test("a bare UUID menu entry carries no label so the target page can name it", () => {
  const ast = parseTerminalMarkup(`::menu\n${ARCHIVE_TOKEN}\n::end`);
  assert.deepEqual(ast.children[0].items, [{ type: "menuItem", label: "", target: ARCHIVE_TOKEN }]);
  assert.deepEqual(ast.diagnostics, []);
});

test("the labelled UUID syntax Foundry itself produces is accepted", () => {
  const ast = parseTerminalMarkup(`::menu\n${ARCHIVE_TOKEN}{ARCHIVES}\n::end`);
  assert.deepEqual(ast.children[0].items, [{ type: "menuItem", label: "ARCHIVES", target: ARCHIVE_TOKEN }]);
  assert.deepEqual(ast.diagnostics, []);
});

test("an unlabelled UUID menu entry is named after the page it points to", async () => {
  const page = terminalPage(ARCHIVE_UUID, "Cold Storage Archives");
  stubUuidLookup({ [ARCHIVE_UUID]: page });

  const menu = await resolveMenu(
    { type: "menu", mode: "explicit", items: [{ type: "menuItem", label: "", target: ARCHIVE_TOKEN }] },
    terminalPage("JournalEntry.a.JournalEntryPage.main", "MAIN"),
    { user: { isGM: false } }
  );

  assert.equal(menu.items[0].label, "Cold Storage Archives");
  assert.equal(menu.items[0].pageUuid, ARCHIVE_UUID);
});

test("a broken menu entry shows its target to the GM so it can be repaired", async () => {
  stubUuidLookup({});

  const menu = await resolveMenu(
    { type: "menu", mode: "explicit", items: [{ type: "menuItem", label: "", target: ARCHIVE_TOKEN }] },
    terminalPage("JournalEntry.a.JournalEntryPage.main", "MAIN"),
    { user: { isGM: true } }
  );

  assert.equal(menu.items[0].state, "missing");
  assert.equal(menu.items[0].label, ARCHIVE_TOKEN);
  assert.equal(menu.items[0].debug, "BROKEN");
});

test("a broken menu entry never shows the authored label to a player", async () => {
  stubUuidLookup({});

  const menu = await resolveMenu(
    { type: "menu", mode: "explicit", items: [{ type: "menuItem", label: "TOP SECRET ARCHIVE", target: ARCHIVE_TOKEN }] },
    terminalPage("JournalEntry.a.JournalEntryPage.main", "MAIN"),
    { user: { isGM: false } }
  );

  assert.equal(menu.items[0].state, "missing");
  assert.equal(menu.items[0].label, "UNAVAILABLE");
  assert.equal(menu.items[0].debug, undefined);
});

test("inline UUID links resolve to a readable label instead of the raw token", async () => {
  assert.deepEqual(parseInline(`See ${ARCHIVE_TOKEN}{the file} now`)[1], {
    type: "link",
    label: "the file",
    target: ARCHIVE_TOKEN
  });

  const nodes = parseInline(`See ${ARCHIVE_TOKEN} now`);
  assert.equal(nodes[1].label, "");
  stubUuidLookup({ [ARCHIVE_UUID]: terminalPage(ARCHIVE_UUID, "Cold Storage Archives") });

  assert.equal(await resolveInlineLabels(nodes, null, { user: { isGM: false } }), 1);
  assert.equal(nodes[1].label, "Cold Storage Archives");
});

test("an unresolvable inline link shows its target to the GM so it can be repaired", async () => {
  const nodes = parseInline(`See ${ARCHIVE_TOKEN} now`);
  stubUuidLookup({});

  await resolveInlineLabels(nodes, null, { user: { isGM: true } });
  assert.equal(nodes[1].label, ARCHIVE_TOKEN);
});

test("an inline link a player cannot reach is redacted instead of naming the page", async () => {
  const hidden = terminalPage(ARCHIVE_UUID, "Cold Storage Archives");
  hidden.system.release = { visibility: "hidden", access: "available" };
  stubUuidLookup({ [ARCHIVE_UUID]: hidden });

  const nodes = parseInline(`See ${ARCHIVE_TOKEN} now`);
  await resolveInlineLabels(nodes, null, { user: { isGM: false } });
  assert.equal(nodes[1].label, "UNAVAILABLE");

  const broken = parseInline(`See ${ARCHIVE_TOKEN} now`);
  stubUuidLookup({});
  await resolveInlineLabels(broken, null, { user: { isGM: false } });
  assert.equal(broken[1].label, "UNAVAILABLE", "a missing target must not leak its uuid either");
});

test("links inside a heading stay navigable", () => {
  stubDocument();
  const container = fakeElement("main");
  let navigated = null;

  renderTerminalBlocks(container, {
    blocks: parseTerminalMarkup(`# [ARCHIVES](terminal:archives)`).children,
    diagnostics: []
  }, { onNavigate: item => navigated = item });

  const heading = container.children[0];
  assert.equal(heading.tag, "h1");
  heading.children[0].listeners.click();
  assert.equal(navigated.target, "terminal:archives");
});

function terminalPage(uuid, name) {
  return {
    uuid,
    name,
    type: PAGE_TYPE,
    documentName: "JournalEntryPage",
    testUserPermission: () => true,
    system: { pageId: name.toLowerCase(), navigation: {}, release: { visibility: "visible", access: "available" }, lock: { type: "none" } }
  };
}

function stubUuidLookup(documents) {
  globalThis.foundry = { utils: { fromUuid: async uuid => documents[uuid] ?? null } };
}

function stubDocument() {
  globalThis.document = {
    createElement: tag => fakeElement(tag),
    createTextNode: text => ({ tag: "#text", text, children: [] })
  };
}

function fakeElement(tag) {
  return {
    tag,
    className: "",
    dataset: {},
    children: [],
    listeners: {},
    append(...nodes) { this.children.push(...nodes); },
    replaceChildren(...nodes) { this.children = nodes; },
    setAttribute() {},
    addEventListener(name, handler) { this.listeners[name] = handler; }
  };
}
