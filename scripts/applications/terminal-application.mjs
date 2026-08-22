import { MODULE_ID } from "../constants.mjs";
import { getTerminalConfig } from "../data/terminal-config.mjs";
import { renderTerminalBlocks } from "../render/terminal-renderer.mjs";
import { resolveDocument, resolveStartPage, resolveTerminalTarget } from "../resolver/document-resolver.mjs";
import { resolvePage } from "../resolver/page-resolver.mjs";
import { resolveRelease } from "../resolver/release-resolver.mjs";
import { TerminalSession } from "../runtime/terminal-session.mjs";
import { KeyboardController } from "../runtime/keyboard-controller.mjs";
import { startTypewriter } from "../runtime/typewriter-controller.mjs";
import { resolveTheme, themeClasses, themeToStyle } from "../themes/theme-resolver.mjs";
import { sharedSessionManager } from "../sync/shared-session-manager.mjs";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

export class TerminalApplication extends HandlebarsApplicationMixin(ApplicationV2) {
  static HELP_SECTION = "operation";
  static DEFAULT_OPTIONS = {
    classes: ["retro-crt-terminal", "terminal-application"],
    position: { width: 820, height: 620 },
    window: { icon: "fa-solid fa-desktop", resizable: true },
    actions: {
      back: TerminalApplication.onBack,
      home: TerminalApplication.onHome,
      sync: TerminalApplication.onSync
    }
  };

  static PARTS = {
    terminal: { template: `modules/${MODULE_ID}/templates/terminal-application.hbs` }
  };

  constructor({ root, page, options = {} }) {
    const config = getTerminalConfig(root);
    super({
      id: `${MODULE_ID}-${crypto.randomUUID()}`,
      window: { title: config.label || root.name },
      position: { width: options.fullscreen ? window.innerWidth : 820, height: options.fullscreen ? window.innerHeight : 620 }
    });
    this.root = root;
    this.startPageUuid = page.uuid;
    this.config = config;
    this.session = new TerminalSession({
      terminalRootUuid: root.uuid,
      currentPageUuid: page.uuid,
      runtimeThemeId: options.theme ?? "",
      rememberNavigation: options.rememberNavigation ?? config.behavior.rememberPage
    });
    this.keyboard = new KeyboardController(this);
    this.viewModel = null;
    this.homePageUuid = page.uuid;
    this._bootPending = config.behavior.showBootSequence && game.settings.get(MODULE_ID, "effectsEnabled");
    this._bootTimer = null;
    this._typewriter = null;
    this._lastTypewriterKey = null;
    this._boundKeydown = event => this.keyboard.handle(event);
    const sharedSessionId = options.sharedSessionId
      ?? (sharedSessionManager.active && sharedSessionManager.state.terminalRootUuid === root.uuid && sharedSessionManager.isParticipant
        ? sharedSessionManager.state.sessionId
        : null);
    this.sharedSessionId = sharedSessionId;
    if (sharedSessionId) sharedSessionManager.registerApplication(this, sharedSessionId);
  }

  get synchronized() {
    return Boolean(this.sharedSessionId && sharedSessionManager.state?.sessionId === this.sharedSessionId && sharedSessionManager.active);
  }

  get canControl() {
    return !this.synchronized || sharedSessionManager.isController;
  }

  get isTyping() {
    return Boolean(this._typewriter?.active);
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const page = await resolveDocument(this.session.currentPageUuid);
    if (!page) {
      this.viewModel = { blocks: [], diagnostics: [], missing: true };
      return { ...context, title: this.config.label, missing: true, ...this.prepareSyncContext() };
    }
    this.viewModel = await resolvePage(page, {
      user: game.user,
      sessionUnlocks: this.session.sessionUnlocks,
      gmDebug: game.user.isGM && game.settings.get(MODULE_ID, "gmDebug")
    });
    const theme = resolveTheme({
      worldThemeId: game.settings.get(MODULE_ID, "defaultTheme"),
      terminalThemeId: this.session.runtimeThemeId || this.config.themeId,
      pageThemeId: page.system.presentation?.themeOverride,
      terminalOverrides: this.config.themeOverrides,
      effectsEnabled: game.settings.get(MODULE_ID, "effectsEnabled")
    });
    const effectsEnabled = game.settings.get(MODULE_ID, "effectsEnabled");
    const reduceMotion = !effectsEnabled || globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    return {
      ...context,
      title: page.name,
      terminalLabel: this.config.label,
      pageType: page.system.pageType,
      missing: false,
      canBack: this.session.history.length > 0,
      themeStyle: themeToStyle(theme),
      themeClasses: themeClasses(theme),
      reduceMotion,
      typewriterSpeed: Number(game.settings.get(MODULE_ID, "typewriterSpeed")) || 0,
      ...this.prepareSyncContext()
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.cancelTyping();
    this.stopBootSequence();
    const screen = this.element.querySelector("[data-terminal-screen]");
    if (screen && !context.missing && this.viewModel.release?.accessible) {
      renderTerminalBlocks(screen, this.viewModel, {
        onNavigate: item => this.activateTarget(item),
        onLogin: (password, block) => this.submitInlineLogin(password, block)
      });
      const buttons = [...screen.querySelectorAll("[data-menu-index]")];
      this.session.selectedIndex = Math.min(this.session.selectedIndex, Math.max(0, buttons.length - 1));
      buttons.forEach((button, index) => button.classList.toggle("is-selected", index === this.session.selectedIndex));
    } else if (screen && this.viewModel.release?.state === "locked") {
      const heading = document.createElement("h2");
      heading.className = "terminal-heading";
      heading.textContent = game.i18n.localize("RETRO_CRT_TERMINAL.Lock.Title");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "terminal-menu-item is-selected";
      button.dataset.menuIndex = "0";
      button.textContent = game.i18n.localize("RETRO_CRT_TERMINAL.Actions.Access");
      button.addEventListener("click", async () => {
        if (await this.requestUnlock(this.viewModel.page)) await this.render();
      });
      screen.replaceChildren(heading, button);
    } else if (screen && !this.viewModel.release?.accessible) {
      const message = document.createElement("p");
      message.className = "terminal-error";
      message.textContent = game.i18n.localize("RETRO_CRT_TERMINAL.Errors.FileUnavailable");
      screen.replaceChildren(message);
    }
    this.element.removeEventListener("keydown", this._boundKeydown);
    this.element.addEventListener("keydown", this._boundKeydown);
    if (this.synchronized && !this.canControl) {
      screen?.classList.add("is-spectator");
      for (const control of screen?.querySelectorAll("button, input, select, textarea") ?? []) {
        control.setAttribute("aria-disabled", "true");
        control.tabIndex = -1;
        control.disabled = true;
      }
    } else this.element.querySelector("[data-terminal-screen]")?.focus({ preventScroll: true });
    let typingDelay = 0;
    if (this._bootPending) {
      this._bootPending = false;
      this.element.querySelector(".terminal-shell")?.classList.add("is-booting");
      typingDelay = 850;
      this._bootTimer = setTimeout(() => this.stopBootSequence(), typingDelay);
    }
    const typewriterKey = `${this.session.currentPageUuid}:${this.viewModel?.release?.state ?? "missing"}:${Boolean(this.viewModel?.release?.accessible)}`;
    if (screen && !context.missing && !context.reduceMotion && context.typewriterSpeed > 0 && this._lastTypewriterKey !== typewriterKey) {
      this._lastTypewriterKey = typewriterKey;
      const controller = startTypewriter(screen, {
        speed: context.typewriterSpeed,
        delay: typingDelay,
        onComplete: () => {
          if (this._typewriter === controller) this._typewriter = null;
          this.stopBootSequence();
        }
      });
      this._typewriter = controller;
    }
  }

  finishTyping() {
    const controller = this._typewriter;
    if (!controller?.active) return false;
    controller.finish();
    this.stopBootSequence();
    return true;
  }

  cancelTyping() {
    this._typewriter?.cancel();
    this._typewriter = null;
  }

  stopBootSequence() {
    if (this._bootTimer) clearTimeout(this._bootTimer);
    this._bootTimer = null;
    this.element?.querySelector(".terminal-shell")?.classList.remove("is-booting");
  }

  async activateTarget(item) {
    if (!this.canControl) return;
    let page = item.pageUuid ? await resolveDocument(item.pageUuid) : await resolveTerminalTarget(item.target, { currentPage: this.viewModel?.page });
    if (!page) return ui.notifications.warn(game.i18n.localize("RETRO_CRT_TERMINAL.Errors.FileUnavailable"));
    const release = resolveRelease(page, {
      user: game.user,
      sessionUnlocks: this.session.sessionUnlocks,
      gmDebug: game.user.isGM && game.settings.get(MODULE_ID, "gmDebug")
    });
    if (!release.visible) return ui.notifications.warn(game.i18n.localize("RETRO_CRT_TERMINAL.Errors.FileUnavailable"));
    if (!release.accessible) {
      const unlocked = await this.requestUnlock(page);
      if (!unlocked) return;
    }
    if (this.synchronized) return sharedSessionManager.navigate(page.uuid);
    this.session.navigate(page.uuid);
    await this.rememberPage();
    await this.render();
  }

  async requestUnlock(page) {
    const lock = page.system.lock ?? {};
    if (game.user.isGM) {
      if (this.synchronized) await sharedSessionManager.unlock(page.uuid);
      else this.session.unlock(page.uuid);
      return true;
    }
    if (lock.type !== "password") {
      ui.notifications.warn(lock.failureMessage || game.i18n.localize("RETRO_CRT_TERMINAL.Lock.AccessDenied"));
      return false;
    }
    const result = await DialogV2.input({
      window: { title: game.i18n.localize("RETRO_CRT_TERMINAL.Lock.Title") },
      content: `<label>${game.i18n.localize("RETRO_CRT_TERMINAL.Lock.Prompt")}<input type="password" name="password" autocomplete="off" autofocus></label>`,
      ok: { label: game.i18n.localize("RETRO_CRT_TERMINAL.Actions.Submit") },
      rejectClose: false,
      modal: true
    });
    if (result && String(result.password ?? "") === String(lock.secret ?? "")) {
      if (this.synchronized) await sharedSessionManager.unlock(page.uuid);
      else this.session.unlock(page.uuid);
      return true;
    }
    ui.notifications.warn(lock.failureMessage || game.i18n.localize("RETRO_CRT_TERMINAL.Lock.AccessDenied"));
    return false;
  }

  async submitInlineLogin(password, block) {
    if (!this.canControl) return;
    const target = await resolveTerminalTarget(block.success, { currentPage: this.viewModel?.page });
    if (!target) return ui.notifications.warn(game.i18n.localize("RETRO_CRT_TERMINAL.Errors.FileUnavailable"));
    const release = resolveRelease(target, { user: game.user, sessionUnlocks: this.session.sessionUnlocks });
    if (!release.visible) return ui.notifications.warn(game.i18n.localize("RETRO_CRT_TERMINAL.Errors.FileUnavailable"));
    if (String(password) !== String(target.system.lock?.secret ?? "")) return ui.notifications.warn(target.system.lock?.failureMessage || game.i18n.localize("RETRO_CRT_TERMINAL.Lock.AccessDenied"));
    if (this.synchronized) {
      await sharedSessionManager.unlock(target.uuid);
      return sharedSessionManager.navigate(target.uuid);
    }
    this.session.unlock(target.uuid);
    this.session.navigate(target.uuid);
    await this.rememberPage();
    await this.render();
  }

  async goBack() {
    if (!this.canControl) return;
    if (this.synchronized) return sharedSessionManager.back();
    if (this.session.back()) return this.render();
    if (this.config.behavior.closeOnEscapeAtRoot) return this.close();
  }

  async goHome() {
    if (!this.canControl) return;
    if (this.synchronized) return sharedSessionManager.home();
    const home = await resolveStartPage(this.root);
    if (!home) return;
    this.homePageUuid = home.uuid;
    this.session.home(home.uuid);
    await this.rememberPage();
    await this.render();
  }

  async rememberPage() {
    if (this.synchronized) return;
    if (!this.session.rememberNavigation) return;
    await game.user.setFlag(MODULE_ID, `lastPage-${this.root.id}`, this.session.currentPageUuid);
  }

  async _onClose(options) {
    this.cancelTyping();
    this.stopBootSequence();
    sharedSessionManager.unregisterApplication(this);
    await super._onClose(options);
    Hooks.callAll(`${MODULE_ID}.closed`, this);
  }

  static onBack() { return this.goBack(); }
  static onHome() { return this.goHome(); }
  static async onSync() {
    const { openTerminalConfig } = await import("./terminal-config-application.mjs");
    return openTerminalConfig(this.root, { tab: "sync", initialPageUuid: this.session.currentPageUuid });
  }

  selectIndex(index) {
    if (this.synchronized && this.canControl) sharedSessionManager.select(index);
  }

  prepareSyncContext() {
    return {
      synchronized: this.synchronized,
      canControl: this.canControl,
      isSpectator: this.synchronized && !this.canControl,
      controllerName: this.synchronized ? sharedSessionManager.controller?.name ?? "—" : null,
      controllerOnline: this.synchronized ? sharedSessionManager.controllerOnline : true,
      canManageSync: game.user.isGM
    };
  }

  applySharedState(state, { selectionOnly = false, render = true } = {}) {
    if (state.sessionId !== this.sharedSessionId) return;
    this.session.currentPageUuid = state.currentPageUuid;
    this.session.history = [...state.history];
    this.session.selectedIndex = state.selectedIndex;
    this.session.sessionUnlocks = new Set(state.sessionUnlocks);
    this.homePageUuid = state.homePageUuid;
    if (!render || !this.rendered) return;
    if (selectionOnly) {
      const buttons = [...this.element.querySelectorAll("[data-menu-index]")];
      buttons.forEach((button, index) => button.classList.toggle("is-selected", index === state.selectedIndex));
      const selected = buttons[state.selectedIndex];
      selected?.scrollIntoView({ block: "nearest" });
      if (this.canControl) selected?.focus({ preventScroll: true });
      return;
    }
    this.render();
  }
}
