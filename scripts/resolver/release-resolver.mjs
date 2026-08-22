import { ACCESS, VISIBILITY } from "../constants.mjs";
import { canViewDocument } from "./permission-resolver.mjs";

export function resolveRelease(page, { user = game.user, sessionUnlocks = new Set(), gmDebug = false } = {}) {
  if (!canViewDocument(page, user)) return { state: "forbidden", visible: false, accessible: false, reason: "permission" };

  const visibility = page.system.release?.visibility ?? VISIBILITY.VISIBLE;
  const access = page.system.release?.access ?? ACCESS.AVAILABLE;
  const unlocked = sessionUnlocks.has(page.uuid);
  const gmOverride = user?.isGM && gmDebug;

  if (visibility === VISIBILITY.HIDDEN && !gmOverride) {
    return { state: "hidden", visible: false, accessible: false, reason: "hidden" };
  }
  if (access === ACCESS.LOCKED && !unlocked && !gmOverride) {
    return { state: "locked", visible: true, accessible: false, reason: page.system.lock?.type ?? "none" };
  }
  return {
    state: visibility === VISIBILITY.HIDDEN ? "hidden-debug" : "available",
    visible: true,
    accessible: true,
    reason: null
  };
}
