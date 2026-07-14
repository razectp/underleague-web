/**
 * Escalação, pré-jogo, pós-jogo, finanças, calendário, metas.
 */

import { formatMoney } from "../../core/utils.js";
import { FORMATIONS } from "../../config/constants.js";
import { playerAvailability, squadAvailabilityReport } from "../../systems/availability.js";
import { lineupSummary } from "../../systems/lineup.js";
import { ledgerSummary } from "../../systems/finance.js";
import { FACILITY_DEFS, ensureFacilities, facilityUpgradeCost } from "../../systems/facilities.js";
import { seasonGoalsSummary } from "../../systems/seasonGoals.js";
import { APPROACHES } from "../../config/constants.js";
import { MATCH_ENERGY_COST } from "../../config/constants.js";

export function viewLineup(game, s) {
  const sum = lineupSummary(game);
  const report = squadAvailabilityReport(s.squad);
  const startSet = new Set(sum.starters.map((p) => p.id));
  const benchSet = new Set(sum.bench.map((p) => p.id));

  const rows = [...s.squad]
    .sort((a, b) => b.overall - a.overall)
    .map((p) => {
      const av = playerAvailability(p);
      let role = "—";
      if (startSet.has(p.id)) role = "XI";
      else if (benchSet.has(p.id)) role = "Banco";
      const disabled = !av.ok ? "disabled" : "";
      return `<tr class="${!av.ok ? "dim-row" : ""}">
        <td><span class="pos">${p.pos}</span></td>
        <td><strong>${p.name}</strong><br><small style="color:var(--dim)">${av.label}${p.contractYears != null ? ` · contrato ${p.contractYears}a` : ""}</small></td>
        <td class="num">${p.overall}</td>
        <td class="num">${Math.floor(p.stamina)}</td>
        <td><span class="badge ${role === "XI" ? "ok" : role === "Banco" ? "warn" : "muted"}">${role}</span></td>
        <td><button type="button" class="btn btn-sm ${role === "XI" ? "btn-primary" : "btn-secondary"}" data-lineup-toggle="${p.id}" ${disabled}>
          ${role === "XI" ? "Tirar" : role === "Banco" ? "Subir" : "Escalar"}
        </button></td>
      </tr>`;
    })
    .join("");

  return `
    <h1 class="view-title">Escalação</h1>
    <p class="view-sub">XI ${sum.starters.length}/11 · banco ${sum.bench.length}/7 · OVR médio ${sum.avgOvr} · ${s.club.formation}</p>
    ${!sum.full ? `<div class="msg bad">Complete 11 titulares para jogar.</div>` : ""}
    <div class="btn-row" style="margin-bottom:0.75rem">
      <button type="button" class="btn btn-gold btn-sm" id="btn-lineup-auto">Montar automático</button>
      <button type="button" class="btn btn-secondary btn-sm" data-go="prematch">Pré-jogo</button>
    </div>
    <div class="panel">
      <h3>Avisos do plantel</h3>
      ${report.warnings.map((w) => `<div class="msg ${w.level === "critical" ? "bad" : "warn"}">${w.text}</div>`).join("") || `<div class="empty">Plantel em ordem.</div>`}
    </div>
    <div class="panel table-wrap">
      <table class="data">
        <thead><tr><th>Pos</th><th>Nome</th><th>OVR</th><th>Sta</th><th>Papel</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
}

export function viewPrematch(game, s) {
  const next = game.getNextFixture();
  const report = squadAvailabilityReport(s.squad);
  const sum = lineupSummary(game);
  if (!next) {
    return `<h1 class="view-title">Pré-jogo</h1><div class="empty">Sem partida no calendário.</div>`;
  }
  const f = next.fixture;
  const oppId = f.home === s.club.id ? f.away : f.home;
  const opp = game.getClub(oppId);
  const where = f.home === s.club.id ? "Casa" : "Fora";
  const myPower = Math.round(game.teamStrength(sum.starters, s.club, s.boss.stats));
  const oppXI = game.bestXI(game.getSquad(opp.id), opp.formation);
  const oppPower = Math.round(game.teamStrength(oppXI, opp, null));
  const fit = game.tacticalMatchup(s.club, opp);
  const canPlay = s.boss.lastMatchDay !== s.day && sum.full && s.boss.energy >= MATCH_ENERGY_COST;

  return `
    <h1 class="view-title">Pré-jogo</h1>
    <p class="view-sub">${where} vs <strong>${opp.name}</strong> · ⚡${MATCH_ENERGY_COST} · 1x por dia</p>
    <div class="hero-line">
      Força XI: <strong>${myPower}</strong> × Rival ~${oppPower}<br>
      Tática: ${s.club.formation} · ${s.club.mentality} · ${APPROACHES[s.club.approach]?.label || s.club.approach}<br>
      Leitura: ${fit.reasons.join("; ")}
    </div>
    <div class="grid-2">
      <div class="panel">
        <h3>Seu XI (${sum.starters.length})</h3>
        ${sum.starters.map((p) => `<div class="feed-item"><time>${p.pos}</time>${p.name} · ${p.overall}</div>`).join("")}
        <div class="btn-row" style="margin-top:0.75rem">
          <button type="button" class="btn btn-secondary btn-sm" data-go="lineup">Ajustar escalação</button>
          <button type="button" class="btn btn-secondary btn-sm" data-go="tactics">Tática</button>
        </div>
      </div>
      <div class="panel">
        <h3>Plantel</h3>
        <dl class="kv">
          <dt>Aptos</dt><dd>${report.fitCount}</dd>
          <dt>Lesionados</dt><dd>${report.injured.length}</dd>
          <dt>Suspensos</dt><dd>${report.suspended.length}</dd>
          <dt>Exaustos</dt><dd>${report.exhausted.length}</dd>
        </dl>
        ${report.suspended.map((x) => `<div class="msg warn">${x.player.name}: ${x.detail}</div>`).join("")}
        ${report.injured.slice(0, 4).map((x) => `<div class="msg bad">${x.player.name}: ${x.detail}</div>`).join("")}
      </div>
    </div>
    <div class="panel">
      <div class="btn-row is-center">
        <button type="button" class="btn btn-primary" id="btn-play-match" ${canPlay ? "" : "disabled"}>
          ${s.boss.lastMatchDay === s.day ? "Já jogou hoje" : !sum.full ? "Complete o XI" : s.boss.energy < MATCH_ENERGY_COST ? "Sem energia" : "Iniciar partida"}
        </button>
      </div>
    </div>`;
}

export function viewPostMatch(game, s) {
  const pm = s.lastPostMatch;
  if (!pm) {
    return `<h1 class="view-title">Pós-jogo</h1><div class="empty">Jogue uma partida para ver o relatório do técnico.</div>`;
  }
  const result =
    pm.playerWon ? "Vitória" : pm.playerDraw ? "Empate" : "Derrota";
  return `
    <h1 class="view-title">Pós-jogo</h1>
    <p class="view-sub">${pm.home} ${pm.hg}–${pm.ag} ${pm.away} · ${result} · Dia ${pm.day}</p>
    <div class="hero-line">
      Prêmio R$ ${formatMoney(pm.prize)}${pm.themeBonus ? ` · tema +R$ ${formatMoney(pm.themeBonus)}` : ""}
    </div>
    <div class="grid-2">
      <div class="panel">
        <h3>Lances-chave</h3>
        ${(pm.events || []).map((e) => `<div class="feed-item"><time>${e.min}'</time>${e.text}</div>`).join("") || `<div class="empty">—</div>`}
      </div>
      <div class="panel">
        <h3>Disciplina & lesões</h3>
        ${(pm.cards || []).map((e) => `<div class="msg warn">${e.min}' · ${e.text}</div>`).join("") || `<div class="empty">Sem cartões registrados.</div>`}
        ${(pm.injuries || []).map((i) => `<div class="msg bad">${i.min}' · ${i.name}</div>`).join("")}
        ${pm.discipline?.sentOffIds?.length ? `<p class="micro-help">Expulsos ficam suspensos no próximo jogo.</p>` : ""}
      </div>
    </div>
    <div class="panel">
      <h3>XI utilizado</h3>
      <div class="btn-row" style="flex-wrap:wrap">
        ${(pm.xi || []).map((p) => `<span class="badge muted">${p.pos} ${p.name}</span>`).join(" ")}
      </div>
      <div class="btn-row" style="margin-top:0.75rem">
        <button type="button" class="btn btn-secondary btn-sm" data-go="compete" data-compete-tab="liga">Voltar à liga</button>
        <button type="button" class="btn btn-primary btn-sm" data-go="lineup">Escalação</button>
      </div>
    </div>`;
}

export function viewFinance(game, s) {
  const fin = ledgerSummary(game, 25);
  const fac = ensureFacilities(s.club);
  const goals = seasonGoalsSummary(game);

  const rows = fin.items
    .map(
      (e) =>
        `<tr>
          <td class="num">D${e.day}</td>
          <td>${e.label}</td>
          <td class="num" style="color:${e.amount >= 0 ? "var(--green)" : "var(--red)"}">${e.amount >= 0 ? "+" : ""}${formatMoney(e.amount)}</td>
        </tr>`
    )
    .join("");

  const facCards = Object.entries(FACILITY_DEFS)
    .map(([key, def]) => {
      const lv = fac[key] || 1;
      const cost = facilityUpgradeCost(s.club, key);
      return `<div class="action-card">
        <div>
          <h4>${def.label} <span class="tag">Nv.${lv}/${def.max}</span></h4>
          <p>${def.blurb}</p>
        </div>
        <button type="button" class="btn btn-gold btn-sm" data-upgrade-facility="${key}" ${cost == null || s.club.bank < cost ? "disabled" : ""}>
          ${cost == null ? "Máx" : `Melhorar R$ ${formatMoney(cost)}`}
        </button>
      </div>`;
    })
    .join("");

  const goalRow = (key, label, cur, target, claimed) => {
    const done = cur >= target;
    return `<div class="action-card">
      <div><h4>${label}</h4><p>${cur}/${target}${claimed ? " · resgatada" : done ? " · pronta" : ""}</p></div>
      <button type="button" class="btn btn-sm ${claimed ? "btn-ghost" : "btn-gold"}" data-claim-goal="${key}" ${claimed || !done ? "disabled" : ""}>
        ${claimed ? "OK" : done ? "Resgatar" : "—"}
      </button>
    </div>`;
  };

  return `
    <h1 class="view-title">Finanças & estrutura</h1>
    <p class="view-sub">Caixa R$ ${formatMoney(fin.clubBank)} · bolso R$ ${formatMoney(fin.bossMoney)} · temporada ${s.season}</p>
    <div class="grid-2">
      <div class="panel">
        <h3>Temporada</h3>
        <dl class="kv">
          <dt>Receitas</dt><dd>+R$ ${formatMoney(fin.seasonIncome)}</dd>
          <dt>Despesas</dt><dd>R$ ${formatMoney(Math.abs(fin.seasonExpense))}</dd>
          <dt>Saldo</dt><dd>R$ ${formatMoney(fin.seasonNet)}</dd>
        </dl>
      </div>
      <div class="panel">
        <h3>Metas da temporada</h3>
        ${goalRow("points", "Pontos", goals.progress.points, goals.targets.points, goals.claimed.points)}
        ${goalRow("wins", "Vitórias", goals.progress.wins, goals.targets.wins, goals.claimed.wins)}
        ${goalRow("cleanSheets", "Clean sheets", goals.progress.cleanSheets, goals.targets.cleanSheets, goals.claimed.cleanSheets)}
        <div class="action-card">
          <div><h4>Terminar no top 4</h4>
          <p>${goals.progress.rank ? `${goals.progress.rank}º agora` : "Sem posição"} · meta ≤4º${goals.claimed.topHalf ? " · resgatada" : ""}</p></div>
          <button type="button" class="btn btn-sm ${goals.claimed.topHalf ? "btn-ghost" : "btn-gold"}" data-claim-goal="topHalf" ${goals.claimed.topHalf || !(goals.progress.rank && goals.progress.rank <= 4) ? "disabled" : ""}>
            ${goals.claimed.topHalf ? "OK" : goals.progress.rank && goals.progress.rank <= 4 ? "Resgatar" : "—"}
          </button>
        </div>
      </div>
    </div>
    <div class="panel"><h3>Estrutura</h3><div class="action-list">${facCards}</div></div>
    <div class="panel table-wrap">
      <h3>Extrato</h3>
      <table class="data">
        <thead><tr><th>Dia</th><th>Lançamento</th><th>Valor</th></tr></thead>
        <tbody>${rows || `<tr><td colspan="3" class="empty">Sem lançamentos ainda.</td></tr>`}</tbody>
      </table>
    </div>`;
}

export function viewCalendar(game, s) {
  const fixtures = (s.seasonFixtures || []).filter(
    (f) => f.home === s.club.id || f.away === s.club.id
  );
  const rows = fixtures
    .map((f, i) => {
      const home = game.getClub(f.home);
      const away = game.getClub(f.away);
      const isNext = !f.played && fixtures.findIndex((x) => !x.played) === i;
      let score = "—";
      if (f.played && f.result) score = `${f.result.hg}–${f.result.ag}`;
      return `<tr style="${isNext ? "background:rgba(62,207,106,0.08)" : ""}">
        <td class="num">${i + 1}</td>
        <td>${f.home === s.club.id ? "<strong>Casa</strong>" : home.name}</td>
        <td class="num">${score}</td>
        <td>${f.away === s.club.id ? "<strong>Fora</strong>" : away.name}</td>
        <td>${f.played ? "OK" : isNext ? "Próxima" : "Agenda"}</td>
      </tr>`;
    })
    .join("");

  return `
    <h1 class="view-title">Calendário</h1>
    <p class="view-sub">Temporada ${s.season} · ${s.seasonTheme?.name || ""} · 1 partida oficial por dia de jogo</p>
    <div class="panel table-wrap">
      <table class="data">
        <thead><tr><th>#</th><th>Casa</th><th></th><th>Fora</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="btn-row">
      <button type="button" class="btn btn-primary btn-sm" data-go="prematch">Abrir pré-jogo</button>
    </div>`;
}
