import { ACCESS, MODULE_ID, VISIBILITY } from "../constants.mjs";
import { ThemeRegistry } from "../themes/theme-registry.mjs";
import { slugify } from "../data/terminal-config.mjs";
import { pageSort, terminalPages } from "../resolver/document-resolver.mjs";
import { TerminalAPI } from "../api/terminal-api.mjs";

const BasePageSheet = foundry.applications.sheets.journal.JournalEntryPageSheet;
const { HandlebarsApplicationMixin } = foundry.applications.api;

const PAGE_TABS = Object.freeze([
  { id: "content", icon: "fa-solid fa-file-code", label: "RETRO_CRT_TERMINAL.PageSheet.Tabs.Content" },
  { id: "settings", icon: "fa-solid fa-sliders", label: "RETRO_CRT_TERMINAL.PageSheet.Tabs.Settings" }
]);

export class TerminalPageSheet extends HandlebarsApplicationMixin(BasePageSheet) {
  static HELP_SECTION = "authoring";
  static DEFAULT_OPTIONS = {
    classes: ["retro-crt-terminal", "terminal-page-sheet", "standard-form"],
    tag: "form",
    position: { width: 760, height: 780 },
    window: { icon: "fa-solid fa-terminal", resizable: true },
    form: { handler: TerminalPageSheet.onSubmit, closeOnSubmit: false },
    actions: {
      selectTab: TerminalPageSheet.onSelectTab,
      preview: TerminalPageSheet.onPreview,
      reveal: TerminalPageSheet.onReveal,
      hide: TerminalPageSheet.onHide,
      lock: TerminalPageSheet.onLock,
      unlock: TerminalPageSheet.onUnlock,
      toggleSecret: TerminalPageSheet.onToggleSecret
    }
  };

  static PARTS = { form: { template: `modules/${MODULE_ID}/templates/terminal-page-sheet.hbs` } };

  activeTab = "content";

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.page.system.toObject?.() ?? this.page.system;
    return {
      ...context,
      page: this.page,
      rootId: this.id,
      system,
      fields: this.page.system.schema.fields,
      editable: this.page.isOwner,
      tabs: PAGE_TABS.map(entry => ({ ...entry, active: entry.id === this.activeTab })),
      parents: this.parentChoices(system),
      themes: [
        { id: "", name: "—", selected: !system.presentation.themeOverride },
        ...ThemeRegistry.list().map(theme => ({ id: theme.id, name: theme.name, selected: system.presentation.themeOverride === theme.id }))
      ]
    };
  }

  /** Sibling pages that may legally act as this page's menu parent. */
  parentChoices(system) {
    const current = String(system.navigation.parent ?? "").toLowerCase();
    return terminalPages(this.page.parent)
      .filter(page => page.id !== this.page.id && page.system.pageId)
      .sort(pageSort)
      .map(page => ({
        pageId: page.system.pageId,
        name: page.system.navigation?.label || page.name,
        selected: page.system.pageId.toLowerCase() === current
      }));
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const source = this.element.querySelector("textarea[name='system.source']");
    if (!source || !this.page.isOwner) return;
    source.addEventListener("dragover", event => event.preventDefault());
    source.addEventListener("drop", async event => {
      event.preventDefault();
      const TextEditorClass = foundry.applications.ux.TextEditor;
      const data = (TextEditorClass.implementation ?? TextEditorClass).getDragEventData(event);
      const uuid = data.uuid;
      if (!uuid) return;
      const document = await foundry.utils.fromUuid(uuid);
      const insertion = `[${document?.name ?? "LINK"}](@UUID[${uuid}])`;
      source.setRangeText(insertion, source.selectionStart, source.selectionEnd, "end");
      source.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }

  static async onSubmit(_event, _form, formData) {
    const update = { ...formData.object };
    update["system.pageId"] = slugify(update["system.pageId"]);
    update["system.navigation.parent"] = optionalSlug(update["system.navigation.parent"]);
    await this.page.update(update);
    ui.notifications.info(game.i18n.localize("RETRO_CRT_TERMINAL.Notifications.Saved"));
    await this.render();
  }

  static onSelectTab(_event, target) {
    this.activeTab = target.dataset.tab;
    for (const item of this.element.querySelectorAll("[data-action='selectTab']")) {
      item.classList.toggle("active", item.dataset.tab === this.activeTab);
      item.setAttribute("aria-selected", String(item.dataset.tab === this.activeTab));
    }
    for (const panel of this.element.querySelectorAll(".tab[data-tab]")) {
      panel.classList.toggle("active", panel.dataset.tab === this.activeTab);
    }
  }

  static onToggleSecret(_event, target) {
    const input = this.element.querySelector("[name='system.lock.secret']");
    if (!input) return;
    const revealed = input.type === "text";
    input.type = revealed ? "password" : "text";
    target.querySelector("i")?.classList.toggle("fa-eye", revealed);
    target.querySelector("i")?.classList.toggle("fa-eye-slash", !revealed);
  }

  static async onPreview() { return TerminalAPI.open(this.page.uuid); }
  static async onReveal() { await this.page.update({ "system.release.visibility": VISIBILITY.VISIBLE }); return this.render(); }
  static async onHide() { await this.page.update({ "system.release.visibility": VISIBILITY.HIDDEN }); return this.render(); }
  static async onLock() { await this.page.update({ "system.release.access": ACCESS.LOCKED }); return this.render(); }
  static async onUnlock() { await this.page.update({ "system.release.access": ACCESS.AVAILABLE }); return this.render(); }
}

function optionalSlug(value) {
  return String(value ?? "").trim() ? slugify(value) : "";
}
