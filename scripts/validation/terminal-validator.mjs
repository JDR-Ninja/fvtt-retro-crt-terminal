import { PAGE_TYPES } from "../constants.mjs";
import { parseTerminalMarkup } from "../parser/parser.mjs";
import { terminalPages } from "../resolver/document-resolver.mjs";
import { ThemeRegistry } from "../themes/theme-registry.mjs";
import { getTerminalConfig } from "../data/terminal-config.mjs";

export function validateTerminal(journal) {
  const pages = terminalPages(journal);
  const issues = [];
  const byId = new Map();

  for (const page of pages) {
    const pageId = String(page.system.pageId ?? "").trim().toLowerCase();
    if (!pageId) issues.push(issue("missing-page-id", "error", page, "Page ID is required"));
    else if (byId.has(pageId)) issues.push(issue("duplicate-page-id", "error", page, `Duplicate page ID: ${pageId}`));
    else byId.set(pageId, page);

    if (!PAGE_TYPES.includes(page.system.pageType)) issues.push(issue("unsupported-page-type", "warning", page, `Unsupported page type: ${page.system.pageType}`));
    for (const diagnostic of parseTerminalMarkup(page.system.source).diagnostics) {
      issues.push(issue(diagnostic.code, diagnostic.severity, page, diagnostic.message, diagnostic.line));
    }
    const override = page.system.presentation?.themeOverride;
    if (override && !ThemeRegistry.has(override)) issues.push(issue("invalid-theme", "warning", page, `Unknown theme: ${override}`));
  }

  for (const page of pages) {
    const parentId = String(page.system.navigation?.parent ?? "").trim().toLowerCase();
    if (parentId && !byId.has(parentId)) issues.push(issue("missing-parent", "warning", page, `Parent page not found: ${parentId}`));
  }
  detectParentCycles(pages, byId, issues);

  const config = getTerminalConfig(journal);
  if (!config.startPageUuid && pages.length === 0) issues.push({ code: "missing-start-page", severity: "error", pageUuid: null, pageName: null, message: "Terminal has no start page" });
  if (!ThemeRegistry.has(config.themeId)) issues.push({ code: "invalid-theme", severity: "warning", pageUuid: null, pageName: null, message: `Unknown terminal theme: ${config.themeId}` });
  return issues;
}

function detectParentCycles(pages, byId, issues) {
  for (const page of pages) {
    const visited = new Set();
    let cursor = page;
    while (cursor) {
      const id = String(cursor.system.pageId ?? "").toLowerCase();
      if (visited.has(id)) {
        issues.push(issue("parent-cycle", "error", page, "Parent hierarchy contains a cycle"));
        break;
      }
      visited.add(id);
      const parentId = String(cursor.system.navigation?.parent ?? "").toLowerCase();
      cursor = parentId ? byId.get(parentId) : null;
    }
  }
}

function issue(code, severity, page, message, line = null) {
  return { code, severity, pageUuid: page.uuid, pageName: page.name, message, line };
}
