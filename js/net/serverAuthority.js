/**
 * Ponte cliente → servidor autoritativo.
 * Toda mutação do cliente passa pelo servidor e exige sessão.
 */

import { api, getToken } from "./api.js";

/**
 * @param {import('../game/Game.js').Game} game
 */
export function enableServerAuthority(game) {
  if (game.__serverWrapped) {
    game.serverAuthoritative = true;
    return;
  }
  game.__serverWrapped = true;
  game.serverAuthoritative = true;

  /**
   * @param {string} action
   * @param {object} [payload]
   * @returns {Promise<object>}
   */
  game.serverAction = async function serverAction(action, payload = {}) {
    if (!getToken()) {
      return { ok: false, msg: "Faça login para jogar com autoridade no servidor." };
    }
    const r = await api.gameAction(action, payload);
    if (!r.ok) {
      return {
        ok: false,
        msg: r.error || "Falha no servidor.",
        error: r.error
      };
    }
    if (r.gameState) {
      this.acceptServerState(r.gameState);
    }
    // Resultado da ação (ok/msg/live/…)
    const result = r.result && typeof r.result === "object" ? { ...r.result } : { ok: true };
    if (r.live) result.live = r.live;
    if (r.postMatch) result.postMatch = r.postMatch;
    if (r.match) result.match = r.match;
    if (result.ok === undefined) result.ok = true;
    return result;
  };

  // Wrappers síncronos → async (call sites usam await ou .then).
  // Não existe fallback local no cliente.
  const map = {
    train: (id) => ({ id }),
    trainSquadFocus: (playerId, attr) => ({ playerId, attr }),
    rest: (kind) => ({ kind }),
    wait: () => ({}),
    medicalCare: (target) => ({ target }),
    runOperation: (opId) => ({ opId }),
    buyPlayer: (id) => ({ id }),
    sellPlayer: (id) => ({ id }),
    setFormation: (f) => ({ formation: f }),
    setMentality: (m) => ({ mentality: m }),
    setApproach: (approach) => ({ approach }),
    playNextMatch: () => ({}),
    playCircuitMatch: (rivalId) => ({ rivalId }),
    strengthenInfluence: (id) => ({ id }),
    depositToClub: (amount) => ({ amount }),
    withdrawFromClub: (amount) => ({ amount }),
    promoteYouth: () => ({}),
    upgradeAcademy: () => ({}),
    claimMission: (id) => ({ id }),
    claimSeasonGoal: (key) => ({ key }),
    upgradeFacility: (key) => ({ key }),
    autoFillLineup: () => ({}),
    toggleLineupPlayer: (id) => ({ id }),
    advanceTutorial: () => ({}),
    skipTutorial: () => ({})
  };

  for (const [name, toPayload] of Object.entries(map)) {
    game[name] = function remoteWrapper(...args) {
      if (!this.serverAuthoritative || !getToken()) {
        return Promise.resolve({
          ok: false,
          msg: "Sessão online obrigatória. Entre novamente para continuar."
        });
      }
      return this.serverAction(name, toPayload(...args));
    };
  }

  game.newGame = function (opts) {
    if (!this.serverAuthoritative || !getToken()) {
      return Promise.reject(new Error("Sessão online obrigatória para fundar um clube."));
    }
    return this.serverAction("newGame", opts).then((r) => {
      if (r.ok === false) throw new Error(r.msg || r.error || "Falha ao fundar clube");
      return this.state;
    });
  };
}
