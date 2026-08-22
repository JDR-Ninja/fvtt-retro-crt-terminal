import { MODULE_ID } from "../constants.mjs";
import { TerminalAPI } from "../api/terminal-api.mjs";
import { createSecurityConsoleExample, isSecurityConsoleExample, updateSecurityConsoleExample } from "../examples/security-console-example.mjs";
import { GUIDE_DISABLED_SETTING, GUIDE_SEEN_SETTING, openGamemasterGuide } from "../guide/gamemaster-guide.mjs";
import { prepareLauncherTerminalContext } from "./terminal-launcher-context.mjs";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class TerminalOnboardingApplication extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: `${MODULE_ID}-onboarding`,
    classes: ["retro-crt-terminal", "terminal-onboarding"],
    position: { width: 650, height: "auto" },
    window: { title: "RETRO_CRT_TERMINAL.Guide.WelcomeTitle", icon: "fa-solid fa-circle-question", resizable: true },
    actions: {
      openGuide: TerminalOnboardingApplication.onOpenGuide,
      launchExample: TerminalOnboardingApplication.onLaunchExample,
      dismiss: TerminalOnboardingApplication.onDismiss,
      disable: TerminalOnboardingApplication.onDisable
    }
  };

  static PARTS = { guide: { template: `modules/${MODULE_ID}/templates/terminal-onboarding.hbs` } };

  async _prepareContext(options) {
    const launcher = prepareLauncherTerminalContext(game.journal.contents, game.user);
    const example = launcher.terminals.find(terminal => terminal.isExample);
    const exampleActionLabel = launcher.canCreateExample
      ? "RETRO_CRT_TERMINAL.Example.Create"
      : launcher.canRestoreExample
        ? "RETRO_CRT_TERMINAL.Example.Restore"
        : "RETRO_CRT_TERMINAL.Example.Open";
    return {
      ...await super._prepareContext(options),
      version: game.modules.get(MODULE_ID).version,
      exampleActionLabel,
      exampleUuid: launcher.exampleUuid || example?.uuid || ""
    };
  }

  async markSeen() {
    const version = game.modules.get(MODULE_ID).version;
    if (game.settings.get(MODULE_ID, GUIDE_SEEN_SETTING) !== version) {
      await game.settings.set(MODULE_ID, GUIDE_SEEN_SETTING, version);
    }
  }

  static async onOpenGuide() {
    await this.markSeen();
    await this.close();
    return openGamemasterGuide("quickstart");
  }

  static async onLaunchExample(_event, target) {
    target.disabled = true;
    try {
      const { journal, notice } = await ensureOnboardingExample();
      if (notice) ui.notifications.info(game.i18n.localize(notice));
      await TerminalAPI.open(journal.uuid);
      await this.markSeen();
      return this.close();
    } catch (error) {
      console.error(`${MODULE_ID} | Failed to launch example terminal from onboarding`, error);
      ui.notifications.error(game.i18n.localize("RETRO_CRT_TERMINAL.Example.CreateFailed"));
    } finally {
      target.disabled = false;
    }
  }

  static async onDismiss() {
    await this.markSeen();
    return this.close();
  }

  static async onDisable() {
    await game.settings.set(MODULE_ID, GUIDE_DISABLED_SETTING, true);
    await this.markSeen();
    return this.close();
  }
}

export async function ensureOnboardingExample({
  journals = game.journal.contents,
  createExample = createSecurityConsoleExample,
  updateExample = updateSecurityConsoleExample
} = {}) {
  const contents = Array.from(journals ?? []);
  const existing = contents.find(isSecurityConsoleExample) ?? null;
  if (!existing) {
    return {
      journal: await createExample(),
      notice: "RETRO_CRT_TERMINAL.Example.Created"
    };
  }

  const launcher = prepareLauncherTerminalContext(contents, game.user);
  if (launcher.canRestoreExample) {
    return {
      journal: await updateExample(existing),
      notice: "RETRO_CRT_TERMINAL.Example.Updated"
    };
  }
  return { journal: existing, notice: null };
}

export async function showGamemasterOnboarding() {
  if (!game.user?.isGM) return false;
  if (game.settings.get(MODULE_ID, GUIDE_DISABLED_SETTING)) return false;
  const version = game.modules.get(MODULE_ID).version;
  if (game.settings.get(MODULE_ID, GUIDE_SEEN_SETTING) === version) return false;
  if (foundry.applications.instances.get(`${MODULE_ID}-onboarding`)) return false;
  await new TerminalOnboardingApplication().render({ force: true });
  return true;
}
