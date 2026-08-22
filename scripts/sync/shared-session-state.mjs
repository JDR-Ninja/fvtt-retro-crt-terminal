export function createSharedSessionState({
  terminalRootUuid,
  currentPageUuid,
  homePageUuid = currentPageUuid,
  controllerUserId,
  audienceUserIds,
  managerUserId,
  previousRevision = 0
}) {
  return {
    active: true,
    sessionId: crypto.randomUUID(),
    terminalRootUuid,
    currentPageUuid,
    homePageUuid,
    history: [],
    selectedIndex: 0,
    sessionUnlocks: [],
    controllerUserId,
    audienceUserIds: [...new Set(audienceUserIds)],
    managerUserId,
    revision: previousRevision + 1,
    startedAt: Date.now(),
    updatedAt: Date.now()
  };
}

export function applySharedAction(state, action, payload = {}) {
  if (!state?.active) return state;
  const next = structuredClone(state);
  switch (action) {
    case "select":
      next.selectedIndex = Math.max(0, Number(payload.index) || 0);
      break;
    case "navigate":
      if (!payload.pageUuid || payload.pageUuid === next.currentPageUuid) return state;
      next.history.push(next.currentPageUuid);
      next.currentPageUuid = payload.pageUuid;
      next.selectedIndex = 0;
      break;
    case "back": {
      const previous = next.history.pop();
      if (!previous) return state;
      next.currentPageUuid = previous;
      next.selectedIndex = 0;
      break;
    }
    case "home":
      if (!next.homePageUuid) return state;
      next.history = [];
      next.currentPageUuid = next.homePageUuid;
      next.selectedIndex = 0;
      break;
    case "unlock":
      if (!payload.pageUuid || next.sessionUnlocks.includes(payload.pageUuid)) return state;
      next.sessionUnlocks.push(payload.pageUuid);
      break;
    default:
      return state;
  }
  next.revision += 1;
  next.updatedAt = Date.now();
  return next;
}

export function updateSharedParticipants(state, { controllerUserId, audienceUserIds, managerUserId }) {
  const next = structuredClone(state);
  next.controllerUserId = controllerUserId;
  next.audienceUserIds = [...new Set([...audienceUserIds, controllerUserId])];
  next.managerUserId = managerUserId;
  next.revision += 1;
  next.updatedAt = Date.now();
  return next;
}

export function stopSharedSession(state, managerUserId) {
  return {
    ...structuredClone(state),
    active: false,
    managerUserId,
    revision: (state?.revision ?? 0) + 1,
    updatedAt: Date.now()
  };
}
