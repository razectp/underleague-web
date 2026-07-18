import { clamp } from "../core/utils.js";
import { REAL_MS_PER_GAME_DAY, REAL_MS_PER_GAME_HOUR } from "../config/constants.js";

/** Ex.: 01:23:45 — contagem regressiva em relógio real (parede). */
export function formatCountdownHMS(ms) {
  const totalSec = Math.max(0, Math.ceil(Number(ms) / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Converte ms reais restantes para duração no relógio do clube.
 * Config: 1 dia de jogo = 5 h reais → 1 h de jogo ≈ 12 min 30 s reais.
 * Ex.: "14h20 de jogo", "45min de jogo".
 */
export function formatGameCountdown(ms) {
  if (!(ms > 0) || !(REAL_MS_PER_GAME_HOUR > 0)) return "0min de jogo";
  const gameMinutes = Math.max(1, Math.ceil(Number(ms) / (REAL_MS_PER_GAME_HOUR / 60)));
  const h = Math.floor(gameMinutes / 60);
  const m = gameMinutes % 60;
  if (h <= 0) return `${m}min de jogo`;
  if (m === 0) return `${h}h de jogo`;
  return `${h}h${String(m).padStart(2, "0")} de jogo`;
}

/**
 * Texto de espera privilegiando o tempo do clube.
 * Ex.: "faltam 14h20 de jogo (≈ 02:58 reais)".
 */
export function formatWaitDual(ms, { prefix = "faltam" } = {}) {
  if (!(ms > 0)) return "disponível agora";
  const game = formatGameCountdown(ms);
  const real = formatCountdownHMS(ms);
  const head = prefix ? `${prefix} ${game}` : game;
  return `${head} (≈ ${real} reais)`;
}

/**
 * Tempo real restante de um cooldown em horas de jogo (boss.cooldowns[key]),
 * estimando a fração já decorrida desde serverClockAt.
 */
export function cooldownRemainingMs(state, key, now = Date.now()) {
  const hoursLeft = Number(state?.boss?.cooldowns?.[key]) || 0;
  if (hoursLeft <= 0) return 0;
  const anchor = Number(state.serverClockAt);
  if (!Number.isFinite(anchor) || now <= anchor || !(REAL_MS_PER_GAME_HOUR > 0)) {
    return hoursLeft * REAL_MS_PER_GAME_HOUR;
  }
  const elapsedGameHours = (now - anchor) / REAL_MS_PER_GAME_HOUR;
  return Math.max(0, (hoursLeft - elapsedGameHours) * REAL_MS_PER_GAME_HOUR);
}

/** Ms reais até o próximo dia de jogo (virada 00h do clube no relógio ao vivo). */
export function msUntilNextGameDay(state, now = Date.now()) {
  if (!state) return 0;
  const { hour, minute } = gameClockParts(state, now);
  const gameMinutesLeft = Math.max(0, (24 - hour) * 60 - minute);
  return gameMinutesLeft * (REAL_MS_PER_GAME_HOUR / 60);
}

/**
 * Ms reais até a próxima partida da liga liberar (1 por dia de jogo).
 * Usa o dia “ao vivo” (state + serverClockAt), não só state.day cru —
 * senão o contador pode mostrar ~5 h reais quando o dia do clube já virou na UI.
 */
export function msUntilMatchAvailable(state, lastMatchDay = state?.boss?.lastMatchDay, now = Date.now()) {
  if (!state) return 0;
  const played = Number(lastMatchDay);
  if (!Number.isFinite(played) || played <= 0) return 0;

  const clock = gameClockParts(state, now);
  if (played < clock.day) return 0;
  if (played === clock.day) return msUntilNextGameDay(state, now);

  // lastMatchDay à frente do relógio (estado inconsistente): espera dias restantes.
  const fullDays = played - clock.day;
  return fullDays * REAL_MS_PER_GAME_DAY + msUntilNextGameDay(state, now);
}

/** Dia de jogo “ao vivo” (para UI de disponibilidade da liga). */
export function liveGameDay(state, now = Date.now()) {
  return gameClockParts(state, now).day;
}

/** Atualiza nós [data-countdown-until] no DOM (a cada segundo). */
export function tickCountdownNodes(root = document) {
  if (!root?.querySelectorAll) return;
  const now = Date.now();
  root.querySelectorAll("[data-countdown-until]").forEach((el) => {
    const until = Number(el.dataset.countdownUntil) || 0;
    const left = until - now;
    const prefix = el.dataset.countdownPrefix || "Volte em";
    if (left <= 0) {
      el.textContent = el.dataset.countdownDone || "Disponível agora";
      el.classList.add("countdown-ready");
      return;
    }
    el.classList.remove("countdown-ready");
    // mode=game|dual: prioriza relógio do clube (1 dia ≈ 5 h reais).
    // default/real: só HH:MM:SS de parede.
    const mode = el.dataset.countdownMode || "real";
    if (mode === "game" || mode === "dual") {
      el.textContent = formatWaitDual(left, { prefix });
      return;
    }
    const clock = formatCountdownHMS(left);
    el.textContent = prefix ? `${prefix} ${clock}` : clock;
  });
}

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
