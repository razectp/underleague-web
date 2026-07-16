/**
 * Painel de operações completo — UI só após login isAdmin.
 * Sem rota /admin e sem hash navegável.
 */

import { api } from "../net/api.js";
import { $, toast, modal } from "./dom.js";

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtWhen(ts) {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString("pt-BR", { hour12: false });
  } catch {
    return "—";
  }
}

function fmtUptime(ms) {
  const s = Math.floor((ms || 0) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return `${h}h ${m}m`;
}

function askConfirm(title, bodyText, word = "RESETAR") {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    modal({
      title,
      body: `<p>${bodyText}</p>
        <label style="display:block;margin-top:0.75rem">Digite <strong>${esc(word)}</strong> para confirmar
          <input type="text" id="ops-confirm-input" autocomplete="off" style="width:100%;margin-top:0.35rem" />
        </label>`,
      confirmText: "Confirmar",
      danger: word === "RESETAR",
      onConfirm: () => {
        const value = document.getElementById("ops-confirm-input")?.value?.trim() || "";
        finish(value);
      },
      onCancel: () => finish(null)
    });
  });
}

function askFields(title, fieldsHtml, word = "CONFIRMAR") {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    modal({
      title,
      body: `${fieldsHtml}
        <label style="display:block;margin-top:0.75rem">Digite <strong>${esc(word)}</strong>
          <input type="text" id="ops-confirm-input" autocomplete="off" style="width:100%;margin-top:0.35rem" />
        </label>`,
      confirmText: "Aplicar",
      danger: word === "RESETAR",
      onConfirm: () => {
        const confirm = document.getElementById("ops-confirm-input")?.value?.trim() || "";
        const root = document.getElementById("modal-root");
        const data = { confirm };
        root?.querySelectorAll("[data-ops-field]").forEach((el) => {
          data[el.dataset.opsField] = el.value;
        });
        finish(data);
      },
      onCancel: () => finish(null)
    });
  });
}

function filterUsers(users, q, filter) {
  const needle = String(q || "").trim().toLowerCase();
  return (users || []).filter((u) => {
    if (filter === "save" && !u.hasSave) return false;
    if (filter === "nosave" && u.hasSave) return false;
    if (filter === "banned" && !u.banned) return false;
    if (filter === "online" && !(u.activeSessions > 0)) return false;
    if (!needle) return true;
    return [u.email, u.displayName, u.clubName]
      .map((x) => String(x || "").toLowerCase())
      .some((x) => x.includes(needle));
  });
}

function renderTable(users) {
  if (!users?.length) return `<p class="empty">Nenhuma conta neste filtro.</p>`;
  const rows = users
    .map((u) => {
      const day = u.hasSave ? `D${u.day ?? "?"} · T${u.season ?? "?"}` : "sem save";
      const badges = [
        u.isOps ? `<span class="badge ok">ops</span>` : "",
        u.banned ? `<span class="badge warn">ban</span>` : "",
        u.activeSessions > 0 ? `<span class="badge ok">online</span>` : ""
      ]
        .filter(Boolean)
        .join(" ");
      const actions = u.isOps
        ? `<span class="micro-help">protegida</span>`
        : `<div class="ops-actions">
            <button type="button" class="btn btn-ghost btn-sm" data-ops-inspect="${esc(u.id)}">Detalhes</button>
            <button type="button" class="btn btn-secondary btn-sm" data-ops-heal="${esc(u.id)}" data-email="${esc(u.email)}" ${u.hasSave ? "" : "disabled"}>Curar</button>
            <button type="button" class="btn btn-secondary btn-sm" data-ops-grant="${esc(u.id)}" data-email="${esc(u.email)}" ${u.hasSave ? "" : "disabled"}>Grant</button>
            <button type="button" class="btn btn-secondary btn-sm" data-ops-kick="${esc(u.id)}" data-email="${esc(u.email)}">Kick</button>
            ${
              u.banned
                ? `<button type="button" class="btn btn-secondary btn-sm" data-ops-unban="${esc(u.id)}" data-email="${esc(u.email)}">Desbanir</button>`
                : `<button type="button" class="btn btn-secondary btn-sm" data-ops-ban="${esc(u.id)}" data-email="${esc(u.email)}">Banir</button>`
            }
            <button type="button" class="btn btn-secondary btn-sm" data-ops-pass="${esc(u.id)}" data-email="${esc(u.email)}">Senha</button>
            <button type="button" class="btn btn-secondary btn-sm" data-ops-wipe="save" data-user-id="${esc(u.id)}" data-user-email="${esc(u.email)}">Limpar save</button>
            <button type="button" class="btn btn-danger btn-sm" data-ops-wipe="account" data-user-id="${esc(u.id)}" data-user-email="${esc(u.email)}">Apagar</button>
          </div>`;
      return `<tr class="${u.banned ? "ops-row-banned" : ""}">
        <td>
          <strong>${esc(u.displayName)}</strong> ${badges}<br>
          <small>${esc(u.email)}</small><br>
          <small class="micro-help">visto ${esc(fmtWhen(u.lastSeenAt))}</small>
        </td>
        <td>${esc(u.clubName || "—")}<br><small>${esc(day)}</small>
          ${u.hasSave ? `<br><small>elenco ${u.squadSize || 0} · 🏥${u.injured || 0} · 🟨${u.suspended || 0}</small>` : ""}
        </td>
        <td class="num">★${u.rep}<br><small>nv ${u.level}</small>
          ${u.hasSave ? `<br><small>R$ ${esc(u.bossMoney ?? "—")} / ${esc(u.clubBank ?? "—")}</small>` : ""}
        </td>
        <td class="num">${u.wins}V ${u.draws}E ${u.losses}D<br><small>Arena ${u.arenaPoints} · sess ${u.activeSessions || 0}</small></td>
        <td>${actions}</td>
      </tr>`;
    })
    .join("");
  return `<div class="table-wrap"><table class="data-table ops-table">
    <thead><tr><th>Conta</th><th>Clube / dia</th><th>Rep / grana</th><th>Placar</th><th>Ações</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}

function renderAudit(audit) {
  if (!audit?.length) return `<p class="empty">Sem ações registradas ainda.</p>`;
  return `<ul class="ops-audit-list">${audit
    .map(
      (a) => `<li>
        <time>${esc(fmtWhen(a.at))}</time>
        <strong>${esc(a.action)}</strong>
        <span>por ${esc(a.by)}</span>
        <small>${esc(JSON.stringify(a.detail || {}))}</small>
      </li>`
    )
    .join("")}</ul>`;
}

function renderFeed(feed) {
  if (!feed?.length) return `<p class="empty">Feed vazio.</p>`;
  return `<ul class="ops-audit-list">${feed
    .map((f) => `<li><span>${esc(f.text || `${f.homeName} ${f.hg}x${f.ag} ${f.awayName}`)}</span></li>`)
    .join("")}</ul>`;
}

async function showInspect(userId) {
  const r = await api.opsInspectUser(userId);
  if (!r.ok) {
    toast(r.error || "Falha ao inspecionar.", "bad");
    return;
  }
  const u = r.user;
  const s = r.save;
  const body = s
    ? `<div class="ops-inspect">
        <p><strong>${esc(u.displayName)}</strong> · ${esc(u.email)} · ${esc(u.clubName || "—")}</p>
        <dl class="kv">
          <dt>Dia / temporada</dt><dd>D${esc(s.day)} · T${esc(s.season)} · ${esc(s.hour)}h</dd>
          <dt>Dirigente</dt><dd>${esc(s.boss?.name)} · ★${esc(s.boss?.rep)} nv${esc(s.boss?.level)} · ⚡${esc(s.boss?.energy)}</dd>
          <dt>Caixas</dt><dd>pessoal R$ ${esc(s.boss?.money)} · clube R$ ${esc(s.club?.bank)}</dd>
          <dt>Liga</dt><dd>${esc(s.club?.wins)}V ${esc(s.club?.draws)}E ${esc(s.club?.losses)}D · ${esc(s.club?.points)} pts</dd>
          <dt>Elenco</dt><dd>${esc(s.squadSize)} · média OVR ${esc(s.avgOverall)}</dd>
          <dt>Fixtures</dt><dd>${esc(s.fixturesPlayed)} jogadas · ${esc(s.fixturesLeft)} restantes</dd>
          <dt>Circuito</dt><dd>volta ${esc(s.circuitTour)} · unlocked ${esc(s.circuitUnlocked)}</dd>
          <dt>Lesões</dt><dd>${s.injuries?.length ? esc(s.injuries.map((i) => i.name).join(", ")) : "nenhuma"}</dd>
          <dt>Suspensões</dt><dd>${s.suspensions?.length ? esc(s.suspensions.map((i) => i.name).join(", ")) : "nenhuma"}</dd>
        </dl>
      </div>`
    : `<p>Conta sem campanha salva.</p>`;
  modal({
    title: "Inspeção da conta",
    body,
    confirmText: "Fechar",
    onConfirm: () => {}
  });
}

export async function renderOpsPanel() {
  const root = $("#ops-panel-root");
  if (!root) return;
  root.innerHTML = `<p class="empty">Carregando…</p>`;
  const data = await api.opsOverview();
  if (!data.ok) {
    root.innerHTML = `<p class="empty">${esc(data.error || "Falha ao carregar painel.")}</p>`;
    toast(data.error || "Sem permissão para o painel.", "bad");
    return;
  }

  const o = data.overview || {};
  const srv = o.server || {};
  const q = root.dataset.filterQ || "";
  const filter = root.dataset.filterKind || "all";
  const users = filterUsers(data.users, q, filter);

  root.innerHTML = `
    <div class="ops-grid">
      <div class="boot-card portal-card">
        <h2>Servidor</h2>
        <dl class="kv">
          <dt>Ambiente</dt><dd>${esc(srv.env)} · ${srv.isProd ? "prod" : "dev"}</dd>
          <dt>DB</dt><dd>${esc(srv.dbDriver)} · Node ${esc(srv.node)}</dd>
          <dt>Uptime</dt><dd>${esc(fmtUptime(srv.uptimeMs))}</dd>
          <dt>Ops e-mail</dt><dd>${esc(srv.opsEmail || "—")}</dd>
          <dt>Atualizado</dt><dd>${esc(fmtWhen(o.updatedAt))}</dd>
        </dl>
      </div>

      <div class="boot-card portal-card">
        <h2>Resumo</h2>
        <div class="ops-stat-grid">
          <div class="ops-stat"><strong>${o.users ?? 0}</strong><span>contas</span></div>
          <div class="ops-stat"><strong>${o.withSave ?? 0}</strong><span>com save</span></div>
          <div class="ops-stat"><strong>${o.neverPlayed ?? 0}</strong><span>sem clube</span></div>
          <div class="ops-stat"><strong>${o.banned ?? 0}</strong><span>banidas</span></div>
          <div class="ops-stat"><strong>${o.active7d ?? 0}</strong><span>ativas 7d</span></div>
          <div class="ops-stat"><strong>${o.sessions ?? 0}</strong><span>sessões</span></div>
          <div class="ops-stat"><strong>${o.pendingChallenges ?? 0}</strong><span>desafios pend.</span></div>
          <div class="ops-stat"><strong>${o.matchFeed ?? 0}</strong><span>feed PvP</span></div>
          <div class="ops-stat"><strong>${o.avgDay ?? 0}</strong><span>dia médio</span></div>
          <div class="ops-stat"><strong>${o.maxDay ?? 0}</strong><span>dia máx.</span></div>
        </div>
      </div>

      <div class="boot-card portal-card ops-span-2">
        <h2>Ações globais</h2>
        <p class="micro-help">Destrutivas: confirme com <strong>RESETAR</strong>. Ajustes: <strong>CONFIRMAR</strong>.</p>
        <div class="ops-action-groups">
          <div>
            <h3 class="ops-h3">Progresso / Arena</h3>
            <div class="btn-row ops-btn-wrap">
              <button type="button" class="btn btn-danger" id="ops-reset-progress">Reset progresso (mantém cadastros)</button>
              <button type="button" class="btn btn-secondary" id="ops-clear-arena">Limpar Arena + W/D/L + feed</button>
              <button type="button" class="btn btn-secondary" id="ops-clear-challenges">Limpar só desafios</button>
              <button type="button" class="btn btn-secondary" id="ops-clear-feed">Limpar só feed</button>
            </div>
          </div>
          <div>
            <h3 class="ops-h3">Sessões / limpeza</h3>
            <div class="btn-row ops-btn-wrap">
              <button type="button" class="btn btn-secondary" id="ops-purge-sessions">Encerrar todas as sessões</button>
              <button type="button" class="btn btn-secondary" id="ops-advance-all">Avançar +1 dia (todos com save)</button>
              <button type="button" class="btn btn-danger" id="ops-purge-inactive">Apagar contas sem save (30d+)</button>
            </div>
          </div>
          <div>
            <h3 class="ops-h3">Aviso no portal</h3>
            <div class="btn-row ops-btn-wrap">
              <button type="button" class="btn btn-primary" id="ops-broadcast">Publicar aviso</button>
              <button type="button" class="btn btn-ghost" id="ops-broadcast-clear">Remover aviso</button>
              <button type="button" class="btn btn-ghost" id="ops-refresh">Atualizar painel</button>
            </div>
          </div>
        </div>
      </div>

      <div class="boot-card portal-card ops-span-2">
        <h2>Contas <small class="micro-help">(${users.length} de ${(data.users || []).length})</small></h2>
        <div class="ops-filters btn-row">
          <input type="search" id="ops-search" placeholder="Buscar e-mail, nome, clube…" value="${esc(q)}" />
          <select id="ops-filter">
            <option value="all" ${filter === "all" ? "selected" : ""}>Todas</option>
            <option value="save" ${filter === "save" ? "selected" : ""}>Com save</option>
            <option value="nosave" ${filter === "nosave" ? "selected" : ""}>Sem save</option>
            <option value="banned" ${filter === "banned" ? "selected" : ""}>Banidas</option>
            <option value="online" ${filter === "online" ? "selected" : ""}>Online</option>
          </select>
        </div>
        ${renderTable(users)}
      </div>

      <div class="boot-card portal-card">
        <h2>Auditoria</h2>
        ${renderAudit(data.audit)}
      </div>
      <div class="boot-card portal-card">
        <h2>Feed recente</h2>
        ${renderFeed(data.recentFeed)}
      </div>
    </div>`;

  const refilter = () => {
    root.dataset.filterQ = $("#ops-search")?.value || "";
    root.dataset.filterKind = $("#ops-filter")?.value || "all";
    renderOpsPanel();
  };
  $("#ops-search")?.addEventListener("change", refilter);
  $("#ops-search")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") refilter();
  });
  $("#ops-filter")?.addEventListener("change", refilter);
  $("#ops-refresh")?.addEventListener("click", () => renderOpsPanel());

  $("#ops-reset-progress")?.addEventListener("click", async () => {
    const confirm = await askConfirm(
      "Resetar progresso",
      "Zera saves, dias, scores e arena de <strong>todos</strong>. Mantém e-mails e senhas."
    );
    if (confirm == null) return;
    const r = await api.opsResetProgress(confirm);
    if (!r.ok) return toast(r.error || "Falha no reset.", "bad");
    toast(`Progresso zerado · ${r.users} contas · ${r.wipedSaves} saves.`, "info");
    await renderOpsPanel();
  });

  $("#ops-clear-arena")?.addEventListener("click", async () => {
    const confirm = await askConfirm(
      "Limpar Arena",
      "Zera placar online, desafios e feed. Campanhas permanecem."
    );
    if (confirm == null) return;
    const r = await api.opsClearArena(confirm);
    if (!r.ok) return toast(r.error || "Falha.", "bad");
    toast("Arena e feed limpos.", "info");
    await renderOpsPanel();
  });

  $("#ops-clear-challenges")?.addEventListener("click", async () => {
    const confirm = await askConfirm("Limpar desafios", "Remove todos os desafios (pendentes e histórico).");
    if (confirm == null) return;
    const r = await api.opsClearChallenges(confirm);
    if (!r.ok) return toast(r.error || "Falha.", "bad");
    toast(`${r.removed} desafio(s) removido(s).`, "info");
    await renderOpsPanel();
  });

  $("#ops-clear-feed")?.addEventListener("click", async () => {
    const confirm = await askConfirm("Limpar feed", "Apaga o feed PvP público.");
    if (confirm == null) return;
    const r = await api.opsClearFeed(confirm);
    if (!r.ok) return toast(r.error || "Falha.", "bad");
    toast(`${r.removed} item(ns) do feed removido(s).`, "info");
    await renderOpsPanel();
  });

  $("#ops-purge-sessions")?.addEventListener("click", async () => {
    const confirm = await askConfirm(
      "Encerrar sessões",
      "Desloga todos os jogadores. Sua sessão de operador é mantida."
    );
    if (confirm == null) return;
    const r = await api.opsPurgeSessions(confirm, true);
    if (!r.ok) return toast(r.error || "Falha.", "bad");
    toast(`${r.removed} sessão(ões) encerrada(s).`, "info");
    await renderOpsPanel();
  });

  $("#ops-advance-all")?.addEventListener("click", async () => {
    const dataFields = await askFields(
      "Avançar dias (todos)",
      `<p>Avança o relógio da campanha de todos com save.</p>
       <label>Dias (1–14)<input data-ops-field="days" type="number" min="1" max="14" value="1" style="width:100%;margin-top:0.35rem" /></label>`,
      "CONFIRMAR"
    );
    if (!dataFields) return;
    const r = await api.opsAdvanceDay({
      scope: "all",
      days: Number(dataFields.days) || 1,
      confirm: dataFields.confirm
    });
    if (!r.ok) return toast(r.error || "Falha.", "bad");
    toast(`Avançou ${r.days}d em ${r.updated} campanha(s).`, "info");
    await renderOpsPanel();
  });

  $("#ops-purge-inactive")?.addEventListener("click", async () => {
    const dataFields = await askFields(
      "Apagar contas inativas",
      `<p>Remove contas <strong>sem save</strong> e sem atividade há N dias. Conta ops protegida.</p>
       <label>Dias sem atividade (mín. 7)<input data-ops-field="days" type="number" min="7" max="365" value="30" style="width:100%;margin-top:0.35rem" /></label>`,
      "RESETAR"
    );
    if (!dataFields) return;
    const r = await api.opsPurgeInactive(Number(dataFields.days) || 30, dataFields.confirm);
    if (!r.ok) return toast(r.error || "Falha.", "bad");
    toast(`${r.removed} conta(s) removida(s).`, "info");
    await renderOpsPanel();
  });

  $("#ops-broadcast")?.addEventListener("click", async () => {
    const dataFields = await askFields(
      "Aviso no portal",
      `<p>Mensagem exibida no lobby para todos.</p>
       <label>Mensagem (máx. 280)
         <textarea data-ops-field="message" rows="3" maxlength="280" style="width:100%;margin-top:0.35rem"></textarea>
       </label>`,
      "CONFIRMAR"
    );
    if (!dataFields) return;
    const r = await api.opsBroadcast({
      message: dataFields.message,
      confirm: dataFields.confirm
    });
    if (!r.ok) return toast(r.error || "Falha.", "bad");
    toast("Aviso publicado no portal.", "info");
    await renderOpsPanel();
  });

  $("#ops-broadcast-clear")?.addEventListener("click", async () => {
    const confirm = await askConfirm("Remover aviso", "Remove o aviso do portal.", "CONFIRMAR");
    if (confirm == null) return;
    const r = await api.opsBroadcast({ clear: true, confirm });
    if (!r.ok) return toast(r.error || "Falha.", "bad");
    toast("Aviso removido.", "info");
    await renderOpsPanel();
  });

  root.querySelectorAll("[data-ops-inspect]").forEach((btn) => {
    btn.addEventListener("click", () => showInspect(btn.dataset.opsInspect));
  });

  root.querySelectorAll("[data-ops-heal]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const confirm = await askConfirm(
        "Curar elenco",
        `Remove lesões/suspensões e restaura stamina de <strong>${esc(btn.dataset.email)}</strong>.`,
        "CONFIRMAR"
      );
      if (confirm == null) return;
      const r = await api.opsHeal(btn.dataset.opsHeal, confirm);
      if (!r.ok) return toast(r.error || "Falha.", "bad");
      toast(`Curado: ${r.healedInjuries} lesões · ${r.clearedSuspensions} suspensões.`, "info");
      await renderOpsPanel();
    });
  });

  root.querySelectorAll("[data-ops-grant]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const dataFields = await askFields(
        "Conceder recursos",
        `<p>Conta: <strong>${esc(btn.dataset.email)}</strong>. Valores são deltas (+ ou −).</p>
         <div class="grid-2" style="gap:0.5rem">
           <label>Dinheiro pessoal<input data-ops-field="money" type="number" value="0" style="width:100%" /></label>
           <label>Caixa do clube<input data-ops-field="clubBank" type="number" value="0" style="width:100%" /></label>
           <label>Energia<input data-ops-field="energy" type="number" value="0" style="width:100%" /></label>
           <label>Rep<input data-ops-field="rep" type="number" value="0" style="width:100%" /></label>
         </div>`,
        "CONFIRMAR"
      );
      if (!dataFields) return;
      const r = await api.opsGrant({
        userId: btn.dataset.opsGrant,
        money: Number(dataFields.money) || 0,
        clubBank: Number(dataFields.clubBank) || 0,
        energy: Number(dataFields.energy) || 0,
        rep: Number(dataFields.rep) || 0,
        confirm: dataFields.confirm
      });
      if (!r.ok) return toast(r.error || "Falha.", "bad");
      toast(`Grant ok · grana ${r.bossMoney} · clube ${r.clubBank}.`, "info");
      await renderOpsPanel();
    });
  });

  root.querySelectorAll("[data-ops-kick]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const confirm = await askConfirm(
        "Kick",
        `Encerra sessões de <strong>${esc(btn.dataset.email)}</strong>.`,
        "CONFIRMAR"
      );
      if (confirm == null) return;
      const r = await api.opsKickUser(btn.dataset.opsKick, confirm);
      if (!r.ok) return toast(r.error || "Falha.", "bad");
      toast(`${r.removed} sessão(ões) de ${r.email} encerrada(s).`, "info");
      await renderOpsPanel();
    });
  });

  root.querySelectorAll("[data-ops-ban]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const dataFields = await askFields(
        "Banir conta",
        `<p>Suspende login de <strong>${esc(btn.dataset.email)}</strong>.</p>
         <label>Motivo<input data-ops-field="reason" type="text" maxlength="160" value="Suspenso pela operação." style="width:100%;margin-top:0.35rem" /></label>`,
        "RESETAR"
      );
      if (!dataFields) return;
      const r = await api.opsBanUser(btn.dataset.opsBan, dataFields.reason, dataFields.confirm);
      if (!r.ok) return toast(r.error || "Falha.", "bad");
      toast(`${r.email} banida.`, "warn");
      await renderOpsPanel();
    });
  });

  root.querySelectorAll("[data-ops-unban]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const confirm = await askConfirm(
        "Desbanir",
        `Libera login de <strong>${esc(btn.dataset.email)}</strong>.`,
        "CONFIRMAR"
      );
      if (confirm == null) return;
      const r = await api.opsUnbanUser(btn.dataset.opsUnban, confirm);
      if (!r.ok) return toast(r.error || "Falha.", "bad");
      toast(`${r.email} desbanida.`, "info");
      await renderOpsPanel();
    });
  });

  root.querySelectorAll("[data-ops-pass]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const dataFields = await askFields(
        "Redefinir senha",
        `<p>Nova senha para <strong>${esc(btn.dataset.email)}</strong>. Encerra sessões da conta.</p>
         <label>Nova senha<input data-ops-field="password" type="text" minlength="6" style="width:100%;margin-top:0.35rem" /></label>`,
        "CONFIRMAR"
      );
      if (!dataFields) return;
      const r = await api.opsSetPassword(
        btn.dataset.opsPass,
        dataFields.password,
        dataFields.confirm
      );
      if (!r.ok) return toast(r.error || "Falha.", "bad");
      toast(`Senha de ${r.email} redefinida.`, "info");
      await renderOpsPanel();
    });
  });

  root.querySelectorAll("[data-ops-wipe]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const mode = btn.dataset.opsWipe;
      const userId = btn.dataset.userId;
      const email = btn.dataset.userEmail || userId;
      const confirm = await askConfirm(
        mode === "account" ? "Apagar conta" : "Limpar save",
        mode === "account"
          ? `Remove permanentemente <strong>${esc(email)}</strong> e o progresso.`
          : `Limpa a campanha de <strong>${esc(email)}</strong> (cadastro permanece).`
      );
      if (confirm == null) return;
      const r = await api.opsWipeUser(userId, mode, confirm);
      if (!r.ok) return toast(r.error || "Falha.", "bad");
      toast(mode === "account" ? `Conta ${r.email} apagada.` : `Save de ${r.email} limpo.`, "info");
      await renderOpsPanel();
    });
  });
}
