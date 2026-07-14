/**
 * Tela de rankings — clubes e jogadores.
 * Tabs + ordenação por desempenho, G/J, gols, nota, etc.
 */

function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formHtml(form) {
  if (!form) return "—";
  return String(form)
    .split("")
    .map((c) => {
      if (c === "V") return `<span class="form-dot win">V</span>`;
      if (c === "E") return `<span class="form-dot draw">E</span>`;
      if (c === "D") return `<span class="form-dot loss">D</span>`;
      return "";
    })
    .join("");
}

function tabBtn(id, label, active) {
  return `<button type="button" class="tab ${active ? "active" : ""}" data-rank-tab="${id}">${label}</button>`;
}

function sortBtn(id, label, active) {
  return `<button type="button" class="tab ${active ? "active" : ""}" data-rank-sort="${id}">${label}</button>`;
}

export function viewRankings(game, _s, uiState) {
  const fallback = {
    tab: "clubs",
    clubSort: "pts",
    playerSort: "goals",
    scope: "league",
    minGames: 1
  };
  const st =
    uiState ||
    (typeof window !== "undefined" && window.__UL_RANK_UI) ||
    fallback;

  if (typeof window !== "undefined") window.__UL_RANK_UI = st;

  if (st.tab === "players") {
    return renderPlayers(game, st);
  }
  if (st.tab === "online") {
    return renderOnlineShell(st);
  }
  return renderClubs(game, st);
}

function header(st) {
  return `
    <h1 class="view-title">Rankings</h1>
    <p class="view-sub">Clubes e jogadores · gols, média por jogo, notas e campanhas</p>
    <div class="tabs">
      ${tabBtn("clubs", "Clubes", st.tab === "clubs")}
      ${tabBtn("players", "Jogadores", st.tab === "players")}
      ${tabBtn("online", "Outros clubes", st.tab === "online")}
    </div>`;
}

function renderClubs(game, st) {
  const rows = game.clubRankings(st.clubSort);
  const body = rows
    .map((r) => {
      const hl = r.you ? ' style="background:rgba(62,207,106,0.08)"' : "";
      return `<tr${hl}>
        <td class="num"><strong>${r.rank}</strong></td>
        <td>${r.you ? "<strong>" + esc(r.name) + " (você)</strong>" : esc(r.name)}
          <br><span style="color:var(--dim);font-size:0.72rem">${esc(r.typeLabel || "")} · forma ${formHtml(r.form) || "—"}</span>
        </td>
        <td class="num">${r.g}</td>
        <td class="num">${r.pts}</td>
        <td class="num">${r.w}/${r.d}/${r.l}</td>
        <td class="num">${r.gf}:${r.ga}</td>
        <td class="num">${r.gd > 0 ? "+" : ""}${r.gd}</td>
        <td class="num">${r.ppg.toFixed(2)}</td>
        <td class="num">${r.gpg.toFixed(2)}</td>
        <td class="num">${r.cleanSheets}</td>
        <td class="num"><strong>${r.perf}</strong></td>
      </tr>`;
    })
    .join("");

  return `
    ${header(st)}
    <div class="tabs" style="margin-top:0.25rem">
      ${sortBtn("pts", "Pontos", st.clubSort === "pts")}
      ${sortBtn("perf", "Desempenho", st.clubSort === "perf")}
      ${sortBtn("ppg", "Pts/J", st.clubSort === "ppg")}
      ${sortBtn("gpg", "Gols/J", st.clubSort === "gpg")}
      ${sortBtn("gf", "Gols", st.clubSort === "gf")}
      ${sortBtn("gd", "Saldo", st.clubSort === "gd")}
      ${sortBtn("cs", "Clean sheets", st.clubSort === "cs")}
    </div>
    <div class="panel table-wrap">
      <table class="data">
        <thead>
          <tr>
            <th>#</th><th>Clube</th><th>J</th><th>Pts</th><th>V/E/D</th>
            <th>Gols</th><th>SG</th><th>Pts/J</th><th>G/J</th><th>CS</th><th>Perf</th>
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
    <div class="panel">
      <h3>Métricas</h3>
      <p style="color:var(--muted);font-size:0.88rem;line-height:1.5">
        <strong>Perf</strong> = índice de desempenho (pontos/jogo, vitórias, ataque, saldo, clean sheets).<br>
        <strong>G/J</strong> = gols marcados por partida · <strong>Pts/J</strong> = pontos por partida · <strong>CS</strong> = jogos sem sofrer gols.
      </p>
    </div>`;
}

function renderPlayers(game, st) {
  const minG = st.minGames ?? 1;
  const rows = game.playerRankings({
    scope: st.scope || "league",
    sortBy: st.playerSort || "goals",
    seasonOnly: true,
    minGames: ["gpg", "rating", "perf", "apg"].includes(st.playerSort) ? Math.max(1, minG) : 0
  });

  const body = rows
    .slice(0, 40)
    .map((r) => {
      const hl = r.you ? ' style="background:rgba(62,207,106,0.08)"' : "";
      return `<tr${hl}>
        <td class="num"><strong>${r.rank}</strong></td>
        <td>
          <button class="linkish" data-player="${esc(r.id)}"><strong>${esc(r.name)}</strong></button>
          <br><span style="color:var(--dim);font-size:0.72rem"><span class="pos">${esc(r.pos)}</span> · ${esc(r.clubName)}${r.you ? " ★" : ""}</span>
        </td>
        <td class="num">${r.games}</td>
        <td class="num"><strong>${r.goals}</strong></td>
        <td class="num">${r.assists}</td>
        <td class="num">${r.gpg.toFixed(2)}</td>
        <td class="num">${r.apg.toFixed(2)}</td>
        <td class="num">${r.rating ? r.rating.toFixed(2) : "—"}</td>
        <td class="num">${r.motm}</td>
        <td class="num"><strong>${r.perf}</strong></td>
      </tr>`;
    })
    .join("");

  return `
    ${header(st)}
    <div class="tabs" style="margin-top:0.25rem">
      ${sortBtn("goals", "Gols", st.playerSort === "goals")}
      ${sortBtn("gpg", "Gols/J", st.playerSort === "gpg")}
      ${sortBtn("assists", "Assist.", st.playerSort === "assists")}
      ${sortBtn("rating", "Nota", st.playerSort === "rating")}
      ${sortBtn("perf", "Desempenho", st.playerSort === "perf")}
      ${sortBtn("apps", "Jogos", st.playerSort === "apps")}
      ${sortBtn("motm", "Craque", st.playerSort === "motm")}
    </div>
    <div class="tabs" style="margin-top:0.15rem">
      <button type="button" class="tab ${st.scope === "league" ? "active" : ""}" data-rank-scope="league">Liga inteira</button>
      <button type="button" class="tab ${st.scope === "mine" ? "active" : ""}" data-rank-scope="mine">Só meu elenco</button>
    </div>
    <div class="panel table-wrap">
      <table class="data">
        <thead>
          <tr>
            <th>#</th><th>Jogador</th><th>J</th><th>G</th><th>A</th>
            <th>G/J</th><th>A/J</th><th>Nota</th><th>MOTM</th><th>Perf</th>
          </tr>
        </thead>
        <tbody>${body || `<tr><td colspan="10" class="empty">Sem dados ainda — dispute partidas para gerar estatísticas.</td></tr>`}</tbody>
      </table>
    </div>
    <div class="panel">
      <h3>Métricas de jogador</h3>
      <p style="color:var(--muted);font-size:0.88rem;line-height:1.5">
        <strong>G/J</strong> gols por jogo · <strong>A/J</strong> assistências por jogo ·
        <strong>Nota</strong> média das partidas (4–10) · <strong>MOTM</strong> craques da partida ·
        <strong>Perf</strong> índice de desempenho individual (gols, assistências, nota e regularidade).
      </p>
    </div>`;
}

function renderOnlineShell(st) {
  const cache = typeof window !== "undefined" ? window.__UL_ONLINE_RANKINGS : null;
  if (!cache) {
    return `
      ${header(st)}
      <div class="panel">
        <div class="empty">Carregando rankings…</div>
        <button class="btn btn-secondary btn-sm" id="btn-load-online-rank" style="margin-top:0.75rem;width:auto">Carregar</button>
      </div>`;
  }
  if (cache.error) {
    return `
      ${header(st)}
      <div class="panel">
        <div class="msg bad">${esc(cache.error)}</div>
        <button class="btn btn-secondary btn-sm" id="btn-load-online-rank" style="margin-top:0.75rem;width:auto">Tentar de novo</button>
      </div>`;
  }

  const clubs = (cache.clubs || [])
    .map(
      (r, i) => `<tr>
        <td class="num">${i + 1}</td>
        <td><strong>${esc(r.clubName)}</strong><br><span style="color:var(--dim);font-size:0.72rem">${esc(r.displayName || "")} · Liga ${r.wins || 0}V/${r.draws || 0}E/${r.losses || 0}D</span></td>
        <td class="num">★ ${r.rep || 0}</td>
        <td class="num">${r.pts ?? "—"}</td>
        <td class="num">${r.gpg != null ? Number(r.gpg).toFixed(2) : "—"}</td>
        <td class="num">${r.perf ?? "—"}</td>
        <td class="num">${r.avgOvr ?? "—"}</td>
      </tr>`
    )
    .join("");

  const arena = (cache.arena || [])
    .map(
      (r, i) => `<tr>
        <td class="num">${i + 1}</td>
        <td><strong>${esc(r.clubName)}</strong><br><span style="color:var(--dim);font-size:0.72rem">${esc(r.displayName || "")}</span></td>
        <td class="num"><strong>${r.points || 0}</strong></td>
        <td class="num">${r.wins || 0}V ${r.draws || 0}E ${r.losses || 0}D</td>
      </tr>`
    )
    .join("");

  const scorers = (cache.scorers || [])
    .map(
      (r, i) => `<tr>
        <td class="num">${i + 1}</td>
        <td><strong>${esc(r.name)}</strong><br><span style="color:var(--dim);font-size:0.72rem">${esc(r.pos || "")} · ${esc(r.clubName)}</span></td>
        <td class="num"><strong>${r.goals || 0}</strong></td>
        <td class="num">${r.assists || 0}</td>
        <td class="num">${r.games || 0}</td>
        <td class="num">${r.gpg != null ? Number(r.gpg).toFixed(2) : "—"}</td>
        <td class="num">${r.rating != null ? Number(r.rating).toFixed(2) : "—"}</td>
      </tr>`
    )
    .join("");

  return `
    ${header(st)}
    <div class="btn-row" style="margin-bottom:0.75rem">
      <button class="btn btn-secondary btn-sm" id="btn-load-online-rank" style="width:auto">Atualizar ranking</button>
    </div>
    <div class="panel table-wrap">
      <h3>Ranking Arena</h3>
      <p style="color:var(--muted);font-size:0.82rem">Somente partidas ranqueadas entre dirigentes reais. Amistosos contra rivais da liga não pontuam.</p>
      <table class="data">
        <thead><tr><th>#</th><th>Clube</th><th>Pontos</th><th>Histórico ranqueado</th></tr></thead>
        <tbody>${arena || `<tr><td colspan="4" class="empty">Nenhuma partida ranqueada ainda.</td></tr>`}</tbody>
      </table>
    </div>
    <div class="grid-2">
      <div class="panel table-wrap">
        <h3>Clubes da comunidade</h3>
        <table class="data">
          <thead><tr><th>#</th><th>Clube</th><th>Rep</th><th>Pts liga</th><th>G/J</th><th>Perf</th><th>OVR</th></tr></thead>
          <tbody>${clubs || `<tr><td colspan="7" class="empty">Nenhum clube no ranking ainda.</td></tr>`}</tbody>
        </table>
      </div>
      <div class="panel table-wrap">
        <h3>Artilheiros da comunidade</h3>
        <table class="data">
          <thead><tr><th>#</th><th>Jogador</th><th>G</th><th>A</th><th>J</th><th>G/J</th><th>Nota</th></tr></thead>
          <tbody>${scorers || `<tr><td colspan="7" class="empty">A artilharia ainda não começou.</td></tr>`}</tbody>
        </table>
      </div>
    </div>`;
}
