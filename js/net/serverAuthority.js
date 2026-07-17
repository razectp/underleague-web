/**
 * Ponte cliente → servidor autoritativo.
 * Toda mutação do cliente passa pelo servidor e exige sessão.
 */

import { api, getToken } from "./api.js";
import {
  STATE_PATCH_MODE,
  applyTopLevelStatePatch
} from "../core/statePatch.js";

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
      return { ok: false, msg: "Faça login para continuar." };
    }
    const r = await api.gameAction(action, payload, {
      stateMode: STATE_PATCH_MODE,
      baseRevision: this.stateRevision
    });
    if (!r.ok) {
      return {
        ok: false,
        msg: r.error || "Não foi possível concluir a ação.",
        error: r.error
      };
    }
    if (r.gameStatePatch) {
      const next = applyTopLevelStatePatch(this.state, r.gameStatePatch, this.stateRevision);
      if (next) this.acceptServerState(next, r.gameStatePatch.revision);
      else {
        // Defesa para respostas inconsistentes: uma leitura completa corrige
        // revisão antiga/múltiplas abas sem aplicar patch sobre base errada.
        const fresh = await api.gameState();
        if (fresh.ok && fresh.gameState) {
          this.acceptServerState(fresh.gameState, fresh.stateRevision);
        }
      }
    } else if (r.gameState) {
      this.acceptServerState(r.gameState, r.stateRevision);
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
    skipTutorial: () => ({}),
    renameManager: (name) => ({ name }),
    setPlayerNickname: (playerId, nickname) => ({ playerId, nickname })
  };

  for (const [name, toPayload] of Object.entries(map)) {
    game[name] = function remoteWrapper(...args) {
      if (!this.serverAuthoritative || !getToken()) {
        return Promise.resolve({
          ok: false,
          msg: "Sua sessão terminou. Entre novamente para continuar."
        });
      }
      return this.serverAction(name, toPayload(...args));
    };
  }

  game.newGame = function (opts) {
    if (!this.serverAuthoritative || !getToken()) {
      return Promise.reject(new Error("Entre na sua conta antes de fundar um clube."));
    }
    return this.serverAction("newGame", opts).then((r) => {
      if (r.ok === false) throw new Error(r.msg || r.error || "Falha ao fundar clube");
      return this.state;
    });
  };
}
