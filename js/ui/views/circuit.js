import { APPROACHES, CIRCUIT_ENERGY_COST } from "../../config/constants.js";
import { formatMoney } from "../../core/utils.js";

function objective(label, done) {
  return `<span class="badge ${done ? "ok" : "muted"}">${done ? "✓" : "○"} ${label}</span>`;
}

export function viewCircuit(game, s) {
  const { circuit, rivals } = game.circuitStatus();
  const myXI = game.bestXI(s.squad, s.club.formation);
  const myPower = Math.round(game.teamStrength(myXI, s.club, s.boss.stats));
  const currentStars = rivals.reduce((sum, x) => sum + (x.record.bestStars || 0), 0);

  const cards = rivals
    .map(({ rival, def, record, unlocked, estimatedPower }) => {
      const diff = estimatedPower - myPower;
      const powerClass = diff <= -4 ? "ok" : diff <= 4 ? "warn" : "bad";
      const locked = !unlocked;
      return `
        <div class="circuit-card ${locked ? "locked" : ""}">
          <div class="circuit-rank">${rival.difficulty}</div>
          <div class="circuit-info">
            <h4>${rival.name} <span class="badge ${powerClass}">${def?.label || "Rival"}</span></h4>
            <p>${rival.description || def?.desc || "Adversário permanente do circuito."}</p>
            <div class="meta">
              <span>Força ${estimatedPower}</span>
              <span>${rival.formation}</span>
              <span>${APPROACHES[rival.approach]?.label || rival.approach}</span>
              <span>${rival.mentality}</span>
            </div>
            <p class="circuit-lesson">Treino: ${rival.lesson || def?.lesson || "Adapte o time."}</p>
            <div class="circuit-stars" title="Melhor desempenho nesta volta">
              ${[1, 2, 3].map((n) => `<span class="${record.bestStars >= n ? "on" : ""}">★</span>`).join("")}
              <small>${record.wins || 0} vitória(s) · ${record.played || 0} jogo(s)</small>
            </div>
          </div>
          <div class="circuit-action">
            <strong>R$ ${formatMoney(def?.reward || 500)}</strong>
            <button class="btn ${record.wins ? "btn-secondary" : "btn-primary"} btn-sm" data-circuit="${rival.circuitId}" ${locked || game.cooldownLeft("circuit") ? "disabled" : ""}>
              ${locked ? "Bloqueado" : record.wins ? "Revanche" : "Desafiar"}
            </button>
          </div>
        </div>`;
    })
    .join("");

  const last = circuit.lastMatch;
  const lastHtml = last
    ? `<div class="match-score">
        <div class="team">${s.club.name}</div><div class="score">${last.mine}–${last.theirs}</div><div class="team">${last.rival}</div>
      </div>
      <div class="objective-row">
        ${objective("Vencer", last.objectives.win)}
        ${objective("Não sofrer gols", last.objectives.cleanSheet)}
        ${objective("Usar 2 jovens", last.objectives.development)}
      </div>
      <p class="tactical-note">Leitura tática: ${last.tacticalNote}</p>`
    : `<div class="empty">Escolha o primeiro rival. Cada vitória abre o próximo desafio.</div>`;

  return `
    <h1 class="view-title">Circuito de Treino</h1>
    <p class="view-sub">Volta ${circuit.tour} · ${currentStars}/${rivals.length * 3} estrelas nesta volta</p>
    <div class="hero-line">
      Força do seu XI: <strong>${myPower}</strong> · ⚡${CIRCUIT_ENERGY_COST} por jogo · próximo desafio em ${game.cooldownLeft("circuit") || 0}h<br>
      Vença o Porto Imperial para fechar a volta e enfrentar rivais mais fortes na seguinte.
    </div>
    <div class="panel"><h3>Escada de adversários <span class="tag">${circuit.totalWins} vitórias totais</span></h3><div class="circuit-list">${cards}</div></div>
    <div class="panel"><h3>Último teste</h3>${lastHtml}</div>`;
}
