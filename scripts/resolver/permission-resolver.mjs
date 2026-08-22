export function canViewDocument(document, user = game.user) {
  if (!document || !user) return false;
  if (user.isGM) return true;
  const parent = document.documentName === "JournalEntryPage" ? document.parent : null;
  return testObserver(document, user) && (!parent || testObserver(parent, user));
}

export function canUpdateDocument(document, user = game.user) {
  if (!document || !user) return false;
  if (user.isGM) return true;
  const owner = globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
  return Boolean(document.testUserPermission?.(user, owner));
}

function testObserver(document, user) {
  const observer = globalThis.CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OBSERVER ?? 2;
  if (typeof document.testUserPermission === "function") return document.testUserPermission(user, observer);
  return Boolean(document.visible);
}
