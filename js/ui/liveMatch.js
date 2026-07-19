/**
 * Transmissão ao vivo da partida (apresentação).
 *
 * Segurança:
 * - Não chama simulação nem concede prêmios.
 * - Só lê snapshot sealed (live.sealed === true).
 * - Skip/acelerar apenas avança o relógio da UI.
 */

import { $ } from "./dom.js";
import { loadPrefs, savePrefs } from "../systems/prefs.js";
import { wantsMotion } from "./fx.js";

let timer = null;
let activeSession = null;

function clearTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function kindClass(kind) {
  if (
    kind === "goal" ||
    kind === "penalty_goal" ||
    kind === "freekick_goal" ||
    kind === "own_goal"
  ) {
    return "live-ev goal";
  }
  if (kind === "red" || kind === "second_yellow") {
    return "live-ev drama red";
  }
  if (kind === "penalty") {
    return "live-ev drama penalty-wait";
  }
  if (kind === "injury" || kind === "var" || kind === "woodwork") {
    return "live-ev drama";
  }
  if (kind === "yellow" || kind === "foul" || kind === "handball" || kind === "offside") {
    return "live-ev foul";
  }
  if (kind === "save" || kind === "penalty_save") return "live-ev save";
  if (kind === "half" || kind === "fulltime" || kind === "kickoff" || kind === "sub") {
    return "live-ev meta";
  }
  return "live-ev";
}

function isGoalKind(kind) {
  return (
    kind === "goal" ||
    kind === "penalty_goal" ||
    kind === "freekick_goal" ||
    kind === "own_goal"
  );
}

function ensureRoot() {
  let root = $("#live-match-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "live-match-root";
    root.className = "live-match-root hidden";
    document.body.appendChild(root);
  }
  return root;
}

/**
 * @param {object} live
 * @returns {{ title: string, cls: string, detail: string }}
 */
function resolveOutcome(live) {
  const hg = live.finalHome;
  const ag = live.finalAway;
  const detail = `${live.home || "Mandante"} ${hg}–${ag} ${live.away || "Visitante"}`;
  const outcome = live.playerOutcome; // "win" | "draw" | "loss" | undefined
  if (outcome === "win") return { title: "VITÓRIA", cls: "win", detail };
  if (outcome === "draw") return { title: "EMPATE", cls: "draw", detail };
  if (outcome === "loss") return { title: "DERROTA", cls: "loss", detail };
  if (hg > ag) return { title: "FIM DE JOGO", cls: "win", detail };
  if (hg < ag) return { title: "FIM DE JOGO", cls: "loss", detail };
  return { title: "FIM DE JOGO", cls: "draw", detail };
}

/**
 * @param {object} live - snapshot de buildLiveSnapshot
 * @param {{ onClose?: () => void }} opts
 */
export function openLiveMatch(live, opts = {}) {
  if (!live || !live.sealed || !Array.isArray(live.events)) {
    console.warn("[liveMatch] snapshot inválido ou não sealed — abortado.");
    return;
  }

  // Impede duas transmissões / reabrir o mesmo pacote para “tentar de novo”
  if (activeSession && activeSession.sessionId === live.sessionId && activeSession.running) {
    return;
  }

  clearTimer();
  const root = ensureRoot();
  const prefs = loadPrefs();
  const motion = wantsMotion();
  activeSession = {
    sessionId: live.sessionId,
    running: true,
    speed: prefs.liveSpeed || 1,
    clock: 0,
    scoreH: 0,
    scoreA: 0,
    eventIndex: 0,
    live,
    motion
  };

  const state = activeSession;
  const events = live.events;

  root.classList.remove("hidden");
  root.innerHTML = `
    <div class="live-match-panel" role="dialog" aria-modal="true" aria-label="Transmissão da partida">
      <header class="live-match-head">
        <div>
          <span class="live-badge">AO VIVO</span>
          <p class="live-sub">${escapeHtml(live.subtitle || "")}</p>
        </div>
        <div class="live-controls">
          <button type="button" class="btn btn-ghost btn-sm" data-live-speed="1">1x</button>
          <button type="button" class="btn btn-ghost btn-sm" data-live-speed="2">2x</button>
          <button type="button" class="btn btn-ghost btn-sm" data-live-speed="4">4x</button>
          <button type="button" class="btn btn-secondary btn-sm" data-live-skip>Pular</button>
        </div>
      </header>

      <div class="live-scoreboard" id="live-scoreboard">
        <div class="live-team" id="live-home">${escapeHtml(live.home)}</div>
        <div class="live-score">
          <span id="live-hg">0</span><span class="live-sep">–</span><span id="live-ag">0</span>
          <div class="live-clock" id="live-clock">0'</div>
        </div>
        <div class="live-team" id="live-away">${escapeHtml(live.away)}</div>
      </div>

      <div id="live-result-slot"></div>

      <div class="live-progress"><i id="live-bar" style="width:0%"></i></div>

      <div class="live-feed" id="live-feed"></div>

      <footer class="live-foot">
        <p id="live-footer-msg" class="micro-help">Resultado já registrado no clube · só a transmissão roda aqui</p>
        <button type="button" class="btn btn-primary btn-sm hidden" id="live-close">Fechar</button>
      </footer>
    </div>`;

  const panel = root.querySelector(".live-match-panel");
  const scoreboard = root.querySelector("#live-scoreboard");
  const resultSlot = root.querySelector("#live-result-slot");
  const feedEl = root.querySelector("#live-feed");
  const clockEl = root.querySelector("#live-clock");
  const hgEl = root.querySelector("#live-hg");
  const agEl = root.querySelector("#live-ag");
  const barEl = root.querySelector("#live-bar");
  const closeBtn = root.querySelector("#live-close");
  const footMsg = root.querySelector("#live-footer-msg");

  const punchScore = (sideEl) => {
    if (!state.motion || !sideEl) return;
    sideEl.classList.remove("is-score-pop");
    // reflow para reiniciar animação
    void sideEl.offsetWidth;
    sideEl.classList.add("is-score-pop");
    setTimeout(() => sideEl.classList.remove("is-score-pop"), 560);
  };

  const flashPanel = (kind) => {
    if (!state.motion || !panel || !scoreboard) return;
    panel.classList.remove("is-goal-shake", "is-goal-flash");
    scoreboard.classList.remove("is-goal-hit", "is-drama-hit");
    void panel.offsetWidth;
    if (kind === "goal") {
      panel.classList.add("is-goal-shake", "is-goal-flash");
      scoreboard.classList.add("is-goal-hit");
      setTimeout(() => {
        panel.classList.remove("is-goal-shake", "is-goal-flash");
        scoreboard.classList.remove("is-goal-hit");
      }, 560);
    } else if (kind === "drama") {
      scoreboard.classList.add("is-drama-hit");
      setTimeout(() => scoreboard.classList.remove("is-drama-hit"), 480);
    }
  };

  /**
   * @param {object} ev
   * @param {{ updateScore?: boolean }} [opts]
   * updateScore=false ao despejar eventos no fim — o placar sealed é a verdade
   * (senão gols já contados / reprocessados viram 6–1 com final 3–1).
   */
  const appendEvent = (ev, opts = {}) => {
    const updateScore = opts.updateScore !== false;
    const row = document.createElement("div");
    row.className = kindClass(ev.kind);
    row.innerHTML = `<time>${ev.min}'</time><span>${escapeHtml(ev.text)}</span>`;
    feedEl.appendChild(row);
    feedEl.scrollTop = feedEl.scrollHeight;

    if (!updateScore) return;

    if (
      ev.kind === "goal" ||
      ev.kind === "penalty_goal" ||
      ev.kind === "freekick_goal"
    ) {
      if (ev.side === "home") state.scoreH += 1;
      else if (ev.side === "away") state.scoreA += 1;
      hgEl.textContent = String(state.scoreH);
      agEl.textContent = String(state.scoreA);
      row.classList.add("pulse");
      punchScore(ev.side === "home" ? hgEl : agEl);
      flashPanel("goal");
    } else if (ev.kind === "own_goal") {
      // gol contra: side = quem cometeu → sobe pro adversário
      if (ev.side === "home") state.scoreA += 1;
      else if (ev.side === "away") state.scoreH += 1;
      hgEl.textContent = String(state.scoreH);
      agEl.textContent = String(state.scoreA);
      row.classList.add("pulse");
      punchScore(ev.side === "home" ? agEl : hgEl);
      flashPanel("goal");
    } else if (ev.kind === "red" || ev.kind === "second_yellow" || ev.kind === "penalty") {
      flashPanel("drama");
    }
  };

  const applySealedScore = () => {
    state.scoreH = live.finalHome;
    state.scoreA = live.finalAway;
    hgEl.textContent = String(live.finalHome);
    agEl.textContent = String(live.finalAway);
  };

  const showResultBanner = () => {
    if (!resultSlot) return;
    const outcome = resolveOutcome(live);
    const footerBit = live.footer ? `<span>${escapeHtml(live.footer)}</span>` : "";
    resultSlot.innerHTML = `
      <div class="live-result-banner ${outcome.cls}" role="status">
        <strong>${escapeHtml(outcome.title)}</strong>
        <span>${escapeHtml(outcome.detail)}</span>
        ${footerBit}
      </div>`;
  };

  const finish = () => {
    clearTimer();
    state.running = false;
    state.clock = 90;
    clockEl.textContent = "90'";
    barEl.style.width = "100%";

    // Despeja o resto do feed SEM somar gols de novo (e sem FX de placar)
    while (state.eventIndex < events.length) {
      appendEvent(events[state.eventIndex++], { updateScore: false });
    }

    // Placar final sempre do snapshot sealed (motor), nunca da contagem da UI
    applySealedScore();
    showResultBanner();

    footMsg.textContent = live.footer || "Fim de jogo · abra o pós-jogo ao fechar";
    closeBtn.textContent = live.mode === "circuit" ? "Fechar transmissão" : "Ver pós-jogo";
    closeBtn.classList.remove("hidden");
  };

  const tick = () => {
    if (!state.running) return;
    // 90 min de jogo em baseDurationMs / speed
    const msPerMin = live.baseDurationMs / 90 / state.speed;
    state.clock += 1;
    if (state.clock > 90) {
      finish();
      return;
    }
    clockEl.textContent = `${state.clock}'`;
    barEl.style.width = `${(state.clock / 90) * 100}%`;

    while (
      state.eventIndex < events.length &&
      events[state.eventIndex].min <= state.clock
    ) {
      const ev = events[state.eventIndex++];
      appendEvent(ev);
      // Pausa dramática em lances-chave (sensação de ansiedade)
      if (ev.drama && state.speed <= 2 && state.motion) {
        clearTimer();
        const pauseMs =
          isGoalKind(ev.kind) || ev.kind === "penalty"
            ? 900 / state.speed
            : 450 / state.speed;
        setTimeout(() => {
          if (!state.running) return;
          if (state.clock >= 90) return;
          timer = setInterval(tick, Math.max(40, msPerMin));
        }, pauseMs);
        return;
      }
    }

    if (state.clock >= 90) finish();
  };

  const armTimer = () => {
    clearTimer();
    const msPerMin = live.baseDurationMs / 90 / state.speed;
    timer = setInterval(tick, Math.max(40, msPerMin));
  };

  root.querySelectorAll("[data-live-speed]").forEach((btn) => {
    btn.onclick = () => {
      state.speed = Number(btn.dataset.liveSpeed) || 1;
      savePrefs({ liveSpeed: state.speed });
      root.querySelectorAll("[data-live-speed]").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      if (state.running) armTimer();
    };
  });
  root.querySelector(`[data-live-speed="${state.speed}"]`)?.classList.add("active");

  root.querySelector("[data-live-skip]").onclick = () => {
    if (!state.running) return;
    finish();
  };

  closeBtn.onclick = () => {
    closeLiveMatch();
    if (opts.onClose) opts.onClose();
  };

  // Primeiro evento (kickoff) imediato
  armTimer();
  tick();
}

export function closeLiveMatch() {
  clearTimer();
  activeSession = null;
  const root = $("#live-match-root");
  if (root) {
    root.classList.add("hidden");
    root.innerHTML = "";
  }
}

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
