import { MODULE_ID } from "../constants.mjs";
import { getTerminalConfig } from "../data/terminal-config.mjs";
import { resolveDocument, resolveStartPage, resolveTerminalTarget, isTerminalPage } from "../resolver/document-resolver.mjs";
import { resolvePage } from "../resolver/page-resolver.mjs";
import { TerminalApplication } from "../applications/terminal-application.mjs";
import { sharedSessionManager } from "../sync/shared-session-manager.mjs";
import { openGamemasterGuide } from "../guide/gamemaster-guide.mjs";

export const openTerminals = new Map();

export const TerminalAPI = Object.freeze({
  async open(uuid, options = {}) {
    const document = await resolveDocument(uuid);
    if (!document) throw localizedError("RETRO_CRT_TERMINAL.Errors.DocumentNotFound", "Terminal document not found");

    const root = isTerminalPage(document) ? document.parent : document;
    if (root?.documentName !== "JournalEntry") throw localizedError("RETRO_CRT_TERMINAL.Errors.InvalidDocument", "The target is not a terminal Journal or page");
    const config = getTerminalConfig(root);
    const remembered = !isTerminalPage(document) && !options.page && config.behavior.rememberPage
      ? game.user.getFlag(MODULE_ID, `lastPage-${root.id}`)
      : null;
    const page = isTerminalPage(document) ? document : await resolveStartPage(root, options.page || remembered);
    if (!page) throw localizedError("RETRO_CRT_TERMINAL.Errors.NoStartPage", "This terminal has no start page");

    const app = new TerminalApplication({ root, page, options });
    openTerminals.set(app.id, app);
    await app.render({ force: true });
    return app;
  },

  async close(applicationId) {
    const app = openTerminals.get(applicationId) ?? foundry.applications.instances.get(applicationId);
    if (!app) return false;
    await app.close();
    openTerminals.delete(applicationId);
    return true;
  },

  async resolve(uuid, options = {}) {
    const page = await resolveTerminalTarget(uuid);
    if (!isTerminalPage(page)) return null;
    return resolvePage(page, { user: game.user, ...options });
  },

  async getTerminalConfig(uuid) {
    const document = await resolveDocument(uuid);
    const journal = isTerminalPage(document) ? document.parent : document;
    return journal?.documentName === "JournalEntry" ? getTerminalConfig(journal) : null;
  },

  openGuide(section = "quickstart") { return openGamemasterGuide(section); },

  shared: Object.freeze({
    get state() { return sharedSessionManager.state ? structuredClone(sharedSessionManager.state) : null; },
    start(options) { return sharedSessionManager.start(options); },
    update(options) { return sharedSessionManager.updateParticipants(options); },
    stop() { return sharedSessionManager.stop(); },
    join() { return sharedSessionManager.join(); }
  })
});

function localizedError(key, fallback) {
  const message = globalThis.game?.i18n?.has?.(key) ? game.i18n.localize(key) : fallback;
  globalThis.ui?.notifications?.error?.(message);
  return new Error(message);
}
