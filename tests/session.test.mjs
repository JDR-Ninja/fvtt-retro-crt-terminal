import assert from "node:assert/strict";
import test from "node:test";
import { TerminalSession } from "../scripts/runtime/terminal-session.mjs";

test("session navigation maintains history and unlocks", () => {
  const session = new TerminalSession({ terminalRootUuid: "JournalEntry.root", currentPageUuid: "Page.home" });
  session.navigate("Page.files");
  session.navigate("Page.secret");
  assert.equal(session.back(), "Page.files");
  assert.equal(session.currentPageUuid, "Page.files");
  session.unlock("Page.secret");
  assert.equal(session.sessionUnlocks.has("Page.secret"), true);
  session.home("Page.home");
  assert.deepEqual(session.history, []);
});
