/**
 * Facade principal do jogo.
 * A UI e o main falam só com esta classe; regras ficam em systems/.
 */

import { uid } from "../core/utils.js";
import { createInitialState, migrateState } from "./createState.js";
import { advanceHours } from "../systems/time.js";
import { rest } from "../systems/rest.js";
import { train, trainSquadFocus } from "../systems/training.js";
import { medicalCare } from "../systems/medical.js";
import { runOperation } from "../systems/operations.js";
import { buyPlayer, sellPlayer } from "../systems/market.js";
import { setFormation, setMentality, setApproach, bestXI, teamStrength, tacticalMatchup } from "../systems/tactics.js";
import { squadAvailabilityReport } from "../systems/availability.js";
import { generateFixtures, getNextFixture, playNextMatch, leagueTable } from "../systems/match.js";
import { circuitStatus, playCircuitMatch } from "../systems/circuit.js";
import { influenceRanking, strengthenInfluence } from "../systems/influence.js";
import { depositToClub, withdrawFromClub } from "../systems/club.js";
import { promoteYouth, upgradeAcademy } from "../systems/academy.js";
import {
  ensureDailyMissions,
  trackMission,
  claimMission,
  missionsSummary
} from "../systems/missions.js";
import {
  clubRankings,
  playerRankings,
  buildRankingSnapshot
} from "../systems/rankings.js";
import {
  autoFillLineup,
  toggleLineupPlayer,
  lineupSummary,
  getStartingXI
} from "../systems/lineup.js";
import { upgradeFacility } from "../systems/facilities.js";
import { claimSeasonGoal, seasonGoalsSummary } from "../systems/seasonGoals.js";
import { ledgerSummary } from "../systems/finance.js";
import { processNpcDay } from "../systems/npcAi.js";

export class Game {
  constructor() {
    /** @type {object|null} */
    this.state = null;
    this.listeners = [];
    /** @type {null|((text:string, type?:string)=>void)} */
    this.toastVia = null;
  }

  /* —— observação —— */
  on(fn) {
    this.listeners.push(fn);
  }

  emit() {
    this.listeners.forEach((fn) => fn(this.state));
  }

  /** Emite a atualização em memória; a persistência pertence ao servidor. */
  commit() {
    this.emit();
  }

  /* —— ciclo do estado em memória —— */
  // Alguns sistemas compartilham esta classe com o motor do servidor. O
  // método permanece como no-op para compatibilidade, sem gravar no browser.
  saveSilent() {
    return this.state;
  }

  wipe() {
    this.state = null;
  }

  hydrate(rawState) {
    this.state = migrateState(rawState);
    if (!this.state.seasonFixtures?.length) generateFixtures(this);
    processNpcDay(this);
    ensureDailyMissions(this);
    if (!this.state.lineup?.starters?.length) autoFillLineup(this);
    this.emit();
    return this.state;
  }

  /** Aceita exclusivamente o snapshot já validado e normalizado pela API. */
  acceptServerState(rawState) {
    if (!rawState || typeof rawState !== "object") return null;
    this.state = JSON.parse(JSON.stringify(rawState));
    this.emit();
    return this.state;
  }

  /* —— ciclo de vida —— */
  newGame(opts) {
    this.state = createInitialState({
      name: opts.name,
      clubName: opts.clubName,
      style: opts.style,
      clubType: opts.clubType
    });
    generateFixtures(this);
    processNpcDay(this);
    ensureDailyMissions(this);
    autoFillLineup(this);
    this.log(
      `${this.state.club.name} foi fundado por ${this.state.boss.name}. Treine o elenco e prepare-se para competir.`,
      "info"
    );
    this.feed(`${this.state.club.name} (${this.state.club.typeLabel || "clube"}) entra na liga.`);
    this.commit();
    return this.state;
  }

  /* —— log / feed —— */
  log(text, type = "info") {
    if (!this.state) return;
    this.state.chronicles.unshift({
      id: uid(),
      day: this.state.day,
      hour: this.state.hour,
      text,
      type: type === "ok" ? "info" : type,
      ts: Date.now()
    });
    if (this.state.chronicles.length > 200) this.state.chronicles.pop();
  }

  feed(text) {
    if (!this.state) return;
    this.state.feed.unshift({
      id: uid(),
      day: this.state.day,
      hour: this.state.hour,
      text,
      ts: Date.now()
    });
    if (this.state.feed.length > 40) this.state.feed.pop();
  }

  notify(text, type) {
    this.log(text, type);
    if (this.toastVia) this.toastVia(text, type);
  }

  /* —— helpers de ação —— */
  canAct(energyCost, moneyCost = 0, opts = {}) {
    const b = this.state.boss;
    if (b.injury && !opts.allowInjured) {
      return { ok: false, reason: `Você está lesionado: ${b.injury.name} (${b.injury.daysLeft}d).` };
    }
    if (b.energy < energyCost) {
      return { ok: false, reason: "Energia insuficiente. Descanse ou aguarde a recuperação do clube." };
    }
    if (b.money < moneyCost) {
      return { ok: false, reason: "Dinheiro pessoal insuficiente." };
    }
    if (b.health < 25 && !opts.allowLowHealth) {
      return { ok: false, reason: "Saúde crítica. Vá ao médico ou descanse." };
    }
    return { ok: true };
  }

  spend(energy, money) {
    this.state.boss.energy -= energy;
    this.state.boss.money -= money;
  }

  addXp(n) {
    const b = this.state.boss;
    b.xp += n;
    const need = b.level * 100;
    if (b.xp >= need) {
      b.xp -= need;
      b.level += 1;
      b.maxEnergy = Math.min(140, b.maxEnergy + 2);
      b.rep += 5;
      this.notify(`Subiu para o nível ${b.level}! +2 energia máx, +5 prestígio.`, "info");
    }
  }

  cooldownLeft(key) {
    return Math.max(0, Math.ceil(this.state.boss.cooldowns[key] || 0));
  }

  setCooldown(key, hours) {
    this.state.boss.cooldowns[key] = hours;
  }

  getClub(id) {
    if (id === this.state.club.id) return this.state.club;
    return this.state.npcs.find((c) => c.id === id);
  }

  getSquad(clubId) {
    if (clubId === this.state.club.id) return this.state.squad;
    const c = this.state.npcs.find((x) => x.id === clubId);
    return c ? c.squad : [];
  }

  /* —— sistemas (API pública estável) —— */
  advanceHours(h, silent) {
    advanceHours(this, h, silent);
  }

  rest(kind) {
    const r = rest(this, kind);
    if (r.ok) trackMission(this, "rest");
    return r;
  }

  train(id) {
    const r = train(this, id);
    if (r.ok) trackMission(this, "train");
    return r;
  }

  trainSquadFocus(playerId, attr) {
    const r = trainSquadFocus(this, playerId, attr);
    if (r.ok) trackMission(this, "squad_train");
    return r;
  }

  medicalCare(target) {
    const r = medicalCare(this, target);
    if (r.ok) trackMission(this, "medical");
    return r;
  }

  runOperation(opId) {
    const r = runOperation(this, opId);
    if (r.ok) trackMission(this, "operation");
    return r;
  }

  buyPlayer(id) {
    const r = buyPlayer(this, id);
    if (r.ok) trackMission(this, "market_buy");
    return r;
  }

  sellPlayer(id) {
    const r = sellPlayer(this, id);
    if (r.ok) trackMission(this, "market_sell");
    return r;
  }

  listOnMarket(id) {
    return this.sellPlayer(id);
  }

  setFormation(f) {
    setFormation(this, f);
  }

  setMentality(m) {
    setMentality(this, m);
  }

  setApproach(approach) {
    setApproach(this, approach);
  }

  bestXI(squad, formation) {
    return bestXI(squad, formation);
  }

  /** Relatório de aptos / lesionados / suspensos (visão do técnico) */
  squadAvailability() {
    return squadAvailabilityReport(this.state?.squad || []);
  }

  teamStrength(xi, club, bossBonus) {
    return teamStrength(xi, club, bossBonus);
  }

  tacticalMatchup(mine, theirs) {
    return tacticalMatchup(mine, theirs);
  }

  circuitStatus() {
    return circuitStatus(this);
  }

  playCircuitMatch(rivalId) {
    const r = playCircuitMatch(this, rivalId);
    if (r.ok) trackMission(this, "circuit");
    return r;
  }

  getNextFixture() {
    return getNextFixture(this);
  }

  playNextMatch() {
    const r = playNextMatch(this);
    if (r.ok) trackMission(this, "match");
    return r;
  }

  leagueTable() {
    return leagueTable(this);
  }

  /** Rankings de clubes: pts | perf | gpg | ppg | gf | gd | cs */
  clubRankings(sortBy = "pts") {
    return clubRankings(this, sortBy);
  }

  /**
   * Rankings de jogadores.
   * scope: league | mine · sortBy: goals | gpg | assists | rating | perf | apps | motm
   */
  playerRankings(opts = {}) {
    return playerRankings(this, opts);
  }

  rankingSnapshot() {
    return buildRankingSnapshot(this);
  }

  strengthenInfluence(id) {
    const r = strengthenInfluence(this, id);
    if (r.ok) trackMission(this, "influence");
    return r;
  }

  influenceRanking(id) {
    return influenceRanking(this, id);
  }

  depositToClub(amount) {
    return depositToClub(this, amount);
  }

  withdrawFromClub(amount) {
    return withdrawFromClub(this, amount);
  }

  promoteYouth() {
    const r = promoteYouth(this);
    if (r.ok) trackMission(this, "academy");
    return r;
  }

  upgradeAcademy() {
    return upgradeAcademy(this);
  }

  claimMission(id) {
    return claimMission(this, id);
  }

  missionsSummary() {
    return missionsSummary(this);
  }

  getPlayer(playerId) {
    return (
      this.state?.squad.find((p) => p.id === playerId) ||
      this.state?.market.find((p) => p.id === playerId) ||
      null
    );
  }

  autoFillLineup() {
    return autoFillLineup(this);
  }

  toggleLineupPlayer(id) {
    return toggleLineupPlayer(this, id);
  }

  lineupSummary() {
    return lineupSummary(this);
  }

  getStartingXI() {
    return getStartingXI(this);
  }

  upgradeFacility(key) {
    return upgradeFacility(this, key);
  }

  claimSeasonGoal(key) {
    return claimSeasonGoal(this, key);
  }

  seasonGoalsSummary() {
    return seasonGoalsSummary(this);
  }

  ledgerSummary(limit) {
    return ledgerSummary(this, limit);
  }

  advanceTutorial() {
    if (!this.state) return;
    this.state.tutorial = this.state.tutorial || { step: 0, done: false };
    this.state.tutorial.step = (this.state.tutorial.step || 0) + 1;
    if (this.state.tutorial.step >= 4) this.state.tutorial.done = true;
    this.commit();
  }

  skipTutorial() {
    if (!this.state) return;
    this.state.tutorial = { step: 4, done: true };
    this.commit();
  }
}

/** Singleton usado pela UI */
export const game = new Game();
