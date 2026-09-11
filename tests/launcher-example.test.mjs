import assert from "node:assert/strict";
import test from "node:test";
import { prepareLauncherTerminalContext } from "../scripts/applications/terminal-launcher-context.mjs";

const TERMINAL_PAGE = { documentName: "JournalEntryPage", type: "retro-crt-terminal.terminal" };

test("offers demo creation to a GM even when another terminal is already listed", () => {
  const context = prepareLauncherTerminalContext([
    journal({ uuid: "JournalEntry.custom", terminalId: "custom-terminal", label: "Custom Terminal" })
  ], { isGM: true });

  assert.equal(context.empty, false);
  assert.equal(context.terminals.length, 1);
  assert.equal(context.canCreateExample, true);
  assert.equal(context.canRestoreExample, false);
});

test("does not offer a duplicate when the complete demo is already listed", () => {
  const context = prepareLauncherTerminalContext([
    journal({ uuid: "JournalEntry.example", terminalId: "orpheus-security-console", label: "Orpheus" })
  ], { isGM: true });

  assert.equal(context.canCreateExample, false);
  assert.equal(context.canRestoreExample, false);
  assert.equal(context.terminals[0].isExample, true);
});

test("offers to repair a recognized demo that is disabled or incomplete", () => {
  const context = prepareLauncherTerminalContext([
    journal({ uuid: "JournalEntry.custom", terminalId: "custom-terminal", label: "Custom Terminal" }),
    journal({ uuid: "JournalEntry.example", terminalId: "orpheus-security-console", label: "Old Demo", enabled: false, pages: [] })
  ], { isGM: true });

  assert.equal(context.empty, false);
  assert.equal(context.canCreateExample, false);
  assert.equal(context.canRestoreExample, true);
  assert.equal(context.exampleUuid, "JournalEntry.example");
});

function journal({ uuid, terminalId, label, enabled = true, pages = [TERMINAL_PAGE] }) {
  return {
    uuid,
    name: label,
    pages: { contents: pages },
    getFlag: () => ({
      enabled,
      terminalId,
      label,
      launcher: { published: true, sort: 0 }
    })
  };
}
