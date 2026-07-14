/** Treinos, descanso e operações */

import { TRAININGS, OPERATIONS } from "../../config/constants.js";
import { riskLabel } from "../../core/utils.js";
import { skillBar, ensureBossSkillXp } from "../../systems/skillProgress.js";
import { statBar } from "../format.js";
import { playerNameHtml } from "../text.js";

function skillProgressHtml(statKey, level, skillXp) {
  const xp = (skillXp && skillXp[statKey]) || 0;
  const bar = skillBar(level, xp);
  return `
    <div class="skill-xp" title="Progresso até o próximo ponto nesta área">
      <div class="skill-xp-lbl"><span>Até o próximo ponto</span><span>${bar.cur}/${bar.need}</span></div>
      <div class="bar blue"><i style="width:${bar.pct}%"></i></div>
    </div>`;
}

export function viewTrain(game, s) {
  const skillXp = ensureBossSkillXp(s.boss);
  const cards = TRAININGS.map((t) => {
    const cd = game.cooldownLeft("train_" + t.id);
    const val = s.boss.stats[t.stat];
    return `
      <div class="action-card action-card-stack">
        <div>
          <h4>${t.name}</h4>
          <p>${t.desc}</p>
          <div class="meta">
            <span>⚡ ${t.costE}</span>
            <span>R$ ${t.costM}</span>
            <span>${t.stat}: <strong>${val}</strong></span>
            ${cd ? `<span>CD ${cd}h</span>` : ""}
          </div>
          ${skillProgressHtml(t.stat, val, skillXp)}
        </div>
        <button class="btn btn-primary btn-sm" data-train="${t.id}" ${cd ? "disabled" : ""}>Treinar</button>
      </div>`;
  }).join("");

  const squadOpts = s.squad
    .filter((p) => !p.injury)
    .sort((a, b) => b.overall - a.overall)
    .map(
      (p) =>
        `<option value="${p.id}">${playerNameHtml(p)} (${p.pos} ${p.overall}) · sta ${Math.floor(p.stamina)}</option>`
    )
    .join("");

  return `
    <h1 class="view-title">Treinos</h1>
    <p class="view-sub">
      Sessões de campo e de sala. Cada treino soma progresso; o atributo sobe quando a barra enche.
    </p>
    <div class="panel"><h3>Treino pessoal</h3><div class="action-list">${cards}</div></div>
    <div class="panel">
      <h3>Treino individual do elenco <span class="tag">⚡10 · R$40</span></h3>
      <div class="btn-row" style="align-items:center;margin-bottom:0.75rem">
        <label class="field-inline" style="flex:2">Jogador
          <select id="train-player" class="select-inline">${squadOpts}</select>
        </label>
        <label class="field-inline">Atributo
          <select id="train-attr" class="select-inline">
            <option value="pace">Ritmo</option>
            <option value="shoot">Finalização</option>
            <option value="pass">Passe</option>
            <option value="defend">Defesa</option>
            <option value="physical">Físico</option>
          </select>
        </label>
        <button class="btn btn-gold btn-sm" id="btn-squad-train" ${game.cooldownLeft("squad_train") ? "disabled" : ""}>Treinar jogador</button>
      </div>
      <p style="color:var(--dim);font-size:0.82rem;font-family:var(--mono)">
        Próximo treino de elenco em ${game.cooldownLeft("squad_train") || 0}h · liderança alta estimula o grupo no dia a dia.
      </p>
    </div>`;
}

export function viewRest(game, s) {
  const cd = game.cooldownLeft("rest");
  return `
    <h1 class="view-title">Descanso</h1>
    <p class="view-sub">Sem disposição o clube para. Durma, recupere e volte à rotina.</p>
    <div class="panel">
      ${statBar("Energia atual", s.boss.energy, s.boss.maxEnergy)}
      ${statBar("Saúde", s.boss.health, 100, s.boss.health < 40 ? "red" : "")}
      <p style="color:var(--muted);font-size:0.88rem;margin:0.5rem 0 0.8rem">
        Pode descansar de novo em: <strong>${cd}h</strong>
        ${s.boss.injury ? ` · Lesão ativa: ${s.boss.injury.name}` : ""}
      </p>
      <div class="action-list">
        <div class="action-card">
          <div><h4>Soneca (2h)</h4><p>+36 energia, +6 saúde. Grátis.</p></div>
          <button class="btn btn-secondary btn-sm" data-rest="short" ${cd ? "disabled" : ""}>Descansar</button>
        </div>
        <div class="action-card">
          <div><h4>Noite de sono (6h)</h4><p>+80 energia, +14 saúde. R$ 30. Pode acelerar recuperação de lesão.</p></div>
          <button class="btn btn-primary btn-sm" data-rest="long" ${cd ? "disabled" : ""}>Dormir</button>
        </div>
        <div class="action-card">
          <div><h4>Spa / recuperação (4h)</h4><p>+65 energia, +24 saúde. R$ 150. Melhor chance de acelerar lesão.</p></div>
          <button class="btn btn-gold btn-sm" data-rest="spa" ${cd ? "disabled" : ""}>Recuperar</button>
        </div>
      </div>
    </div>
    <div class="panel">
      <h3>Na rotina</h3>
      <p style="color:var(--muted);font-size:0.9rem">O relógio continua no servidor mesmo quando você sai. Cada dia do clube dura 5 horas reais; 1h do clube equivale a 12min30s reais.</p>
    </div>`;
}

export function viewOps(game) {
  const cards = OPERATIONS.map((op) => {
    const risk = riskLabel(op.risk);
    const cd = game.cooldownLeft("op_" + op.id);
    return `
      <div class="action-card">
        <div>
          <h4>${op.name} <span class="badge ${risk.cls}">${risk.text}</span></h4>
          <p>${op.desc}</p>
          <div class="meta">
            <span>⚡ ${op.costE}</span>
            <span>R$ ${op.costM}</span>
            ${op.minScout ? `<span>SCO≥${op.minScout}</span>` : ""}
            ${op.minNeg ? `<span>NEG≥${op.minNeg}</span>` : ""}
            ${op.minLead ? `<span>LID≥${op.minLead}</span>` : ""}
            ${op.minCond ? `<span>CON≥${op.minCond}</span>` : ""}
            ${cd ? `<span>CD ${cd}h</span>` : ""}
          </div>
        </div>
        <button class="btn btn-primary btn-sm" data-op="${op.id}" ${cd ? "disabled" : ""}>Executar</button>
      </div>`;
  }).join("");

  return `
    <h1 class="view-title">Operações</h1>
    <p class="view-sub">Ações de bastidor: scouting, torcida, mercado e rachas — com risco e recompensa.</p>
    <div class="panel"><div class="action-list">${cards}</div></div>`;
}
