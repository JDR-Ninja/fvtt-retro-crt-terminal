export class TerminalSession {
  constructor({ terminalRootUuid, currentPageUuid = null, runtimeThemeId = "", rememberNavigation = false } = {}) {
    this.terminalRootUuid = terminalRootUuid;
    this.currentPageUuid = currentPageUuid;
    this.history = [];
    this.selectedIndex = 0;
    this.sessionUnlocks = new Set();
    this.runtimeThemeId = runtimeThemeId;
    this.rememberNavigation = rememberNavigation;
  }

  navigate(pageUuid, { replace = false } = {}) {
    if (!pageUuid || pageUuid === this.currentPageUuid) return;
    if (this.currentPageUuid && !replace) this.history.push(this.currentPageUuid);
    this.currentPageUuid = pageUuid;
    this.selectedIndex = 0;
  }

  back() {
    const previous = this.history.pop() ?? null;
    if (previous) {
      this.currentPageUuid = previous;
      this.selectedIndex = 0;
    }
    return previous;
  }

  home(pageUuid) {
    this.history.length = 0;
    this.currentPageUuid = pageUuid;
    this.selectedIndex = 0;
  }

  unlock(pageUuid) {
    this.sessionUnlocks.add(pageUuid);
  }
}
