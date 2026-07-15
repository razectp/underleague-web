/**
 * Bootstrap Under League
 * Portal + jogo always-online. Campanha só no banco (API).
 *
 * Preferir: servir.bat → http://127.0.0.1:3000
 */

import { game } from "./game/Game.js";
import { createApp } from "./ui/App.js";
import { $, toast } from "./ui/dom.js";
import { refreshChrome } from "./ui/chrome.js";
import { timeStr } from "./ui/format.js";
import { api, setToken, getToken, probeServer } from "./net/api.js";
import { enableServerAuthority } from "./net/serverAuthority.js";
import { managerName } from "./data/generators.js";
import { refreshLobby, fillDemoCredentials } from "./ui/lobby.js";

const app = createApp(game);
game.toastVia = toast;
// O cliente nunca executa mutações locais: o servidor/banco é obrigatório.
enableServerAuthority(game);

let lastServerOk = null;

function setCampaignAccess({ connected = false, hasGame = false } = {}) {
  const createPanel = $("#panel-create");
  createPanel?.classList.toggle("hidden", hasGame);
  const start = $("#btn-start");
  if (start) start.disabled = !connected;
  const createStatus = $("#create-access-status");
  if (createStatus) {
    createStatus.textContent = connected
      ? "Conta conectada. Escolha a identidade do clube para começar."
      : "Faça login ou crie sua conta primeiro.";
  }
  document.querySelectorAll("[data-lobby-go]").forEach((button) => {
    button.disabled = !hasGame;
  });
  const shortcutsStatus = $("#shortcuts-access-status");
  if (shortcutsStatus) {
    shortcutsStatus.textContent = hasGame
      ? "Seu clube está pronto para jogar."
      : "Os atalhos ficam disponíveis assim que seu clube estiver pronto.";
  }
}

function setAccountUi(user, { created = false } = {}) {
  const connected = !!user;
  $("#account-auth-form")?.classList.toggle("hidden", connected);
  $("#account-session")?.classList.toggle("hidden", !connected);
  setCampaignAccess({ connected, hasGame: false });
  if (connected && user.clubName) {
    $("#panel-create")?.classList.add("hidden");
    const start = $("#btn-start");
    if (start) start.disabled = true;
  }
  const title = $("#account-title");
  const hint = $("#account-hint");
  if (title) title.textContent = connected ? "Conta conectada" : "Entrar no jogo";
  if (hint) {
    hint.textContent = connected
      ? "Sua sessão está ativa. Continue para o clube ou troque de conta."
      : "Cadastre-se apenas com e-mail e senha. O clube é criado depois.";
  }
  const status = $("#account-status");
  const apiStatus = $("#account-api-status");
  if (apiStatus) {
    apiStatus.textContent = connected
      ? "Seu progresso está atualizado."
      : "Entre para continuar sua jornada.";
  }
  if (!status) return;
  if (!connected) {
    status.textContent = "";
  } else if (created) {
    status.textContent = `Conta criada: ${user.displayName} · agora funde seu clube`;
  } else {
    status.textContent = user.clubName
      ? `Sessão: ${user.displayName} · ${user.clubName}`
      : `Sessão: ${user.displayName} · clube ainda não fundado`;
  }
}

async function loadServerState() {
  if (!getToken()) {
    game.wipe();
    return { ok: false, error: "Faça login para acessar seu clube." };
  }
  const response = await api.gameState();
  if (!response.ok) return response;
  if (!response.gameState) {
    game.wipe();
    setCampaignAccess({ connected: true, hasGame: false });
    return { ok: true, hasGame: false };
  }
  game.acceptServerState(response.gameState);
  setCampaignAccess({ connected: true, hasGame: true });
  return { ok: true, hasGame: true };
}

async function syncServerQuiet() {
  if (!getToken() || !game.state) return;
  const result = await loadServerState();
  if (!result.ok && $("#screen-game")?.classList.contains("active")) {
    toast(result.error || "Não foi possível atualizar seu progresso agora.", "bad");
  }
}

async function doLogin(user, pass, { autoEnter = true } = {}) {
  const r = await api.login({ email: user, password: pass });
  if (!r.ok) {
    toast(r.error || "Falha no login.", "bad");
    return false;
  }
  setToken(r.token);
  setAccountUi(r.user);
  toast(`Bem-vindo, ${r.user.displayName}!`, "info");

  if (autoEnter) {
    const loaded = await loadServerState();
    if (!loaded.ok) {
      toast(loaded.error || "Não foi possível carregar seu clube agora.", "bad");
      await refreshLobby(game);
      return true;
    }
    if (loaded.hasGame) {
      app.showGame();
      await refreshLobby(game);
      return true;
    }
    // preenche fundação se não houver save
    const n = $("#input-name");
    const c = $("#input-club");
    if (n) n.value = r.user.displayName;
    if (c) c.value = r.user.clubName;
    toast("Conta conectada — agora funde seu clube.", "warn");
  }
  await refreshLobby(game);
  return true;
}

function bindGlobal() {
  window.addEventListener("underleague:unauthorized", () => {
    setToken(null);
    game.wipe();
    setAccountUi(null);
    app.showBoot();
    toast("Sua sessão expirou. Entre novamente para continuar.", "warn");
  });

  const mobileNavBtn = $("#btn-mobile-nav");
  const sidebar = $("#sidebar");
  const setMobileNav = (open) => {
    sidebar?.classList.toggle("mobile-open", open);
    mobileNavBtn?.setAttribute("aria-expanded", open ? "true" : "false");
  };
  mobileNavBtn?.addEventListener("click", () => {
    setMobileNav(!sidebar?.classList.contains("mobile-open"));
  });

  document.querySelectorAll(".nav-item[data-view]").forEach((btn) => {
    btn.addEventListener("click", () => {
      setMobileNav(false);
      app.setView(btn.dataset.view);
    });
  });

  const moreBtn = $("#btn-nav-more");
  const moreWrap = $("#nav-more");
  if (moreBtn && moreWrap) {
    const items = moreWrap.querySelector(".nav-more-items");
    const open = localStorage.getItem("ul_nav_more") === "1";
    if (items) {
      items.hidden = !open;
      moreBtn.setAttribute("aria-expanded", open ? "true" : "false");
      moreWrap.classList.toggle("open", open);
    }
    moreBtn.addEventListener("click", () => {
      if (!items) return;
      const next = items.hidden;
      items.hidden = !next;
      moreBtn.setAttribute("aria-expanded", next ? "true" : "false");
      moreWrap.classList.toggle("open", next);
      localStorage.setItem("ul_nav_more", next ? "1" : "0");
    });
  }

  $("#btn-random-name")?.addEventListener("click", async () => {
    const input = $("#input-name");
    if (!input) return;
    const suggestion = getToken() ? await api.identitySuggestion() : null;
    input.value = suggestion?.ok ? suggestion.name : managerName();
    input.focus();
    toast("Nome gerado. Você ainda pode editá-lo.", "info");
  });

  $("#btn-start")?.addEventListener("click", async () => {
    if (!getToken()) {
      toast("Crie uma conta ou faça login antes de fundar o clube.", "warn");
      $("#input-email")?.focus();
      return;
    }
    const name = $("#input-name").value.trim();
    const club = $("#input-club").value.trim();
    const style = $("#input-style").value;
    const clubType = $("#input-club-type")?.value || "bairro";
    if (club.length < 2) {
      toast("Dê um nome ao seu time / escolinha.", "warn");
      return;
    }
    if (name.length < 2) {
      toast("Como você se chama? (presidente / técnico)", "warn");
      return;
    }
    try {
      const r = await game.serverAction("newGame", {
        name,
        clubName: club,
        style,
        clubType
      });
      if (r.ok === false) {
        toast(r.msg || r.error || "Falha ao fundar.", "bad");
        return;
      }
      toast(`${club} fundado!`, "info");
      app.showGame();
      refreshLobby(game);
    } catch (e) {
      toast(e?.message || "Erro ao criar campanha.", "bad");
    }
  });

  $("#btn-sync-state")?.addEventListener("click", async () => {
    const loaded = await loadServerState();
    if (!loaded.ok || !loaded.hasGame) {
      toast(loaded.error || "Nenhum clube encontrado na sua conta.", "bad");
      return;
    }
    toast("Progresso atualizado.", "info");
    app.render();
  });

  $("#btn-lobby")?.addEventListener("click", () => {
    app.showBoot();
    refreshLobby(game);
  });

  window.addEventListener("popstate", (event) => {
    if (!$("#screen-game")?.classList.contains("active")) return;
    const view = event.state?.underLeagueView || location.hash.slice(1);
    if (view) app.setView(view, { history: false });
  });

  $("#btn-enter-game")?.addEventListener("click", async () => {
    const loaded = await loadServerState();
    if (loaded.ok && loaded.hasGame) {
      app.showGame();
      return;
    }
    toast(
      loaded.error || "Esta conta ainda não possui clube. Funde um para começar.",
      loaded.ok ? "warn" : "bad"
    );
  });

  $("#btn-login")?.addEventListener("click", async () => {
    const email = $("#input-email").value.trim();
    const password = $("#input-password").value;
    if (!email || !password) {
      toast("Preencha usuário e senha.", "warn");
      return;
    }
    await doLogin(email, password, { autoEnter: true });
  });

  $("#btn-demo")?.addEventListener("click", async () => {
    const btn = $("#btn-demo");
    if (btn?.hidden || btn?.classList.contains("hidden")) {
      toast("Conta demo indisponível neste ambiente.", "warn");
      return;
    }
    fillDemoCredentials();
    toast("Entrando na conta demo…", "info");
    await doLogin("teste", "senha123", { autoEnter: true });
  });

  $("#btn-register")?.addEventListener("click", async () => {
    const email = $("#input-email").value.trim();
    const password = $("#input-password").value;
    if (!email || password.length < 6) {
      toast("Informe e-mail e senha (mín. 6) para cadastrar.", "warn");
      return;
    }
    if (!email.includes("@")) {
      toast("Para criar a conta, informe um e-mail válido.", "warn");
      return;
    }

    const r = await api.register({
      email,
      password
    });
    if (!r.ok) {
      toast(r.error || "Falha no cadastro.", "bad");
      return;
    }
    setToken(r.token);
    setAccountUi(r.user, { created: true });
    const name = $("#input-name");
    if (name && !name.value.trim()) name.value = r.user.displayName;
    toast("Conta criada! Agora escolha os detalhes do seu clube.", "info");
    await refreshLobby(game);
    const createPanel = $("#panel-create");
    createPanel?.scrollIntoView({ behavior: "smooth", block: "start" });
    $("#input-club")?.focus({ preventScroll: true });
  });

  $("#btn-logout")?.addEventListener("click", async () => {
    try {
      await api.logout();
    } finally {
      setToken(null);
      game.wipe();
      setAccountUi(null);
      const email = $("#input-email");
      const password = $("#input-password");
      if (email) email.value = "";
      if (password) password.value = "";
      app.showBoot();
      await refreshLobby(game);
      email?.focus();
      toast("Sessão encerrada.", "info");
    }
  });

  // atalhos do portal
  document.querySelectorAll("[data-lobby-go]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const view = btn.dataset.lobbyGo;
      const loaded = await loadServerState();
      if (!loaded.ok || !loaded.hasGame) {
        toast(
          loaded.error || "Faça login e funde um clube primeiro.",
          loaded.ok ? "warn" : "bad"
        );
        return;
      }
      app.showGame();
      app.setView(view);
    });
  });

  setInterval(() => {
    syncServerQuiet();
  }, 60000);

  setInterval(() => {
    checkServer({ quiet: true });
  }, 120000);

  ["input-email", "input-password"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") $("#btn-login")?.click();
    });
  });

  ["input-name", "input-club"].forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter") $("#btn-start")?.click();
    });
  });
}

/**
 * @param {{ quiet?: boolean }} [opts]
 */
async function checkServer({ quiet = false } = {}) {
  const dot = $("#server-dot");
  const probe = await probeServer();
  const up = probe.ok;
  if (dot) {
    if (up) {
      dot.textContent = "Jogo disponível";
      dot.removeAttribute("title");
      dot.className = "badge ok";
    } else {
      dot.textContent = "Jogo temporariamente indisponível";
      dot.title = probe.error || "Sem conexão com o servidor";
      dot.className = "badge warn";
    }
  }
  if (!quiet && lastServerOk === true && !up) {
    toast(
      probe.error || "O jogo está temporariamente indisponível. Seu progresso permanece salvo na conta.",
      "bad"
    );
  }
  if (!quiet && lastServerOk === false && up) {
    toast("Conexão restabelecida. Atualizando progresso…", "info");
  }
  lastServerOk = up;

  if (getToken() && up) {
    try {
      const me = await api.me();
      if (me.ok) {
        setAccountUi(me.user);
        await loadServerState();
      } else {
        setToken(null);
        setAccountUi(null);
      }
    } catch {
      /* ignore */
    }
  } else if (!up && getToken() && $("#screen-game")?.classList.contains("active") && !quiet) {
    toast("Sem conexão com o servidor. Aguarde e tente novamente — o progresso não é salvo no aparelho.", "warn");
  }
  return up;
}

/** Atualiza só o texto do relógio do clube (minutos) sem re-render completo. */
function tickGameClock() {
  if (!$("#screen-game")?.classList.contains("active")) return;
  if (!game.state) return;
  const el = $("#top-day");
  if (!el) return;
  const next = timeStr(game.state);
  if (el.textContent !== next) el.textContent = next;
}

function init() {
  bindGlobal();
  game.on(() => {
    if ($("#screen-game")?.classList.contains("active")) {
      refreshChrome(game);
    }
  });

  // 1 s real ≈ fração de minuto de jogo; mantém o topo “vivo”.
  setInterval(tickGameClock, 1000);

  setAccountUi(null);
  app.showBoot();
  checkServer().then(() => refreshLobby(game));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
