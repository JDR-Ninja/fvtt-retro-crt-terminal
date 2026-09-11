import assert from "node:assert/strict";
import test from "node:test";
import { characterDelay, startTypewriter } from "../scripts/runtime/typewriter-controller.mjs";

test("typewriter can reveal all remaining text immediately", () => {
  const textNodes = [textNode("SYSTEM"), textNode("ONLINE")];
  const container = fakeContainer(textNodes);
  let completed = 0;

  const controller = startTypewriter(container, { speed: 60, delay: 1000, onComplete: () => completed += 1 });

  assert.equal(textNodes[0].data, "");
  assert.equal(textNodes[1].data, "");
  assert.equal(container.classList.has("is-typing"), true);
  assert.equal(container.attributes.get("aria-busy"), "true");

  controller.finish();

  assert.equal(textNodes[0].data, "SYSTEM");
  assert.equal(textNodes[1].data, "ONLINE");
  assert.equal(container.classList.has("is-typing"), false);
  assert.equal(container.attributes.has("aria-busy"), false);
  assert.equal(controller.active, false);
  assert.equal(completed, 1);
});

test("typewriter punctuation creates a perceptible pause", () => {
  assert.equal(characterDelay("A", 18), 18);
  assert.equal(characterDelay(",", 18), 54);
  assert.equal(characterDelay(".", 18), 108);
  assert.equal(characterDelay("x", 18, true), 72);
});

function textNode(data) {
  return { data, parentElement: { closest: () => null } };
}

function fakeContainer(nodes) {
  let index = 0;
  const listeners = new Map();
  const classNames = new Set();
  const attributes = new Map();
  const NodeFilter = { SHOW_TEXT: 4, FILTER_ACCEPT: 1, FILTER_REJECT: 2 };
  return {
    ownerDocument: {
      defaultView: { NodeFilter },
      createTreeWalker(_root, _whatToShow, filter) {
        return {
          nextNode() {
            while (index < nodes.length) {
              const node = nodes[index++];
              if (filter.acceptNode(node) === NodeFilter.FILTER_ACCEPT) return node;
            }
            return null;
          }
        };
      }
    },
    classList: {
      add: value => classNames.add(value),
      remove: value => classNames.delete(value),
      has: value => classNames.has(value)
    },
    attributes,
    setAttribute: (name, value) => attributes.set(name, value),
    removeAttribute: name => attributes.delete(name),
    addEventListener: (name, handler) => listeners.set(name, handler),
    removeEventListener: name => listeners.delete(name)
  };
}
