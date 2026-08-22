import { getTerminalConfig } from "../data/terminal-config.mjs";
import { canViewDocument } from "../resolver/permission-resolver.mjs";
import { terminalPages } from "../resolver/document-resolver.mjs";
import { isSecurityConsoleExample } from "../examples/security-console-example.mjs";

export function prepareLauncherTerminalContext(journals, user) {
  const isGM = Boolean(user?.isGM);
  const contents = Array.from(journals ?? []);
  const exampleJournal = isGM ? contents.find(isSecurityConsoleExample) ?? null : null;
  const terminals = contents.flatMap(journal => {
    const config = getTerminalConfig(journal);
    if (!config.enabled || terminalPages(journal).length === 0) return [];
    if (!isGM && (!config.launcher.published || !canViewDocument(journal, user))) return [];
    return [{
      uuid: journal.uuid,
      label: config.label,
      icon: config.launcher.icon || "fa-solid fa-computer",
      published: config.launcher.published,
      sort: config.launcher.sort,
      canConfigure: isGM,
      isExample: isGM && isSecurityConsoleExample(journal)
    }];
  }).sort((a, b) => a.sort - b.sort || a.label.localeCompare(b.label));
  const exampleListed = terminals.some(terminal => terminal.isExample);

  return {
    terminals,
    empty: terminals.length === 0,
    isGM,
    canCreateExample: isGM && !exampleJournal,
    canRestoreExample: isGM && Boolean(exampleJournal) && !exampleListed,
    exampleUuid: exampleJournal?.uuid ?? ""
  };
}
