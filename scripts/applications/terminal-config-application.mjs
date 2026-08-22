import { ACCESS, MODULE_ID, VISIBILITY } from "../constants.mjs";
import { TerminalConfigModel } from "../data/terminal-config-model.mjs";
import { getTerminalConfig, setTerminalConfig, slugify } from "../data/terminal-config.mjs";
import { pageSort, terminalPages } from "../resolver/document-resolver.mjs";
import { validateTerminal } from "../validation/terminal-validator.mjs";
import { CURATED_FONTS } from "../themes/presets.mjs";
import { ThemeRegistry } from "../themes/theme-registry.mjs";
import { mergeTheme, resolveTheme, themeClasses, themeToStyle } from "../themes/theme-resolver.mjs";
import { sharedSessionManager } from "../sync/shared-session-manager.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const THEME_PREFIX = "themeOverrides.";

const TAB_DEFINITIONS = Object.freeze([
  { id: "general", icon: "fa-solid fa-sliders", label: "RETRO_CRT_TERMINAL.Config.Tabs.General" },
  { id: "structure", icon: "fa-solid fa-diagram-project", label: "RETRO_CRT_TERMINAL.Config.Tabs.Structure" },
  { id: "theme", icon: "fa-solid fa-palette", label: "RETRO_CRT_TERMINAL.Config.Tabs.Theme" },
  { id: "sync", icon: "fa-solid fa-tower-broadcast", label: "RETRO_CRT_TERMINAL.Config.Tabs.Sync" }
]);

/**
 * Opens the configuration window for a terminal Journal on a given tab, reusing an
 * already open window rather than stacking a second one.
 */
export function openTerminalConfig(journal, { tab = "general", initialPageUuid = null } = {}) {
  const existing = foundry.applications.instances.get(`${MODULE_ID}-config-${journal.id}`);
  if (existing) {
    existing.activeTab = tab;
    existing.initialPageUuid = initialPageUuid ?? existing.initialPageUuid;
    return existing.render({ force: true });
  }
  return new TerminalConfigApplication({ journal, tab, initialPageUuid }).render({ force: true });
}

function openTerminal(uuid) {
  return game.modules.get(MODULE_ID).api.open(uuid);
}

/** Every configuration window currently on screen, for hook-driven refreshes. */
export function openConfigApplications() {
  const instances = globalThis.foundry?.applications?.instances;
  if (!instances) return [];
  return [...instances.values()].filter(app => app instanceof TerminalConfigApplication);
}

export class TerminalConfigApplication extends HandlebarsApplicationMixin(ApplicationV2) {
  static HELP_SECTION = "setup";
  static DEFAULT_OPTIONS = {
    classes: ["retro-crt-terminal", "terminal-config", "standard-form"],
    tag: "form",
    position: { width: 740, height: 700 },
    window: { title: "RETRO_CRT_TERMINAL.Config.Title", icon: "fa-solid fa-sliders", resizable: true },
    form: { handler: TerminalConfigApplication.onSubmit, submitOnChange: true, closeOnSubmit: false },
    actions: {
      selectTab: TerminalConfigApplication.onSelectTab,
      openTerminal: TerminalConfigApplication.onOpenTerminal,
      editId: TerminalConfigApplication.onEditId,
      copyId: TerminalConfigApplication.onCopyId,
      openPage: TerminalConfigApplication.onOpenPage,
      editPage: TerminalConfigApplication.onEditPage,
      toggleVisibility: TerminalConfigApplication.onToggleVisibility,
      toggleAccess: TerminalConfigApplication.onToggleAccess,
      copyUuid: TerminalConfigApplication.onCopyUuid,
      loadPreset: TerminalConfigApplication.onLoadPreset,
      startSync: TerminalConfigApplication.onStartSync,
      stopSync: TerminalConfigApplication.onStopSync
    }
  };

  static PARTS = {
    tabs: { template: `modules/${MODULE_ID}/templates/config/tabs.hbs` },
    general: { template: `modules/${MODULE_ID}/templates/config/general.hbs` },
    structure: { template: `modules/${MODULE_ID}/templates/config/structure.hbs` },
    theme: { template: `modules/${MODULE_ID}/templates/config/theme.hbs` },
    sync: { template: `modules/${MODULE_ID}/templates/config/sync.hbs` },
    footer: { template: `modules/${MODULE_ID}/templates/config/footer.hbs` }
  };

  constructor({ journal, tab = "general", initialPageUuid = null }) {
    super({ id: `${MODULE_ID}-config-${journal.id}` });
    this.journal = journal;
    this.activeTab = TAB_DEFINITIONS.some(entry => entry.id === tab) ? tab : "general";
    this.initialPageUuid = initialPageUuid;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const config = getTerminalConfig(this.journal);
    const theme = resolveTheme({ terminalThemeId: config.themeId, terminalOverrides: config.themeOverrides });
    const model = new TerminalConfigModel({ ...config, themeOverrides: theme }, { strict: false });
    const source = model.toObject();
    const fields = model.schema.fields;
    const pages = terminalPages(this.journal).sort(pageSort);

    return {
      ...context,
      journal: this.journal,
      rootId: this.id,
      fields,
      source,
      editable: this.journal.isOwner,
      tabs: TAB_DEFINITIONS.map(entry => ({ ...entry, active: entry.id === this.activeTab })),
      startPages: pages.map(page => ({ uuid: page.uuid, name: page.name, selected: page.uuid === source.startPageUuid })),
      themes: ThemeRegistry.list().map(item => ({ id: item.id, name: item.name, selected: item.id === source.themeId })),
      fonts: CURATED_FONTS.map(font => ({ name: font, selected: font === source.themeOverrides.typography.font })),
      themeStyle: themeToStyle(theme),
      themeClasses: themeClasses(theme),
      typography: sliders(fields.themeOverrides.fields.typography, source.themeOverrides.typography, `${THEME_PREFIX}typography`),
      colors: swatches(fields.themeOverrides.fields.colors, source.themeOverrides.colors),
      effects: effectGroups(fields.themeOverrides.fields.effects, source.themeOverrides.effects),
      pages: pages.map(page => structureRow(page)),
      empty: pages.length === 0,
      issues: validateTerminal(this.journal),
      ...this.prepareSyncContext()
    };
  }

  async _preparePartContext(partId, context, options) {
    const partContext = (await super._preparePartContext?.(partId, context, options)) ?? context;
    partContext.tab = partContext.tabs?.find(entry => entry.id === partId) ?? null;
    return partContext;
  }

  prepareSyncContext() {
    const state = sharedSessionManager.state;
    const activeHere = Boolean(state?.active && state.terminalRootUuid === this.journal.uuid);
    return {
      users: game.users.contents.filter(user => user.active).map(user => ({
        id: user.id,
        name: user.name,
        isGM: user.isGM,
        controller: activeHere ? state.controllerUserId === user.id : user.id === game.user.id
      })),
      activeHere,
      anotherActive: Boolean(state?.active && !activeHere),
      controllerName: activeHere ? sharedSessionManager.controller?.name ?? "—" : null,
      controllerOnline: activeHere ? sharedSessionManager.controllerOnline : true,
      canManageSync: game.user.isGM,
      syncSubmitLabel: activeHere ? "RETRO_CRT_TERMINAL.Sync.Update" : "RETRO_CRT_TERMINAL.Sync.Start"
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    // The form element outlives a re-render, so the delegate is rebound rather than stacked.
    this._boundThemeInput ??= event => {
      if (!event.target?.name?.startsWith(THEME_PREFIX)) return;
      this.syncSliderOutput(event.target);
      this.refreshThemePreview();
    };
    this.element.removeEventListener("input", this._boundThemeInput);
    this.element.addEventListener("input", this._boundThemeInput);

    this._boundPresetChange ??= event => {
      if (event.target?.name === "themeId") this.applyPreset();
    };
    this.element.removeEventListener("change", this._boundPresetChange);
    this.element.addEventListener("change", this._boundPresetChange);
  }

  syncSliderOutput(input) {
    const output = this.element.querySelector(`[data-slider-output="${input.name}"]`);
    if (output) output.textContent = input.value;
  }

  /** Repaints the theme preview from the live control values, without a round trip. */
  refreshThemePreview() {
    const preview = this.element.querySelector("[data-theme-preview]");
    if (!preview) return;
    const overrides = {};
    for (const input of this.element.querySelectorAll(`[name^="${THEME_PREFIX}"]`)) {
      overrides[input.name.slice(THEME_PREFIX.length)] = input.type === "checkbox" ? input.checked : input.value;
    }
    const theme = mergeTheme(
      ThemeRegistry.get(this.element.elements.themeId?.value),
      foundry.utils.expandObject(overrides)
    );
    preview.setAttribute("style", themeToStyle(theme));
    preview.className = `terminal-shell terminal-preview ${themeClasses(theme)}`;
  }

  reportSaved() {
    const status = this.element?.querySelector("[data-save-status]");
    if (!status) return;
    status.classList.add("is-visible");
    clearTimeout(this._savedTimer);
    this._savedTimer = setTimeout(() => status.classList.remove("is-visible"), 1800);
  }

  async pageFromTarget(target) {
    return foundry.utils.fromUuid(target.dataset.uuid);
  }

  static async onSubmit(_event, _form, formData) {
    if (!this.journal.isOwner) return;
    const current = getTerminalConfig(this.journal);
    const submitted = foundry.utils.expandObject(formData.object);
    submitted.terminalId = slugify(submitted.terminalId) || current.terminalId;
    submitted.launcher = { ...submitted.launcher, audience: current.launcher.audience };
    const model = new TerminalConfigModel({ ...current, ...submitted }, { strict: false });
    await setTerminalConfig(this.journal, model.toObject());
    this.reportSaved();
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
    if (this.activeTab === "theme") this.refreshThemePreview();
  }

  static onOpenTerminal() { return openTerminal(this.journal.uuid); }

  static onEditId(_event, target) {
    const input = this.element.elements.terminalId;
    if (!input || !this.journal.isOwner) return;
    input.readOnly = !input.readOnly;
    target.classList.toggle("active", !input.readOnly);
    if (!input.readOnly) input.focus();
  }

  static async onCopyId() {
    await navigator.clipboard.writeText(this.element.elements.terminalId?.value ?? "");
    ui.notifications.info(game.i18n.localize("RETRO_CRT_TERMINAL.Notifications.IdCopied"));
  }

  static async onOpenPage(_event, target) { return openTerminal(target.dataset.uuid); }

  static async onEditPage(_event, target) {
    (await this.pageFromTarget(target))?.sheet?.render({ force: true });
  }

  static async onToggleVisibility(_event, target) {
    const page = await this.pageFromTarget(target);
    if (!page) return;
    const visibility = page.system.release.visibility === VISIBILITY.HIDDEN ? VISIBILITY.VISIBLE : VISIBILITY.HIDDEN;
    await page.update({ "system.release.visibility": visibility });
    await this.render();
  }

  static async onToggleAccess(_event, target) {
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

  static onLoadPreset() { return this.applyPreset(); }

  /**
   * Repopulates every theme control from the selected preset and saves. Overrides are
   * stored in full, so without this the preset selector would have no visible effect.
   */
  applyPreset() {
    const theme = ThemeRegistry.get(this.element.elements.themeId?.value);
    if (!theme) return;
    const preset = foundry.utils.flattenObject({
      typography: theme.typography,
      colors: theme.colors,
      effects: theme.effects
    });
    for (const [path, value] of Object.entries(preset)) {
      const input = this.element.elements[`${THEME_PREFIX}${path}`];
      if (!input) continue;
      if (input.type === "checkbox") input.checked = Boolean(value);
      else input.value = value;
    }
    for (const output of this.element.querySelectorAll("[data-slider-output]")) {
      output.textContent = this.element.elements[output.dataset.sliderOutput]?.value ?? "";
    }
    this.refreshThemePreview();
    this.element.requestSubmit();
  }

  static async onStartSync() {
    const controllerUserId = this.element.querySelector("[data-sync-controller]")?.value;
    try {
      if (this.prepareSyncContext().activeHere) await sharedSessionManager.updateParticipants({ controllerUserId });
      else await sharedSessionManager.start({
        terminalRootUuid: this.journal.uuid,
        controllerUserId,
        initialPageUuid: this.initialPageUuid
      });
      ui.notifications.info(game.i18n.localize("RETRO_CRT_TERMINAL.Sync.StartedNotice"));
      await this.render();
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async onStopSync() {
    await sharedSessionManager.stop();
    ui.notifications.info(game.i18n.localize("RETRO_CRT_TERMINAL.Sync.StoppedNotice"));
    await this.render();
  }
}

function sliders(schemaField, values, prefix) {
  return Object.entries(schemaField.fields)
    .filter(([, field]) => Number.isFinite(field.min) && Number.isFinite(field.max))
    .map(([key, field]) => ({
      name: `${prefix}.${key}`,
      label: field.label,
      min: field.min,
      max: field.max,
      step: field.step ?? 1,
      value: values[key]
    }));
}

function swatches(schemaField, values) {
  return Object.entries(schemaField.fields).map(([key, field]) => ({
    name: `${THEME_PREFIX}colors.${key}`,
    label: field.label,
    value: values[key]
  }));
}

function effectGroups(schemaField, values) {
  return Object.entries(schemaField.fields).map(([key, group]) => ({
    key,
    label: group.fields.enabled.label,
    enabledName: `${THEME_PREFIX}effects.${key}.enabled`,
    enabled: values[key].enabled,
    sliders: sliders(group, values[key], `${THEME_PREFIX}effects.${key}`)
  }));
}

function structureRow(page) {
  const release = page.system.release ?? {};
  return {
    uuid: page.uuid,
    pageId: page.system.pageId,
    label: page.system.navigation?.label || page.name,
    parent: page.system.navigation?.parent || "—",
    visibility: release.visibility,
    access: release.access,
    visibilityLabel: localizeState(release.visibility),
    accessLabel: localizeState(release.access),
    isHidden: release.visibility === VISIBILITY.HIDDEN,
    isLocked: release.access === ACCESS.LOCKED
  };
}

function localizeState(value) {
  const text = String(value ?? "");
  const key = `RETRO_CRT_TERMINAL.States.${text[0]?.toUpperCase()}${text.slice(1)}`;
  return game.i18n.has(key) ? game.i18n.localize(key) : text;
}
