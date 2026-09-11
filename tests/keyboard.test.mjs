import assert from "node:assert/strict";
import test from "node:test";
import { KeyboardController } from "../scripts/runtime/keyboard-controller.mjs";

test("terminal arrow navigation does not propagate to Foundry scene controls", () => {
  const application = fakeApplication([button(), button()]);
  const event = keyEvent("ArrowDown");

  new KeyboardController(application).handle(event);

  assert.equal(application.session.selectedIndex, 1);
  assert.equal(event.prevented, 1);
  assert.equal(event.stopped, 1);
  assert.equal(application.buttons[1].focused, 1);
});

test("arrow keys are swallowed on a page that has no menu", () => {
  for (const key of ["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight"]) {
    const application = fakeApplication([]);
    const event = keyEvent(key);

    new KeyboardController(application).handle(event);

    assert.equal(event.prevented, 1, `${key} must not reach the canvas`);
    assert.equal(event.stopped, 1, `${key} must not reach the canvas`);
  }
});

test("a digit beyond the menu never reaches the Foundry hotbar", () => {
  const application = fakeApplication([button()]);
  const event = keyEvent("5");

  new KeyboardController(application).handle(event);

  assert.equal(event.prevented, 1);
  assert.equal(event.stopped, 1);
  assert.equal(application.buttons[0].clicked, 0);
  assert.equal(application.session.selectedIndex, 0);
});

test("a digit within the menu still activates its entry", () => {
  const application = fakeApplication([button(), button()]);
  const event = keyEvent("2");

  new KeyboardController(application).handle(event);

  assert.equal(event.prevented, 1);
  assert.equal(application.session.selectedIndex, 1);
  assert.equal(application.buttons[1].clicked, 1);
  // A locked entry opens a prompt over a menu that stays on screen: the cursor must have moved.
  assert.deepEqual(application.buttons.map(item => item.selected), [false, true]);
  assert.equal(application.buttons[1].focused, 1);
});

test("a synchronized spectator cannot navigate but cannot move the camera either", () => {
  const application = fakeApplication([button(), button()]);
  application.canControl = false;
  application.synchronized = true;
  const event = keyEvent("ArrowDown");

  new KeyboardController(application).handle(event);

  assert.equal(application.session.selectedIndex, 0);
  assert.equal(event.prevented, 1);
  assert.equal(event.stopped, 1);
});

test("a spectator pressing Escape stays in the shared presentation", () => {
  const application = fakeApplication([button()]);
  application.canControl = false;
  application.synchronized = true;
  const event = keyEvent("Escape");

  new KeyboardController(application).handle(event);

  assert.equal(event.prevented, 1, "Foundry would otherwise close the window and drop the observer");
  assert.equal(event.stopped, 1);
  assert.equal(application.backs, 0);
});

test("the controller pressing Escape still navigates back", () => {
  const application = fakeApplication([button()]);
  const event = keyEvent("Escape");

  new KeyboardController(application).handle(event);

  assert.equal(event.prevented, 1);
  assert.equal(application.backs, 1);
});

test("keys typed into a login field are left to the browser", () => {
  const application = fakeApplication([button()]);
  const event = keyEvent("1");
  event.target.matches = () => true;

  new KeyboardController(application).handle(event);

  assert.equal(event.prevented, 0);
  assert.equal(application.buttons[0].clicked, 0);
});

function fakeApplication(buttons) {
  const application = {
    isTyping: false,
    canControl: true,
    synchronized: false,
    buttons,
    backs: 0,
    session: { selectedIndex: 0 },
    element: { querySelectorAll: () => buttons },
    goBack: () => application.backs += 1
  };
  return application;
}

function keyEvent(key) {
  const event = {
    key,
    prevented: 0,
    stopped: 0,
    target: { matches: () => false },
    preventDefault: () => event.prevented += 1,
    stopPropagation: () => event.stopped += 1
  };
  return event;
}

function button() {
  const node = {
    focused: 0,
    clicked: 0,
    selected: false,
    classList: { toggle: (name, force) => { if (name === "is-selected") node.selected = Boolean(force); } },
    focus: () => node.focused += 1,
    click: () => node.clicked += 1,
    scrollIntoView: () => {}
  };
  return node;
}
