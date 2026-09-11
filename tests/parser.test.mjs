import assert from "node:assert/strict";
import test from "node:test";
import { parseTerminalMarkup } from "../scripts/parser/parser.mjs";

test("parses headings, inline markup, lists and paragraphs", () => {
  const ast = parseTerminalMarkup("# SYSTEM\n\nHello **operator** and `root`.\n\n- one\n- two");
  assert.equal(ast.children[0].type, "heading");
  assert.equal(ast.children[1].children[1].type, "strong");
  assert.equal(ast.children[2].type, "list");
  assert.equal(ast.children[2].items.length, 2);
});

test("parses automatic child menus", () => {
  const ast = parseTerminalMarkup("::menu children\n::end");
  assert.deepEqual(ast.children[0], { type: "menu", mode: "children", items: [], location: { line: 1 } });
});

test("parses explicit local and UUID menu links", () => {
  const ast = parseTerminalMarkup("::menu\n[HOME](terminal:home)\n[FILE](@UUID[JournalEntry.a.JournalEntryPage.b])\n::end");
  assert.equal(ast.children[0].items[0].target, "terminal:home");
  assert.equal(ast.children[0].items[1].target, "@UUID[JournalEntry.a.JournalEntryPage.b]");
});

test("reports unclosed and invalid directives without throwing", () => {
  const ast = parseTerminalMarkup("::menu\nnot a link");
  assert.equal(ast.diagnostics.filter(item => item.severity === "error").length, 1);
  assert.equal(ast.diagnostics.filter(item => item.code === "invalid-menu-entry").length, 1);
});
