import { DEFAULT_TERMINAL_CONFIG, FLAG_SCOPE, TERMINAL_FLAG } from "../constants.mjs";

function merge(base, update) {
  const output = structuredClone(base);
  for (const [key, value] of Object.entries(update ?? {})) {
    if (value && typeof value === "object" && !Array.isArray(value)) output[key] = merge(output[key] ?? {}, value);
    else output[key] = value;
  }
  return output;
}

export function getTerminalConfig(journal) {
  const stored = journal?.getFlag?.(FLAG_SCOPE, TERMINAL_FLAG) ?? {};
  const config = merge(DEFAULT_TERMINAL_CONFIG, stored);
  if (!config.label) config.label = journal?.name ?? "Terminal";
  if (!config.terminalId) config.terminalId = slugify(journal?.name ?? "terminal");
  return config;
}

export async function setTerminalConfig(journal, config) {
  if (!journal) throw new Error("A JournalEntry is required");
  return journal.setFlag(FLAG_SCOPE, TERMINAL_FLAG, merge(getTerminalConfig(journal), config));
}

export function slugify(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "terminal";
}
