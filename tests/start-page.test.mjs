import assert from "node:assert/strict";
import test from "node:test";
import { PAGE_TYPE } from "../scripts/constants.mjs";
import { resolveStartPage } from "../scripts/resolver/document-resolver.mjs";

function page(pageId, sort = 0) {
  return {
    uuid: `JournalEntry.station.JournalEntryPage.${pageId}`,
    name: pageId,
    type: PAGE_TYPE,
    documentName: "JournalEntryPage",
    sort,
    system: { pageId, navigation: { parent: "", sort }, release: { visibility: "visible", access: "available" }, lock: { type: "none" } }
  };
}

function journal(uuid, ...pages) {
  const entry = { uuid, name: "Orpheus Station", pages: { contents: pages } };
  for (const item of pages) item.parent = entry;
  return entry;
}

test("a terminal page id opens that page instead of falling back to the start page", async () => {
  const main = page("main", 0);
  const archives = page("archives", 500);
  const entry = journal("JournalEntry.station", main, archives);

  assert.equal(await resolveStartPage(entry, "terminal:archives"), archives);
});

test("a terminal page id is matched regardless of letter case and padding", async () => {
  const main = page("main", 0);
  const archives = page("archives", 500);
  const entry = journal("JournalEntry.station", main, archives);

  assert.equal(await resolveStartPage(entry, "terminal: ARCHIVES "), archives);
});

test("an unknown terminal page id falls back to the first page of the terminal", async () => {
  const main = page("main", 0);
  const archives = page("archives", 500);
  const entry = journal("JournalEntry.station", main, archives);

  assert.equal(await resolveStartPage(entry, "terminal:nowhere"), main);
});

test("a terminal page id never reaches into another journal", async () => {
  const main = page("main", 0);
  const entry = journal("JournalEntry.station", main);
  journal("JournalEntry.other", page("archives", 500));

  assert.equal(await resolveStartPage(entry, "terminal:archives"), main);
});
