import { MODULE_ID } from "../constants.mjs";
import { sharedSessionManager } from "../sync/shared-session-manager.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class TerminalSyncApplication extends HandlebarsApplicationMixin(ApplicationV2) {
  static HELP_SECTION = "synchronization";
  static DEFAULT_OPTIONS = {
    classes: ["retro-crt-terminal", "terminal-sync-config"],
    tag: "form",
    position: { width: 600, height: "auto" },
    window: { title: "RETRO_CRT_TERMINAL.Sync.Title", icon: "fa-solid fa-tower-broadcast", resizable: true },
    form: { handler: TerminalSyncApplication.onSubmit, closeOnSubmit: false },
    actions: { stop: TerminalSyncApplication.onStop }
  };

  static PARTS = { form: { template: `modules/${MODULE_ID}/templates/terminal-sync.hbs` } };

  constructor({ journal, initialPageUuid = null }) {
    super({ id: `${MODULE_ID}-sync-${journal.id}` });
    this.journal = journal;
    this.initialPageUuid = initialPageUuid;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const state = sharedSessionManager.state;
    const activeHere = Boolean(state?.active && state.terminalRootUuid === this.journal.uuid);
    const activeUsers = game.users.contents.filter(user => user.active);
    const users = activeUsers.map(user => ({
      id: user.id,
      name: user.name,
      isGM: user.isGM,
      controller: activeHere ? state.controllerUserId === user.id : user.id === game.user.id
    }));
    return {
      ...context,
      journal: this.journal,
      users,
      activeHere,
      anotherActive: Boolean(state?.active && !activeHere),
      controllerName: activeHere ? sharedSessionManager.controller?.name : null,
      controllerOnline: activeHere ? sharedSessionManager.controllerOnline : true,
      submitLabel: activeHere ? "RETRO_CRT_TERMINAL.Sync.Update" : "RETRO_CRT_TERMINAL.Sync.Start"
    };
  }

  static async onSubmit(_event, form) {
    const formData = new FormData(form);
    const controllerUserId = formData.get("controllerUserId");
    try {
      const activeHere = sharedSessionManager.active && sharedSessionManager.state.terminalRootUuid === this.journal.uuid;
      if (activeHere) await sharedSessionManager.updateParticipants({ controllerUserId });
      else await sharedSessionManager.start({ terminalRootUuid: this.journal.uuid, controllerUserId, initialPageUuid: this.initialPageUuid });
      ui.notifications.info(game.i18n.localize(activeHere ? "RETRO_CRT_TERMINAL.Sync.UpdatedNotice" : "RETRO_CRT_TERMINAL.Sync.StartedNotice"));
      await this.render();
    } catch (error) {
      ui.notifications.error(error.message);
    }
  }

  static async onStop() {
    await sharedSessionManager.stop();
    ui.notifications.info(game.i18n.localize("RETRO_CRT_TERMINAL.Sync.StoppedNotice"));
    await this.render();
  }
}
