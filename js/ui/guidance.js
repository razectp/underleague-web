/**
 * Orientação do jogador: próxima ação, glossário e dicas legíveis.
 * Foco em clareza — não em facilitar a vitória.
 */

import { APPROACHES, CIRCUIT_ENERGY_COST, MATCH_ENERGY_COST } from "../config/constants.js";
import { missionDestination } from "../systems/missions.js";

/** Glossário curto (hover / primeira leitura) */
export const GLOSSARY = {
  energy: "Energia: gasta em treinos, jogos e operações. Recupera com descanso e com o relógio do clube.",
  money: "Seu bolso: dinheiro pessoal do dirigente. Missões e alguns treinos usam isto.",
  clubBank: "Caixa do clube: salários, mercado e prêmios de jogo entram aqui.",
  rep: "Prestígio: fama do projeto. Sobe com vitórias e missões.",
  health: "Disposição: se cair demais, ações ficam bloqueadas. Descanse ou vá ao médico.",
  ovr: "OVR: força geral do jogador. Quanto maior, melhor no XI.",
  day: "Dia de jogo do clube. O tempo do jogo corre sozinho: 1 dia ≈ 5 horas reais. A liga permite 1 partida oficial por dia de jogo."
};

/**
 * Decide a melhor próxima ação para o jogador (prioridade legível).
 * @returns {{ id: string, title: string, why: string, view?: string, tab?: string, actionable?: boolean, primary?: boolean }}
 */
export function suggestNextAction(game) {
  const s = game.state;
  if (!s) {
    return {
      id: "boot",
      title: "Fundar ou entrar no clube",
      why: "Comece uma campanha para jogar.",
      view: "home"
    };
  }

  const missions = game.missionsSummary();
  const claimable = missions.items.find((m) => !m.claimed && m.progress >= m.target);
  if (claimable) {
    return {
      id: "claim",
      title: "Resgatar missão pronta",
      why: `${claimable.label} · recompensa esperando.`,
      view: "missions",
      primary: true
    };
  }

  const lowEnergy = s.boss.energy < 20;
  if (lowEnergy || (s.boss.health < 35 && !s.boss.injury)) {
    return {
      id: "rest",
      title: "Descansar e recuperar",
      why: lowEnergy
        ? "Energia baixa — sem ⚡ você não treina nem joga."
        : "Disposição crítica — recupere antes de forçar o elenco.",
      view: "rest",
      primary: true
    };
  }

  if (s.boss.injury || s.squad.some((p) => p.injury)) {
    return {
      id: "hospital",
      title: "Cuidar das lesões",
      why: s.boss.injury
        ? `Você está indisposto: ${s.boss.injury.name}.`
        : "Há jogadores lesionados no elenco.",
      view: "hospital",
      primary: true
    };
  }

  const canMatch = s.boss.lastMatchDay !== s.day && s.boss.energy >= MATCH_ENERGY_COST;
  const next = game.getNextFixture();
  if (canMatch && next) {
    const f = next.fixture;
    const oppId = f.home === s.club.id ? f.away : f.home;
    const opp = game.getClub(oppId);
    const planHint = opp?.ai?.plan
      ? ` · rival em ${opp.ai.plan.formation}/${opp.ai.plan.mentality}`
      : "";
    return {
      id: "match",
      title: "Jogar a rodada da liga",
      why: `vs ${opp?.name || "adversário"} · ⚡${MATCH_ENERGY_COST} · 1 partida por dia do clube${planHint}.`,
      view: "compete",
      tab: "liga",
      primary: true
    };
  }
  if (s.boss.lastMatchDay === s.day && next) {
    return {
      id: "wait-day",
      title: "Aguarde o próximo dia",
      why: "Você já jogou a liga neste dia de jogo. Quando o dia do clube virar (≈ 5 h reais), libera a próxima rodada e as comissões rivais também avançam.",
      actionable: false,
      primary: false
    };
  }

  const circuit = game.circuitStatus();
  const rival =
    circuit.rivals.find((r) => r.unlocked && !(r.record.wins > 0)) ||
    circuit.rivals.find((r) => r.unlocked);
  if (rival && game.cooldownLeft("circuit") === 0 && s.boss.energy >= CIRCUIT_ENERGY_COST) {
    return {
      id: "circuit",
      title: `Circuito: ${rival.rival.name}`,
      why: `${rival.def?.label || "Desafio"} · ⚡${CIRCUIT_ENERGY_COST} · treino competitivo.`,
      view: "compete",
      tab: "circuito",
      primary: true
    };
  }

  const openMission = missions.items.find((m) => !m.claimed && m.progress < m.target);
  if (openMission) {
    const dest = missionDestination(openMission.type);
    return {
      id: "mission",
      title: openMission.label,
      why: `${openMission.blurb || "Tarefa do dia"} · ${dest.label}.`,
      view: dest.view,
      tab: dest.competeTab,
      primary: true
    };
  }

  if (s.boss.energy >= 12) {
    return {
      id: "train",
      title: "Treinar o time",
      why: "Evolui o técnico e o elenco entre as partidas.",
      view: "train",
      primary: true
    };
  }

  return {
    id: "wait",
    title: "Descansar e recuperar",
    why: "Sem energia ou com atividades em recuperação — descanse ou volte mais tarde.",
    view: "rest",
    primary: false
  };
}

/** Textos humanos para mentalidade */
export const MENTALITY_UI = {
  defesa: {
    label: "Fecha a defesa",
    plain: "Joga seguro, cede um pouco o ataque."
  },
  equilibrado: {
    label: "Equilibrado",
    plain: "Nem recua demais, nem se lança sem freio."
  },
  ataque: {
    label: "Empurra o ataque",
    plain: "Busca gols; deixa mais espaços atrás."
  }
};

/** Dica tática em português simples contra um rival */
export function plainTacticalTip(mine, theirs) {
  if (!theirs) return "Escolha formação e estilo; o XI entra automático.";

  const approachBeats = {
    posse: "direto",
    direto: "contra_ataque",
    contra_ataque: "pressao",
    pressao: "posse"
  };
  const counter = {
    posse: "pressao",
    direto: "posse",
    contra_ataque: "direto",
    pressao: "contra_ataque"
  };

  const theirApp = theirs.approach;
  const myApp = mine.approach;
  const theirLabel = APPROACHES[theirApp]?.label || theirApp;
  const tips = [];

  if (approachBeats[myApp] === theirApp) {
    tips.push(`Seu estilo (${APPROACHES[myApp]?.label}) encaixa bem contra o deles (${theirLabel}).`);
  } else if (approachBeats[theirApp] === myApp) {
    const better = counter[theirApp];
    tips.push(
      `Eles jogam de ${theirLabel}. Tente mudar para ${APPROACHES[better]?.label || better}.`
    );
  } else {
    tips.push(`Rival usa ${theirLabel}. Teste o estilo que “quebra” o plano deles.`);
  }

  if (theirs.mentality === "ataque" && mine.mentality !== "defesa") {
    tips.push("Eles atacam muito — “Fecha a defesa” pode frear o jogo.");
  } else if (theirs.mentality === "defesa" && mine.mentality === "ataque") {
    tips.push("Bloco baixo: ataque puro pode se expor no contra-golpe.");
  }

  return tips.join(" ");
}

function competeStore() {
  if (typeof globalThis !== "undefined") return globalThis;
  return {};
}

export function getCompeteTab() {
  return competeStore().__UL_COMPETE_TAB || "liga";
}

export function setCompeteTab(tab) {
  competeStore().__UL_COMPETE_TAB = tab;
}

/** Views antigas redirecionam para Competir com aba certa */
export const COMPETE_VIEW_ALIASES = {
  match: "liga",
  league: "liga",
  circuit: "circuito",
  online: "arena"
};
