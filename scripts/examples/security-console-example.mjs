import { MODULE_ID, PAGE_TYPE } from "../constants.mjs";
import { getTerminalConfig, setTerminalConfig } from "../data/terminal-config.mjs";

export const SECURITY_CONSOLE_TERMINAL_ID = "orpheus-security-console";
export const SECURITY_CONSOLE_EXAMPLE_VERSION = 3;
const PASSWORD = "ORPHEE-79";

export async function createSecurityConsoleExample() {
  return installSecurityConsoleExample();
}

export async function updateSecurityConsoleExample(journal) {
  if (!journal) throw new Error("An example JournalEntry is required");
  return installSecurityConsoleExample(journal);
}

export function isSecurityConsoleExample(journal) {
  return getTerminalConfig(journal).terminalId === SECURITY_CONSOLE_TERMINAL_ID;
}

async function installSecurityConsoleExample(existingJournal = null) {
  if (!game.user?.isGM) throw new Error(game.i18n.localize("RETRO_CRT_TERMINAL.Sync.GmOnly"));

  const JournalEntryClass = globalThis.foundry?.utils?.getDocumentClass?.("JournalEntry") ?? globalThis.JournalEntry;
  if (!JournalEntryClass?.create) throw new Error("JournalEntry document class is unavailable");

  const pages = examplePages();
  const ownership = { default: globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OBSERVER ?? 2 };
  let journal = existingJournal;
  if (journal) {
    await journal.update({ name: localize("TerminalName"), ownership });
    const existingByPageId = new Map(journal.pages.contents.map(page => [page.system.pageId, page]));
    for (const data of pages) {
      const page = existingByPageId.get(data.system.pageId);
      if (page) await page.update(data);
      else await journal.createEmbeddedDocuments("JournalEntryPage", [data]);
    }
  } else {
    journal = await JournalEntryClass.create({ name: localize("TerminalName"), ownership, pages }, { renderSheet: false });
  }

  const startPage = journal.pages.contents.find(page => page.system.pageId === "main");
  if (!startPage) throw new Error("Example terminal start page was not created");

  await setTerminalConfig(journal, {
    enabled: true,
    terminalId: SECURITY_CONSOLE_TERMINAL_ID,
    label: localize("TerminalName"),
    startPageUuid: startPage.uuid,
    themeId: "green-crt",
    launcher: { published: true, sort: 0, icon: "fa-solid fa-computer", audience: "observers" }
  });

  return journal;
}

function examplePages() {
  return [
    pageData({ name: localize("MainName"), pageId: "main", pageType: "menu", source: localize("MainSource"), showInParentMenu: false }),
    pageData({ name: localize("PublicAccessName"), pageId: "public-access", pageType: "directory", source: localize("PublicAccessSource"), label: localize("PublicAccessLabel"), parent: "main", sort: 50 }),
    pageData({ name: localize("StationOverviewName"), pageId: "station-overview", pageType: "document", source: localize("StationOverviewSource"), label: localize("StationOverviewLabel"), parent: "public-access", sort: 100 }),
    pageData({ name: localize("DeckDirectoryName"), pageId: "deck-directory", pageType: "directory", source: localize("DeckDirectorySource"), label: localize("DeckDirectoryLabel"), parent: "public-access", sort: 200 }),
    pageData({ name: localize("ScienceDeckName"), pageId: "science-deck", pageType: "directory", source: localize("ScienceDeckSource"), label: localize("ScienceDeckLabel"), parent: "deck-directory", sort: 100 }),
    pageData({ name: localize("LaboratoryIndexName"), pageId: "laboratory-index", pageType: "document", source: localize("LaboratoryIndexSource"), label: localize("LaboratoryIndexLabel"), parent: "science-deck", sort: 100 }),
    pageData({ name: localize("StatusName"), pageId: "status", pageType: "system", source: localize("StatusSource"), label: localize("StatusLabel"), parent: "main", sort: 100 }),
    pageData({ name: localize("PersonnelName"), pageId: "personnel", pageType: "directory", source: localize("PersonnelSource"), label: localize("PersonnelLabel"), parent: "main", sort: 200 }),
    pageData({ name: localize("VossName"), pageId: "lena-voss", pageType: "document", source: localize("VossSource"), label: localize("VossLabel"), parent: "personnel", sort: 100 }),
    pageData({ name: localize("TannhauserName"), pageId: "marc-tannhauser", pageType: "document", source: localize("TannhauserSource"), label: localize("TannhauserLabel"), parent: "personnel", sort: 200 }),
    pageData({ name: localize("WardName"), pageId: "elise-ward", pageType: "document", source: localize("WardSource"), label: localize("WardLabel"), parent: "personnel", sort: 300 }),
    pageData({ name: localize("CommunicationsName"), pageId: "communications", pageType: "email", source: localize("CommunicationsSource"), label: localize("CommunicationsLabel"), parent: "main", sort: 300 }),
    pageData({ name: localize("DiagnosticsName"), pageId: "diagnostics", pageType: "command", source: localize("DiagnosticsSource"), label: localize("DiagnosticsLabel"), parent: "main", sort: 400 }),
    pageData({ name: localize("ArchivesName"), pageId: "archives", pageType: "directory", source: localize("ArchivesSource"), label: localize("ArchivesLabel"), parent: "main", sort: 500, access: "locked", lockType: "password", secret: PASSWORD, failureMessage: localize("AccessDenied") }),
    pageData({ name: localize("QuarantineName"), pageId: "quarantine-protocol", pageType: "document", source: localize("QuarantineSource"), label: localize("QuarantineLabel"), parent: "archives", sort: 100 }),
    pageData({ name: localize("IncidentName"), pageId: "incident-1979", pageType: "document", source: localize("IncidentSource"), label: localize("IncidentLabel"), parent: "archives", sort: 200, visibility: "hidden" }),
    pageData({ name: localize("LabLogName"), pageId: "lab-b-log", pageType: "document", source: localize("LabLogSource"), label: localize("LabLogLabel"), parent: "incident-1979", sort: 100, visibility: "hidden" })
  ];
}

function pageData({
  name,
  pageId,
  pageType,
  source,
  label = "",
  parent = "",
  sort = 0,
  showInParentMenu = true,
  visibility = "visible",
  access = "available",
  lockType = "none",
  secret = "",
  failureMessage = "ACCESS DENIED"
}) {
  return {
    name,
    type: PAGE_TYPE,
    system: {
      source,
      pageId,
      pageType,
      navigation: { label: label || name, parent, sort, showInParentMenu },
      release: { visibility, access },
      lock: { type: lockType, secret, failureMessage },
      presentation: { themeOverride: "", startFocusedElement: "" }
    },
    flags: { [MODULE_ID]: { example: true, exampleVersion: SECURITY_CONSOLE_EXAMPLE_VERSION } }
  };
}

function localize(key) {
  return game.i18n.localize(`RETRO_CRT_TERMINAL.Example.${key}`);
}
