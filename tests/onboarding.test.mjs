import assert from "node:assert/strict";
import test from "node:test";

class ApplicationV2 {
  async close() {
    this.closed = true;
  }

  async _onClose() {}
}

const HandlebarsApplicationMixin = Base => class extends Base {};

globalThis.foundry = {
  applications: {
    api: { ApplicationV2, HandlebarsApplicationMixin, DialogV2: class {} },
    instances: new Map()
  },
  utils: { fromUuid: async () => null }
};

const settings = new Map([
  ["guideSeenVersion", ""],
  ["guideDisabled", false]
]);
const writes = [];

globalThis.game = {
  modules: { get: () => ({ version: "0.1.0" }) },
  settings: {
    get: (_moduleId, key) => settings.get(key),
    set: async (_moduleId, key, value) => {
      settings.set(key, value);
      writes.push([key, value]);
    }
  },
  user: { isGM: true },
  journal: { contents: [] }
};

const { TerminalOnboardingApplication, ensureOnboardingExample } = await import(
  `../scripts/applications/terminal-onboarding-application.mjs?test=${Date.now()}`
);

test("closing onboarding implicitly does not mark the guide as seen", async () => {
  const app = new TerminalOnboardingApplication();

  await app._onClose({});

  assert.deepEqual(writes, []);
  assert.equal(settings.get("guideSeenVersion"), "");
});

test("the explicit dismiss action marks the current version as seen", async () => {
  const app = new TerminalOnboardingApplication();

  await TerminalOnboardingApplication.onDismiss.call(app);

  assert.deepEqual(writes, [["guideSeenVersion", "0.1.0"]]);
  assert.equal(settings.get("guideSeenVersion"), "0.1.0");
  assert.equal(app.closed, true);
});

test("onboarding creates the demo when no recognized example exists", async () => {
  const created = { uuid: "JournalEntry.created" };
  let createCalls = 0;

  const result = await ensureOnboardingExample({
    journals: [],
    createExample: async () => {
      createCalls++;
      return created;
    }
  });

  assert.equal(createCalls, 1);
  assert.equal(result.journal, created);
  assert.equal(result.notice, "RETRO_CRT_TERMINAL.Example.Created");
});

test("onboarding reuses a complete demo instead of creating a duplicate", async () => {
  const existing = exampleJournal();
  let createCalls = 0;
  let updateCalls = 0;

  const result = await ensureOnboardingExample({
    journals: [existing],
    createExample: async () => { createCalls++; },
    updateExample: async () => { updateCalls++; }
  });

  assert.equal(createCalls, 0);
  assert.equal(updateCalls, 0);
  assert.equal(result.journal, existing);
  assert.equal(result.notice, null);
});

test("onboarding repairs a recognized incomplete demo", async () => {
  const existing = exampleJournal({ enabled: false, pages: [] });
  const repaired = exampleJournal();
  let updatedJournal;

  const result = await ensureOnboardingExample({
    journals: [existing],
    updateExample: async journal => {
      updatedJournal = journal;
      return repaired;
    }
  });

  assert.equal(updatedJournal, existing);
  assert.equal(result.journal, repaired);
  assert.equal(result.notice, "RETRO_CRT_TERMINAL.Example.Updated");
});

function exampleJournal({ enabled = true, pages = [{ documentName: "JournalEntryPage", type: "retro-crt-terminal.terminal" }] } = {}) {
  return {
    uuid: "JournalEntry.example",
    name: "Orpheus",
    pages: { contents: pages },
    getFlag: () => ({
      enabled,
      terminalId: "orpheus-security-console",
      label: "Orpheus",
      launcher: { published: true, sort: 0 }
    })
  };
}
