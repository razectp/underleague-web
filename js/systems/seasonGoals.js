/**
 * Metas de temporada — objetivos de longo prazo.
 */

export function ensureSeasonGoals(state) {
  if (!state.seasonGoals || state.seasonGoals.season !== state.season) {
    state.seasonGoals = {
      season: state.season,
      targets: {
        points: 20,
        wins: 6,
        topHalf: true,
        cleanSheets: 3
      },
      progress: {
        points: 0,
        wins: 0,
        cleanSheets: 0,
        rank: null
      },
      claimed: {
        points: false,
        wins: false,
        topHalf: false,
        cleanSheets: false
      }
    };
  }
  return state.seasonGoals;
}

export function syncSeasonGoalsFromClub(state) {
  const g = ensureSeasonGoals(state);
  const c = state.club;
  g.progress.points = c.points || 0;
  g.progress.wins = c.wins || 0;
  g.progress.cleanSheets = c.cleanSheets || 0;
  return g;
}

export function claimSeasonGoal(game, key) {
  const g = syncSeasonGoalsFromClub(game.state);
  // No modo autoritativo cada clique é processado por uma nova instância do
  // jogo. Portanto o rank não pode depender do efeito colateral do render da
  // tela no cliente: recalcule-o no momento do resgate.
  if (key === "topHalf" && typeof game.leagueTable === "function") {
    const me = game.leagueTable().find((row) => row.you);
    if (me) g.progress.rank = me.rank;
  }
  if (g.claimed[key]) return { ok: false, msg: "Já resgatada." };

  let ok = false;
  let prize = 0;
  if (key === "points" && g.progress.points >= g.targets.points) {
    ok = true;
    prize = 1200;
  } else if (key === "wins" && g.progress.wins >= g.targets.wins) {
    ok = true;
    prize = 1500;
  } else if (key === "cleanSheets" && g.progress.cleanSheets >= g.targets.cleanSheets) {
    ok = true;
    prize = 900;
  } else if (key === "topHalf") {
    const rank = g.progress.rank;
    if (rank && rank <= 4) {
      ok = true;
      prize = 2000;
    }
  }

  if (!ok) return { ok: false, msg: "Meta ainda não cumprida." };
  g.claimed[key] = true;
  game.state.club.bank += prize;
  game.state.boss.rep += 3;
  game.notify(`Meta de temporada: ${key} · +R$ ${prize}`, "info");
  game.commit();
  return { ok: true, prize };
}

export function seasonGoalsSummary(game) {
  const g = syncSeasonGoalsFromClub(game.state);
  const table = typeof game.leagueTable === "function" ? game.leagueTable() : [];
  const me = table.find((r) => r.you);
  if (me) g.progress.rank = me.rank;
  return g;
}
