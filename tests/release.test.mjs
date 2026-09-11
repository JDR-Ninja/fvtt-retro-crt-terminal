import assert from "node:assert/strict";
import test from "node:test";
import { resolveRelease } from "../scripts/resolver/release-resolver.mjs";

const player = { isGM: false };
const gm = { isGM: true };

function page(visibility, access, uuid = "Page.test") {
  return {
    uuid,
    documentName: "JournalEntryPage",
    parent: { testUserPermission: () => true },
    testUserPermission: () => true,
    system: { release: { visibility, access }, lock: { type: "password" } }
  };
}

test("hidden content is omitted for players", () => {
  assert.deepEqual(resolveRelease(page("hidden", "available"), { user: player }), {
    state: "hidden", visible: false, accessible: false, reason: "hidden"
  });
});

test("locked content is visible but inaccessible until session unlock", () => {
  const target = page("visible", "locked");
  assert.equal(resolveRelease(target, { user: player }).state, "locked");
  assert.equal(resolveRelease(target, { user: player, sessionUnlocks: new Set([target.uuid]) }).accessible, true);
});

test("GM debug mode exposes hidden content", () => {
  const release = resolveRelease(page("hidden", "locked"), { user: gm, gmDebug: true });
  assert.equal(release.visible, true);
  assert.equal(release.accessible, true);
  assert.equal(release.state, "hidden-debug");
});
