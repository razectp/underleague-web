/**
 * Liga eventos da view atual aos métodos do Game.
 * Usa data-* attributes no HTML gerado pelas views.
 */

import { $, toast, modal } from "./dom.js";
import { api, getToken } from "../net/api.js";
import { setCompeteTab } from "./guidance.js";
import { openLiveMatch } from "./liveMatch.js";

/**
 * @param {import('../game/Game.js').Game} game
 * @param {{ setView:(v:string)=>void, render:()=>void }} app
 */
export function bindViewEvents(game, app) {
  const root = $("#main-content");
  if (!root) return;

  const after = async (resultOrPromise, failType = "bad") => {
    let result = resultOrPromise;
    try {
      if (resultOrPromise && typeof resultOrPromise.then === "function") {
        result = await resultOrPromise;
      }
    } catch (e) {
      toast(e?.message || "Falha na ação.", failType);
      app.render();
      return;
    }
    if (result && result.ok === false && (result.msg || result.error)) {
      toast(result.msg || result.error, failType);
    }
    app.render();
    return result;
  };

  root.querySelectorAll("[data-go]").forEach((btn) => {
    btn.onclick = () => {
      const opts = {};
      if (btn.dataset.competeTab) opts.competeTab = btn.dataset.competeTab;
      app.setView(btn.dataset.go, opts);
    };
  });

  root.querySelectorAll("[data-compete-tab]").forEach((btn) => {
    if (btn.dataset.go) return; // já tratado em data-go
    btn.onclick = async () => {
      const tab = btn.dataset.competeTab;
      setCompeteTab(tab);
      await app.setView("compete", { focus: false });
      root.querySelector(`[role="tab"][data-compete-tab="${tab}"]`)?.focus();
    };
  });

  const competeTabs = [...root.querySelectorAll('[role="tab"][data-compete-tab]')];
  competeTabs.forEach((btn, index) => {
    btn.onkeydown = (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      let next = index;
      if (event.key === "ArrowLeft") next = (index - 1 + competeTabs.length) % competeTabs.length;
      if (event.key === "ArrowRight") next = (index + 1) % competeTabs.length;
      if (event.key === "Home") next = 0;
      if (event.key === "End") next = competeTabs.length - 1;
      competeTabs[next].focus();
      competeTabs[next].click();
    };
  });

  root.querySelectorAll("[data-train]").forEach((btn) => {
    btn.onclick = () => after(game.train(btn.dataset.train));
  });

  const squadTrain = root.querySelector("#btn-squad-train");
  if (squadTrain) {
    squadTrain.onclick = () => {
      const pid = root.querySelector("#train-player")?.value;
      const attr = root.querySelector("#train-attr")?.value;
      after(game.trainSquadFocus(pid, attr));
    };
  }

  root.querySelectorAll("[data-rest]").forEach((btn) => {
    btn.onclick = () => after(game.rest(btn.dataset.rest), "warn");
  });

  root.querySelectorAll("[data-op]").forEach((btn) => {
    btn.onclick = () => after(game.runOperation(btn.dataset.op));
  });

  root.querySelectorAll("[data-sell]").forEach((btn) => {
    btn.onclick = () => {
      const p = game.state.squad.find((x) => x.id === btn.dataset.sell);
      if (!p) return;
      modal({
        title: "Vender jogador",
        body: `Confirmar venda de <strong>${p.name}</strong>? Taxa de 3% sobre o valor. Elenco mínimo: 14.`,
        confirmText: "Vender",
        danger: true,
        onConfirm: () => after(game.sellPlayer(p.id))
      });
    };
  });

  root.querySelectorAll("[data-buy]").forEach((btn) => {
    btn.onclick = () => after(game.buyPlayer(btn.dataset.buy));
  });

  const form = root.querySelector("#sel-formation");
  if (form) {
    form.onchange = () => after(game.setFormation(form.value));
  }

  const ment = root.querySelector("#sel-mentality");
  if (ment) {
    ment.onchange = () => after(game.setMentality(ment.value));
  }

  const approach = root.querySelector("#sel-approach");
  if (approach) {
    approach.onchange = () => after(game.setApproach(approach.value));
  }

  const play = root.querySelector("#btn-play-match");
  if (play) {
    play.onclick = async () => {
      play.disabled = true;
      try {
        const result = await after(game.playNextMatch());
        if (result?.ok && result.live) {
          openLiveMatch(result.live, {
            onClose: () => app.setView("postmatch")
          });
        }
      } finally {
        play.disabled = false;
      }
    };
  }

  root.querySelectorAll("[data-lineup-toggle]").forEach((btn) => {
    btn.onclick = () => after(game.toggleLineupPlayer(btn.dataset.lineupToggle), "warn");
  });

  const autoLineup = root.querySelector("#btn-lineup-auto");
  if (autoLineup) {
    autoLineup.onclick = async () => {
      await after(game.autoFillLineup());
      toast("XI montado no servidor.", "info");
    };
  }

  root.querySelectorAll("[data-upgrade-facility]").forEach((btn) => {
    btn.onclick = () => after(game.upgradeFacility(btn.dataset.upgradeFacility));
  });

  root.querySelectorAll("[data-claim-goal]").forEach((btn) => {
    btn.onclick = () => after(game.claimSeasonGoal(btn.dataset.claimGoal), "warn");
  });

  const tutNext = root.querySelector("#btn-tutorial-next");
  if (tutNext) tutNext.onclick = () => after(game.advanceTutorial());
  const tutSkip = root.querySelector("#btn-tutorial-skip");
  if (tutSkip) tutSkip.onclick = () => after(game.skipTutorial());

  root.querySelectorAll("[data-circuit]").forEach((btn) => {
    btn.onclick = async () => {
      const result = await after(game.playCircuitMatch(btn.dataset.circuit));
      if (result?.ok && result.live) {
        openLiveMatch(result.live, { onClose: () => app.render() });
      }
    };
  });

  const promoteYouth = root.querySelector("#btn-promote-youth");
  if (promoteYouth) promoteYouth.onclick = () => after(game.promoteYouth());

  const upgradeAcademy = root.querySelector("#btn-upgrade-academy");
  if (upgradeAcademy) upgradeAcademy.onclick = () => after(game.upgradeAcademy());

  root.querySelectorAll("[data-influence]").forEach((btn) => {
    btn.onclick = () => after(game.strengthenInfluence(btn.dataset.influence));
  });

  const dep = root.querySelector("#btn-deposit");
  if (dep) {
    dep.onclick = () => {
      const amount = root.querySelector("#club-amount")?.value;
      after(game.depositToClub(amount));
    };
  }

  const wit = root.querySelector("#btn-withdraw");
  if (wit) {
    wit.onclick = () => {
      const amount = root.querySelector("#club-amount")?.value;
      after(game.withdrawFromClub(amount));
    };
  }

  root.querySelectorAll("[data-heal]").forEach((btn) => {
    btn.onclick = () => after(game.medicalCare(btn.dataset.heal));
  });

  root.querySelectorAll("[data-claim]").forEach((btn) => {
    btn.onclick = () => after(game.claimMission(btn.dataset.claim));
  });

  root.querySelectorAll("[data-player]").forEach((btn) => {
    btn.onclick = () => {
      const p = game.getPlayer(btn.dataset.player);
      if (!p) return;
      const inj = p.injury
        ? `${p.injury.name} (${p.injury.daysLeft}d)`
        : "Apto";
      modal({
        title: `${p.name}`,
        body: `
          <span class="pos">${p.pos}</span> · OVR <strong>${p.overall}</strong> · ${p.age} anos · pot ${p.potential}<br><br>
          Ritmo ${p.pace} · Finalização ${p.shoot} · Passe ${p.pass}<br>
          Defesa ${p.defend} · Físico ${p.physical}<br><br>
          Forma ${p.form} · Stamina ${Math.floor(p.stamina)} · Moral ${p.morale}<br>
          Gols ${p.goals || 0} · Jogos ${p.games || 0}<br>
          Valor R$ ${p.value.toLocaleString("pt-BR")} · Salário R$ ${(p.salary || 0).toLocaleString("pt-BR")}<br>
          Saúde: ${inj}
        `,
        confirmText: "Fechar",
        onConfirm: () => {}
      });
    };
  });

  /* —— rankings —— */
  root.querySelectorAll("[data-rank-tab]").forEach((btn) => {
    btn.onclick = () => {
      window.__UL_RANK_UI = window.__UL_RANK_UI || {
        tab: "clubs",
        clubSort: "pts",
        playerSort: "goals",
        scope: "league",
        minGames: 1
      };
      window.__UL_RANK_UI.tab = btn.dataset.rankTab;
      app.setView("rankings");
    };
  });

  root.querySelectorAll("[data-rank-sort]").forEach((btn) => {
    btn.onclick = () => {
      const st = (window.__UL_RANK_UI = window.__UL_RANK_UI || {
        tab: "clubs",
        clubSort: "pts",
        playerSort: "goals",
        scope: "league",
        minGames: 1
      });
      if (st.tab === "players") st.playerSort = btn.dataset.rankSort;
      else st.clubSort = btn.dataset.rankSort;
      app.setView("rankings");
    };
  });

  root.querySelectorAll("[data-rank-scope]").forEach((btn) => {
    btn.onclick = () => {
      window.__UL_RANK_UI = window.__UL_RANK_UI || {
        tab: "players",
        clubSort: "pts",
        playerSort: "goals",
        scope: "league",
        minGames: 1
      };
      window.__UL_RANK_UI.scope = btn.dataset.rankScope;
      window.__UL_RANK_UI.tab = "players";
      app.setView("rankings");
    };
  });

  const loadOnlineRank = root.querySelector("#btn-load-online-rank");
  if (loadOnlineRank) {
    loadOnlineRank.onclick = async () => {
      try {
        const r = await api.rankings();
        if (!r.ok) {
          window.__UL_ONLINE_RANKINGS = { error: r.error || "Falha ao carregar." };
        } else {
          window.__UL_ONLINE_RANKINGS = { clubs: r.clubs || [], scorers: r.scorers || [] };
        }
      } catch {
        window.__UL_ONLINE_RANKINGS = {
          error: "Servidor indisponível. O jogo precisa da conexão para continuar."
        };
      }
      window.__UL_RANK_UI = window.__UL_RANK_UI || {};
      window.__UL_RANK_UI.tab = "online";
      app.setView("rankings");
    };
  }

  /* —— multiplayer —— */
  const syncBtn = root.querySelector("#btn-sync-cloud");
  if (syncBtn) {
    syncBtn.onclick = async () => {
      if (!getToken()) {
        toast("Faça login na tela inicial.", "warn");
        return;
      }
      // Estado já está no servidor a cada ação; só confirma leitura
      const r = await api.gameState();
      if (r.ok && r.gameState) {
        game.acceptServerState(r.gameState);
        toast("Elenco confirmado no servidor (autoridade).", "info");
      } else toast(r.error || "Sem campanha no servidor.", "bad");
      app.setView("online");
    };
  }

  const refreshOnline = root.querySelector("#btn-refresh-online");
  if (refreshOnline) {
    refreshOnline.onclick = () => app.setView("online");
  }

  root.querySelectorAll("[data-challenge]").forEach((btn) => {
    btn.onclick = async () => {
      const r = await api.challenge(btn.dataset.challenge);
      if (r.ok) toast("Desafio enviado!", "info");
      else toast(r.error || "Falha no desafio.", "bad");
      app.setView("online");
    };
  });

  root.querySelectorAll("[data-respond]").forEach((btn) => {
    btn.onclick = async () => {
      const accept = btn.dataset.accept === "1";
      const r = await api.respond(btn.dataset.respond, accept);
      if (!r.ok) {
        toast(r.error || "Falha.", "bad");
      } else if (r.declined) {
        toast("Desafio recusado.", "warn");
      } else if (r.result) {
        toast(
          `PvP: ${r.result.homeName} ${r.result.hg} x ${r.result.ag} ${r.result.awayName}`,
          "info"
        );
      }
      app.setView("online");
    };
  });
}
