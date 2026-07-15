import { clamp } from "../core/utils.js";
import { REAL_MS_PER_GAME_HOUR } from "../config/constants.js";

export function bar(val, max = 100, cls = "") {
  const pct = clamp((val / max) * 100, 0, 100);
  return `<div class="bar ${cls}"><i style="width:${pct}%"></i></div>`;
}

export function statBar(label, val, max = 100, cls = "") {
  return `<div class="stat-bar"><div class="lbl"><span>${label}</span><strong>${val}</strong></div>${bar(val, max, cls)}</div>`;
}

/**
 * Tempo de jogo “ao vivo” para a UI: combina day/hour do estado com a fração
 * da hora atual a partir de serverClockAt (1 h de jogo ≈ 12 min 30 s reais).
 * Só para exibição — o avanço oficial continua no backend.
 */
export function gameClockParts(state, now = Date.now()) {
  if (!state) return { day: 1, hour: 0, minute: 0, season: 1 };
  let day = Math.max(1, Number(state.day) || 1);
  let hour = Math.max(0, Math.floor(Number(state.hour) || 0));
  let minute = 0;
  const season = Math.max(1, Number(state.season) || 1);
  const anchor = Number(state.serverClockAt);

  if (Number.isFinite(anchor) && now >= anchor && REAL_MS_PER_GAME_HOUR > 0) {
    const ms = now - anchor;
    const fullHours = Math.floor(ms / REAL_MS_PER_GAME_HOUR);
    const remMs = ms - fullHours * REAL_MS_PER_GAME_HOUR;
    hour += fullHours;
    while (hour >= 24) {
      hour -= 24;
      day += 1;
    }
    minute = Math.min(59, Math.floor((remMs / REAL_MS_PER_GAME_HOUR) * 60));
  }

  return { day, hour, minute, season };
}

/** Ex.: Dia 12 · 14:37 · Temporada 1 */
export function timeStr(s, now = Date.now()) {
  const { day, hour, minute, season } = gameClockParts(s, now);
  const h = String(hour).padStart(2, "0");
  const m = String(minute).padStart(2, "0");
  return `Dia ${day} · ${h}:${m} · Temporada ${season}`;
}
