/** Topbar + trilho lateral (situação / feed) */

import { formatMoney } from "../core/utils.js";
import { $ } from "./dom.js";
import { timeStr } from "./format.js";
import { GLOSSARY } from "./guidance.js";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function refreshChrome(game) {
  const s = game.state;
  if (!s) return;

  // Identidade principal = o TIME; secundário = o técnico
  $("#top-name").textContent = s.club.name;
  $("#top-club").textContent = `${s.boss.name} · ${s.club.typeLabel || "clube"}`;
  $("#top-money").textContent = formatMoney(s.boss.money);
  $("#top-energy").textContent = Math.floor(s.boss.energy);
  $("#top-energy").parentElement.querySelector(".pill-max").textContent = `/${s.boss.maxEnergy}`;
  $("#top-rep").textContent = s.boss.rep;
  $("#top-day").textContent = timeStr(s);
  $("#top-health").textContent = `${Math.floor(s.boss.health)}%`;

  const pillMoney = $("#top-money")?.closest(".pill");
  const pillEnergy = $("#top-energy")?.closest(".pill");
  const pillRep = $("#top-rep")?.closest(".pill");
  const pillDay = $("#top-day")?.closest(".pill");
  const pillHealth = $("#top-health")?.closest(".pill");
  if (pillMoney) pillMoney.title = GLOSSARY.money;
  if (pillEnergy) pillEnergy.title = GLOSSARY.energy;
  if (pillRep) pillRep.title = GLOSSARY.rep;
  if (pillDay) pillDay.title = GLOSSARY.day;
  if (pillHealth) pillHealth.title = GLOSSARY.health;

  if (s.boss.injury) $("#top-health").classList.add("injured-flash");
  else $("#top-health").classList.remove("injured-flash");

  const injured = s.squad.filter((p) => p.injury).length;
  const avg =
    s.squad.length > 0
      ? Math.round(s.squad.reduce((a, p) => a + p.overall, 0) / s.squad.length)
      : 0;

  let missionReady = 0;
  try {
    missionReady = game
      .missionsSummary()
      .items.filter((m) => !m.claimed && m.progress >= m.target).length;
  } catch {
    /* ignore */
  }

  $("#rail-status").innerHTML = `
    <dl class="kv">
      <dt title="Nível do dirigente">Nível</dt><dd>${s.boss.level}</dd>
      <dt>XP</dt><dd>${s.boss.xp}/${s.boss.level * 100}</dd>
      <dt title="${GLOSSARY.clubBank}">Caixa clube</dt><dd>R$ ${formatMoney(s.club.bank)}</dd>
      <dt title="${GLOSSARY.money}">Seu bolso</dt><dd>R$ ${formatMoney(s.boss.money)}</dd>
      <dt title="${GLOSSARY.ovr}">Elenco OVR</dt><dd>${avg}</dd>
      <dt>Lesionados</dt><dd>${injured}</dd>
      <dt>Missões</dt><dd>${missionReady ? `<span class="badge ok">${missionReady} pronta(s)</span>` : `<span class="badge muted">—</span>`}</dd>
      <dt>Status</dt><dd>${s.boss.injury ? `<span class="badge bad">Indisposto</span>` : `<span class="badge ok">Apto</span>`}</dd>
    </dl>
    <p class="micro-help" style="margin-top:0.55rem">Passe o mouse nos números do topo para ver o que cada um significa.</p>`;

  $("#rail-feed").innerHTML =
    (s.feed || [])
      .slice(0, 12)
      .map(
        (f) =>
          `<div class="feed-item"><time>D${f.day} ${String(f.hour).padStart(2, "0")}h</time>${escapeHtml(f.text)}</div>`
      )
      .join("") || `<div class="empty">Sem eventos ainda.</div>`;
}
