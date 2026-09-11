import assert from "node:assert/strict";
import test from "node:test";
import { MODULE_ID } from "../scripts/constants.mjs";
import { sharedSessionManager, SHARED_SESSION_FLAG } from "../scripts/sync/shared-session-manager.mjs";

function baseState(overrides = {}) {
  return {
    active: true,
    sessionId: "session",
    terminalRootUuid: "JournalEntry.root",
    currentPageUuid: "Page.home",
    homePageUuid: "Page.home",
    history: [],
    selectedIndex: 0,
    sessionUnlocks: [],
    controllerUserId: "controller",
    audienceUserIds: ["controller", "observer"],
    managerUserId: "gm",
    revision: 1,
    updatedAt: 1,
    ...overrides
  };
}

function asObserver(state = baseState()) {
  const controller = { id: "controller", active: true, flag: null };
  controller.getFlag = (scope, key) => scope === MODULE_ID && key === SHARED_SESSION_FLAG ? controller.flag : undefined;
  globalThis.game = {
    user: { id: "observer", isGM: false },
    users: new Map([["controller", controller]])
  };
  sharedSessionManager.state = structuredClone(state);
  sharedSessionManager.applications.clear();
  const application = {
    rendered: true,
    root: { uuid: state.terminalRootUuid },
    sharedSessionId: state.sessionId,
    applied: [],
    closed: 0,
    applySharedState(next, options) { this.applied.push({ selectedIndex: next.selectedIndex, ...options }); },
    async close() { this.closed += 1; }
  };
  sharedSessionManager.applications.add(application);
  return { controller, application };
}

test("a forged socket packet impersonating the controller cannot move the terminal or unlock pages", async () => {
  asObserver();

  await sharedSessionManager.receive({
    type: "controller-state",
    senderUserId: "controller",
    sessionId: "session",
    selectionOnly: false,
    state: baseState({
      currentPageUuid: "Page.secret",
      history: ["Page.home"],
      sessionUnlocks: ["Page.secret", "Page.archive"],
      revision: 99
    })
  });

  assert.equal(sharedSessionManager.state.currentPageUuid, "Page.home");
  assert.deepEqual(sharedSessionManager.state.history, []);
  assert.deepEqual(sharedSessionManager.state.sessionUnlocks, []);
  assert.equal(sharedSessionManager.state.revision, 1);
});

test("a selection packet carrying extra state still only moves the menu cursor", async () => {
  const { application } = asObserver();

  await sharedSessionManager.receive({
    type: "controller-state",
    senderUserId: "controller",
    sessionId: "session",
    selectionOnly: true,
    selectedIndex: 2,
    state: baseState({ currentPageUuid: "Page.secret", sessionUnlocks: ["Page.secret"], revision: 99 })
  });

  assert.equal(sharedSessionManager.state.selectedIndex, 2);
  assert.equal(sharedSessionManager.state.currentPageUuid, "Page.home");
  assert.deepEqual(sharedSessionManager.state.sessionUnlocks, []);
  assert.equal(sharedSessionManager.state.revision, 1);
  assert.deepEqual(application.applied, [{ selectedIndex: 2, selectionOnly: true }]);
});

test("a socket packet from a user who is not the controller is dropped", async () => {
  asObserver();

  await sharedSessionManager.receive({
    type: "controller-state",
    senderUserId: "intruder",
    sessionId: "session",
    selectionOnly: true,
    selectedIndex: 4
  });

  assert.equal(sharedSessionManager.state.selectedIndex, 0);
});

test("navigation and unlocks are accepted from the controller's User flag", async () => {
  const { controller } = asObserver();
  controller.flag = baseState({
    currentPageUuid: "Page.secret",
    history: ["Page.home"],
    sessionUnlocks: ["Page.secret"],
    revision: 2
  });

  assert.equal(await sharedSessionManager.acceptControllerState(controller), true);
  assert.equal(sharedSessionManager.state.currentPageUuid, "Page.secret");
  assert.deepEqual(sharedSessionManager.state.history, ["Page.home"]);
  assert.deepEqual(sharedSessionManager.state.sessionUnlocks, ["Page.secret"]);
});

test("a User flag from a bystander never reshapes the session", async () => {
  asObserver();
  const bystander = {
    id: "intruder",
    getFlag: () => baseState({ currentPageUuid: "Page.secret", sessionUnlocks: ["Page.secret"], revision: 99 })
  };

  assert.equal(await sharedSessionManager.acceptControllerState(bystander), false);
  assert.equal(sharedSessionManager.state.currentPageUuid, "Page.home");
  assert.deepEqual(sharedSessionManager.state.sessionUnlocks, []);
});

test("a controller flag describing another terminal or audience is rejected", async () => {
  const { controller } = asObserver();
  controller.flag = baseState({ terminalRootUuid: "JournalEntry.other", currentPageUuid: "Page.other", revision: 9 });
  assert.equal(await sharedSessionManager.acceptControllerState(controller), false);

  controller.flag = baseState({ audienceUserIds: ["controller"], currentPageUuid: "Page.other", revision: 9 });
  assert.equal(await sharedSessionManager.acceptControllerState(controller), false);
  assert.equal(sharedSessionManager.state.currentPageUuid, "Page.home");
});

test("a stopped managed session cannot be revived by an older controller snapshot", async () => {
  const { controller } = asObserver();
  controller.flag = baseState({ active: true, revision: 50 });
  const stopped = baseState({ active: false, revision: 3 });
  sharedSessionManager.state = baseState({ active: true, revision: 2 });

  await sharedSessionManager.acceptPersistedState(stopped);

  assert.equal(sharedSessionManager.state.active, false);
  assert.equal(sharedSessionManager.state.revision, 3);
});
