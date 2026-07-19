/**
 * Temas de interface (client-only).
 * Persistidos em prefs; aplicados em <html data-theme="…">.
 */

import { loadPrefs, savePrefs } from "../systems/prefs.js";

/** @type {ReadonlyArray<{ id: string, label: string, blurb: string, swatch: string[] }>} */
export const THEMES = [
  {
    id: "pitch",
    label: "Campo",
    blurb: "Base neutra com acento verde de gramado.",
    swatch: ["#0d0f10", "#5cbf7a", "#e8ecea"]
  },
  {
    id: "midnight",
    label: "Noturno",
    blurb: "Azul-ardósia com acento ciano.",
    swatch: ["#0b0f16", "#6eb6ff", "#e6ebf4"]
  },
  {
    id: "graphite",
    label: "Grafite",
    blurb: "Cinza frio com acento dourado.",
    swatch: ["#101214", "#d4b15a", "#eceff1"]
  },
  {
    id: "ember",
    label: "Derby",
    blurb: "Carvão quente com acento âmbar.",
    swatch: ["#120e0c", "#e08945", "#f0e8e2"]
  }
];

const THEME_IDS = new Set(THEMES.map((t) => t.id));

export function normalizeThemeId(value) {
  const id = String(value || "").trim().toLowerCase();
  return THEME_IDS.has(id) ? id : "pitch";
}

/** Aplica o tema no documento. Não grava preferência. */
export function applyTheme(themeId) {
  const id = normalizeThemeId(themeId);
  if (typeof document === "undefined") return id;
  document.documentElement.setAttribute("data-theme", id);
  return id;
}

/** Lê prefs e aplica. */
export function applyThemeFromPrefs() {
  const prefs = loadPrefs();
  return applyTheme(prefs.theme);
}

/** Grava e aplica. */
export function setTheme(themeId) {
  const id = normalizeThemeId(themeId);
  savePrefs({ theme: id });
  return applyTheme(id);
}

export function currentThemeId() {
  return normalizeThemeId(loadPrefs().theme);
}
