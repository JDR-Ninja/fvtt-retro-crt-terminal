import assert from "node:assert/strict";
import test from "node:test";
import { applySharedAction, createSharedSessionState, stopSharedSession, updateSharedParticipants } from "../scripts/sync/shared-session-state.mjs";

function session() {
  return createSharedSessionState({
    terminalRootUuid: "JournalEntry.root",
    currentPageUuid: "Page.home",
    homePageUuid: "Page.home",
    controllerUserId: "user-a",
    audienceUserIds: ["user-a", "user-b"],
    managerUserId: "gm",
    previousRevision: 4
  });
}

test("controller navigation produces a monotonic shared history", () => {
  let state = session();
  assert.equal(state.revision, 5);
  state = applySharedAction(state, "select", { index: 2 });
  assert.equal(state.selectedIndex, 2);
  state = applySharedAction(state, "navigate", { pageUuid: "Page.files" });
  assert.equal(state.currentPageUuid, "Page.files");
  assert.deepEqual(state.history, ["Page.home"]);
  assert.equal(state.selectedIndex, 0);
  state = applySharedAction(state, "back");
  assert.equal(state.currentPageUuid, "Page.home");
  assert.equal(state.revision, 7);
});

test("moving the menu cursor does not consume a shared revision", () => {
  const state = session();
  const moved = applySharedAction(state, "select", { index: 3 });
  assert.equal(moved.selectedIndex, 3);
  assert.equal(moved.revision, state.revision);
  assert.equal(applySharedAction(moved, "navigate", { pageUuid: "Page.files" }).revision, state.revision + 1);
});

test("shared unlocks and home navigation are part of the observed state", () => {
  let state = applySharedAction(session(), "navigate", { pageUuid: "Page.secret" });
  state = applySharedAction(state, "unlock", { pageUuid: "Page.secret" });
  assert.deepEqual(state.sessionUnlocks, ["Page.secret"]);
  state = applySharedAction(state, "home");
  assert.equal(state.currentPageUuid, "Page.home");
  assert.deepEqual(state.history, []);
});

test("participant updates transfer control and preserve the controller in the audience", () => {
  const state = session();
  const transferred = updateSharedParticipants(state, {
    controllerUserId: "user-b",
    audienceUserIds: ["user-c"],
    managerUserId: "gm"
  });
  assert.equal(transferred.controllerUserId, "user-b");
  assert.deepEqual(transferred.audienceUserIds, ["user-c", "user-b"]);
  const stopped = stopSharedSession(transferred, "gm");
  assert.equal(stopped.active, false);
  assert.ok(stopped.revision > transferred.revision);
});
