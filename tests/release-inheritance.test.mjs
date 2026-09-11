import assert from "node:assert/strict";
import test from "node:test";
import { PAGE_TYPE } from "../scripts/constants.mjs";
import { resolveRelease } from "../scripts/resolver/release-resolver.mjs";

const player = { isGM: false };
const gm = { isGM: true };

function page(pageId, { parent = "", visibility = "visible", access = "available", lockType = "none" } = {}) {
  return {
    uuid: `JournalEntry.station.JournalEntryPage.${pageId}`,
    name: pageId,
    type: PAGE_TYPE,
    documentName: "JournalEntryPage",
    sort: 0,
    testUserPermission: () => true,
    system: {
      pageId,
      navigation: { parent, sort: 0 },
      release: { visibility, access },
      lock: { type: lockType }
    }
  };
}

function journal(...pages) {
  const entry = { uuid: "JournalEntry.station", pages: { contents: pages }, testUserPermission: () => true };
  for (const item of pages) item.parent = entry;
  return entry;
}

test("a page inside a locked branch cannot be opened without unlocking the branch", () => {
  const archives = page("archives", { parent: "main", access: "locked", lockType: "password" });
  const quarantine = page("quarantine-protocol", { parent: "archives" });
  journal(page("main"), archives, quarantine);

  const release = resolveRelease(quarantine, { user: player });
  assert.equal(release.state, "locked");
  assert.equal(release.accessible, false);
  assert.equal(release.reason, "password");
  assert.equal(release.blockedBy, archives.uuid);
});

test("unlocking a locked ancestor releases every page below it", () => {
  const archives = page("archives", { parent: "main", access: "locked", lockType: "password" });
  const quarantine = page("quarantine-protocol", { parent: "archives" });
  const appendix = page("appendix", { parent: "quarantine-protocol" });
  journal(page("main"), archives, quarantine, appendix);

  const unlocked = { user: player, sessionUnlocks: new Set([archives.uuid]) };
  assert.equal(resolveRelease(quarantine, unlocked).accessible, true);
  assert.equal(resolveRelease(quarantine, unlocked).state, "available");
  assert.equal(resolveRelease(appendix, unlocked).accessible, true);
});

test("a page inherits the lock of a grandparent, not only of its direct parent", () => {
  const archives = page("archives", { parent: "main", access: "locked", lockType: "password" });
  const incident = page("incident-1979", { parent: "archives" });
  const log = page("lab-b-log", { parent: "incident-1979" });
  journal(page("main"), archives, incident, log);

  assert.equal(resolveRelease(log, { user: player }).accessible, false);
  assert.equal(resolveRelease(log, { user: player }).blockedBy, archives.uuid);
});

test("a page below a hidden ancestor is hidden even when it is published itself", () => {
  const incident = page("incident-1979", { parent: "main", visibility: "hidden" });
  const log = page("lab-b-log", { parent: "incident-1979" });
  journal(page("main"), incident, log);

  const release = resolveRelease(log, { user: player });
  assert.equal(release.state, "hidden");
  assert.equal(release.visible, false);
  assert.equal(release.reason, "hidden");
  assert.equal(release.blockedBy, incident.uuid);
});

test("the most restrictive ancestor wins so a hidden branch outranks a locked one", () => {
  const hidden = page("hidden-root", { parent: "", visibility: "hidden" });
  const archives = page("archives", { parent: "hidden-root", access: "locked", lockType: "password" });
  const leaf = page("leaf", { parent: "archives" });
  journal(hidden, archives, leaf);

  assert.equal(resolveRelease(leaf, { user: player }).state, "hidden");
  assert.equal(resolveRelease(leaf, { user: player }).blockedBy, hidden.uuid);
});

test("a parent cycle stops the walk instead of hanging the render", () => {
  const left = page("left", { parent: "right" });
  const right = page("right", { parent: "left" });
  journal(left, right);

  assert.equal(resolveRelease(left, { user: player }).state, "available");

  const selfParent = page("loop", { parent: "loop" });
  journal(selfParent);
  assert.equal(resolveRelease(selfParent, { user: player }).state, "available");
});

test("a cycle that contains a lock still blocks instead of looping forever", () => {
  const vault = page("vault", { parent: "annex", access: "locked", lockType: "password" });
  const annex = page("annex", { parent: "vault" });
  journal(vault, annex);

  assert.equal(resolveRelease(annex, { user: player }).accessible, false);
  assert.equal(resolveRelease(annex, { user: player }).blockedBy, vault.uuid);
});

test("an unknown parent id leaves the page reachable", () => {
  const orphan = page("orphan", { parent: "does-not-exist" });
  journal(page("main"), orphan);

  assert.equal(resolveRelease(orphan, { user: player }).accessible, true);
});

test("parent ids match regardless of letter case", () => {
  const archives = page("archives", { parent: "main", access: "locked", lockType: "password" });
  const quarantine = page("quarantine-protocol", { parent: "ARCHIVES" });
  journal(page("main"), archives, quarantine);

  assert.equal(resolveRelease(quarantine, { user: player }).accessible, false);
});

test("GM debug mode still reveals content buried under a locked ancestor", () => {
  const archives = page("archives", { parent: "main", access: "locked", lockType: "password" });
  const quarantine = page("quarantine-protocol", { parent: "archives" });
  journal(page("main"), archives, quarantine);

  const release = resolveRelease(quarantine, { user: gm, gmDebug: true });
  assert.equal(release.visible, true);
  assert.equal(release.accessible, true);
  assert.equal(release.state, "available");
});

test("inherited restrictions do not add keys to an unrestricted release", () => {
  const leaf = page("leaf", { parent: "main" });
  journal(page("main"), leaf);

  assert.deepEqual(resolveRelease(leaf, { user: player }), {
    state: "available", visible: true, accessible: true, reason: null
  });
});
