/**
 * Evolução leve dos NPCs entre temporadas.
 */

import { clamp, rand } from "../core/utils.js";
import { refreshPlayerDerived } from "../data/generators.js";

export function evolveNpcs(game) {
  const season = game.state.season || 1;
  (game.state.npcs || []).forEach((club, i) => {
    const difficulty = club.difficulty || i + 1;
    (club.squad || []).forEach((p) => {
      // envelhece levemente a cada temporada
      if (season > 1 && rand(1, 100) <= 40) p.age = Math.min(38, (p.age || 25) + 1);
      const drift = rand(-1, 2) + (difficulty >= 5 ? 1 : 0);
      ["pace", "shoot", "pass", "defend", "physical"].forEach((k) => {
        if (p[k] != null) p[k] = clamp(p[k] + (rand(1, 100) <= 35 ? drift : 0), 25, 96);
      });
      p.form = clamp((p.form || 60) + rand(-3, 4), 40, 92);
      p.morale = clamp((p.morale || 60) + rand(-2, 3), 40, 92);
      refreshPlayerDerived(p);
      p.salary = Math.max(35, Math.floor((p.value || 0) / 55));
    });
    club.prestige = Math.min(99, (club.prestige || 10) + rand(0, 2));
  });
  if (typeof game.feed === "function") {
    game.feed("Rivais investiram na pré-temporada — elencos NPC se mexeram.");
  }
}
