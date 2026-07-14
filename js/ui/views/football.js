/** Elenco, tática, partidas e mercado */

import {
  APPROACHES,
  FORMATIONS,
  POS_LINE,
  MARKET_FEE_RATE,
  MATCH_ENERGY_COST
} from "../../config/constants.js";
import { formatMoney } from "../../core/utils.js";
import { playerDisplayName } from "../../data/generators.js";
import { escapeHtml as esc } from "../text.js";
import { MENTALITY_UI, plainTacticalTip, GLOSSARY } from "../guidance.js";
import {
  playerAvailability,
  squadAvailabilityReport
} from "../../systems/availability.js";

export function viewSquad(game, s) {
  const report = squadAvailabilityReport(s.squad);
  const rows = [...s.squad]
    .sort((a, b) => b.overall - a.overall)
    .map((p) => {
      const av = playerAvailability(p);
      let statusBadge;
      if (av.reason === "injured") {
        statusBadge = `<span class="badge bad" title="${av.detail}">Lesão</span>`;
      } else if (av.reason === "suspended") {
        statusBadge = `<span class="badge warn" title="${av.detail}">Suspenso</span>`;
      } else if (av.reason === "exhausted") {
        statusBadge = `<span class="badge muted" title="${av.detail}">Exausto</span>`;
      } else {
        statusBadge = `<span class="badge ok">Apto</span>`;
      }
      const y = p.seasonYellows || 0;
      return `<tr>
        <td><span class="pos">${p.pos}</span></td>
        <td>
          <button class="linkish" data-player="${p.id}" title="Ver ficha">
            <strong>${esc(playerDisplayName(p))}</strong>
          </button>
          <br><span style="color:var(--dim);font-size:0.75rem">${p.age}a · J${p.games || 0} G${p.goals || 0} A${p.assists || 0}${p.ratingCount ? ` · nota ${((p.ratingSum || 0) / p.ratingCount).toFixed(1)}` : ""}${y ? ` · 🟨${y}` : ""}</span>
        </td>
        <td class="num">${p.overall}</td>
        <td class="num">${p.form}</td>
        <td class="num">${Math.floor(p.stamina)}</td>
        <td class="num">${p.morale}</td>
        <td>${statusBadge}</td>
        <td class="num">R$ ${formatMoney(p.value)}</td>
        <td><div class="btn-row">
          <button class="btn btn-ghost btn-sm" data-nickname="${p.id}">Apelido</button>
          <button class="btn btn-ghost btn-sm" data-sell="${p.id}">Vender</button>
        </div></td>
      </tr>`;
    })
    .join("");

  const avg = Math.round(s.squad.reduce((a, p) => a + p.overall, 0) / Math.max(1, s.squad.length));
  const warnHtml = report.warnings
    .map((w) => `<div class="msg ${w.level === "critical" ? "bad" : w.level === "warn" ? "warn" : "info"}">${w.text}</div>`)
    .join("");

  return `
    <h1 class="view-title">Elenco</h1>
    <p class="view-sub">${s.squad.length} jogadores · ${report.fitCount} aptos · média OVR ${avg}</p>
    ${warnHtml ? `<div class="panel">${warnHtml}</div>` : ""}
    <div class="panel table-wrap">
      <table class="data">
        <thead><tr>
          <th>Pos</th><th>Nome</th><th>OVR</th><th>Forma</th><th>Sta</th><th>Moral</th><th>Status</th><th>Valor</th><th></th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

export function viewTactics(game, s) {
  const xi = game.bestXI(s.squad, s.club.formation);
  const byLine = [[], [], [], []];
  xi.forEach((p) => {
    const line = POS_LINE[p.pos] ?? 2;
    byLine[line].push(p);
  });
  const visual = [byLine[3], byLine[2], byLine[1], byLine[0]];
  const pitch = visual
    .map(
      (row) =>
        `<div class="formation-row">${row
          .map((p) => {
            const star = p.overall >= 75 ? "star" : "";
            const inj = p.injury ? "injured" : "";
            const shortName = p.nickname || p.name.split(" ")[0];
            return `<div class="pitch-player ${star} ${inj}"><strong>${esc(shortName)}</strong><span>${p.pos} · ${p.overall}</span></div>`;
          })
          .join("")}</div>`
    )
    .join("");

  const forms = Object.keys(FORMATIONS)
    .map((f) => `<option value="${f}" ${s.club.formation === f ? "selected" : ""}>${f}</option>`)
    .join("");
  const approaches = Object.entries(APPROACHES)
    .map(
      ([id, a]) =>
        `<option value="${id}" ${s.club.approach === id ? "selected" : ""}>${a.label} — ${a.desc}</option>`
    )
    .join("");

  const next = game.getNextFixture();
  let rival = null;
  if (next) {
    const f = next.fixture;
    const oppId = f.home === s.club.id ? f.away : f.home;
    rival = game.getClub(oppId);
  }
  const tip = plainTacticalTip(s.club, rival);
  const ment = MENTALITY_UI[s.club.mentality] || MENTALITY_UI.equilibrado;

  return `
    <h1 class="view-title">Tática</h1>
    <p class="view-sub">Escolha como o time joga. O XI (11 titulares) é montado sozinho com os melhores aptos.</p>
    <div class="panel tip-panel">
      <h3>Dica do próximo rival</h3>
      <p>${rival ? `<strong>${rival.name}</strong> — ` : ""}${tip}</p>
    </div>
    <div class="panel">
      <div class="tactics-controls">
        <label>Formação (desenho em campo)
          <select id="sel-formation" class="select-inline">${forms}</select>
        </label>
        <label>Postura
          <select id="sel-mentality" class="select-inline">
            <option value="defesa" ${s.club.mentality === "defesa" ? "selected" : ""}>Fecha a defesa</option>
            <option value="equilibrado" ${s.club.mentality === "equilibrado" ? "selected" : ""}>Equilibrado</option>
            <option value="ataque" ${s.club.mentality === "ataque" ? "selected" : ""}>Empurra o ataque</option>
          </select>
        </label>
        <label>Estilo de jogo
          <select id="sel-approach" class="select-inline">${approaches}</select>
        </label>
      </div>
      <p class="micro-help">${ment.label}: ${ment.plain}</p>
      <div class="formation">${pitch || `<div class="empty">Sem XI disponível</div>`}</div>
      <p style="margin-top:0.75rem;color:var(--dim);font-size:0.82rem;font-family:var(--mono)">
        Força do XI: ${Math.round(game.teamStrength(xi, s.club, s.boss.stats))} · ${xi.length}/11 aptos
        <span class="help-dot" title="${GLOSSARY.ovr}">?</span>
      </p>
    </div>`;
}

export function viewMatch(game, s) {
  const next = game.getNextFixture();
  let nextBlock = `<div class="empty">Carregando...</div>`;
  if (next) {
    const f = next.fixture;
    const oppId = f.home === s.club.id ? f.away : f.home;
    const opp = game.getClub(oppId);
    const where = f.home === s.club.id ? "em casa" : "fora";
    const myXI = game.bestXI(s.squad, s.club.formation);
    const oppXI = game.bestXI(opp.squad, opp.formation);
    const myPower = Math.round(game.teamStrength(myXI, s.club, s.boss.stats));
    const oppPower = Math.round(game.teamStrength(oppXI, opp, null));
    const fit = game.tacticalMatchup(s.club, opp);
    nextBlock = `
      <div class="match-score">
        <div class="team"><div>${s.club.name}</div><small style="color:var(--muted);font-family:var(--mono)">Você</small></div>
        <div class="score">vs</div>
        <div class="team"><div>${opp.name}</div><small style="color:var(--muted);font-family:var(--mono)">${where}</small></div>
      </div>
      <p style="text-align:center;color:var(--muted);margin-bottom:0.8rem">Custa ⚡${MATCH_ENERGY_COST} · 1 partida por dia · prêmio no caixa do clube</p>
      <p class="tactical-note">Força ${myPower} × ${oppPower} · rival: ${opp.formation}, ${opp.mentality}, ${APPROACHES[opp.approach]?.label || "estilo desconhecido"}. ${fit.reasons.join("; ")}.</p>
      <div class="btn-row is-center">
        <button type="button" class="btn btn-primary" id="btn-play-match" ${s.boss.lastMatchDay === s.day ? "disabled" : ""}>
          ${s.boss.lastMatchDay === s.day ? "Aguarde o próximo dia" : "Jogar partida"}
        </button>
      </div>`;
  }

  const last = s.lastMatch;
  const lastHtml = last
    ? `
    <div class="match-score">
      <div class="team">${last.home}</div>
      <div class="score">${last.hg}–${last.ag}</div>
      <div class="team">${last.away}</div>
    </div>
    <div style="max-height:180px;overflow:auto">
      ${(last.events || []).map((e) => `<div class="msg">${e.min}' — ${e.text}</div>`).join("") || `<div class="empty">Jogo truncado, poucos lances.</div>`}
    </div>
    <p style="margin-top:0.5rem;font-family:var(--mono);font-size:0.8rem;color:var(--dim)">Prêmio: R$ ${formatMoney(last.prize)}${last.themeBonus ? ` · bônus temático R$ ${formatMoney(last.themeBonus)}` : ""} · Dia ${last.day}</p>`
    : `<div class="empty">Nenhuma partida jogada ainda.</div>`;

  const fixtures = (s.seasonFixtures || []).filter(
    (f) => f.home === s.club.id || f.away === s.club.id
  );
  const played = fixtures.filter((f) => f.played).length;
  const total = fixtures.length;

  const calendar = fixtures
    .map((f, i) => {
      const home = game.getClub(f.home);
      const away = game.getClub(f.away);
      const isNext = !f.played && fixtures.findIndex((x) => !x.played) === i;
      let score = "—";
      if (f.played && f.result) score = `${f.result.hg}–${f.result.ag}`;
      const youHome = f.home === s.club.id;
      return `<tr style="${isNext ? "background:rgba(62,207,106,0.08)" : ""}">
        <td class="num">${i + 1}</td>
        <td>${youHome ? "<strong>" + home.name + "</strong>" : home.name}</td>
        <td class="num">${score}</td>
        <td>${!youHome ? "<strong>" + away.name + "</strong>" : away.name}</td>
        <td>${f.played ? `<span class="badge muted">OK</span>` : isNext ? `<span class="badge ok">Próxima</span>` : `<span class="badge warn">Agenda</span>`}</td>
      </tr>`;
    })
    .join("");

  return `
    <h1 class="view-title">Liga local</h1>
    <p class="view-sub">${s.club.name} · temporada ${s.season} · ${played}/${total} jogos · ${s.club.points} pts · ${s.seasonTheme?.name || "Temporada Clássica"}</p>
    <div class="hero-line">Regra da temporada: ${s.seasonTheme?.desc || "Sem modificadores."}</div>
    <div class="panel"><h3>Próximo confronto</h3>${nextBlock}</div>
    <div class="panel"><h3>Último jogo</h3>${lastHtml}</div>
    <div class="panel table-wrap">
      <h3>Calendário da temporada</h3>
      <table class="data">
        <thead><tr><th>#</th><th>Casa</th><th></th><th>Fora</th><th>Status</th></tr></thead>
        <tbody>${calendar}</tbody>
      </table>
    </div>`;
}

export function viewMarket(_game, s) {
  const rows = [...s.market]
    .sort((a, b) => b.overall - a.overall)
    .map((p) => {
      const total = p.marketPrice + Math.floor(p.marketPrice * MARKET_FEE_RATE);
      return `<tr>
        <td><span class="pos">${p.pos}</span></td>
        <td><strong>${esc(playerDisplayName(p))}</strong><br><span style="color:var(--dim);font-size:0.75rem">${p.age}a · pot ${p.potential}</span></td>
        <td class="num">${p.overall}</td>
        <td class="num">${p.pace}/${p.shoot}/${p.pass}/${p.defend}/${p.physical}</td>
        <td class="num">R$ ${formatMoney(p.marketPrice)}</td>
        <td class="num">R$ ${formatMoney(total)}</td>
        <td><button class="btn btn-primary btn-sm" data-buy="${p.id}">Comprar</button></td>
      </tr>`;
    })
    .join("");

  return `
    <h1 class="view-title">Mercado</h1>
    <p class="view-sub">Contratações e vendas com taxa de intermediação de 3%. O clube paga primeiro; se faltar, usa o bolso do dirigente.</p>
    <div class="panel table-wrap">
      <table class="data">
        <thead><tr>
          <th>Pos</th><th>Jogador</th><th>OVR</th><th>Rit/Fin/Pas/Def/Fis</th><th>Preço</th><th>+Taxa</th><th></th>
        </tr></thead>
        <tbody>${rows || `<tr><td colspan="7" class="empty">Mercado vazio — faça scouting.</td></tr>`}</tbody>
      </table>
    </div>`;
}
