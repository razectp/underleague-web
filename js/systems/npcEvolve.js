/**
 * Evolução leve dos NPCs entre temporadas (determinística por seed).
 */

import { clamp } from "../core/utils.js";
import { refreshPlayerDerived } from "../data/generators.js";
import { deterministicInt, ensureNpcAiState, ensureNpcDna } from "./npcAi.js";

export function evolveNpcs(game) {
  const state = game.state;
  ensureNpcAiState(state);
  const season = state.season || 1;
  (state.npcs || []).forEach((club, i) => {
    ensureNpcDna(club);
    const difficulty = club.difficulty || i + 1;
    (club.squad || []).forEach((p, pi) => {
      const seed = `${season}:${club.id}:${p.id}:evolve`;
      // envelhece levemente a cada temporada
      if (season > 1 && deterministicInt(`${seed}:age`, 1, 100) <= 40) {
        p.age = Math.min(38, (p.age || 25) + 1);
      }
      const driftBase = deterministicInt(`${seed}:drift`, -1, 2) + (difficulty >= 5 ? 1 : 0);
      ["pace", "shoot", "pass", "defend", "physical"].forEach((k, ki) => {
        if (p[k] == null) return;
        const apply = deterministicInt(`${seed}:attr:${k}:${ki}`, 1, 100) <= 35;
        if (apply) p[k] = clamp(p[k] + driftBase, 25, 96);
      });
      p.form = clamp(
        (p.form || 60) + deterministicInt(`${seed}:form`, -3, 4),
        40,
        92
      );
      p.morale = clamp(
        (p.morale || 60) + deterministicInt(`${seed}:morale`, -2, 3),
        40,
        92
      );
      refreshPlayerDerived(p);
      p.salary = Math.max(35, Math.floor((p.value || 0) / 55));
    });
    club.prestige = Math.min(
      99,
      (club.prestige || 10) + deterministicInt(`${season}:${club.id}:prestige`, 0, 2)
    );
    // DNA tático permanece entre temporadas.
    club.formation = club.ai.dna.formation;
    club.approach = club.ai.dna.approach;
  });
  if (typeof game.feed === "function") {
    game.feed("Rivais investiram na pré-temporada — elencos NPC se mexeram.");
  }
}
