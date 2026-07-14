/**
 * Registro de telas — adicione novas views aqui.
 * Cada view: (game, state) => htmlString
 */

import { viewHome } from "./home.js";
import { viewStatus } from "./status.js";
import { viewTrain, viewRest, viewOps } from "./actions.js";
import { viewSquad, viewTactics, viewMatch, viewMarket } from "./football.js";
import { viewClub, viewMap, viewLeague, viewHospital, viewLog } from "./world.js";
import { viewMissions } from "./missions.js";
import { viewOnline } from "./online.js";
import { viewRankings } from "./rankings.js";
import { viewCircuit } from "./circuit.js";
import { viewCompete } from "./compete.js";
import {
  viewLineup,
  viewPrematch,
  viewPostMatch,
  viewFinance,
  viewCalendar
} from "./coach.js";

export const VIEWS = {
  home: viewHome,
  status: viewStatus,
  train: viewTrain,
  rest: viewRest,
  ops: (game) => viewOps(game),
  missions: (game) => viewMissions(game),
  /** @deprecated use compete + aba arena */
  online: (game, s) =>
    viewOnline(game, s, (typeof window !== "undefined" && window.__UL_ONLINE_CACHE) || null),
  rankings: (game, s) =>
    viewRankings(game, s, (typeof window !== "undefined" && window.__UL_RANK_UI) || null),
  squad: viewSquad,
  lineup: viewLineup,
  prematch: viewPrematch,
  postmatch: viewPostMatch,
  finance: viewFinance,
  calendar: viewCalendar,
  tactics: viewTactics,
  match: viewMatch,
  circuit: viewCircuit,
  compete: viewCompete,
  market: viewMarket,
  club: viewClub,
  map: (game) => viewMap(game),
  league: viewLeague,
  hospital: viewHospital,
  log: viewLog
};
