import { MODULE_ID, PAGE_TYPE } from "../constants.mjs";
import { TerminalAPI, openTerminals } from "../api/terminal-api.mjs";
import { TerminalLauncherApplication } from "../applications/terminal-launcher-application.mjs";
import { openConfigApplications, openTerminalConfig } from "../applications/terminal-config-application.mjs";
import { terminalPages, isTerminalPage } from "../resolver/document-resolver.mjs";
import { getTerminalConfig } from "../data/terminal-config.mjs";
import { sharedSessionManager } from "../sync/shared-session-manager.mjs";
import { openGamemasterGuide } from "../guide/gamemaster-guide.mjs";
import { showGamemasterOnboarding } from "../applications/terminal-onboarding-application.mjs";

export function registerHooks() {
  Hooks.once("ready", async () => {
    await sharedSessionManager.initialize();
    await showGamemasterOnboarding();
  });
  Hooks.on("getSceneControlButtons", addSceneControl);
  Hooks.on("getHeaderControlsApplicationV2", addHeaderControls);
  Hooks.on("updateJournalEntryPage", refreshForPage);
  Hooks.on("createJournalEntryPage", refreshForPage);
  Hooks.on("deleteJournalEntryPage", refreshForPage);
  Hooks.on("updateJournalEntry", refreshForJournal);
  Hooks.on(`${MODULE_ID}.closed`, app => openTerminals.delete(app.id));
  Hooks.on("updateUser", () => {
    for (const app of sharedSessionManager.applications) app.render();
    for (const app of openConfigApplications()) app.render();
    foundry.applications.instances.get(`${MODULE_ID}-launcher`)?.render();
  });
}

function addSceneControl(controls) {
  controls[MODULE_ID] = {
    name: MODULE_ID,
    title: "RETRO_CRT_TERMINAL.Launcher.Control",
    icon: "fa-solid fa-computer",
    order: 75,
    visible: true,
    activeTool: "launcher",
    tools: {
      launcher: {
        name: "launcher",
        title: "RETRO_CRT_TERMINAL.Launcher.Open",
        icon: "fa-solid fa-power-off",
        order: 0,
        button: true,
        onChange: () => new TerminalLauncherApplication().render({ force: true })
      },
      guide: {
        name: "guide",
        title: "RETRO_CRT_TERMINAL.Guide.Open",
        icon: "fa-solid fa-circle-question",
        order: 1,
        button: true,
        visible: game.user.isGM,
        onChange: () => openGamemasterGuide("quickstart")
      }
    }
  };
}

function addHeaderControls(application, controls) {
  const helpSection = application.constructor.HELP_SECTION;
  if (game.user.isGM && helpSection) addGuideControl(controls, helpSection);
  const page = application.page ?? (isTerminalPage(application.document) ? application.document : null);
  const journal = application.entry ?? (application.document?.documentName === "JournalEntry" ? application.document : page?.parent);
  if (page && page.type === PAGE_TYPE) {
    addControlOnce(controls, {
      label: "RETRO_CRT_TERMINAL.Actions.OpenAsTerminal",
      icon: "fa-solid fa-terminal",
      action: `${MODULE_ID}-open`,
      ownership: "OBSERVER",
      visible: true,
      onClick: () => TerminalAPI.open(page.uuid)
    });
  }
  if (journal?.documentName === "JournalEntry" && terminalPages(journal).length) {
    if (game.user.isGM) addGuideControl(controls, page ? "authoring" : "setup");
    if (!page) addControlOnce(controls, {
      label: "RETRO_CRT_TERMINAL.Actions.OpenAsTerminal",
      icon: "fa-solid fa-terminal",
      action: `${MODULE_ID}-open-journal`,
      ownership: "OBSERVER",
      visible: true,
      onClick: () => TerminalAPI.open(journal.uuid)
    });
    if (game.user.isGM) {
      addControlOnce(controls, {
        label: "RETRO_CRT_TERMINAL.Actions.Configure",
        icon: "fa-solid fa-sliders",
        action: `${MODULE_ID}-configure`,
        ownership: "OWNER",
        visible: true,
        onClick: () => openTerminalConfig(journal)
      });
      addControlOnce(controls, {
        label: "RETRO_CRT_TERMINAL.Actions.Structure",
        icon: "fa-solid fa-diagram-project",
        action: `${MODULE_ID}-structure`,
        ownership: "OWNER",
        visible: true,
        onClick: () => openTerminalConfig(journal, { tab: "structure" })
      });
      addControlOnce(controls, {
        label: "RETRO_CRT_TERMINAL.Sync.Manage",
        icon: "fa-solid fa-tower-broadcast",
        action: `${MODULE_ID}-sync`,
        ownership: "OWNER",
        visible: true,
        onClick: () => openTerminalConfig(journal, { tab: "sync" })
      });
    }
  }
}

function addGuideControl(controls, section) {
  addControlOnce(controls, {
    label: "RETRO_CRT_TERMINAL.Guide.Open",
    icon: "fa-solid fa-circle-question",
    action: `${MODULE_ID}-guide`,
    ownership: "OWNER",
    visible: true,
    onClick: () => openGamemasterGuide(section)
  });
}

async function refreshForPage(page) {
  for (const app of openTerminals.values()) {
    const current = await foundry.utils.fromUuid(app.session.currentPageUuid);
    const sameJournal = current?.parent?.uuid === page.parent?.uuid;
    if (app.root?.uuid === page.parent?.uuid || app.session.currentPageUuid === page.uuid || sameJournal) app.render();
  }
  foundry.applications.instances.get(`${MODULE_ID}-launcher`)?.render();
}

function refreshForJournal(journal) {
  for (const app of openTerminals.values()) {
    if (app.root?.uuid === journal.uuid) {
      app.config = getTerminalConfig(journal);
      app.render();
    }
  }
  foundry.applications.instances.get(`${MODULE_ID}-launcher`)?.render();
}

function addControlOnce(controls, control) {
  if (!controls.some(item => item.action === control.action)) controls.unshift(control);
}
