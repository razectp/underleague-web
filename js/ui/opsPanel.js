/**
 * Painel de operações — UI só após login isAdmin.
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

function askConfirm(title, bodyText) {
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
        <label style="display:block;margin-top:0.75rem">Digite <strong>RESETAR</strong> para confirmar
          <input type="text" id="ops-confirm-input" autocomplete="off" style="width:100%;margin-top:0.35rem" />
        </label>`,
      confirmText: "Confirmar",
      danger: true,
      onConfirm: () => {
        const value = document.getElementById("ops-confirm-input")?.value?.trim() || "";
        finish(value);
      },
      onCancel: () => finish(null)
    });
  });
}

function renderTable(users) {
  if (!users?.length) return `<p class="empty">Nenhuma conta.</p>`;
  const rows = users
    .map((u) => {
      const day = u.hasSave ? `D${u.day ?? "?"} · T${u.season ?? "?"}` : "sem save";
      const badge = u.isOps ? `<span class="badge ok">ops</span>` : "";
      const actions = u.isOps
        ? `<span class="micro-help">protegida</span>`
        : `<div class="btn-row" style="gap:0.35rem;flex-wrap:wrap">
            <button type="button" class="btn btn-secondary btn-sm" data-ops-wipe="save" data-user-id="${esc(u.id)}" data-user-email="${esc(u.email)}">Limpar save</button>
            <button type="button" class="btn btn-danger btn-sm" data-ops-wipe="account" data-user-id="${esc(u.id)}" data-user-email="${esc(u.email)}">Apagar conta</button>
          </div>`;
      return `<tr>
        <td>
          <strong>${esc(u.displayName)}</strong> ${badge}<br>
          <small>${esc(u.email)}</small>
        </td>
        <td>${esc(u.clubName || "—")}<br><small>${esc(day)}</small></td>
        <td class="num">★${u.rep}<br><small>nv ${u.level}</small></td>
        <td class="num">${u.wins}V ${u.draws}E ${u.losses}D<br><small>Arena ${u.arenaPoints}</small></td>
        <td>${actions}</td>
      </tr>`;
    })
    .join("");
  return `<div class="table-wrap"><table class="data-table ops-table">
    <thead><tr><th>Conta</th><th>Clube</th><th>Rep</th><th>Placar</th><th></th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
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
  root.innerHTML = `
    <div class="ops-grid">
      <div class="boot-card portal-card">
        <h2>Resumo</h2>
        <dl class="kv">
          <dt>Contas</dt><dd><strong>${o.users ?? 0}</strong></dd>
          <dt>Com campanha</dt><dd>${o.withSave ?? 0}</dd>
          <dt>Sessões</dt><dd>${o.sessions ?? 0}</dd>
          <dt>Desafios</dt><dd>${o.challenges ?? 0}</dd>
          <dt>Feed PvP</dt><dd>${o.matchFeed ?? 0}</dd>
        </dl>
        <p class="micro-help" style="margin-top:0.75rem">Operações irreversíveis. Backup diário na VPS. Confirme com a palavra <strong>RESETAR</strong>.</p>
        <div class="btn-row" style="margin-top:0.85rem;flex-wrap:wrap;gap:0.5rem">
          <button type="button" class="btn btn-danger" id="ops-reset-progress">Reset progresso (mantém cadastros)</button>
          <button type="button" class="btn btn-secondary" id="ops-clear-arena">Limpar Arena / feed</button>
          <button type="button" class="btn btn-secondary" id="ops-purge-sessions">Encerrar sessões</button>
          <button type="button" class="btn btn-ghost" id="ops-refresh">Atualizar</button>
        </div>
      </div>
      <div class="boot-card portal-card">
        <h2>Contas</h2>
        ${renderTable(data.users)}
      </div>
    </div>`;

  $("#ops-refresh")?.addEventListener("click", () => renderOpsPanel());

  $("#ops-reset-progress")?.addEventListener("click", async () => {
    const confirm = await askConfirm(
      "Resetar progresso",
      "Zera saves, dias, scores e arena de <strong>todos</strong>. Mantém e-mails e senhas."
    );
    if (confirm == null) return;
    const r = await api.opsResetProgress(confirm);
    if (!r.ok) {
      toast(r.error || "Falha no reset.", "bad");
      return;
    }
    toast(`Progresso zerado · ${r.users} contas · ${r.wipedSaves} saves limpos.`, "info");
    await renderOpsPanel();
  });

  $("#ops-clear-arena")?.addEventListener("click", async () => {
    const confirm = await askConfirm(
      "Limpar Arena",
      "Zera placar online, desafios e feed. Campanhas (liga/circuito) permanecem."
    );
    if (confirm == null) return;
    const r = await api.opsClearArena(confirm);
    if (!r.ok) {
      toast(r.error || "Falha.", "bad");
      return;
    }
    toast("Arena e feed limpos.", "info");
    await renderOpsPanel();
  });

  $("#ops-purge-sessions")?.addEventListener("click", async () => {
    const confirm = await askConfirm(
      "Encerrar sessões",
      "Desloga todos os jogadores. Sua sessão de operador é mantida."
    );
    if (confirm == null) return;
    const r = await api.opsPurgeSessions(confirm, true);
    if (!r.ok) {
      toast(r.error || "Falha.", "bad");
      return;
    }
    toast(`${r.removed} sessão(ões) encerrada(s).`, "info");
    await renderOpsPanel();
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
      if (!r.ok) {
        toast(r.error || "Falha.", "bad");
        return;
      }
      toast(mode === "account" ? `Conta ${r.email} apagada.` : `Save de ${r.email} limpo.`, "info");
      await renderOpsPanel();
    });
  });
}
