import { PRACAS, MATCH_ENERGY_COST, CIRCUIT_ENERGY_COST } from "../../config/constants.js";
import { formatMoney } from "../../core/utils.js";
import { statBar, timeStr } from "../format.js";
import { suggestNextAction, GLOSSARY } from "../guidance.js";

export function viewHome(game, s) {
  const next = game.getNextFixture();
  let nextTxt = "Calendário livre — nova liga em breve.";
  if (next) {
    const f = next.fixture;
    const oppId = f.home === s.club.id ? f.away : f.home;
    const opp = game.getClub(oppId);
    const where = f.home === s.club.id ? "Casa" : "Fora";
    nextTxt = `Próximo jogo: ${where} vs <strong>${opp.name}</strong>`;
  }

  const { items, done, total, claimed } = game.missionsSummary();
  const missionPreview = items
    .map((m) => {
      const tag = m.claimed
        ? "✓"
        : m.progress >= m.target
          ? "★ pronta"
          : `${m.progress}/${m.target}`;
      const reward = `R$ ${formatMoney(m.prize)}${m.energy ? ` · +${m.energy}⚡` : ""}`;
      return `<div class="feed-item"><time>${tag}</time>${m.label} · ${reward}</div>`;
    })
    .join("");

  const avgOvr = Math.round(s.squad.reduce((a, p) => a + p.overall, 0) / Math.max(1, s.squad.length));
  const young = s.squad.filter((p) => p.age <= 21).length;
  const typeLabel = s.club.typeLabel || "Seu clube";
  const circuit = game.circuitStatus();
  const nextRival = circuit.rivals.find((x) => x.unlocked && !x.record.wins) || circuit.rivals[0];
  const regionalPresence = Object.entries(s.club.influence || {})
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id]) => `${PRACAS.find((p) => p.id === id)?.name || id} ${game.influenceRanking(id)?.mine.score || 0}%`)
    .join(", ");

  const tip = suggestNextAction(game);
  const tipTabAttr = tip.tab ? ` data-compete-tab="${tip.tab}"` : "";

  const tut = s.tutorial || { step: 0, done: false };
  const tutSteps = [
    "Bem-vindo. Monte o XI em Escalação e confira quem está apto.",
    "Use Pré-jogo antes da rodada: rival, tática e plantel.",
    "Partidas abrem transmissão ao vivo; o resultado já fica salvo.",
    "Feche as Tarefas do dia para energia e grana extras."
  ];
  const tutHtml =
    !tut.done && tut.step < 4
      ? `<div class="panel tip-panel">
          <h3>Começando · passo ${tut.step + 1}/4</h3>
          <p>${tutSteps[tut.step] || tutSteps[0]}</p>
          <div class="btn-row" style="margin-top:0.65rem">
            <button type="button" class="btn btn-primary btn-sm" id="btn-tutorial-next">Próximo</button>
            <button type="button" class="btn btn-ghost btn-sm" id="btn-tutorial-skip">Pular</button>
            <button type="button" class="btn btn-secondary btn-sm" data-go="${tut.step === 0 ? "lineup" : tut.step === 1 ? "prematch" : tut.step === 2 ? "compete" : "missions"}">Abrir</button>
          </div>
        </div>`
      : "";

  return `
    <h1 class="view-title">Meu time</h1>
    <p class="view-sub">${s.club.name} · ${typeLabel}</p>
    ${tutHtml}

    <div class="loop-guide" title="Rotina do clube">
      <span class="loop-step">Energia</span>
      <span class="loop-arrow">→</span>
      <span class="loop-step">Treino</span>
      <span class="loop-arrow">→</span>
      <span class="loop-step">Rodada</span>
      <span class="loop-arrow">→</span>
      <span class="loop-step">Crescer o clube</span>
    </div>

    <div class="next-action stack-split ${tip.primary ? "is-primary" : ""}">
      <div class="next-action-body">
        <span class="next-action-kicker">Próxima ação</span>
        <h2>${tip.title}</h2>
        <p>${tip.why}</p>
      </div>
      <button type="button" class="btn btn-primary" data-go="${tip.view}"${tipTabAttr}>Fazer isso</button>
    </div>

    <div class="hero-line">
      Presidente/técnico: <strong>${s.boss.name}</strong> · Elenco OVR médio ${avgOvr}
      <span class="help-dot" title="${GLOSSARY.ovr}">?</span>
      · ${young} jovens (≤21)<br>
      ${s.boss.injury
        ? `⚠ Indisposto: ${s.boss.injury.name} (${s.boss.injury.daysLeft}d).`
        : "Rotina: treinar, jogar a rodada, cumprir missões."}
      <br>Presença regional: ${regionalPresence || "ainda começando na cidade"}.
    </div>

    <div class="grid-2">
      <div class="panel">
        <h3>Dia a dia <span class="tag">${timeStr(s)}</span></h3>
        ${statBar("Energia (rotina)", s.boss.energy, s.boss.maxEnergy)}
        <p class="micro-help">${GLOSSARY.energy}</p>
        ${statBar("Disposição", s.boss.health, 100, s.boss.health < 40 ? "red" : "")}
        ${statBar("Prestígio", Math.min(s.boss.rep, 100), 100, "gold")}
        <p style="margin-top:0.6rem;color:var(--muted);font-size:0.88rem">${nextTxt}</p>
        <div class="btn-row" style="margin-top:0.75rem">
          <button class="btn btn-primary" data-go="prematch">Pré-jogo</button>
          <button class="btn btn-secondary" data-go="lineup">Escalação</button>
          <button class="btn btn-secondary" data-go="train">Treinar</button>
        </div>
        <p class="micro-help" style="margin-top:0.5rem">
          Partida ⚡${MATCH_ENERGY_COST} · Circuito ⚡${CIRCUIT_ENERGY_COST} · 1 rodada oficial por dia
        </p>
      </div>
      <div class="panel">
        <h3>Tarefas do dia <span class="tag">${claimed}/${total} resgatadas</span></h3>
        ${missionPreview || `<div class="empty">Sem tarefas</div>`}
        <p class="micro-help" style="margin-top:0.4rem">${done}/${total} completas · checklist fixo todo dia</p>
        <div class="btn-row" style="margin-top:0.75rem">
          <button class="btn btn-gold btn-sm" data-go="missions">Ver tarefas</button>
          <button class="btn btn-secondary btn-sm" data-go="rest">Descansar</button>
        </div>
      </div>
    </div>

    <div class="panel">
      <h3>Circuito de treino <span class="tag">volta ${circuit.circuit.tour}</span></h3>
      <div class="action-card">
        <div>
          <h4>Próximo teste: ${nextRival?.rival.name || "Circuito concluído"}</h4>
          <p>${nextRival?.rival.lesson || "Nova volta disponível."} · força rival ${nextRival?.estimatedPower || "—"}</p>
        </div>
        <button class="btn btn-gold btn-sm" data-go="compete" data-compete-tab="circuito">Abrir circuito</button>
      </div>
    </div>

    <div class="panel">
      <h3>Últimas crônicas</h3>
      ${(s.chronicles || [])
        .slice(0, 3)
        .map((c) => `<div class="msg ${c.type}">D${c.day} ${String(c.hour).padStart(2, "0")}h — ${c.text}</div>`)
        .join("") || `<div class="empty">A história de ${s.club.name} começa agora.</div>`}
    </div>`;
}
