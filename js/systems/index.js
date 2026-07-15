/**
 * Barrel dos systems — atalho de imports em testes / ferramentas.
 * A UI deve preferir a facade Game.
 *
 * Estado de campanha é autoritativo no servidor/banco; estes módulos
 * só definem regras. Preferências de UI (prefs) não fazem parte do save.
 */

export * from "./time.js";
export * from "./rest.js";
export * from "./training.js";
export * from "./injuries.js";
export * from "./medical.js";
export * from "./operations.js";
export * from "./market.js";
export * from "./tactics.js";
export * from "./match.js";
export * from "./influence.js";
export * from "./club.js";
export * from "./circuit.js";
export * from "./academy.js";
export * from "./missions.js";
export * from "./skillProgress.js";
export * from "./rankings.js";
export * from "./availability.js";
export * from "./lineup.js";
export * from "./finance.js";
export * from "./facilities.js";
export * from "./seasonGoals.js";
export * from "./matchSim.js";
export * from "./matchReactions.js";
export * from "./npcAi.js";
export * from "./npcEvolve.js";
export * from "./prefs.js";
