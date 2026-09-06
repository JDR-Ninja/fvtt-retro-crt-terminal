import { terminalPages, pageSort, resolveTerminalTarget } from "./document-resolver.mjs";
import { resolveRelease } from "./release-resolver.mjs";

export async function resolveMenu(node, currentPage, options = {}) {
  const candidates = node.mode === "children"
    ? terminalPages(currentPage.parent)
      .filter(page => page.system.navigation?.showInParentMenu !== false)
      .filter(page => String(page.system.navigation?.parent ?? "").toLowerCase() === String(currentPage.system.pageId ?? "").toLowerCase())
      .sort(pageSort)
      .map(page => ({ label: page.system.navigation?.label || page.name, document: page, target: page.uuid }))
    : await Promise.all(node.items.map(async item => ({
      label: item.label,
      target: item.target,
      document: await resolveTerminalTarget(item.target, { currentPage })
    })));

  const items = [];
  for (const candidate of candidates) {
    if (!candidate.document) {
      // The authored label may name content the player has no right to know about.
      if (options.user?.isGM) items.push({ label: candidate.label || candidate.target, target: candidate.target, state: "missing", accessible: false, debug: "BROKEN" });
      else items.push({ label: localize("RETRO_CRT_TERMINAL.Status.Unavailable", "UNAVAILABLE"), target: candidate.target, state: "missing", accessible: false });
      continue;
    }
    const release = resolveRelease(candidate.document, options);
    if (!release.visible) continue;
    items.push({
      label: candidate.label || candidate.document.name,
      target: candidate.document.uuid,
      pageUuid: candidate.document.uuid,
      state: release.state,
      accessible: release.accessible,
      lockType: candidate.document.system.lock?.type ?? "none",
      debug: release.state === "hidden-debug" ? "HIDDEN" : null
    });
  }
  return { ...node, items };
}

function localize(key, fallback) {
  return globalThis.game?.i18n?.has?.(key) ? game.i18n.localize(key) : fallback;
}
