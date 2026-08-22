const baseEffects = {
  scanlines: { enabled: true, opacity: 0.14, size: 3 },
  glow: { enabled: true, strength: 0.35 },
  flicker: { enabled: false, strength: 0.03, speed: 140 },
  noise: { enabled: false, strength: 0.04 },
  vhs: { enabled: false, tracking: 0, jitter: 0, chromaticOffset: 0 },
  curvature: { enabled: false, strength: 0 }
};

function preset(id, name, font, colors, effects = {}) {
  return {
    id,
    name,
    typography: { font, size: 20, lineHeight: 1.35, letterSpacing: 1, uppercase: false },
    colors,
    effects: structuredClone({ ...baseEffects, ...effects })
  };
}

export const THEME_PRESETS = Object.freeze([
  preset("green-crt", "Green Phosphor CRT", "VT323", { foreground: "#7dff8a", background: "#031006", muted: "#41984c", highlight: "#c8ffcd", border: "#398644", error: "#ff6464" }),
  preset("amber-mainframe", "Amber Mainframe", "Share Tech Mono", { foreground: "#ffb347", background: "#120b02", muted: "#8f672d", highlight: "#ffd28a", border: "#805a20", error: "#ff625f" }),
  preset("dos-blue", "DOS Blue", "IBM Plex Mono", { foreground: "#f4f4f4", background: "#0000aa", muted: "#aaaaaa", highlight: "#ffff55", border: "#55ffff", error: "#ff5555" }, { scanlines: { enabled: false, opacity: 0, size: 3 }, glow: { enabled: false, strength: 0 } }),
  preset("vhs-security", "VHS Security Monitor", "Roboto Mono", { foreground: "#d8e4dc", background: "#080a09", muted: "#7b8a80", highlight: "#ffffff", border: "#58635b", error: "#ff6b6b" }, { vhs: { enabled: true, tracking: 0.35, jitter: 0.4, chromaticOffset: 1 }, noise: { enabled: true, strength: 0.06 } }),
  preset("corporate-1980", "1980s Corporate", "Courier Prime", { foreground: "#d7e5ff", background: "#071326", muted: "#7789a8", highlight: "#ffffff", border: "#42628f", error: "#ff7474" }),
  preset("cold-war-radar", "Cold War Radar", "Share Tech Mono", { foreground: "#84ffbd", background: "#00140d", muted: "#3a8c64", highlight: "#d5ffe8", border: "#2a7451", error: "#ff706f" }),
  preset("clean-modern", "Clean Modern Terminal", "Roboto Mono", { foreground: "#d7dde8", background: "#151922", muted: "#8590a3", highlight: "#ffffff", border: "#3e4654", error: "#ff6b78" }, { scanlines: { enabled: false, opacity: 0, size: 3 }, glow: { enabled: false, strength: 0 } })
]);

export const CURATED_FONTS = Object.freeze([
  "VT323", "Share Tech Mono", "IBM Plex Mono", "Space Mono", "Courier Prime",
  "Oxanium", "Rajdhani", "Chakra Petch", "Roboto Mono", "Source Code Pro"
]);
