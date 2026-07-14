/**
 * Portal inicial: status, rankings, notícias, login.
 */

import { formatMoney } from "../core/utils.js";
import { $ } from "./dom.js";
import { api, getToken } from "../net/api.js";

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function refreshLobby(game) {
  const clubsEl = $("#lobby-clubs");
  const scorersEl = $("#lobby-scorers");
  const feedEl = $("#lobby-feed");
  const newsEl = $("#lobby-news");
  const statusEl = $("#lobby-status");
  const enterRow = $("#lobby-enter-row");
  const demoButton = $("#btn-demo");
  const demoBox = $("#demo-box");

  // status da campanha carregada do servidor
  if (statusEl) {
    if (game?.state) {
      const s = game.state;
      const table = game.leagueTable?.() || [];
      const pos = table.find((r) => r.you)?.rank || "—";
      const top = game.playerRankings?.({ scope: "mine", sortBy: "goals", minGames: 0 })?.[0];
      statusEl.innerHTML = `
        <dl class="kv">
          <dt>Clube</dt><dd><strong>${esc(s.club.name)}</strong></dd>
          <dt>Técnico</dt><dd>${esc(s.boss.name)}</dd>
          <dt>Energia</dt><dd>${Math.floor(s.boss.energy)}/${s.boss.maxEnergy}</dd>
          <dt>Prestígio</dt><dd>★ ${s.boss.rep}</dd>
          <dt>Caixa pessoal</dt><dd>R$ ${formatMoney(s.boss.money)}</dd>
          <dt>Caixa do clube</dt><dd>R$ ${formatMoney(s.club.bank)}</dd>
          <dt>Liga (posição)</dt><dd>#${pos} · ${s.club.points || 0} pts</dd>
          <dt>Campanha</dt><dd>${s.club.wins || 0}V ${s.club.draws || 0}E ${s.club.losses || 0}D</dd>
          <dt>Dia</dt><dd>D${s.day} · T${s.season}</dd>
          <dt>Artilheiro</dt><dd>${top ? `${esc(top.name)} (${top.goals}G)` : "—"}</dd>
        </dl>`;
      if (enterRow) enterRow.style.display = "flex";
    } else {
      statusEl.innerHTML = `<p class="empty">Faça login para continuar ou funde um novo clube.</p>`;
      if (enterRow) enterRow.style.display = "none";
    }
  }

  // rankings públicos
  try {
    const data = await api.lobby();
    if (!data.ok) throw new Error(data.error || "lobby fail");
    demoButton?.classList.toggle("hidden", !data.demo);
    demoBox?.classList.toggle("hidden", !data.demo);

    if (clubsEl) {
      const rows = (data.clubs || [])
        .slice(0, 8)
        .map(
          (c, i) => `
          <div class="lobby-row">
            <span class="num">#${i + 1}</span>
            <span class="lobby-row-main">
              <strong>${esc(c.clubName)}</strong>
              <small>${esc(c.displayName || "")} · ★${c.rep || 0}</small>
            </span>
            <span class="num">${c.pts ?? 0} pts<br><small>G/J ${(c.gpg ?? 0).toFixed?.(2) ?? c.gpg ?? "—"}</small></span>
          </div>`
        )
        .join("");
      clubsEl.innerHTML = rows || `<p class="empty">Nenhum clube no ranking ainda.</p>`;
    }

    if (scorersEl) {
      const rows = (data.scorers || [])
        .slice(0, 8)
        .map(
          (p, i) => `
          <div class="lobby-row">
            <span class="num">#${i + 1}</span>
            <span class="lobby-row-main">
              <strong>${esc(p.name)}</strong>
              <small>${esc(p.clubName)} · ${esc(p.pos || "")}</small>
            </span>
            <span class="num"><strong>${p.goals || 0}</strong> G<br><small>${p.gpg != null ? Number(p.gpg).toFixed(2) : "—"} G/J</small></span>
          </div>`
        )
        .join("");
      scorersEl.innerHTML = rows || `<p class="empty">Sem artilheiros ainda.</p>`;
    }

    if (feedEl) {
      const items = (data.feed || [])
        .map((f) => `<div class="feed-item"><time>PvP</time>${esc(f.text)}</div>`)
        .join("");
      feedEl.innerHTML = items || `<p class="empty">Sem confrontos PvP ainda.</p>`;
    }

    if (newsEl && data.demo) {
      // mantém notícias base; prepend demo tip se vazio de server news
    }

    return data;
  } catch {
    demoButton?.classList.add("hidden");
    demoBox?.classList.add("hidden");
    if (clubsEl) clubsEl.innerHTML = `<p class="empty">O ranking está temporariamente indisponível.</p>`;
    if (scorersEl) scorersEl.innerHTML = `<p class="empty">—</p>`;
    if (feedEl) feedEl.innerHTML = `<p class="empty">O feed está temporariamente indisponível.</p>`;
    return null;
  }
}

export function fillDemoCredentials() {
  const email = $("#input-email");
  const pass = $("#input-password");
  if (email) email.value = "teste";
  if (pass) pass.value = "senha123";
}
