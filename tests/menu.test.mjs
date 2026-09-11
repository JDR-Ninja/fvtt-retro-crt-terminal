import assert from "node:assert/strict";
import test from "node:test";
import { PAGE_TYPE } from "../scripts/constants.mjs";
import { resolveMenu } from "../scripts/resolver/menu-resolver.mjs";

const user = { isGM: false };

function child(uuid, pageId, parent, visibility = "visible", access = "available", sort = 0) {
  return {
    uuid,
    id: uuid,
    name: pageId,
    type: PAGE_TYPE,
    documentName: "JournalEntryPage",
    sort,
    testUserPermission: () => true,
    system: {
      pageId,
      navigation: { label: pageId.toUpperCase(), parent, sort, showInParentMenu: true },
      release: { visibility, access },
      lock: { type: access === "locked" ? "password" : "none" }
    }
  };
}

test("automatic menus omit hidden children and retain locked entries", async () => {
  const root = child("Page.root", "main", "");
  const visible = child("Page.visible", "visible", "main", "visible", "available", 20);
  const hidden = child("Page.hidden", "hidden", "main", "hidden", "available", 10);
  const locked = child("Page.locked", "locked", "main", "visible", "locked", 30);
  const journal = { pages: { contents: [root, visible, hidden, locked] }, testUserPermission: () => true };
  for (const page of journal.pages.contents) page.parent = journal;

  const menu = await resolveMenu({ type: "menu", mode: "children", items: [] }, root, { user });
  assert.deepEqual(menu.items.map(item => item.pageUuid), [visible.uuid, locked.uuid]);
  assert.equal(menu.items[1].state, "locked");
  assert.equal(menu.items[1].accessible, false);
});

test("a menu link that points past a locked branch stays locked", async () => {
  const root = child("Page.root", "main", "");
  const archives = child("Page.archives", "archives", "main", "visible", "locked");
  const quarantine = child("Page.quarantine", "quarantine-protocol", "archives");
  const journal = { pages: { contents: [root, archives, quarantine] }, testUserPermission: () => true };
  for (const page of journal.pages.contents) page.parent = journal;

  const node = { type: "menu", mode: "explicit", items: [{ type: "menuItem", label: "QUARANTINE", target: "terminal:quarantine-protocol" }] };
  const menu = await resolveMenu(node, root, { user });
  assert.equal(menu.items[0].pageUuid, quarantine.uuid);
  assert.equal(menu.items[0].state, "locked");
  assert.equal(menu.items[0].accessible, false);

  const unlocked = await resolveMenu(node, root, { user, sessionUnlocks: new Set([archives.uuid]) });
  assert.equal(unlocked.items[0].accessible, true);
});

test("a menu link that points past a hidden branch is dropped entirely", async () => {
  const root = child("Page.root", "main", "");
  const incident = child("Page.incident", "incident-1979", "main", "hidden");
  const log = child("Page.log", "lab-b-log", "incident-1979");
  const journal = { pages: { contents: [root, incident, log] }, testUserPermission: () => true };
  for (const page of journal.pages.contents) page.parent = journal;

  const menu = await resolveMenu(
    { type: "menu", mode: "explicit", items: [{ type: "menuItem", label: "LAB LOG", target: "terminal:lab-b-log" }] },
    root,
    { user }
  );
  assert.deepEqual(menu.items, []);
});
