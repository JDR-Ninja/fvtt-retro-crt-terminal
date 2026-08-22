import { PAGE_TYPE } from "../constants.mjs";
import { getTerminalConfig } from "../data/terminal-config.mjs";

export function isTerminalPage(document) {
  return document?.documentName === "JournalEntryPage" && document.type === PAGE_TYPE;
}

export function terminalPages(journal) {
  return (journal?.pages?.contents ?? [...(journal?.pages ?? [])]).filter(isTerminalPage);
}

export function normalizeUuidTarget(target) {
  const value = String(target ?? "").trim();
  const uuid = value.match(/^@UUID\[([^\]]+)\](?:\{[^}]*\})?$/);
  return uuid ? uuid[1] : value;
}

export async function resolveDocument(target) {
  if (typeof target !== "string") return target ?? null;
  const uuid = normalizeUuidTarget(target);
  return foundry.utils.fromUuid(uuid);
}

export async function resolveTerminalTarget(target, { currentPage = null } = {}) {
  if (typeof target === "string" && target.startsWith("terminal:")) {
    const pageId = target.slice("terminal:".length).trim().toLowerCase();
    return terminalPages(currentPage?.parent).find(page => page.system.pageId.toLowerCase() === pageId) ?? null;
  }

  const document = await resolveDocument(target);
  if (isTerminalPage(document)) return document;
  if (document?.documentName === "JournalEntry") return resolveStartPage(document);
  return null;
}

export async function resolveStartPage(journal, requestedPage = null) {
  if (!journal) return null;
  if (requestedPage) {
    const requested = await resolveTerminalTarget(requestedPage);
    if (requested && requested.parent?.uuid === journal.uuid) return requested;
  }
  const config = getTerminalConfig(journal);
  if (config.startPageUuid) {
    const configured = await resolveDocument(config.startPageUuid);
    if (isTerminalPage(configured)) return configured;
  }
  return terminalPages(journal).sort(pageSort)[0] ?? null;
}

export function pageSort(left, right) {
  const navSort = (left.system.navigation.sort ?? 0) - (right.system.navigation.sort ?? 0);
  return navSort || (left.sort ?? 0) - (right.sort ?? 0) || left.name.localeCompare(right.name);
}
