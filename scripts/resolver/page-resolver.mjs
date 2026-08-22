import { parseTerminalMarkup } from "../parser/parser.mjs";
import { resolveTerminalTarget } from "./document-resolver.mjs";
import { resolveMenu } from "./menu-resolver.mjs";
import { resolveRelease } from "./release-resolver.mjs";

export async function resolveInlineLabels(nodes, currentPage) {
  const pending = [];
  collectUnlabelledLinks(nodes, pending);
  await Promise.all(pending.map(async node => {
    const document = await resolveTerminalTarget(node.target, { currentPage });
    node.label = document?.name || node.target;
  }));
  return pending.length;
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
  await resolveInlineLabels(blocks, page);
  return {
    page,
    release,
    ast,
    blocks,
    diagnostics: ast.diagnostics,
    pageType: page.system.pageType ?? "document"
  };
}
