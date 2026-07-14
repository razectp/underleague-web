/**
 * Simulação narrativa de partida (90' + acréscimos).
 *
 * Probabilidades calibradas para futebol real (médias aproximadas):
 * - ~2,4–2,9 gols/jogo no total
 * - ~3–4 amarelos/jogo
 * - ~0,15–0,35 vermelhos/jogo (muitos jogos SEM vermelho)
 * - ~0,20–0,35 pênaltis/jogo (maioria dos jogos SEM pênalti)
 * - lesão grave rara
 *
 * Regras oficiais no campo:
 * - 2º amarelo = vermelho
 * - Expulso sai; time joga com menos
 * - Até 5 substituições
 *
 * Segurança: resultado gerado uma vez (sealed na UI).
 */

import { rand, pick, chance, clamp } from "../core/utils.js";
import { playerDisplayName } from "../data/generators.js";

function push(events, ev) {
  events.push({
    id: `e_${events.length}_${ev.min}_${ev.kind}`,
    side: null,
    drama: false,
    soft: false,
    ...ev
  });
}

/** Amostra Poisson (Knuth) — contagens raras realistas */
export function poisson(lambda) {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= Math.random();
  } while (p > L && k < 40);
  return k - 1;
}

function createSide(name, xi, baseStr, key) {
  return {
    key,
    name,
    baseStr,
    players: xi.map((p) => ({ ...p, name: playerDisplayName(p) })),
    yellows: new Map(),
    sentOff: new Set(),
    onPitch: new Set(xi.map((p) => p.id)),
    injuredOff: new Set(),
    subsUsed: 0,
    maxSubs: 5,
    /** amarelos “simples” neste jogo (não 2º amarelo) para acúmulo de liga */
    matchYellowIds: []
  };
}

function onField(side) {
  return side.players.filter(
    (p) => side.onPitch.has(p.id) && !side.sentOff.has(p.id) && !side.injuredOff.has(p.id)
  );
}

function attackers(side) {
  const pool = onField(side).filter((p) =>
    ["ATA", "MEI", "PE", "PD", "VOL", "LAT"].includes(p.pos)
  );
  return pool.length ? pool : onField(side);
}

function defenders(side) {
  const pool = onField(side).filter((p) => ["ZAG", "VOL", "LAT", "GOL"].includes(p.pos));
  return pool.length ? pool : onField(side);
}

function keeper(side) {
  return onField(side).find((p) => p.pos === "GOL") || onField(side)[0] || null;
}

function fieldCount(side) {
  return onField(side).length;
}

function effStr(side) {
  const n = fieldCount(side);
  if (n <= 0) return side.baseStr * 0.35;
  return side.baseStr * (0.52 + 0.48 * (n / 11));
}

export function applyYellowCard(side, player, min, events) {
  if (!player || side.sentOff.has(player.id) || !side.onPitch.has(player.id)) {
    return "none";
  }
  const prev = side.yellows.get(player.id) || 0;
  const next = prev + 1;
  side.yellows.set(player.id, next);

  if (next === 1) {
    side.matchYellowIds.push(player.id);
    push(events, {
      min,
      kind: "yellow",
      side: side.key,
      playerId: player.id,
      text: `Cartão amarelo para ${player.name} (${side.name})`
    });
    return "yellow";
  }

  push(events, {
    min,
    kind: "second_yellow",
    side: side.key,
    drama: true,
    playerId: player.id,
    text: `Segundo amarelo! ${player.name} vê o vermelho`
  });
  sendOff(side, player, min, events, "second_yellow");
  return "second_yellow";
}

function sendOff(side, player, min, events, reason) {
  if (!player || side.sentOff.has(player.id)) return;
  side.sentOff.add(player.id);
  side.onPitch.delete(player.id);
  const left = fieldCount(side);
  if (reason === "direct_red") {
    push(events, {
      min,
      kind: "red",
      side: side.key,
      drama: true,
      playerId: player.id,
      text: `VERMELHO DIRETO! ${player.name} expulso · ${side.name} com ${left}`
    });
  } else if (reason === "second_yellow") {
    push(events, {
      min,
      kind: "red",
      side: side.key,
      drama: true,
      soft: true,
      playerId: player.id,
      text: `${side.name} fica com ${left} em campo`
    });
  } else {
    push(events, {
      min,
      kind: "red",
      side: side.key,
      drama: true,
      playerId: player.id,
      text: `${player.name} expulso · ${side.name} com ${left}`
    });
  }
}

function trySub(side, min, events, reason) {
  if (side.subsUsed >= side.maxSubs) return false;
  const outPool = onField(side).filter((p) => p.pos !== "GOL" || reason === "injury");
  if (outPool.length < 2) return false;
  const leaving =
    reason === "injury"
      ? outPool.find((p) => side.injuredOff.has(p.id)) || pick(outPool)
      : pick(outPool.filter((p) => p.pos !== "GOL"));
  if (!leaving) return false;

  // Banco real se existir; senão reserva genérica
  let incoming = null;
  if (Array.isArray(side.bench) && side.bench.length) {
    const idx = side.bench.findIndex((p) => !side.onPitch.has(p.id) && !side.sentOff.has(p.id));
    if (idx >= 0) {
      incoming = side.bench[idx];
      side.bench.splice(idx, 1);
    }
  }

  side.onPitch.delete(leaving.id);
  side.subsUsed += 1;
  if (incoming) {
    if (!side.players.some((p) => p.id === incoming.id)) side.players.push({ ...incoming });
    side.onPitch.add(incoming.id);
    push(events, {
      min,
      kind: "sub",
      side: side.key,
      outPlayerId: leaving.id,
      inPlayerId: incoming.id,
      text: `Substituição (${side.name}): sai ${leaving.name}, entra ${incoming.name}${
        reason === "injury" ? " · lesão" : ""
      }`
    });
  } else {
    const subName = `Reserva ${side.subsUsed}`;
    const subId = `${side.key}_sub_${side.subsUsed}`;
    side.players.push({
      id: subId,
      name: subName,
      pos: leaving.pos,
      overall: leaving.overall || 50
    });
    side.onPitch.add(subId);
    push(events, {
      min,
      kind: "sub",
      side: side.key,
      outPlayerId: leaving.id,
      inPlayerId: subId,
      text: `Substituição (${side.name}): sai ${leaving.name}, entra ${subName}${
        reason === "injury" ? " · lesão" : ""
      }`
    });
  }
  return true;
}

function placeMinutes(count, from, to, avoid = new Set()) {
  const mins = [];
  let guard = 0;
  while (mins.length < count && guard < 200) {
    guard += 1;
    const m = rand(from, to);
    if (avoid.has(m) && chance(70)) continue;
    mins.push(m);
    avoid.add(m);
  }
  return mins.sort((a, b) => a - b);
}

/**
 * Orçamento de eventos do jogo (inteligente / raro).
 * Lambdas ≈ médias de futebol profissional.
 */
export function rollMatchBudget(homeMentality, awayMentality) {
  const attackBias =
    (homeMentality === "ataque" ? 0.15 : 0) +
    (awayMentality === "ataque" ? 0.15 : 0) +
    (homeMentality === "defesa" ? -0.08 : 0) +
    (awayMentality === "defesa" ? -0.08 : 0);

  return {
    /** gols de bola rolando (sem pênalti/falta) */
    openGoals: poisson(clamp(2.35 + attackBias, 1.4, 3.4)),
    /** finalizações perigosas sem gol */
    bigChances: poisson(4.2),
    saves: poisson(3.5),
    woodwork: poisson(0.35),
    corners: poisson(9.5),
    cornerGoals: 0, // derivado
    yellows: poisson(3.4),
    /** vermelho direto (muito raro) */
    directReds: poisson(0.12),
    /** faltas “de cartão” extras sem amarelo */
    fouls: poisson(8),
    /** pênaltis (maioria dos jogos = 0) */
    penalties: poisson(0.28),
    handballs: poisson(0.35),
    offsides: poisson(3.2),
    freekickGoals: poisson(0.12),
    injuries: poisson(0.09),
    ownGoals: poisson(0.08),
    counters: poisson(2.5),
    /** narrativa de posse */
    buildUp: poisson(6)
  };
}

export function simulateMatchNarrative({
  homeName,
  awayName,
  homeXI,
  awayXI,
  homeStr,
  awayStr,
  homeMentality = "equilibrado",
  awayMentality = "equilibrado",
  homeBench = [],
  awayBench = []
}) {
  const events = [];
  const goalsById = {};
  const assistsById = {};
  const injuryMarks = [];

  const home = createSide(homeName, homeXI, homeStr, "home");
  const away = createSide(awayName, awayXI, awayStr, "away");
  home.bench = (homeBench || []).map((p) => ({ ...p, name: playerDisplayName(p) }));
  away.bench = (awayBench || []).map((p) => ({ ...p, name: playerDisplayName(p) }));
  const sides = { home, away };

  let hg = 0;
  let ag = 0;
  const stoppageFirst = rand(1, 3);
  const stoppageSecond = rand(2, 5);

  const budget = rollMatchBudget(homeMentality, awayMentality);
  // cantos que viram gol: ~8–12% dos escanteios, limitado
  budget.cornerGoals = Math.min(
    budget.corners,
    poisson(budget.corners * 0.09)
  );

  push(events, {
    min: 0,
    kind: "kickoff",
    drama: true,
    text: `Apito inicial · ${homeName} x ${awayName}`
  });

  const pickAttackingSide = () => {
    const h = effStr(home);
    const a = effStr(away);
    const homeShare = h / Math.max(1, h + a);
    return chance(homeShare * 100) ? home : away;
  };

  const addOpenGoal = (att, min, kind = "goal") => {
    const scorer = pick(attackers(att));
    if (!scorer) return;
    if (att.key === "home") hg += 1;
    else ag += 1;
    if (scorer.id && !String(scorer.id).includes("_sub_")) {
      goalsById[scorer.id] = (goalsById[scorer.id] || 0) + 1;
    }
    push(events, {
      min,
      kind,
      side: att.key,
      drama: true,
      playerId: scorer.id,
      text:
        kind === "freekick_goal"
          ? `GOL de falta! ${scorer.name} (${att.name})`
          : `GOL! ${scorer.name} (${att.name})`,
      scorer: scorer.name,
      club: att.name
    });
    const helpers = attackers(att).filter((p) => p.id !== scorer.id);
    if (helpers.length && chance(55) && kind === "goal") {
      const helper = pick(helpers);
      if (helper.id && !String(helper.id).includes("_sub_")) {
        assistsById[helper.id] = (assistsById[helper.id] || 0) + 1;
      }
      push(events, {
        min,
        kind: "assist",
        side: att.key,
        soft: true,
        text: `Assistência: ${helper.name}`
      });
    }
  };

  const schedule = [];

  const addScheduled = (type, count, from = 1, to = 90) => {
    placeMinutes(count, from, to).forEach((min) => schedule.push({ min, type }));
  };

  addScheduled("open_goal", budget.openGoals, 4, 90);
  addScheduled("big_chance", budget.bigChances, 3, 90);
  addScheduled("save", budget.saves, 5, 90);
  addScheduled("woodwork", budget.woodwork, 10, 88);
  addScheduled("corner", budget.corners, 5, 90);
  addScheduled("corner_goal", budget.cornerGoals, 8, 90);
  addScheduled("yellow", budget.yellows, 6, 90);
  addScheduled("direct_red", budget.directReds, 15, 88);
  addScheduled("foul", budget.fouls, 4, 90);
  addScheduled("penalty", budget.penalties, 12, 88);
  addScheduled("handball", budget.handballs, 10, 85);
  addScheduled("offside", budget.offsides, 5, 90);
  addScheduled("freekick_goal", budget.freekickGoals, 20, 85);
  addScheduled("injury", budget.injuries, 12, 85);
  addScheduled("own_goal", budget.ownGoals, 15, 85);
  addScheduled("counter", budget.counters, 20, 90);
  addScheduled("build", budget.buildUp, 3, 88);
  // substituições táticas típicas 55–80
  addScheduled("sub", poisson(3.2), 55, 82);

  schedule.sort((a, b) => a.min - b.min || a.type.localeCompare(b.type));

  const takePenalty = (att, def, min, reason) => {
    push(events, {
      min,
      kind: "penalty",
      side: att.key,
      drama: true,
      text: `Pênalti para ${att.name}!${reason ? ` (${reason})` : ""}`
    });
    if (chance(15)) {
      push(events, { min, kind: "var", drama: true, text: "VAR analisa o lance…" });
      if (chance(15)) {
        push(events, { min, kind: "var", text: "VAR anula o pênalti" });
        return;
      }
      push(events, { min, kind: "var", text: "VAR confirma o pênalti" });
    }
    const taker = pick(attackers(att));
    const gk = keeper(def);
    if (chance(74)) {
      if (att.key === "home") hg += 1;
      else ag += 1;
      if (taker?.id && !String(taker.id).includes("_sub_")) {
        goalsById[taker.id] = (goalsById[taker.id] || 0) + 1;
      }
      push(events, {
        min,
        kind: "penalty_goal",
        side: att.key,
        drama: true,
        playerId: taker?.id,
        text: `Gol de pênalti! ${taker?.name || "Batedor"}`
      });
    } else if (chance(55)) {
      push(events, {
        min,
        kind: "penalty_save",
        side: def.key,
        drama: true,
        text: `Defesaça de ${gk?.name || "goleiro"}!`
      });
    } else {
      push(events, {
        min,
        kind: "penalty_miss",
        side: att.key,
        drama: true,
        text: `${taker?.name || "Batedor"} desperdiça!`
      });
    }
  };

  for (const item of schedule) {
    const min = item.min;
    const att = pickAttackingSide();
    const def = att.key === "home" ? away : home;
    if (fieldCount(att) === 0 || fieldCount(def) === 0) continue;

    switch (item.type) {
      case "open_goal":
        addOpenGoal(att, min);
        break;
      case "big_chance": {
        const sh = pick(attackers(att));
        push(events, {
          min,
          kind: "chance",
          side: att.key,
          text: `Grande chance de ${sh?.name || "atacante"} — desperdiçada`
        });
        break;
      }
      case "save": {
        const sh = pick(attackers(att));
        const gk = keeper(def);
        push(events, {
          min,
          kind: "save",
          side: def.key,
          text: `${gk?.name || "Goleiro"} defende de ${sh?.name || "atacante"}`
        });
        break;
      }
      case "woodwork": {
        const sh = pick(attackers(att));
        push(events, {
          min,
          kind: "woodwork",
          side: att.key,
          drama: true,
          text: `NA TRAVE! ${sh?.name || "Atacante"}`
        });
        break;
      }
      case "corner":
        push(events, {
          min,
          kind: "corner",
          side: att.key,
          text: `Escanteio para ${att.name}`
        });
        break;
      case "corner_goal":
        push(events, {
          min,
          kind: "corner",
          side: att.key,
          text: `Escanteio perigoso · ${att.name}`
        });
        addOpenGoal(att, min);
        break;
      case "yellow": {
        const fouler = pick(defenders(def));
        const victim = pick(attackers(att));
        if (!fouler) break;
        push(events, {
          min,
          kind: "foul",
          side: def.key,
          playerId: fouler.id,
          text: `Falta de ${fouler.name}${victim ? ` em ${victim.name}` : ""}`
        });
        applyYellowCard(def, fouler, min, events);
        break;
      }
      case "direct_red": {
        const fouler = pick(defenders(def));
        if (!fouler || def.sentOff.has(fouler.id)) break;
        push(events, {
          min,
          kind: "foul",
          side: def.key,
          drama: true,
          text: `Entrada dura de ${fouler.name}!`
        });
        sendOff(def, fouler, min, events, "direct_red");
        if (chance(35)) takePenalty(att, def, min, "derrubada na área");
        break;
      }
      case "foul": {
        const fouler = pick(defenders(def));
        const victim = pick(attackers(att));
        if (!fouler) break;
        push(events, {
          min,
          kind: "foul",
          side: def.key,
          text: `Falta de ${fouler.name}${victim ? ` em ${victim.name}` : ""}`
        });
        // ~25% das faltas “mostradas” viram amarelo (já temos yellows orçados à parte)
        if (chance(12)) applyYellowCard(def, fouler, min, events);
        break;
      }
      case "penalty":
        takePenalty(att, def, min, "falta na área");
        break;
      case "handball": {
        const culprit = pick(defenders(def).filter((p) => p.pos !== "GOL"));
        if (!culprit) break;
        push(events, {
          min,
          kind: "handball",
          side: def.key,
          text: `Mão de ${culprit.name}`
        });
        if (chance(40)) applyYellowCard(def, culprit, min, events);
        if (chance(50)) takePenalty(att, def, min, "mão na área");
        break;
      }
      case "offside": {
        const off = pick(attackers(att));
        push(events, {
          min,
          kind: "offside",
          side: att.key,
          text: `Impedimento de ${off?.name || "atacante"}`
        });
        break;
      }
      case "freekick_goal": {
        push(events, {
          min,
          kind: "freekick",
          side: att.key,
          text: `Falta perigosa para ${att.name}`
        });
        addOpenGoal(att, min, "freekick_goal");
        break;
      }
      case "injury": {
        const pool = onField(home).concat(onField(away));
        const vic = pick(pool);
        if (!vic) break;
        const vicSide = onField(home).some((p) => p.id === vic.id) ? home : away;
        if (vicSide.sentOff.has(vic.id)) break;
        injuryMarks.push({
          playerId: vic.id,
          name: vic.name,
          clubName: vicSide.name,
          min
        });
        push(events, {
          min,
          kind: "injury",
          side: vicSide.key,
          drama: true,
          playerId: vic.id,
          text: `Lesão: ${vic.name} (${vicSide.name})`
        });
        if (vicSide.subsUsed < vicSide.maxSubs && chance(70)) {
          vicSide.injuredOff.add(vic.id);
          trySub(vicSide, min, events, "injury");
        } else if (chance(35)) {
          vicSide.injuredOff.add(vic.id);
          vicSide.onPitch.delete(vic.id);
          push(events, {
            min,
            kind: "injury",
            soft: true,
            text: `${vic.name} não continua`
          });
        }
        break;
      }
      case "own_goal": {
        const og = pick(defenders(def));
        if (!og) break;
        if (def.key === "home") ag += 1;
        else hg += 1;
        push(events, {
          min,
          kind: "own_goal",
          side: def.key,
          drama: true,
          playerId: og.id,
          text: `GOL CONTRA! ${og.name}`
        });
        break;
      }
      case "counter":
        push(events, {
          min,
          kind: "counter",
          side: att.key,
          text: `Contra-ataque de ${att.name}`
        });
        if (chance(22)) addOpenGoal(att, min);
        break;
      case "build":
        push(events, {
          min,
          kind: "play",
          side: att.key,
          text: chance(50)
            ? `${att.name} troca passes no meio`
            : `${def.name} compacta as linhas`
        });
        break;
      case "sub":
        trySub(chance(50) ? home : away, min, events, "tactical");
        break;
      default:
        break;
    }
  }

  // Acréscimos: só se orçamento ainda permite um lance raro
  if (chance(35)) {
    const att = pickAttackingSide();
    push(events, {
      min: 45,
      kind: "chance",
      side: att.key,
      text: `Acréscimos do 1º tempo (+${stoppageFirst}') · pressão de ${att.name}`
    });
  }

  push(events, {
    min: 45,
    kind: "half",
    drama: true,
    text: `Intervalo · ${homeName} ${hg}–${ag} ${awayName}`
  });

  if (chance(40)) {
    const att = pickAttackingSide();
    push(events, {
      min: 90,
      kind: "chance",
      side: att.key,
      text: `Acréscimos finais (+${stoppageSecond}') · ${att.name} busca o lance`
    });
    if (chance(12)) addOpenGoal(att, 90);
  }

  push(events, {
    min: 90,
    kind: "fulltime",
    drama: true,
    text: `Fim de jogo · ${homeName} ${hg}–${ag} ${awayName}`
  });

  // Integridade cartões
  for (const side of [home, away]) {
    side.yellows.forEach((count, pid) => {
      if (count >= 2 && !side.sentOff.has(pid)) {
        const p = side.players.find((x) => x.id === pid);
        if (p) sendOff(side, p, 90, events, "second_yellow");
      }
    });
  }

  events.sort((a, b) => {
    if (a.min !== b.min) return a.min - b.min;
    return (a.soft ? 1 : 0) - (b.soft ? 1 : 0);
  });

  const sentOffIds = [...home.sentOff, ...away.sentOff].filter(
    (id) => !String(id).includes("_sub_")
  );
  const yellowIds = [...home.matchYellowIds, ...away.matchYellowIds].filter(
    (id) => !sentOffIds.includes(id) && !String(id).includes("_sub_")
  );

  return {
    hg,
    ag,
    events,
    goalsById,
    assistsById,
    injuryMarks,
    discipline: { sentOffIds, yellowIds },
    budget,
    stats: {
      homeMen: fieldCount(home),
      awayMen: fieldCount(away),
      homeReds: home.sentOff.size,
      awayReds: away.sentOff.size,
      totalYellows: home.matchYellowIds.length + away.matchYellowIds.length,
      penalties: budget.penalties,
      openGoals: budget.openGoals
    }
  };
}

export function buildLiveSnapshot({
  mode,
  home,
  away,
  hg,
  ag,
  events,
  subtitle = "",
  footer = ""
}) {
  return {
    sessionId: `live_${Date.now()}_${rand(1000, 9999)}`,
    mode,
    home,
    away,
    finalHome: hg,
    finalAway: ag,
    events: (events || []).map((e) => ({ ...e })),
    subtitle,
    footer,
    baseDurationMs: 120_000,
    createdAt: Date.now(),
    sealed: true
  };
}
