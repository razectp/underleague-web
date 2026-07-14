/**
 * Arena de clubes — cada conta é um time; PvP entre clubes.
 */

import { api, getToken } from "../../net/api.js";

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function loadOnlineData() {
  if (!getToken()) {
    return { offline: true, needAuth: true, players: [], challenges: [], feed: [] };
  }
  try {
    const [playersRes, chRes, feedRes] = await Promise.all([
      api.players(),
      api.challenges(),
      api.feed()
    ]);
    if (playersRes.error === "Não autenticado.") {
      return { offline: true, needAuth: true, players: [], challenges: [], feed: [] };
    }
    return {
      offline: false,
      error: playersRes.error,
      players: playersRes.players || [],
      challenges: chRes.challenges || [],
      feed: feedRes.feed || []
    };
  } catch {
    return {
      offline: true,
      needAuth: false,
      error: "A Arena está temporariamente indisponível. Tente novamente em instantes.",
      players: [],
      challenges: [],
      feed: []
    };
  }
}

export function viewOnline(game, s, data) {
  data = data || window.__UL_ONLINE_CACHE || {
    offline: true,
    needAuth: true,
    players: [],
    challenges: [],
    feed: []
  };

  if (data.needAuth || (!getToken() && data.offline)) {
    return `
      <h1 class="view-title">Arena de clubes</h1>
      <p class="view-sub">Cada dirigente online comanda o próprio clube. Entre e dispute clube vs clube.</p>
      <div class="panel">
        <h3>Entre com a conta do seu clube</h3>
        <p style="color:var(--muted);font-size:0.9rem;margin-bottom:0.75rem">
          Na tela inicial, faça login ou cadastre-se, funde o clube e prepare o elenco para desafiar rivais.
        </p>
      </div>`;
  }

  if (data.error && !data.players.length) {
    return `
      <h1 class="view-title">Arena de clubes</h1>
      <div class="panel"><div class="msg bad">${esc(data.error)}</div>
      <button class="btn btn-secondary btn-sm" id="btn-refresh-online" style="margin-top:0.75rem;width:auto">Tentar de novo</button>
      </div>`;
  }

  const myChallenges = (data.challenges || [])
    .map((c) => {
      if (c.incoming) {
        return `
          <div class="action-card">
            <div>
              <h4>${esc(c.fromName)} quer jogar contra você</h4>
              <p>Clube vs clube · confronto valendo pelo ranking</p>
            </div>
            <div class="btn-row" style="flex:0;min-width:160px">
              <button class="btn btn-primary btn-sm" data-respond="${c.id}" data-accept="1">Aceitar jogo</button>
              <button class="btn btn-ghost btn-sm" data-respond="${c.id}" data-accept="0">Recusar</button>
            </div>
          </div>`;
      }
      return `
        <div class="action-card">
          <div>
            <h4>Convite enviado a ${esc(c.toName)}</h4>
            <p>Aguardando o outro clube aceitar...</p>
          </div>
          <span class="badge warn">pendente</span>
        </div>`;
    })
    .join("");

  const players = (data.players || [])
    .map((p) => {
      const online = p.online
        ? `<span class="badge ok">online</span>`
        : `<span class="badge muted">off</span>`;
      const save = p.hasSave ? "" : `<span class="badge warn">clube em formação</span>`;
      return `
        <tr>
          <td>
            <strong>${esc(p.clubName)}</strong>
            <br><span style="color:var(--dim);font-size:0.75rem">técnico: ${esc(p.displayName)}</span>
          </td>
          <td class="num">★ ${p.rep || 0}</td>
          <td class="num">${p.wins || 0}V ${p.draws || 0}E ${p.losses || 0}D</td>
          <td>${online} ${save}</td>
          <td>
            <button class="btn btn-secondary btn-sm" data-challenge="${p.id}" ${p.hasSave ? "" : "disabled"}>Desafiar clube</button>
          </td>
        </tr>`;
    })
    .join("");

  const feed =
    (data.feed || [])
      .map(
        (f) =>
          `<div class="feed-item"><time>${new Date(f.playedAt || Date.now()).toLocaleString("pt-BR")}</time>${esc(f.text)}</div>`
      )
      .join("") || `<div class="empty">Nenhum clássico entre clubes ainda.</div>`;

  const myClub = s?.club?.name || "Seu clube";

  return `
    <h1 class="view-title">Arena de clubes</h1>
    <p class="view-sub"><strong>${esc(myClub)}</strong> na arena · desafie outros clubes</p>
    <div class="btn-row" style="margin-bottom:0.9rem">
      <button class="btn btn-primary btn-sm" id="btn-sync-cloud" style="width:auto">☁ Publicar elenco</button>
      <button class="btn btn-secondary btn-sm" id="btn-refresh-online" style="width:auto">Atualizar</button>
    </div>
    <div class="grid-2">
      <div class="panel">
        <h3>Convites de jogo</h3>
        <div class="action-list">${myChallenges || `<div class="empty">Nenhum convite agora.</div>`}</div>
      </div>
      <div class="panel">
        <h3>Últimos confrontos</h3>
        ${feed}
      </div>
    </div>
    <div class="panel table-wrap">
      <h3>Clubes cadastrados</h3>
      <table class="data">
        <thead><tr><th>Clube / técnico</th><th>Rep</th><th>Cartola PvP</th><th></th><th></th></tr></thead>
        <tbody>${players || `<tr><td colspan="5" class="empty">Ainda só o seu time — chame um amigo para fundar o rival.</td></tr>`}</tbody>
      </table>
    </div>
    <div class="panel">
      <h3>Rivalidade na arena</h3>
      <p style="color:var(--muted);font-size:0.88rem;line-height:1.55">
        Prepare o elenco, desafie outro clube e aguarde o aceite.
        O placar sai na hora — clube contra clube, com o time que cada um montou.
      </p>
    </div>`;
}
