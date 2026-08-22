import { MODULE_ID } from "../constants.mjs";

export const GUIDE_PACK_ID = `${MODULE_ID}.gm-guide`;
export const GUIDE_SEEN_SETTING = "guideSeenVersion";
export const GUIDE_DISABLED_SETTING = "guideDisabled";

export const GUIDE_DOCUMENT_IDS = Object.freeze({
  fr: "RetroGuideFR0001",
  en: "RetroGuideEN0001"
});

export const GUIDE_PAGE_IDS = Object.freeze({
  quickstart: "GuideQuickStart1",
  setup: "GuideConfigure01",
  authoring: "GuideAuthoring01",
  example: "GuideExample0001",
  release: "GuideRelease0001",
  publication: "GuidePublish0001",
  synchronization: "GuideSync0000001",
  themes: "GuideThemes00001",
  operation: "GuideOperate0001",
  checklist: "GuideChecklist01",
  troubleshooting: "GuideTrouble0001"
});

export async function openGamemasterGuide(section = "quickstart") {
  if (!game.user?.isGM) return false;
  const pack = game.packs.get(GUIDE_PACK_ID);
  if (!pack) {
    ui.notifications.warn(game.i18n.localize("RETRO_CRT_TERMINAL.Guide.Unavailable"));
    return false;
  }
  const language = String(game.i18n.lang ?? "en").toLowerCase().startsWith("fr") ? "fr" : "en";
  const guide = await pack.getDocument(GUIDE_DOCUMENT_IDS[language]);
  if (!guide) {
    ui.notifications.warn(game.i18n.localize("RETRO_CRT_TERMINAL.Guide.Unavailable"));
    return false;
  }
  await guide.sheet.render({ force: true, pageId: GUIDE_PAGE_IDS[section] ?? GUIDE_PAGE_IDS.quickstart });
  return guide;
}
