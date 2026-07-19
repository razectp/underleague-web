/**
 * Preferências estritamente de UI no navegador.
 *
 * NÃO armazena progresso de campanha, elenco, finanças, tutorial de jogo
 * nem qualquer dado autoritativo. Isso vive no PostgreSQL/JSON via API.
 *
 * Permitido aqui: velocidade da transmissão, motion, tema visual.
 */

const KEY = "underleague_prefs_v1";

const DEFAULTS = {
  liveSpeed: 1,
  reduceMotion: false,
  theme: "pitch"
};

const THEME_IDS = new Set(["pitch", "midnight", "graphite", "ember"]);

function normalizeTheme(value) {
  const id = String(value || "").trim().toLowerCase();
  return THEME_IDS.has(id) ? id : DEFAULTS.theme;
}

export function loadPrefs() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      liveSpeed: Number(parsed.liveSpeed) || DEFAULTS.liveSpeed,
      reduceMotion: Boolean(parsed.reduceMotion),
      theme: normalizeTheme(parsed.theme)
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function savePrefs(partial) {
  const next = { ...loadPrefs() };
  if (partial && typeof partial === "object") {
    if (partial.liveSpeed != null) next.liveSpeed = Number(partial.liveSpeed) || 1;
    if (partial.reduceMotion != null) next.reduceMotion = Boolean(partial.reduceMotion);
    if (partial.theme != null) next.theme = normalizeTheme(partial.theme);
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}
