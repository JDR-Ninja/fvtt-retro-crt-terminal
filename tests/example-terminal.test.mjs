import assert from "node:assert/strict";
import test from "node:test";
import { createSecurityConsoleExample, updateSecurityConsoleExample } from "../scripts/examples/security-console-example.mjs";

test("creates a published, player-readable security console example", async () => {
  let createdData;
  let createdOptions;
  let storedConfig;

  globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { OBSERVER: 2 } };
  globalThis.game = {
    user: { isGM: true },
    i18n: { localize: key => key }
  };
  const JournalEntryClass = {
    async create(data, options) {
      createdData = data;
      createdOptions = options;
      const pages = data.pages.map((page, index) => ({
        ...page,
        uuid: `JournalEntry.example.JournalEntryPage.page${index}`
      }));
      return {
        name: data.name,
        uuid: "JournalEntry.example",
        pages: { contents: pages },
        getFlag: () => null,
        async setFlag(scope, key, config) {
          assert.equal(scope, "retro-crt-terminal");
          assert.equal(key, "terminal");
          storedConfig = config;
        }
      };
    }
  };
  globalThis.foundry = { utils: { getDocumentClass: () => JournalEntryClass } };

  const journal = await createSecurityConsoleExample();

  assert.equal(journal.uuid, "JournalEntry.example");
  assert.equal(createdOptions.renderSheet, false);
  assert.equal(createdData.ownership.default, 2);
  assert.equal(createdData.pages.length, 17);
  assert.deepEqual(createdData.pages.map(page => page.system.pageId), [
    "main", "public-access", "station-overview", "deck-directory", "science-deck", "laboratory-index",
    "status", "personnel", "lena-voss", "marc-tannhauser", "elise-ward",
    "communications", "diagnostics", "archives", "quarantine-protocol", "incident-1979", "lab-b-log"
  ]);
  assert.equal(createdData.pages[13].system.release.access, "locked");
  assert.equal(createdData.pages[13].system.lock.secret, "ORPHEE-79");
  assert.equal(createdData.pages[15].system.release.visibility, "hidden");
  assert.equal(createdData.pages[16].system.release.visibility, "hidden");
  for (const pageId of ["public-access", "station-overview", "deck-directory", "science-deck", "laboratory-index"]) {
    const page = createdData.pages.find(candidate => candidate.system.pageId === pageId);
    assert.equal(page.system.release.visibility, "visible");
    assert.equal(page.system.release.access, "available");
  }
  assert.equal(storedConfig.enabled, true);
  assert.equal(storedConfig.launcher.published, true);
  assert.equal(storedConfig.startPageUuid, "JournalEntry.example.JournalEntryPage.page0");
});

test("updates an existing short demo without replacing its Journal", async () => {
  let journalUpdates = 0;
  let pageUpdates = 0;
  let storedConfig;
  const mainPage = {
    uuid: "JournalEntry.example.JournalEntryPage.main",
    system: { pageId: "main", source: "OLD" },
    async update(data) {
      pageUpdates += 1;
      Object.assign(this, data);
    }
  };
  const journal = {
    name: "Old demo",
    uuid: "JournalEntry.example",
    pages: { contents: [mainPage] },
    async update() { journalUpdates += 1; },
    async createEmbeddedDocuments(_type, documents) {
      const created = documents.map((document, index) => ({
        ...document,
        uuid: `JournalEntry.example.JournalEntryPage.new${index}`,
        update: async () => {}
      }));
      this.pages.contents.push(...created);
      return created;
    },
    getFlag: () => null,
    async setFlag(_scope, _key, config) { storedConfig = config; }
  };
  globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { OBSERVER: 2 } };
  globalThis.game = { user: { isGM: true }, i18n: { localize: key => key } };
  globalThis.foundry = { utils: { getDocumentClass: () => ({ create: async () => null }) } };

  const updated = await updateSecurityConsoleExample(journal);

  assert.equal(updated, journal);
  assert.equal(journalUpdates, 1);
  assert.equal(pageUpdates, 1);
  assert.equal(journal.pages.contents.length, 17);
  assert.equal(mainPage.system.source, "RETRO_CRT_TERMINAL.Example.MainSource");
  assert.equal(storedConfig.startPageUuid, mainPage.uuid);
  assert.equal(storedConfig.launcher.published, true);
});

test("refuses example creation for non-GM users", async () => {
  globalThis.game = {
    user: { isGM: false },
    i18n: { localize: key => key }
  };
  await assert.rejects(() => createSecurityConsoleExample(), /RETRO_CRT_TERMINAL\.Sync\.GmOnly/);
});
