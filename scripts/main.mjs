import { MODULE_ID, PAGE_TYPE } from "./constants.mjs";
import { TerminalPageDataModel } from "./data/terminal-page-data-model.mjs";
import { TerminalPageSheet } from "./applications/terminal-page-sheet.mjs";
import { TerminalAPI } from "./api/terminal-api.mjs";
import { ThemeRegistry } from "./themes/theme-registry.mjs";
import { registerSettings } from "./integration/settings.mjs";
import { registerHooks } from "./integration/hooks.mjs";

Hooks.once("init", () => {
  ThemeRegistry.initialize();
  CONFIG.JournalEntryPage.dataModels[PAGE_TYPE] = TerminalPageDataModel;
  CONFIG.JournalEntryPage.typeIcons[PAGE_TYPE] = "fa-solid fa-terminal";

  foundry.applications.apps.DocumentSheetConfig.registerSheet(
    foundry.documents.JournalEntryPage,
    MODULE_ID,
    TerminalPageSheet,
    {
    label: "RETRO_CRT_TERMINAL.PageSheet.Title",
    types: [PAGE_TYPE],
    makeDefault: true,
    canBeDefault: true,
    canConfigure: true
    }
  );

  registerSettings();
  registerHooks();

  const module = game.modules.get(MODULE_ID);
  module.api = TerminalAPI;
  console.info(`${MODULE_ID} | Initialized`);
});
