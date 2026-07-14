/**
 * Preferências estritamente de UI no navegador.
 *
 * NÃO armazena progresso de campanha, elenco, finanças, tutorial de jogo
 * nem qualquer dado autoritativo. Isso vive no PostgreSQL/JSON via API.
 *
 * Permitido aqui: velocidade da transmissão ao vivo e preferência de motion.
 */

const KEY = "underleague_prefs_v1";

const DEFAULTS = {
  liveSpeed: 1,
  reduceMotion: false
};

export function loadPrefs() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      liveSpeed: Number(parsed.liveSpeed) || DEFAULTS.liveSpeed,
      reduceMotion: Boolean(parsed.reduceMotion)
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
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}
