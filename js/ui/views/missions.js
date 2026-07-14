import { formatMoney } from "../../core/utils.js";

function rewardLine(m) {
  const bits = [`R$ ${formatMoney(m.prize)}`];
  if (m.energy) bits.push(`+${m.energy}⚡`);
  if (m.rep) bits.push(`+${m.rep}★`);
  return bits.join(" · ");
}

export function viewMissions(game) {
  const { items, done, claimed, total, fullClaimed, fullClear } = game.missionsSummary();

  const cards = items
    .map((m) => {
      const complete = m.progress >= m.target;
      const pct = Math.round((m.progress / Math.max(1, m.target)) * 100);
      let status;
      if (m.claimed) status = `<span class="badge muted">Resgatada</span>`;
      else if (complete) status = `<span class="badge ok">Pronta</span>`;
      else status = `<span class="badge warn">${m.progress}/${m.target}</span>`;

      const action = m.claimed
        ? ""
        : complete
          ? `<button type="button" class="btn btn-gold btn-sm" data-claim="${m.id}">Resgatar</button>`
          : `<button type="button" class="btn btn-ghost btn-sm" disabled>${m.progress}/${m.target}</button>`;

      return `
        <div class="action-card">
          <div>
            <h4>${m.label} ${status}</h4>
            <p>${m.blurb || ""} · <strong>${rewardLine(m)}</strong></p>
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

  return `
    <h1 class="view-title">Tarefas do dia</h1>
    <p class="view-sub">
      Dia ${game.state.day} · checklist fixo · ${claimed}/${total} resgatadas · ${done}/${total} completas
    </p>
    <div class="panel">
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
      </p>
    </div>`;
}
