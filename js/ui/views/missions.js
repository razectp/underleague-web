import { formatMoney } from "../../core/utils.js";
import {
  missionDestination,
  missionGoAttrs,
  missionWaitInfo
} from "../../systems/missions.js";

function rewardLine(m) {
  const bits = [`R$ ${formatMoney(m.prize)}`];
  if (m.energy) bits.push(`+${m.energy}⚡`);
  if (m.rep) bits.push(`+${m.rep}★`);
  return bits.join(" · ");
}

function waitHtml(wait) {
  if (!wait) return "";
  return `<p class="mission-wait micro-help" style="margin-top:0.4rem">
    <span class="badge warn">Aguarde</span>
    ${wait.label} ·
    <strong
      class="mission-countdown"
      data-countdown-until="${wait.until}"
      data-countdown-prefix="volte em"
      data-countdown-done="disponível agora"
    >volte em ${wait.text.split("volte em ")[1] || "—"}</strong>
  </p>`;
}

export function viewMissions(game) {
  const { items, done, claimed, total, fullClaimed, fullClear } = game.missionsSummary();
  const now = Date.now();

  const cards = items
    .map((m) => {
      const complete = m.progress >= m.target;
      const pct = Math.round((m.progress / Math.max(1, m.target)) * 100);
      const wait = missionWaitInfo(game, m, now);
      let status;
      if (m.claimed) status = `<span class="badge muted">Resgatada</span>`;
      else if (complete) status = `<span class="badge ok">Pronta</span>`;
      else if (wait) status = `<span class="badge warn">Em espera</span>`;
      else status = `<span class="badge warn">${m.progress}/${m.target}</span>`;

      const dest = missionDestination(m.type);
      let action;
      if (m.claimed) {
        action = `<span class="micro-help">OK</span>`;
      } else if (complete) {
        action = `<button type="button" class="btn btn-gold btn-sm" data-claim="${m.id}">Resgatar</button>`;
      } else if (wait) {
        action = `<button type="button" class="btn btn-ghost btn-sm" ${missionGoAttrs(m.type)} title="${dest.label}">Ver local</button>`;
      } else {
        action = `<button type="button" class="btn btn-primary btn-sm" ${missionGoAttrs(m.type)}>${dest.label} →</button>`;
      }

      return `
        <div class="action-card">
          <div>
            <h4>${m.label} ${status}</h4>
            <p>${m.blurb || ""} · <strong>${rewardLine(m)}</strong></p>
            ${waitHtml(wait)}
            <div class="stat-bar" style="margin-top:0.45rem;max-width:280px">
              <div class="bar ${complete ? "gold" : ""}"><i style="width:${Math.min(100, pct)}%"></i></div>
            </div>
          </div>
          ${action}
        </div>`;
    })
    .join("");

  const bonusBits = [
    `R$ ${formatMoney(fullClear.prize)}`,
    `+${fullClear.energy}⚡`,
    `+${fullClear.rep}★`
  ].join(" · ");

  const nextReady = items.find((m) => !m.claimed && m.progress >= m.target);
  const nextOpen = items.find((m) => !m.claimed && m.progress < m.target && !missionWaitInfo(game, m, now));
  const nextWait = items.find((m) => !m.claimed && m.progress < m.target && missionWaitInfo(game, m, now));
  let quickNav;
  if (nextReady) {
    quickNav = `<button type="button" class="btn btn-gold btn-sm" data-claim="${nextReady.id}">Resgatar: ${nextReady.label}</button>`;
  } else if (nextOpen) {
    quickNav = `<button type="button" class="btn btn-primary btn-sm" ${missionGoAttrs(nextOpen.type)}>${missionDestination(nextOpen.type).label}: ${nextOpen.label} →</button>`;
  } else if (nextWait) {
    const w = missionWaitInfo(game, nextWait, now);
    quickNav = `<span class="micro-help">${nextWait.label}: <strong data-countdown-until="${w.until}" data-countdown-prefix="volte em" data-countdown-done="disponível agora">volte em …</strong></span>`;
  } else {
    quickNav = `<button type="button" class="btn btn-secondary btn-sm" data-go="home">Voltar ao time</button>`;
  }

  return `
    <h1 class="view-title">Tarefas do dia</h1>
    <p class="view-sub">
      Dia ${game.state.day} · checklist fixo · ${claimed}/${total} resgatadas · ${done}/${total} completas
    </p>
    <div class="panel">
      <div class="btn-row" style="margin-bottom:0.75rem;flex-wrap:wrap;gap:0.45rem;align-items:center">
        ${quickNav}
      </div>
      <h3>Rotina diária <span class="tag">sempre as mesmas</span></h3>
      <div class="action-list">${cards}</div>
    </div>
    <div class="panel">
      <h3>Dia completo ${fullClaimed ? `<span class="tag">✓</span>` : ""}</h3>
      <p style="color:var(--muted);font-size:0.9rem;line-height:1.45">
        Resgate <strong>todas</strong> as tarefas e ganhe bônus extra:
        <strong>${bonusBits}</strong>.
        ${fullClaimed ? " Bônus do dia já coletado." : " Ainda falta fechar o checklist."}
      </p>
    </div>
    <div class="panel">
      <h3>Por que fazer</h3>
      <p style="color:var(--muted);font-size:0.9rem;line-height:1.45">
        Cada resgate devolve um pouco de dinheiro e energia — o suficiente para manter a rotina
        (treino, descanso e jogos) sem depender de sorte no sorteio de missões.
        Use <strong>Ir →</strong> para ir ao local da tarefa. Cooldowns mostram
        <strong>volte em HH:MM:SS</strong> (tempo real).
      </p>
    </div>`;
}
