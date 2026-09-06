import { parseTerminalMarkup } from "../parser/parser.mjs";
import { resolveTerminalTarget } from "./document-resolver.mjs";
import { resolveMenu } from "./menu-resolver.mjs";
import { resolveRelease } from "./release-resolver.mjs";

export async function resolveInlineLabels(nodes, currentPage, options = {}) {
  const pending = [];
  collectUnlabelledLinks(nodes, pending);
  await Promise.all(pending.map(async node => {
    const document = await resolveTerminalTarget(node.target, { currentPage });
    // A bare link must not name a page the reader cannot reach; the GM keeps the real
    // name so a broken or hidden target stays diagnosable.
    if (options.user?.isGM) node.label = document?.name || node.target;
    else node.label = document && resolveRelease(document, options).visible
      ? document.name
      : localize("RETRO_CRT_TERMINAL.Status.Unavailable", "UNAVAILABLE");
  }));
  return pending.length;
}

function localize(key, fallback) {
  return globalThis.game?.i18n?.has?.(key) ? game.i18n.localize(key) : fallback;
}

function collectUnlabelledLinks(nodes, pending) {
  for (const node of nodes ?? []) {
    if (node?.type === "link" && !node.label) pending.push(node);
    collectUnlabelledLinks(node?.children, pending);
    collectUnlabelledLinks(node?.items, pending);
  }
}

export async function resolvePage(page, options = {}) {
  const release = resolveRelease(page, options);
  if (!release.visible || !release.accessible) return { page, release, ast: null, blocks: [], diagnostics: [] };

  const ast = parseTerminalMarkup(page.system.source ?? "");
  const blocks = [];
  for (const node of ast.children) {
    blocks.push(node.type === "menu" ? await resolveMenu(node, page, options) : node);
  }
  await resolveInlineLabels(blocks, page, options);
  return {
    page,
    release,
    ast,
    blocks,
    diagnostics: ast.diagnostics,
    pageType: page.system.pageType ?? "document"
  };
}
