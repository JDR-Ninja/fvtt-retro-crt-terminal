import { MODULE_ID } from "../constants.mjs";
import { TerminalAPI } from "../api/terminal-api.mjs";
import { openTerminalConfig } from "./terminal-config-application.mjs";
import { sharedSessionManager } from "../sync/shared-session-manager.mjs";
import { createSecurityConsoleExample, isSecurityConsoleExample, updateSecurityConsoleExample } from "../examples/security-console-example.mjs";
import { prepareLauncherTerminalContext } from "./terminal-launcher-context.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class TerminalLauncherApplication extends HandlebarsApplicationMixin(ApplicationV2) {
  static HELP_SECTION = "publication";
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-launcher`,
    classes: ["retro-crt-terminal", "terminal-launcher"],
    position: { width: 560, height: "auto" },
    window: { title: "RETRO_CRT_TERMINAL.Launcher.Title", icon: "fa-solid fa-computer" },
    actions: {
      open: TerminalLauncherApplication.onOpen,
      configure: TerminalLauncherApplication.onConfigure,
      createExample: TerminalLauncherApplication.onCreateExample,
      updateExample: TerminalLauncherApplication.onUpdateExample,
      joinShared: TerminalLauncherApplication.onJoinShared
    }
  };

  static PARTS = { launcher: { template: `modules/${MODULE_ID}/templates/terminal-launcher.hbs` } };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const launcher = prepareLauncherTerminalContext(game.journal.contents, game.user);
    const shared = sharedSessionManager.active && sharedSessionManager.isParticipant ? {
      controllerName: sharedSessionManager.controller?.name ?? "—",
      controllerOnline: sharedSessionManager.controllerOnline
    } : null;
    return { ...context, ...launcher, shared };
  }

  static async onOpen(_event, target) {
    await TerminalAPI.open(target.dataset.uuid);
  }

  static async onConfigure(_event, target) {
    const journal = await foundry.utils.fromUuid(target.dataset.uuid);
    if (journal) openTerminalConfig(journal);
  }

  static async onCreateExample(_event, target) {
    target.disabled = true;
    try {
      const journal = await createSecurityConsoleExample();
      ui.notifications.info(game.i18n.localize("RETRO_CRT_TERMINAL.Example.Created"));
      await this.render();
      return TerminalAPI.open(journal.uuid);
    } catch (error) {
      console.error(`${MODULE_ID} | Failed to create example terminal`, error);
      ui.notifications.error(game.i18n.localize("RETRO_CRT_TERMINAL.Example.CreateFailed"));
    } finally {
      target.disabled = false;
    }
  }

  static async onUpdateExample(_event, target) {
    target.disabled = true;
    try {
      const journal = await foundry.utils.fromUuid(target.dataset.uuid);
      if (!journal || !isSecurityConsoleExample(journal)) throw new Error("Example terminal not found");
      await updateSecurityConsoleExample(journal);
      ui.notifications.info(game.i18n.localize("RETRO_CRT_TERMINAL.Example.Updated"));
      await this.render();
      return TerminalAPI.open(journal.uuid);
    } catch (error) {
      console.error(`${MODULE_ID} | Failed to update example terminal`, error);
      ui.notifications.error(game.i18n.localize("RETRO_CRT_TERMINAL.Example.UpdateFailed"));
    } finally {
      target.disabled = false;
    }
  }

  static onJoinShared() { return sharedSessionManager.join(); }
}
