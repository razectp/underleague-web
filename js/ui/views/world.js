/** Clube, influência regional, liga, médico e crônicas */

import { PRACAS } from "../../config/constants.js";
import { formatMoney } from "../../core/utils.js";
import { academyUpgradeCost } from "../../systems/academy.js";
import { playerNameHtml } from "../text.js";

export function viewClub(game, s) {
  const c = s.club;
  const avg =
    s.squad.length > 0
      ? Math.round(s.squad.reduce((a, p) => a + p.overall, 0) / s.squad.length)
      : 0;
  const young = s.squad.filter((p) => p.age <= 21).length;
  const injured = s.squad.filter((p) => p.injury).length;
  const academyLevel = c.academyLevel || 1;
  const academyCost = academyUpgradeCost(academyLevel);
  const lastSeasons = (s.seasonHistory || []).slice(0, 5);
  const trophies = (s.trophies || []).slice(-8).reverse();

  return `
    <h1 class="view-title">${c.name}</h1>
    <p class="view-sub">${c.typeLabel || "Seu clube"} · você é o presidente/técnico · prestígio ${c.prestige}</p>
    <div class="hero-line">
      ${c.motto || "Treine o elenco. Dispute. Faça o nome do clube."}<br>
      Base/academia nível <strong>${c.academyLevel || 1}</strong> · OVR médio <strong>${avg}</strong> · ${young} jovens · ${injured} lesionados
    </div>
    <div class="grid-2">
      <div class="panel">
        <h3>Caixa do clube</h3>
        <dl class="kv">
          <dt>Caixa do clube</dt><dd>R$ ${formatMoney(c.bank)}</dd>
          <dt>Seu bolso (dirigente)</dt><dd>R$ ${formatMoney(s.boss.money)}</dd>
          <dt>Folha semanal</dt><dd>R$ ${formatMoney(s.squad.reduce((a, p) => a + p.salary, 0))}</dd>
          <dt>Campanha na liga</dt><dd>${c.wins}V ${c.draws}E ${c.losses}D</dd>
          <dt>Gols</dt><dd>${c.gf}:${c.ga}</dd>
          <dt>Pontos</dt><dd>${c.points}</dd>
        </dl>
        <div class="btn-row" style="margin-top:0.85rem">
          <label class="sr-only" for="club-amount">Valor da movimentação</label>
          <input type="number" id="club-amount" placeholder="Valor" min="1" style="flex:1" />
        </div>
        <div class="btn-row" style="margin-top:0.5rem">
          <button class="btn btn-primary btn-sm" id="btn-deposit">Colocar no clube</button>
          <button class="btn btn-secondary btn-sm" id="btn-withdraw">Retirar</button>
        </div>
      </div>
      <div class="panel">
        <h3>Identidade</h3>
        <dl class="kv">
          <dt>Nome</dt><dd>${c.name}</dd>
          <dt>Projeto</dt><dd>${c.typeLabel || "—"}</dd>
          <dt>Formação</dt><dd>${c.formation}</dd>
          <dt>Mentalidade</dt><dd>${c.mentality}</dd>
          <dt>Presidente</dt><dd>${s.boss.name}</dd>
        </dl>
        <p style="margin-top:0.85rem;color:var(--muted);font-size:0.88rem;line-height:1.5">
          Este é o seu projeto: base, elenco e identidade.
          Na Arena você encara o clube de outro dirigente, de igual para igual.
        </p>
        <div class="btn-row" style="margin-top:0.75rem">
          <button class="btn btn-secondary btn-sm" data-go="squad">Ver elenco</button>
          <button class="btn btn-primary btn-sm" data-go="compete" data-compete-tab="arena">Arena online</button>
        </div>
      </div>
    </div>
    <div class="grid-2">
      <div class="panel">
        <h3>Academia <span class="tag">nível ${academyLevel}/5</span></h3>
        <p style="color:var(--muted);font-size:0.86rem;line-height:1.45">Faça uma peneira semanal para revelar um jovem. Academia e scouting aumentam qualidade e potencial.</p>
        <div class="btn-row" style="margin-top:0.8rem">
          <button class="btn btn-primary btn-sm" id="btn-promote-youth" ${game.cooldownLeft("academy_intake") ? "disabled" : ""}>Peneira · R$ ${formatMoney(250 + academyLevel * 150)}</button>
          <button class="btn btn-gold btn-sm" id="btn-upgrade-academy" ${!academyCost ? "disabled" : ""}>${academyCost ? `Melhorar · R$ ${formatMoney(academyCost)}` : "Nível máximo"}</button>
        </div>
        <p style="margin-top:0.5rem;color:var(--dim);font-family:var(--mono);font-size:0.74rem">Próxima peneira: ${game.cooldownLeft("academy_intake") || 0}h · formados no clube: ${s.squad.filter((p) => p.academyGraduate).length}</p>
      </div>
      <div class="panel">
        <h3>Sala de troféus <span class="tag">${trophies.length}</span></h3>
        ${trophies.length ? trophies.map((t) => `<div class="feed-item"><time>T${t.season} · D${t.day}</time>🏆 ${t.name}</div>`).join("") : `<div class="empty">Os primeiros títulos ainda serão escritos.</div>`}
      </div>
    </div>
    <div class="panel table-wrap">
      <h3>Histórico de temporadas</h3>
      <table class="data"><thead><tr><th>Temp.</th><th>Pos.</th><th>Pts</th><th>Campanha</th><th>Gols</th><th>Campeão</th></tr></thead>
        <tbody>${lastSeasons.length ? lastSeasons.map((h) => `<tr><td class="num">${h.season}</td><td class="num">${h.rank}º</td><td class="num">${h.points}</td><td>${h.wins}V ${h.draws}E ${h.losses}D</td><td>${h.gf}:${h.ga}</td><td>${h.champion}</td></tr>`).join("") : `<tr><td colspan="6" class="empty">Conclua uma temporada para formar o histórico.</td></tr>`}</tbody>
      </table>
    </div>`;
}

export function viewMap(game) {
  const cards = PRACAS.map((p) => {
    const status = game.influenceRanking(p.id);
    const mine = status.mine;
    const leader = status.leader;
    const top = status.ranking
      .slice(0, 3)
      .map((entry) => `<span class="influence-club ${entry.you ? "you" : ""}">${entry.name}: ${entry.score}%</span>`)
      .join("");
    return `
      <div class="influence-card ${leader?.you ? "leading" : ""}" data-praca="${p.id}">
        <h4>${playerNameHtml(p)}</h4>
        <p>${p.desc}</p>
        <div class="influence-score"><strong>${mine.score}%</strong><span>sua influência · ${mine.rank}º</span></div>
        <div class="influence-ranking">${top || `<span class="influence-club">Nenhum clube ativo</span>`}</div>
        <p style="margin-top:0.35rem;font-family:var(--mono);font-size:0.72rem;color:var(--dim)">${p.bonus}</p>
        <button class="btn btn-secondary btn-sm" style="margin-top:0.55rem;width:100%" data-influence="${p.id}" ${mine.points >= 100 || game.cooldownLeft("influence") ? "disabled" : ""}>Fortalecer presença · ⚡20</button>
      </div>`;
  }).join("");

  return `
    <h1 class="view-title">Mapa de Influência</h1>
    <p class="view-sub">Clubes coexistem nas regiões. Torcida, escolinhas e ações comunitárias aumentam sua presença local.</p>
    <div class="hero-line">Vários clubes disputam a mesma região. Quanto maior a presença, mais visibilidade e receita local.</div>
    <div class="influence-grid">${cards}</div>
    <p style="margin-top:0.9rem;color:var(--dim);font-size:0.82rem;font-family:var(--mono)">Equipe comunitária: ${game.cooldownLeft("influence") || 0}h · ação custa R$ 180 do clube + ⚡20</p>`;
}

export function viewLeague(game, s) {
  const table = game.leagueTable();
  const rows = table
    .map(
      (r) => `
    <tr style="${r.you ? "background:rgba(62,207,106,0.08)" : ""}">
      <td class="num">${r.rank || ""}</td>
      <td>${r.you ? "<strong>" + r.name + " (seu clube)</strong>" : r.name}</td>
      <td class="num">${r.pts}</td>
      <td class="num">${r.w}</td>
      <td class="num">${r.d}</td>
      <td class="num">${r.l}</td>
      <td class="num">${r.gf}:${r.ga}</td>
      <td class="num">${r.gd > 0 ? "+" : ""}${r.gd}</td>
      <td class="num">${(r.gpg ?? 0).toFixed ? r.gpg.toFixed(2) : r.gpg || "—"}</td>
      <td class="num">${r.perf ?? "—"}</td>
    </tr>`
    )
    .join("");

  const topScorers = game
    .playerRankings({ scope: "league", sortBy: "goals", minGames: 0, seasonOnly: true })
    .slice(0, 8)
    .map(
      (p) =>
        `<tr style="${p.you ? "background:rgba(62,207,106,0.08)" : ""}">
          <td class="num">${p.rank}</td>
          <td><strong>${playerNameHtml(p)}</strong> <span class="pos">${p.pos}</span><br>
            <span style="color:var(--dim);font-size:0.72rem">${p.clubName}</span></td>
          <td class="num"><strong>${p.goals}</strong></td>
          <td class="num">${p.gpg.toFixed(2)}</td>
          <td class="num">${p.assists}</td>
          <td class="num">${p.rating ? p.rating.toFixed(2) : "—"}</td>
        </tr>`
    )
    .join("");

  return `
    <h1 class="view-title">Liga local</h1>
    <p class="view-sub">Temporada ${s.season} · ${s.seasonTheme?.name || "Temporada Clássica"} · ${(s.npcs || []).length + 1} clubes · turno e returno</p>
    <div class="panel table-wrap">
      <h3>Classificação</h3>
      <table class="data">
        <thead><tr>
          <th>#</th><th>Clube</th><th>Pts</th><th>V</th><th>E</th><th>D</th><th>Gols</th><th>SG</th><th>G/J</th><th>Perf</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="panel table-wrap">
      <h3>Artilharia da liga</h3>
      <table class="data">
        <thead><tr><th>#</th><th>Jogador</th><th>G</th><th>G/J</th><th>A</th><th>Nota</th></tr></thead>
        <tbody>${topScorers || `<tr><td colspan="6" class="empty">Jogue rodadas para gerar artilharia.</td></tr>`}</tbody>
      </table>
      <div class="btn-row" style="margin-top:0.75rem">
        <button class="btn btn-secondary btn-sm" data-go="rankings">Abrir rankings completos</button>
      </div>
    </div>`;
}

export function viewHospital(_game, s) {
  const injured = s.squad.filter((p) => p.injury);
  const list = injured
    .map(
      (p) => `
    <div class="action-card">
      <div>
        <h4>${playerNameHtml(p)} <span class="pos">${p.pos}</span></h4>
        <p>${p.injury.name} · ${p.injury.daysLeft} dia(s) restante(s)</p>
      </div>
      <button class="btn btn-primary btn-sm" data-heal="${p.id}">Tratar R$500</button>
    </div>`
    )
    .join("");

  return `
    <h1 class="view-title">Departamento médico</h1>
    <p class="view-sub">Lesões no elenco atrapalham a escalação. Tratar custa caro e acelera a alta.</p>
    <div class="panel">
      <h3>Você (técnico)</h3>
      ${
        s.boss.injury || s.boss.health < 90
          ? `<div class="action-card">
              <div>
                <h4>${s.boss.name}</h4>
                <p>${s.boss.injury ? s.boss.injury.name + " · " + s.boss.injury.daysLeft + "d" : "Disposição baixa: " + Math.floor(s.boss.health) + "%"}</p>
              </div>
              <button class="btn btn-gold btn-sm" data-heal="boss">Tratar R$350</button>
            </div>`
          : `<div class="empty">Você está bem para a rotina do clube.</div>`
      }
    </div>
    <div class="panel">
      <h3>Elenco lesionado <span class="tag">${injured.length}</span></h3>
      <div class="action-list">${list || `<div class="empty">Ninguém no departamento médico.</div>`}</div>
    </div>`;
}

export function viewLog(_game, s) {
  const items = (s.chronicles || [])
    .map(
      (c) =>
        `<div class="msg ${c.type}">D${c.day} ${String(c.hour).padStart(2, "0")}h — ${c.text}</div>`
    )
    .join("");

  const npcEvents = (s.npcAi?.events || [])
    .slice(0, 12)
    .map(
      (e) =>
        `<div class="feed-item"><time>D${e.day}</time>${e.text}</div>`
    )
    .join("");
  const rivalCards = (s.npcs || [])
    .map((club) => {
      const plan = club.ai?.plan;
      const last = club.ai?.recentDecisions?.[0];
      return `
        <div class="action-card">
          <div>
            <h4>${club.name}</h4>
            <p style="color:var(--muted);font-size:0.84rem;line-height:1.4">
              ${club.ai?.personality || "comissão"} · DNA ${club.ai?.dna?.formation || club.formation} / ${club.ai?.dna?.approach || club.approach}
              ${plan ? `<br>Plano: ${plan.formation}, ${plan.mentality}, ${plan.approach}` : ""}
              ${last ? `<br>Última: D${last.day} — ${last.text}` : ""}
            </p>
          </div>
          <span class="tag">${club.ai?.dayFocus || "—"}</span>
        </div>`;
    })
    .join("");

  return `
    <h1 class="view-title">Crônicas do clube</h1>
    <p class="view-sub">Histórico de ${s.club.name} e comissões rivais (gestão no servidor).</p>
    <div class="panel">
      <h3>Comissões da liga <span class="tag">${(s.npcs || []).length} bots</span></h3>
      <div class="badge ok" style="margin-bottom:0.5rem">Sempre ativas no relógio do servidor · 1 ciclo/dia · treino ou mercado (não os dois)</div>
      <div class="action-list">${rivalCards || `<div class="empty">Sem rivais.</div>`}</div>
    </div>
    <div class="panel">
      <h3>Decisões recentes dos rivais</h3>
      <div class="feed-list">${npcEvents || `<div class="empty">Ainda sem movimentos das comissões.</div>`}</div>
    </div>
    <div class="panel log-list">
      <h3>Seu clube</h3>
      ${items || `<div class="empty">Nada registrado.</div>`}
    </div>`;
}
