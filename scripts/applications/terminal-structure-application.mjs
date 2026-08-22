import { ACCESS, MODULE_ID, VISIBILITY } from "../constants.mjs";
import { terminalPages, pageSort } from "../resolver/document-resolver.mjs";
import { validateTerminal } from "../validation/terminal-validator.mjs";
import { TerminalAPI } from "../api/terminal-api.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class TerminalStructureApplication extends HandlebarsApplicationMixin(ApplicationV2) {
  static HELP_SECTION = "release";
  static DEFAULT_OPTIONS = {
    classes: ["retro-crt-terminal", "terminal-structure"],
    position: { width: 760, height: 650 },
    window: { title: "RETRO_CRT_TERMINAL.Structure.Title", icon: "fa-solid fa-diagram-project", resizable: true },
    actions: {
      open: TerminalStructureApplication.onOpen,
      edit: TerminalStructureApplication.onEdit,
      visibility: TerminalStructureApplication.onVisibility,
      access: TerminalStructureApplication.onAccess,
      copyUuid: TerminalStructureApplication.onCopyUuid
    }
  };

  static PARTS = { structure: { template: `modules/${MODULE_ID}/templates/terminal-structure.hbs` } };

  constructor({ journal }) {
    super({ id: `${MODULE_ID}-structure-${journal.id}` });
    this.journal = journal;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const pages = terminalPages(this.journal).sort(pageSort).map(page => ({
      uuid: page.uuid,
      id: page.id,
      pageId: page.system.pageId,
      name: page.name,
      label: page.system.navigation?.label || page.name,
      parent: page.system.navigation?.parent || "—",
      visibility: page.system.release?.visibility,
      access: page.system.release?.access,
      visibilityLabel: localizeState(page.system.release?.visibility),
      accessLabel: localizeState(page.system.release?.access),
      isHidden: page.system.release?.visibility === VISIBILITY.HIDDEN,
      isLocked: page.system.release?.access === ACCESS.LOCKED
    }));
    return { ...context, journal: this.journal, pages, issues: validateTerminal(this.journal), empty: pages.length === 0 };
  }

  async pageFromTarget(target) { return foundry.utils.fromUuid(target.dataset.uuid); }

  static async onOpen(_event, target) { return TerminalAPI.open(target.dataset.uuid); }
  static async onEdit(_event, target) { (await this.pageFromTarget(target))?.sheet?.render({ force: true }); }
  static async onVisibility(_event, target) {
    const page = await this.pageFromTarget(target);
    if (!page) return;
    const visibility = page.system.release.visibility === VISIBILITY.HIDDEN ? VISIBILITY.VISIBLE : VISIBILITY.HIDDEN;
    await page.update({ "system.release.visibility": visibility });
    await this.render();
  }
  static async onAccess(_event, target) {
    const page = await this.pageFromTarget(target);
    if (!page) return;
    const access = page.system.release.access === ACCESS.LOCKED ? ACCESS.AVAILABLE : ACCESS.LOCKED;
    await page.update({ "system.release.access": access });
    await this.render();
  }
  static async onCopyUuid(_event, target) {
    await navigator.clipboard.writeText(target.dataset.uuid);
    ui.notifications.info(game.i18n.localize("RETRO_CRT_TERMINAL.Notifications.UuidCopied"));
  }
}

function localizeState(value) {
  const text = String(value ?? "");
  const key = `RETRO_CRT_TERMINAL.States.${text[0]?.toUpperCase()}${text.slice(1)}`;
  return game.i18n.has(key) ? game.i18n.localize(key) : text;
}
