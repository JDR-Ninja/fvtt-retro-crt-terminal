import { ACCESS, VISIBILITY } from "../constants.mjs";
import { terminalPages } from "./document-resolver.mjs";
import { canViewDocument } from "./permission-resolver.mjs";

export function resolveRelease(page, { user = game.user, sessionUnlocks = new Set(), gmDebug = false } = {}) {
  if (!canViewDocument(page, user)) return { state: "forbidden", visible: false, accessible: false, reason: "permission" };

  const visibility = page.system.release?.visibility ?? VISIBILITY.VISIBLE;
  const access = page.system.release?.access ?? ACCESS.AVAILABLE;
  const unlocked = sessionUnlocks.has(page.uuid);
  const gmOverride = user?.isGM && gmDebug;

  if (gmOverride) {
    return {
      state: visibility === VISIBILITY.HIDDEN ? "hidden-debug" : "available",
      visible: true,
      accessible: true,
      reason: null
    };
  }
  if (visibility === VISIBILITY.HIDDEN) {
    return { state: "hidden", visible: false, accessible: false, reason: "hidden" };
  }
  if (access === ACCESS.LOCKED && !unlocked) {
    return { state: "locked", visible: true, accessible: false, reason: page.system.lock?.type ?? "none" };
  }

  const blocker = findBlockingAncestor(page, sessionUnlocks);
  if (blocker?.state === "hidden") {
    return { state: "hidden", visible: false, accessible: false, reason: "hidden", blockedBy: blocker.page.uuid };
  }
  if (blocker) {
    return { state: "locked", visible: true, accessible: false, reason: blocker.page.system.lock?.type ?? "none", blockedBy: blocker.page.uuid };
  }
  return { state: "available", visible: true, accessible: true, reason: null };
}

// A page inherits the most restrictive state of its navigation ancestors, otherwise any path that
// is not the parent menu (direct UUID, cross-page link, shared session) would walk past the lock.
function findBlockingAncestor(page, sessionUnlocks) {
  const byId = indexByPageId(terminalPages(page.parent));
  const visited = new Set([pageKey(page)]);
  let locked = null;
  let cursor = parentOf(page, byId);

  while (cursor) {
    const key = pageKey(cursor);
    if (visited.has(key)) break;
    visited.add(key);
    if ((cursor.system.release?.visibility ?? VISIBILITY.VISIBLE) === VISIBILITY.HIDDEN) return { state: "hidden", page: cursor };
    if (!locked && (cursor.system.release?.access ?? ACCESS.AVAILABLE) === ACCESS.LOCKED && !sessionUnlocks.has(cursor.uuid)) {
      locked = { state: "locked", page: cursor };
    }
    cursor = parentOf(cursor, byId);
  }
  return locked;
}

function indexByPageId(pages) {
  const byId = new Map();
  for (const page of pages) {
    const key = pageKey(page);
    if (key && !byId.has(key)) byId.set(key, page);
  }
  return byId;
}

function parentOf(page, byId) {
  const parentId = String(page.system?.navigation?.parent ?? "").trim().toLowerCase();
  return parentId ? byId.get(parentId) ?? null : null;
}

function pageKey(page) {
  return String(page.system?.pageId ?? "").trim().toLowerCase();
}
