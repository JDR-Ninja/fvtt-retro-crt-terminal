import { MODULE_ID } from "../constants.mjs";
import { canViewDocument } from "../resolver/permission-resolver.mjs";
import { isTerminalPage, resolveDocument, resolveStartPage } from "../resolver/document-resolver.mjs";
import { resolveRelease } from "../resolver/release-resolver.mjs";
import { applySharedAction, createSharedSessionState, stopSharedSession, updateSharedParticipants } from "./shared-session-state.mjs";

export const SHARED_SESSION_SETTING = "sharedSession";
export const SHARED_SESSION_FLAG = "sharedSessionState";
export const SOCKET_CHANNEL = `module.${MODULE_ID}`;

class SharedSessionManager {
  constructor() {
    this.state = null;
    this.applications = new Set();
    this.initialized = false;
    this.opening = null;
  }

  get active() { return Boolean(this.state?.active); }
  get canManage() { return Boolean(game.user?.isGM); }
  get isController() { return this.active && this.state.controllerUserId === game.user.id; }
  get isParticipant() { return this.active && this.state.audienceUserIds.includes(game.user.id); }
  get controller() { return this.active ? game.users.get(this.state.controllerUserId) : null; }
  get controllerOnline() { return Boolean(this.controller?.active); }

  async initialize() {
    if (this.initialized) return;
    this.initialized = true;
    game.socket.on(SOCKET_CHANNEL, packet => this.receive(packet));
    const persisted = game.settings.get(MODULE_ID, SHARED_SESSION_SETTING);
    await this.acceptPersistedState(persisted);
    if (this.active && this.isParticipant && !this.isController) this.requestSnapshot();
  }

  async acceptPersistedState(state) {
    if (!state?.sessionId) {
      if (this.active) await this.acceptState(state);
      return;
    }
    let best = state;
    const controllerState = game.users.get(state.controllerUserId)?.getFlag(MODULE_ID, SHARED_SESSION_FLAG);
    if (state.active && controllerState?.sessionId === state.sessionId && controllerState.revision > state.revision) best = controllerState;
    await this.acceptState(best);
  }

  async start({ terminalRootUuid, controllerUserId, initialPageUuid = null }) {
    this.assertManager();
    const root = await resolveDocument(terminalRootUuid);
    const home = root?.documentName === "JournalEntry" ? await resolveStartPage(root) : null;
    const requested = initialPageUuid ? await resolveDocument(initialPageUuid) : null;
    const page = isTerminalPage(requested) ? requested : home;
    if (!root || !home || !page) throw localizedError("RETRO_CRT_TERMINAL.Errors.NoStartPage");

    const controller = game.users.get(controllerUserId);
    if (!controller?.active) throw localizedError("RETRO_CRT_TERMINAL.Sync.ControllerOffline");
    if (!resolveRelease(page, { user: controller }).visible) throw localizedError("RETRO_CRT_TERMINAL.Errors.FileUnavailable");
    const audience = this.allUserIds();
    this.assertAudienceCanView(root, page, audience);
    if (home.uuid !== page.uuid) this.assertAudienceCanView(root, home, audience);

    const state = createSharedSessionState({
      terminalRootUuid: root.uuid,
      currentPageUuid: page.uuid,
      homePageUuid: home.uuid,
      controllerUserId,
      audienceUserIds: audience,
      managerUserId: game.user.id,
      previousRevision: this.state?.revision ?? 0
    });
    await this.publishManagedState(state);
    return state;
  }

  async updateParticipants({ controllerUserId }) {
    this.assertManager();
    if (!this.active) return false;
    const controller = game.users.get(controllerUserId);
    if (!controller?.active) throw localizedError("RETRO_CRT_TERMINAL.Sync.ControllerOffline");
    const root = await resolveDocument(this.state.terminalRootUuid);
    const page = await resolveDocument(this.state.currentPageUuid);
    const home = await resolveDocument(this.state.homePageUuid);
    const audience = this.allUserIds();
    this.assertAudienceCanView(root, page, audience);
    this.assertAudienceCanView(root, home, audience);
    await this.publishManagedState(updateSharedParticipants(this.state, {
      controllerUserId,
      audienceUserIds: audience,
      managerUserId: game.user.id
    }));
    return true;
  }

  async stop() {
    this.assertManager();
    if (!this.state) return;
    await this.publishManagedState(stopSharedSession(this.state, game.user.id));
  }

  select(index) {
    const controllerApp = [...this.applications].find(app => app.rendered);
    const count = controllerApp?.element?.querySelectorAll("[data-menu-index]").length ?? 0;
    if (!count) return false;
    const normalized = Math.min(count - 1, Math.max(0, Number(index) || 0));
    return this.broadcastControllerAction("select", { index: normalized }, { persist: false, selectionOnly: true });
  }
  async navigate(pageUuid) {
    if (!this.isController) return false;
    if (!await this.audienceCanViewPage(pageUuid)) return false;
    return this.broadcastControllerAction("navigate", { pageUuid }, { persist: true });
  }
  async back() {
    const target = this.state?.history?.at(-1);
    if (!target || !await this.audienceCanViewPage(target)) return false;
    return this.broadcastControllerAction("back", {}, { persist: true });
  }
  async home() {
    if (!this.state?.homePageUuid || !await this.audienceCanViewPage(this.state.homePageUuid)) return false;
    return this.broadcastControllerAction("home", {}, { persist: true });
  }
  unlock(pageUuid) { return this.broadcastControllerAction("unlock", { pageUuid }, { persist: true }); }

  async broadcastControllerAction(action, payload, { persist, selectionOnly = false }) {
    if (!this.isController) return false;
    const next = applySharedAction(this.state, action, payload);
    if (next === this.state) return false;
    await this.acceptState(next, { selectionOnly, force: true });
    game.socket.emit(SOCKET_CHANNEL, {
      type: "controller-state",
      senderUserId: game.user.id,
      sessionId: next.sessionId,
      selectionOnly,
      state: next
    });
    if (persist) await game.user.setFlag(MODULE_ID, SHARED_SESSION_FLAG, next);
    return true;
  }

  requestSnapshot() {
    if (!this.active) return;
    game.socket.emit(SOCKET_CHANNEL, {
      type: "snapshot-request",
      sessionId: this.state.sessionId,
      requesterUserId: game.user.id
    });
  }

  async receive(packet) {
    if (!packet || packet.sessionId !== this.state?.sessionId) return;
    if (packet.type === "snapshot-request") {
      if (!this.isController) return;
      game.socket.emit(SOCKET_CHANNEL, {
        type: "controller-state",
        senderUserId: game.user.id,
        targetUserId: packet.requesterUserId,
        sessionId: this.state.sessionId,
        selectionOnly: false,
        state: this.state
      });
      return;
    }
    if (packet.type !== "controller-state") return;
    if (packet.targetUserId && packet.targetUserId !== game.user.id) return;
    if (packet.senderUserId !== this.state.controllerUserId) return;
    if (packet.state?.controllerUserId !== this.state.controllerUserId) return;
    if (packet.state?.terminalRootUuid !== this.state.terminalRootUuid) return;
    if (packet.state?.homePageUuid !== this.state.homePageUuid) return;
    if (packet.state?.managerUserId !== this.state.managerUserId) return;
    if (!sameMembers(packet.state?.audienceUserIds, this.state.audienceUserIds)) return;
    await this.acceptState(packet.state, { selectionOnly: packet.selectionOnly });
  }

  async acceptState(state, { selectionOnly = false, force = false } = {}) {
    if (!state?.sessionId) return;
    if (!force && this.state?.sessionId === state.sessionId && state.revision <= this.state.revision) return;
    const previous = this.state;
    this.state = structuredClone(state);

    const staleApplications = [...this.applications].filter(app => app.root?.uuid !== state.terminalRootUuid || app.sharedSessionId !== state.sessionId);
    for (const app of staleApplications) this.applications.delete(app);
    await Promise.allSettled(staleApplications.filter(app => app.rendered).map(app => app.close()));

    if (!state.active || !state.audienceUserIds.includes(game.user.id)) {
      await this.closeApplications();
      return;
    }
    for (const app of this.applications) app.applySharedState?.(this.state, { selectionOnly });
    if (!this.applications.size || previous?.sessionId !== state.sessionId) await this.ensureApplication();
    if (this.isController && previous?.controllerUserId !== game.user.id) {
      await game.user.setFlag(MODULE_ID, SHARED_SESSION_FLAG, this.state);
    }
  }

  registerApplication(app, sessionId = this.state?.sessionId) {
    if (!this.active || sessionId !== this.state.sessionId || app.root?.uuid !== this.state.terminalRootUuid) return false;
    this.applications.add(app);
    app.sharedSessionId = sessionId;
    app.applySharedState?.(this.state, { render: false });
    return true;
  }

  unregisterApplication(app) {
    this.applications.delete(app);
  }

  async ensureApplication() {
    if (!this.isParticipant || this.opening) return this.opening;
    const existing = [...this.applications].find(app => app.rendered);
    if (existing) return existing;
    this.opening = game.modules.get(MODULE_ID).api.open(this.state.terminalRootUuid, {
      page: this.state.currentPageUuid,
      sharedSessionId: this.state.sessionId,
      rememberNavigation: false
    });
    try {
      const app = await this.opening;
      this.registerApplication(app, this.state.sessionId);
      return app;
    } finally {
      this.opening = null;
    }
  }

  async join() {
    if (!this.isParticipant) return false;
    await this.ensureApplication();
    this.requestSnapshot();
    return true;
  }

  async closeApplications() {
    const apps = [...this.applications];
    this.applications.clear();
    await Promise.allSettled(apps.filter(app => app.rendered).map(app => app.close()));
  }

  async publishManagedState(state) {
    await game.settings.set(MODULE_ID, SHARED_SESSION_SETTING, state);
    await this.acceptState(state);
  }

  assertManager() {
    if (!this.canManage) throw localizedError("RETRO_CRT_TERMINAL.Sync.GmOnly");
  }

  allUserIds() {
    return game.users.contents.map(user => user.id);
  }

  assertAudienceCanView(root, page, audienceUserIds) {
    const unlocks = new Set(this.state?.sessionUnlocks ?? []);
    const unavailable = audienceUserIds
      .map(id => game.users.get(id))
      .filter(user => user && (
        !canViewDocument(root, user)
        || !resolveRelease(page, { user, sessionUnlocks: unlocks }).visible
      ))
      .map(user => user.name);
    if (unavailable.length) {
      throw new Error(game.i18n.format("RETRO_CRT_TERMINAL.Sync.MissingPermission", { users: unavailable.join(", ") }));
    }
  }

  async audienceCanViewPage(pageUuid) {
    const page = await resolveDocument(pageUuid);
    const unlocks = new Set(this.state.sessionUnlocks);
    const unavailable = this.state.audienceUserIds
      .map(id => game.users.get(id))
      .filter(user => user && !resolveRelease(page, { user, sessionUnlocks: unlocks }).visible)
      .map(user => user.name);
    if (!unavailable.length) return true;
    ui.notifications.warn(game.i18n.format("RETRO_CRT_TERMINAL.Sync.MissingPermission", { users: unavailable.join(", ") }));
    return false;
  }
}

function localizedError(key) {
  return new Error(game.i18n.localize(key));
}

function sameMembers(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) return false;
  const expected = new Set(right);
  return left.every(id => expected.has(id));
}

export const sharedSessionManager = new SharedSessionManager();
