const CANVAS_KEYS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

export class KeyboardController {
  constructor(application) {
    this.application = application;
  }

  handle(event) {
    if (this.application.isTyping && !["Alt", "Control", "Meta", "Shift", "CapsLock", "Tab"].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      this.application.finishTyping();
      return;
    }
    if (event.target?.matches?.("input, textarea, select")) return;
    if (CANVAS_KEYS.has(event.key) || /^[1-9]$/.test(event.key)) consume(event);
    if (!this.application.canControl) return;
    const buttons = [...this.application.element.querySelectorAll("[data-menu-index]")];
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!buttons.length) return;
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const current = this.application.session.selectedIndex;
      const next = (current + direction + buttons.length) % buttons.length;
      this.application.session.selectedIndex = next;
      if (this.application.synchronized) this.application.selectIndex(next);
      this.focus(buttons);
      return;
    }
    if (event.key === "Enter" && buttons.length) {
      consume(event);
      buttons[this.application.session.selectedIndex]?.click();
      return;
    }
    if (event.key === "Escape") {
      consume(event);
      this.application.goBack();
      return;
    }
    if (event.key === "Home") {
      consume(event);
      this.application.goHome();
      return;
    }
    if (/^[1-9]$/.test(event.key)) {
      const index = Number(event.key) - 1;
      if (buttons[index]) {
        this.application.session.selectedIndex = index;
        if (this.application.synchronized) this.application.selectIndex(index);
        buttons[index].click();
      }
    }
  }

  focus(buttons = [...this.application.element.querySelectorAll("[data-menu-index]")]) {
    buttons.forEach((button, index) => button.classList.toggle("is-selected", index === this.application.session.selectedIndex));
    buttons[this.application.session.selectedIndex]?.focus({ preventScroll: true });
  }
}

function consume(event) {
  event.preventDefault();
  event.stopPropagation();
}
