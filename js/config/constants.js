/**
 * Constantes de regras e conteúdo estático do jogo.
 * Altere números de balanceamento e catálogos aqui.
 */

export const VERSION = 6;

/** O mundo avança 24 horas de jogo a cada 5 horas reais do servidor. */
export const REAL_MS_PER_GAME_DAY = 5 * 60 * 60 * 1000;
export const REAL_MS_PER_GAME_HOUR = REAL_MS_PER_GAME_DAY / 24;

/** Taxa de marketplace (3%) — receita futura da plataforma */
export const MARKET_FEE_RATE = 0.03;

/**
 * Progressão de skills com curva “fácil no começo, pesada no fim”.
 * Cada treino dá XP parcial; só sobe +1 quando enche a barra.
 * Early game recompensa rápido (vício); endgame exige consistência.
 */
export const SKILL_PROGRESS = {
  /** XP base por sessão de treino do dirigente (antes dos modificadores) */
  sessionXpMin: 28,
  sessionXpMax: 44,
  /** Cooldowns curtos no early = mais cliques viciantes por sessão */
  bossTrainCooldownH: 3,
  squadTrainCooldownH: 3,
  /** XP de treino individual de elenco */
  squadXpMin: 18,
  squadXpMax: 34,
  /** Chance de o elenco “roubar” XP de atributo via liderança (não +1 full) */
  leadershipSquadXpChance: 40,
  leadershipSquadXp: [8, 16]
};

/** XP necessário para subir de `level` → `level+1` (level = valor atual da skill) */
export function xpNeededForLevel(level) {
  const L = Math.max(1, Math.min(99, level));
  // ~80 no início (1–3 sessões), ~350 em 40, ~900+ em 70
  return Math.floor(50 + L * 8 + Math.pow(Math.max(0, L - 20), 1.55) * 5 + Math.pow(Math.max(0, L - 50), 1.8) * 10);
}

export const SQUAD_MIN = 14;
export const SQUAD_MAX = 28;
export const MATCH_ENERGY_COST = 18;
export const CIRCUIT_ENERGY_COST = 12;
export const INFLUENCE_ENERGY = 18;
export const INFLUENCE_MONEY = 150;

export const POSITIONS = ["GOL", "ZAG", "LAT", "VOL", "MEI", "PE", "PD", "ATA"];

/** Linha no campo (0 = gol … 3 = ataque) */
export const POS_LINE = {
  GOL: 0,
  ZAG: 1,
  LAT: 1,
  VOL: 2,
  MEI: 2,
  PE: 3,
  PD: 3,
  ATA: 3
};

export const PRACAS = [
  { id: "centro", name: "Centro", bonus: "prestígio + scouting", desc: "Coração da cidade. Prestígio alto, olheiros de elite." },
  { id: "znorte", name: "Zona Norte", bonus: "jovens baratos", desc: "Base fértil. Talentos baratos, disputa acirrada." },
  { id: "zsul", name: "Zona Sul", bonus: "torcida + receita", desc: "Torcida barulhenta e comércio local muito ativo." },
  { id: "litoral", name: "Litoral", bonus: "condicionamento", desc: "Treinos à beira-mar. Recuperação melhor." },
  { id: "interior", name: "Interior", bonus: "salários baixos", desc: "Custo de vida baixo. Folha mais leve." },
  { id: "serra", name: "Serra", bonus: "defesa + físico", desc: "Altitude e raça. Zagueiros de ferro." },
  { id: "porto", name: "Porto", bonus: "mercado internacional", desc: "Porta de entrada de estrangeiros no mercado." },
  { id: "periferia", name: "Periferia", bonus: "racha + moral", desc: "Rachas de rua. Moral e fome de bola." }
];

export const INJURY_TYPES = [
  { id: "contusao", name: "Contusão muscular", min: 1, max: 3, severity: 1 },
  { id: "entorse", name: "Entorse", min: 2, max: 5, severity: 2 },
  { id: "distensao", name: "Distensão", min: 3, max: 7, severity: 2 },
  { id: "lesao_joelho", name: "Joelho inchado", min: 5, max: 12, severity: 3 },
  { id: "fratura_leve", name: "Fratura por estresse", min: 8, max: 16, severity: 4 },
  { id: "fadiga", name: "Fadiga extrema", min: 1, max: 2, severity: 1 }
];

export const TRAININGS = [
  { id: "tatica", stat: "tatica", name: "Estudo tático", desc: "Quadro, vídeos e padrões de jogo com o elenco.", costE: 14, costM: 50, rep: 1 },
  { id: "scouting", stat: "scouting", name: "Olheiro de campo", desc: "Assistir bases e jogos amadores da região.", costE: 12, costM: 70, rep: 1 },
  { id: "negocio", stat: "negocio", name: "Negociação dura", desc: "Mesa com empresários, tabelas e contrapropostas.", costE: 12, costM: 60, rep: 0 },
  { id: "lideranca", stat: "lideranca", name: "Liderança de vestiário", desc: "Reuniões, discurso e leitura do grupo.", costE: 12, costM: 40, rep: 2 },
  { id: "condicionamento", stat: "condicionamento", name: "Condicionamento físico", desc: "Corrida e força. Cansa, mas endurece o corpo.", costE: 16, costM: 35, rep: 0 }
];

export const BOSS_STAT_KEYS = ["tatica", "scouting", "negocio", "lideranca", "condicionamento"];
export const PLAYER_ATTR_KEYS = ["pace", "shoot", "pass", "defend", "physical"];

export const OPERATIONS = [
  { id: "scout_local", name: "Scouting de base", desc: "Vasculhar escolinhas da região em busca de jovens.", risk: "baixo", costE: 20, costM: 200, minScout: 5 },
  { id: "scout_rival", name: "Espiar rival", desc: "Observar treino do adversário. Risco de boato.", risk: "médio", costE: 25, costM: 350, minScout: 15 },
  { id: "market_flip", name: "Virada de mesa", desc: "Forçar desconto em um alvo do mercado.", risk: "médio", costE: 18, costM: 150, minNeg: 12 },
  { id: "torcida", name: "Aproximar a torcida", desc: "Ações comunitárias e presença no bairro. Prestígio.", risk: "baixo", costE: 15, costM: 100, minLead: 8 },
  { id: "hostile", name: "Proposta hostil", desc: "Tentar arrancar um nome de outro clube NPC.", risk: "alto", costE: 30, costM: 800, minNeg: 25 },
  { id: "night_racha", name: "Racha noturno", desc: "Partida informal. Dinheiro e moral, risco de lesão.", risk: "médio", costE: 28, costM: 0, minCond: 10 }
];

export const FORMATIONS = {
  "4-3-3": { GOL: 1, ZAG: 2, LAT: 2, VOL: 1, MEI: 2, PE: 1, PD: 1, ATA: 1 },
  "4-4-2": { GOL: 1, ZAG: 2, LAT: 2, VOL: 2, MEI: 2, ATA: 2, PE: 0, PD: 0 },
  "3-5-2": { GOL: 1, ZAG: 3, LAT: 0, VOL: 2, MEI: 3, ATA: 2, PE: 0, PD: 0 },
  "4-2-3-1": { GOL: 1, ZAG: 2, LAT: 2, VOL: 2, MEI: 3, ATA: 1, PE: 0, PD: 0 }
};

/**
 * Rivais permanentes do modo PvE. A identidade e a ordem nunca mudam;
 * cada volta é calibrada contra a força atual do jogador.
 */
export const STANDARD_OPPONENTS = [
  {
    id: "campinho",
    name: "Molecada do Campinho",
    targetOverall: 40,
    formation: "4-3-3",
    mentality: "ataque",
    approach: "direto",
    label: "Iniciante",
    desc: "Joga sem medo, mas deixa muitos espaços.",
    lesson: "Aprenda a escalar o XI e controlar a energia.",
    reward: 500
  },
  {
    id: "uniao_bairro",
    name: "União do Bairro",
    targetOverall: 48,
    formation: "4-4-2",
    mentality: "equilibrado",
    approach: "direto",
    label: "Fácil",
    desc: "Duas linhas organizadas e muita bola longa.",
    lesson: "Forma e stamina fazem diferença.",
    reward: 700
  },
  {
    id: "muralha_vila",
    name: "Muralha da Vila",
    targetOverall: 55,
    formation: "4-2-3-1",
    mentality: "defesa",
    approach: "contra_ataque",
    label: "Moderado",
    desc: "Fecha a área e pune quem se lança sem pensar.",
    lesson: "Use posse ou amplitude contra bloco baixo.",
    reward: 950
  },
  {
    id: "ferroviario",
    name: "Ferroviário Atlético",
    targetOverall: 60,
    formation: "3-5-2",
    mentality: "equilibrado",
    approach: "pressao",
    label: "Competitivo",
    desc: "Time físico que pressiona até o último minuto.",
    lesson: "Rode o elenco e explore a pressão adversária.",
    reward: 1250
  },
  {
    id: "academia_central",
    name: "Academia Central",
    targetOverall: 65,
    formation: "4-2-3-1",
    mentality: "equilibrado",
    approach: "posse",
    label: "Difícil",
    desc: "Controla o meio e raramente entrega a bola.",
    lesson: "Escolha um estilo que combata a posse.",
    reward: 1600
  },
  {
    id: "litoral_veloz",
    name: "Litoral Veloz",
    targetOverall: 70,
    formation: "4-3-3",
    mentality: "ataque",
    approach: "pressao",
    label: "Elite",
    desc: "Pontas velozes, pressão alta e muitos gols.",
    lesson: "Proteja os lados e ataque o espaço nas costas.",
    reward: 2100
  },
  {
    id: "porto_imperial",
    name: "Porto Imperial",
    targetOverall: 76,
    formation: "3-5-2",
    mentality: "equilibrado",
    approach: "posse",
    label: "Chefe",
    desc: "Elenco caro, banco forte e nenhuma fraqueza óbvia.",
    lesson: "Prove que seu projeto está pronto para a próxima volta.",
    reward: 3000
  }
];

export const APPROACHES = {
  posse: { label: "Posse", desc: "Controla o jogo; supera futebol direto." },
  direto: { label: "Jogo direto", desc: "Vertical e rápido; quebra contra-ataques." },
  contra_ataque: { label: "Contra-ataque", desc: "Cede a bola; pune pressão alta." },
  pressao: { label: "Pressão alta", desc: "Rouba no campo rival; sufoca posse lenta." }
};

/** Regras rotativas dão identidade e objetivos diferentes a cada temporada. */
export const SEASON_THEMES = [
  { id: "classica", name: "Temporada Clássica", desc: "Sem modificadores: vença pelo futebol." },
  { id: "base", name: "Geração de Ouro", desc: "+R$ 500 por jogo usando ao menos 3 atletas de até 21 anos.", youthBonus: 500 },
  { id: "gols", name: "Festival de Gols", desc: "+R$ 120 por gol marcado na liga.", goalBonus: 120 },
  { id: "muralha", name: "Ano das Defesas", desc: "+R$ 450 por partida sem sofrer gols.", cleanSheetBonus: 450 },
  { id: "azarao", name: "Queda dos Gigantes", desc: "+R$ 600 ao pontuar contra um time mais forte.", underdogBonus: 600 }
];

/** Filosofia do técnico (afeta stats iniciais) */
export const STYLES = {
  equilibrio: { tatica: 14, scouting: 12, negocio: 12, lideranca: 12, condicionamento: 14 },
  ataque: { tatica: 16, scouting: 10, negocio: 10, lideranca: 12, condicionamento: 16 },
  defesa: { tatica: 16, scouting: 12, negocio: 10, lideranca: 14, condicionamento: 14 },
  negocio: { tatica: 10, scouting: 16, negocio: 18, lideranca: 10, condicionamento: 10 }
};

/**
 * Tipo de projeto do jogador:
 * cada pessoa funda SEU time e cresce até competir com outros clubes.
 */
export const CLUB_TYPES = {
  escolinha: {
    id: "escolinha",
    label: "Escolinha de futebol",
    blurb: "Base e formação. Jovens baratos, foco em treino e tempo.",
    startBank: 8000,
    squadQuality: 3,
    youthBias: true
  },
  bairro: {
    id: "bairro",
    label: "Time de bairro / amador",
    blurb: "Racha sério do bairro. Equilíbrio entre raça e grana.",
    startBank: 10000,
    squadQuality: 3,
    youthBias: false
  },
  clube: {
    id: "clube",
    label: "Clube em construção",
    blurb: "Estrutura um pouco maior. Quer subir e disputar títulos.",
    startBank: 13000,
    squadQuality: 4,
    youthBias: false
  }
};

export const REST_OPTIONS = {
  short: { h: 2, e: 36, heal: 6, cost: 0, label: "Soneca" },
  long: { h: 6, e: 80, heal: 14, cost: 30, label: "Noite de sono" },
  spa: { h: 4, e: 65, heal: 24, cost: 150, label: "Spa / recuperação" }
};
