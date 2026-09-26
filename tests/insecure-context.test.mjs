import assert from "node:assert/strict";
import test from "node:test";
import { parseTerminalMarkup } from "../scripts/parser/parser.mjs";
import { renderTerminalBlocks } from "../scripts/render/terminal-renderer.mjs";
import { createSharedSessionState } from "../scripts/sync/shared-session-state.mjs";

// A player who joins a self-hosted world over plain HTTP is outside a secure context: the browser
// exposes crypto.getRandomValues() but no crypto.randomUUID(), and the module threw on it (issue #1).

test("a password prompt renders outside a secure context, its label bound to the field", t => {
  outsideSecureContext(t);
  stubDocument(t);
  const container = fakeElement("main");

  renderTerminalBlocks(container, { blocks: parseTerminalMarkup("::login\nprompt: ACCESS CODE\n::end").children, diagnostics: [] });

  const [label, input] = container.children[0].children;
  assert.equal(input.type, "password");
  assert.ok(input.id);
  assert.equal(label.htmlFor, input.id);
});

test("a synchronized session starts outside a secure context, under an id of its own", t => {
  outsideSecureContext(t);
  const start = () => createSharedSessionState({
    terminalRootUuid: "JournalEntry.root",
    currentPageUuid: "Page.home",
    controllerUserId: "user-a",
    audienceUserIds: ["user-a", "user-b"],
    managerUserId: "gm"
  });

  const first = start();
  const second = start();
  assert.equal(typeof first.sessionId, "string");
  assert.ok(first.sessionId);
  assert.notEqual(first.sessionId, second.sessionId);
});

function outsideSecureContext(t) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  const secure = globalThis.crypto;
  Object.defineProperty(globalThis, "crypto", { configurable: true, value: { getRandomValues: array => secure.getRandomValues(array) } });
  t.after(() => Object.defineProperty(globalThis, "crypto", descriptor));
}

function stubDocument(t) {
  const previous = globalThis.document;
  globalThis.document = {
    createElement: tag => fakeElement(tag),
    createTextNode: text => ({ tag: "#text", text, children: [] })
  };
  t.after(() => { globalThis.document = previous; });
}

function fakeElement(tag) {
  return {
    tag,
    className: "",
    dataset: {},
    children: [],
    listeners: {},
    append(...nodes) { this.children.push(...nodes); },
    replaceChildren(...nodes) { this.children = nodes; },
    setAttribute() {},
    addEventListener(name, handler) { this.listeners[name] = handler; }
  };
}
