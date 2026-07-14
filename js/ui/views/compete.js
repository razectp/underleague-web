/**
 * Competir — uma tela, três abas: Liga | Circuito | Arena.
 * Agrupa modos que antes competiam no menu.
 */

import { getCompeteTab } from "../guidance.js";
import { viewMatch } from "./football.js";
import { viewLeague } from "./world.js";
import { viewCircuit } from "./circuit.js";
import { viewOnline } from "./online.js";

function stripChrome(html) {
  return String(html || "")
    .replace(/<h1 class="view-title">[\s\S]*?<\/h1>/i, "")
    .replace(/<p class="view-sub">[\s\S]*?<\/p>/i, "");
}

export function viewCompete(game, s) {
  const tab = getCompeteTab();
  const tabs = [
    { id: "liga", label: "Liga local", hint: "Rodada oficial" },
    { id: "circuito", label: "Circuito", hint: "Treino PvE" },
    { id: "arena", label: "Arena PvP", hint: "Outros clubes" }
  ];

  const tabBar = tabs
    .map(
      (t) => `
      <button type="button" id="compete-tab-${t.id}" class="compete-tab ${tab === t.id ? "active" : ""}"
        role="tab" aria-selected="${tab === t.id}" aria-controls="compete-panel"
        tabindex="${tab === t.id ? "0" : "-1"}" data-compete-tab="${t.id}">
        <strong>${t.label}</strong>
        <small>${t.hint}</small>
      </button>`
    )
    .join("");

  let body = "";
  if (tab === "circuito") {
    body = stripChrome(viewCircuit(game, s));
  } else if (tab === "arena") {
    body = stripChrome(
      viewOnline(game, s, (typeof window !== "undefined" && window.__UL_ONLINE_CACHE) || null)
    );
  } else {
    // Liga: confronto + calendário + classificação compacta
    body = stripChrome(viewMatch(game, s)) + stripChrome(viewLeague(game, s));
  }

  return `
    <h1 class="view-title">Competir</h1>
    <p class="view-sub">
      Liga local, circuito de treino e arena contra outros clubes — escolha o confronto.
    </p>
    <div class="compete-tabs" role="tablist" aria-label="Modos de competição">${tabBar}</div>
    <div class="compete-body" id="compete-panel" role="tabpanel" aria-labelledby="compete-tab-${tab}">${body}</div>`;
}
