/**
 * Controlador de UI: boot, navegação e render de views.
 */

import { $, toast } from "./dom.js";
import { refreshChrome } from "./chrome.js";
import { VIEWS } from "./views/index.js";
import { bindViewEvents } from "./bindEvents.js";
import { loadOnlineData } from "./views/online.js";
import { refreshLobby } from "./lobby.js";
import { renderOpsPanel } from "./opsPanel.js";
import {
  COMPETE_VIEW_ALIASES,
  getCompeteTab,
  setCompeteTab
} from "./guidance.js";

const MORE_VIEWS = new Set([
  "market",
  "ops",
  "map",
  "hospital",
  "rankings",
  "status",
  "log",
  "finance",
  "calendar",
  "postmatch"
]);

function resolveView(view) {
  if (COMPETE_VIEW_ALIASES[view]) {
    setCompeteTab(COMPETE_VIEW_ALIASES[view]);
    return "compete";
  }
  return view;
}

function markNavActive(view) {
  document.querySelectorAll(".nav-item[data-view]").forEach((btn) => {
    const active = btn.dataset.view === view;
    btn.classList.toggle("active", active);
    if (active) btn.setAttribute("aria-current", "page");
    else btn.removeAttribute("aria-current");
  });

  // Se a tela está em "Mais", abre o grupo para o item ativo aparecer
  if (MORE_VIEWS.has(view)) {
    const moreWrap = document.getElementById("nav-more");
    const moreBtn = document.getElementById("btn-nav-more");
    const items = moreWrap?.querySelector(".nav-more-items");
    if (items && items.hidden) {
      items.hidden = false;
      moreBtn?.setAttribute("aria-expanded", "true");
      moreWrap?.classList.add("open");
      try {
        localStorage.setItem("ul_nav_more", "1");
      } catch {
        /* ignore */
      }
    }
  }
}

function closeMobileNav() {
  const sidebar = document.getElementById("sidebar");
  const toggle = document.getElementById("btn-mobile-nav");
  sidebar?.classList.remove("mobile-open");
  toggle?.setAttribute("aria-expanded", "false");
}

function finishNavigation(main, view, historyMode) {
  const heading = main.querySelector("h1");
  const label = heading?.textContent?.trim() || "Jogo";
  document.title = `${label} — Under League`;
  if (historyMode !== false) {
    const url = `${location.pathname}${location.search}#${view}`;
    const state = { underLeagueView: view };
    if (historyMode === "replace") history.replaceState(state, "", url);
    else if (location.hash !== `#${view}`) history.pushState(state, "", url);
  }
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  if (heading) {
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
  } else {
    main.focus({ preventScroll: true });
  }
}

export function createApp(game) {
  const app = {
    view: "home",

    setView(view, opts = {}) {
      if (opts.competeTab) setCompeteTab(opts.competeTab);
      this.view = resolveView(view);
      markNavActive(this.view);
      closeMobileNav();
      return this.render({ focusMain: opts.focus !== false, historyMode: opts.history });
    },

    async render({ focusMain = false, historyMode } = {}) {
      const s = game.state;
      if (!s) return;
      refreshChrome(game);
      const main = $("#main-content");
      const requested = this.view;

      const needsOnline =
        requested === "online" ||
        (requested === "compete" && getCompeteTab() === "arena");

      if (needsOnline) {
        main.innerHTML = `<div class="empty">Carregando arena…</div>`;
        const data = await loadOnlineData();
        window.__UL_ONLINE_CACHE = data;
        if (this.view !== requested) return;
      }

      if (this.view === "rankings") {
        const tab = window.__UL_RANK_UI?.tab || "clubs";
        if (tab === "online" && !window.__UL_ONLINE_RANKINGS) {
          main.innerHTML = `<div class="empty">Carregando rankings…</div>`;
          try {
            const { api } = await import("../net/api.js");
            const r = await api.rankings();
            window.__UL_ONLINE_RANKINGS = r.ok
              ? { clubs: r.clubs || [], scorers: r.scorers || [] }
              : { error: r.error || "Falha." };
          } catch {
            window.__UL_ONLINE_RANKINGS = {
              error: "Não foi possível atualizar o ranking agora."
            };
          }
          if (this.view !== "rankings") return;
        }
      }

      const renderFn = VIEWS[this.view] || VIEWS.home;
      main.innerHTML = renderFn(game, s);
      bindViewEvents(game, app);
      if (focusMain) finishNavigation(main, this.view, historyMode);
    },

    showBoot() {
      $("#screen-boot")?.classList.add("active");
      $("#screen-game")?.classList.remove("active");
      $("#screen-ops")?.classList.remove("active");
      closeMobileNav();
      document.title = "Under League — Portal";
      history.replaceState({}, "", `${location.pathname}${location.search}`);
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      refreshLobby(game);
      requestAnimationFrame(() => {
        const heading = $("#screen-boot h1");
        if (heading) {
          heading.tabIndex = -1;
          heading.focus({ preventScroll: true });
        }
      });
    },

    showGame() {
      $("#screen-boot")?.classList.remove("active");
      $("#screen-ops")?.classList.remove("active");
      $("#screen-game")?.classList.add("active");
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      return this.setView("home", { history: "replace" });
    },

    /** Painel de operações — sem hash/rota pública. */
    async showOps() {
      $("#screen-boot")?.classList.remove("active");
      $("#screen-game")?.classList.remove("active");
      $("#screen-ops")?.classList.add("active");
      closeMobileNav();
      document.title = "Under League — Operações";
      history.replaceState({}, "", `${location.pathname}${location.search}`);
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      await renderOpsPanel();
      requestAnimationFrame(() => {
        const heading = $("#screen-ops h1");
        if (heading) {
          heading.tabIndex = -1;
          heading.focus({ preventScroll: true });
        }
      });
    },

    toast
  };

  // Delegação global: data-go funciona no main e no trilho (chrome re-renderiza sem rebind)
  if (typeof document !== "undefined" && !document.documentElement.dataset.ulGoBound) {
    document.documentElement.dataset.ulGoBound = "1";
    document.addEventListener("click", (event) => {
      const btn = event.target?.closest?.("[data-go]");
      if (!btn || btn.disabled) return;
      // botões com handlers próprios mais específicos já tratam; data-go é navegação
      if (btn.closest("#modal-root")) return;
      event.preventDefault();
      const opts = {};
      if (btn.dataset.competeTab) opts.competeTab = btn.dataset.competeTab;
      app.setView(btn.dataset.go, opts);
    });
  }

  return app;
}
