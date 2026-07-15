/**
 * Reações narrativas pós-partida e “jornal da rodada”.
 * Frases variadas a partir de métricas (placar, cartões, gols, goleada…).
 * Só texto — não altera economia.
 */

import { pick, rand } from "../core/utils.js";

function countKinds(events, kinds) {
  const set = new Set(Array.isArray(kinds) ? kinds : [kinds]);
  return (events || []).filter((e) => set.has(e.kind)).length;
}

/**
 * Extrai métricas legíveis da simulação selada.
 */
export function summarizeMatchMetrics({
  hg,
  ag,
  events = [],
  playerIsHome = true,
  homeName = "Mandante",
  awayName = "Visitante"
}) {
  const mine = playerIsHome ? hg : ag;
  const theirs = playerIsHome ? ag : hg;
  const myName = playerIsHome ? homeName : awayName;
  const oppName = playerIsHome ? awayName : homeName;
  const margin = Math.abs(mine - theirs);
  const totalGoals = mine + theirs;
  const yellows = countKinds(events, ["yellow", "second_yellow"]);
  const reds = countKinds(events, ["red", "second_yellow"]);
  const pens = countKinds(events, "penalty");
  const injuries = countKinds(events, "injury");
  const goals = countKinds(events, "goal");
  const won = mine > theirs;
  const drew = mine === theirs;
  const lost = mine < theirs;
  const thrashing = margin >= 3;
  const goleada = margin >= 4;
  const highScoring = totalGoals >= 5;
  const cagey = totalGoals === 0;
  const oneNil = totalGoals === 1;
  const cleanSheet = theirs === 0 && mine > 0;
  const shutOut = mine === 0 && theirs > 0;
  const cardFest = yellows >= 4 || reds >= 2;
  const hotTemper = yellows >= 3 || reds >= 1;
  const drama = pens > 0 || reds > 0 || injuries > 0;

  return {
    hg,
    ag,
    mine,
    theirs,
    myName,
    oppName,
    homeName,
    awayName,
    margin,
    totalGoals,
    yellows,
    reds,
    pens,
    injuries,
    goals,
    won,
    drew,
    lost,
    thrashing,
    goleada,
    highScoring,
    cagey,
    oneNil,
    cleanSheet,
    shutOut,
    cardFest,
    hotTemper,
    drama,
    scoreline: `${homeName} ${hg}×${ag} ${awayName}`
  };
}

function fill(template, m) {
  return String(template)
    .replaceAll("{me}", m.myName)
    .replaceAll("{opp}", m.oppName)
    .replaceAll("{home}", m.homeName)
    .replaceAll("{away}", m.awayName)
    .replaceAll("{mine}", String(m.mine))
    .replaceAll("{theirs}", String(m.theirs))
    .replaceAll("{hg}", String(m.hg))
    .replaceAll("{ag}", String(m.ag))
    .replaceAll("{margin}", String(m.margin))
    .replaceAll("{total}", String(m.totalGoals))
    .replaceAll("{yellows}", String(m.yellows))
    .replaceAll("{reds}", String(m.reds))
    .replaceAll("{pens}", String(m.pens))
    .replaceAll("{score}", m.scoreline);
}

function pickN(pool, n) {
  const copy = [...pool];
  const out = [];
  while (out.length < n && copy.length) {
    const i = rand(0, copy.length - 1);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}

/** Bancos de frases — generosos de propósito */
const WIN_BIG = [
  "Varreu o gramado e ainda pediu bis. {me} {mine}×{theirs} {opp}: isso não foi jogo, foi sessão de autógrafos.",
  "Goleada histórica! {margin} gols de diferença e a torcida já pede camisa nova.",
  "O placar {mine}×{theirs} vai ficar na parede do vestiário por um tempo. Humilhação educada.",
  "{opp} pediu o intervalo… no minuto 20. {me} não teve piedade.",
  "Isso aqui foi trator em dia de estrada de terra. {score}.",
  "Alguém avisa o placar eletrônico que ele pode parar de contar? {me} enfiou {mine}.",
  "Vitória com direito a pipoca e narrador rouco. {margin} de diferença dói no orgulho alheio.",
  "O rival saiu de campo procurando o GPS do próprio time. {score}."
];

const WIN_NARROW = [
  "Suor, unha e uma pitada de sorte: {me} vence {mine}×{theirs} e respira aliviado.",
  "Vitória de prestígio (e de coração na boca). Um gol bastou para o romance.",
  "Não foi bonito. Foi necessário. {me} leva os 3 pontos no sufoco.",
  "O juiz quase precisava de tranquilizante — e a torcida também. 1×0 com drama incluso.",
  "Vitória de quem sofre junto. {opp} mordeu, {me} mordeu mais forte no fim.",
  "Três pontos no bolso e zero glamour. Às vezes o futebol prefere o prosaico.",
  "Quem pediu espetáculo se enganou de estádio. Quem pediu vitória foi atendido."
];

const WIN_CLEAN = [
  "Defesa de concreto armado: {me} vence e zera a meta adversária.",
  "Clean sheet e sorriso largo. O goleiro pode mandar beijo para a arquibancada.",
  "Zero na meta, três no bolso. A zaga merecia jantar por conta da diretoria.",
  "Ninguém furou o cadeado. {me} fecha o candado e abre a contagem de pontos."
];

const WIN_FEST = [
  "Festa de gols! {total} bolas na rede e o placar parecia roleta.",
  "Abriu o placar, abriu o segundo tempo, abriu o champagne. {score}.",
  "Partida de videogame no modo fácil… para os dois ataques. {total} gols no total.",
  "Quem pediu defesa saiu cedo. O ataque ditou o espetáculo: {score}."
];

const DRAW = [
  "Empate com gosto de café frio: ninguém sai feliz, todo mundo sai com 1 ponto.",
  "Dividiram o bolo no meio. {score} — justiça ou preguiça? O debate continua no bar.",
  "Um ponto que sabe a pouco e a muito ao mesmo tempo. {me} e {opp} se olham e encogem os ombros.",
  "O futebol às vezes é diplomacia com chuteira. Empate {mine}×{theirs}.",
  "Ninguém quis perder. Resultado: ninguém ganhou. Clássico.",
  "Empate técnico, emoção amadora. O público vai embora murmurando."
];

const DRAW_CRAZY = [
  "Empate maluco: {total} gols e zero vencedor. O placar pediu arrego.",
  "Chuva de gols e o troféu… sumiu. {score} é novela sem final feliz.",
  "Todo mundo atacou, ninguém defendeu, o empate riu por último."
];

const LOSE_BIG = [
  "Derrota pesada. {margin} gols de diferença e o vestiário em silêncio de velório.",
  "Levaram um passeio. {score} — a diretoria já finge que não viu.",
  "Dia para apagar da memória (mas o placar não deixa). {theirs}×{mine} dói.",
  "O rival usou {me} de trampolim. Goleada sofrida, ego no chão.",
  "Isso não foi derrota, foi cobrança de pedágio. {opp} passou por cima.",
  "O técnico vai ter que inventar discurso. O placar já inventou a vergonha.",
  "Às vezes o futebol te abraça. Hoje ele te atropelou e ainda buzinou."
];

const LOSE_NARROW = [
  "Perdeu por pouco e isso dói mais. Quase… quase… e o apito final.",
  "Derrota de detalhe. Um lance, um segundo, um gol — e o romance acabou.",
  "Sai de campo com a sensação de que merecia mais. O placar discorda educadamente.",
  "Derrota magra, lição gorda. {score}.",
  "O ponto que escapou vai rondar o treino de amanhã."
];

const LOSE_SHUT = [
  "Zerou no ataque e sofreu no outro lado. Noite branca para os artilheiros.",
  "Nada de gol a favor. O placar foi monólogo do adversário.",
  "Ofensiva sumiu do mapa. GPS não acha finalização."
];

const CARDS_HEAVY = [
  "Cartãozinho? Cartãozão. {yellows} amarelos e o juiz quase pediu hora extra de caneta.",
  "Partida quente: {yellows} amarelos e o banco virando plateia de novela.",
  "Faltou só o juíz amarelar o gramado. Temperatura lá em cima.",
  "O vestiário vai ter mais cartão do que chuteira limpa. Disciplina em frangalhos."
];

const REDS = [
  "Vermelho na conta: a expulsão mudou o roteiro (e o humor do técnico).",
  "{reds} expulsão(ões) — o time jogou com a alma… e com um a menos.",
  "Cartão vermelho: o plano tático foi pro lixo junto com o jogador."
];

const PENS = [
  "Pênalti no cardápio. O goleiro respirou fundo, a torcida parou o coração.",
  "A marca da cal teve protagonismo. {pens} pênalti(s) e drama garantido.",
  "Doze passos de tortura. Quem não gosta de pênalti está mentindo (ou é zagueiro)."
];

const INJURY = [
  "Lesão no caminho: o departamento médico já acende a luz amarela.",
  "Mais um para a maca. O futebol cobra o pedágio do corpo.",
  "Esticou demais, o músculo disse não. Torcida em silêncio."
];

const CAGEY = [
  "0×0 clássico: defesa nota 10, ataque de cinema mudo.",
  "Ninguém queria errar. Resultado: ninguém brilhou. Travamento total.",
  "Partida de xadrez com chuteira. Empate sem gols, sem perdão."
];

const GENERIC_COLOR = [
  "Apito final. O placar é lei: {score}.",
  "Fim de papo no gramado. {score} entra para a história da temporada.",
  "Mais 90 minutos na conta do futebol de bairro (que se leva a sério)."
];

const ROUND_SPICY = [
  "{score} — placar de quem não brinca em serviço.",
  "{score}: o mandante ditou o ritmo e o visitante pediu água.",
  "Goleada na rodada: {score}. Alguém vai ouvir no treino.",
  "{score} com cheiro de virada de chave na tabela.",
  "Resultado seco: {score}. Pontos na conta, drama no vestiário.",
  "{score} — confronto que alimenta rivalidade por semanas.",
  "Na rodada paralela: {score}. A torcida local pode sorrir.",
  "{score}. Se tinha favorito no papel, o gramado rasgou o papel."
];

const ROUND_DRAW = [
  "{score}: dividiram os pontos e a frustração.",
  "Empate na rodada — {score}. Ninguém compra champanhe.",
  "{score}. Um ponto cada, zero poetry."
];

const ROUND_THRASH = [
  "Passeio na rodada: {score}. Diferença de {margin} dói.",
  "{score} — isso aqui foi esculacho com hora marcada.",
  "Placar pesado na liga: {score}. O visitante pede silêncio no ônibus."
];

/**
 * Monta reações do JOGADOR após a partida principal.
 * @returns {{ headline: string, lines: string[], toast: string, toastType: string, metrics: object }}
 */
export function buildPlayerMatchReactions(raw) {
  const m = summarizeMatchMetrics(raw);
  const lines = [];
  const buckets = [];

  if (m.won && m.goleada) buckets.push(...WIN_BIG, ...WIN_BIG);
  else if (m.won && m.thrashing) buckets.push(...WIN_BIG);
  else if (m.won && m.oneNil) buckets.push(...WIN_NARROW);
  else if (m.won) buckets.push(...WIN_NARROW);

  if (m.won && m.cleanSheet) buckets.push(...WIN_CLEAN);
  if (m.won && m.highScoring) buckets.push(...WIN_FEST);

  if (m.drew && m.highScoring) buckets.push(...DRAW_CRAZY);
  else if (m.drew && m.cagey) buckets.push(...CAGEY, ...DRAW);
  else if (m.drew) buckets.push(...DRAW);

  if (m.lost && m.goleada) buckets.push(...LOSE_BIG, ...LOSE_BIG);
  else if (m.lost && m.thrashing) buckets.push(...LOSE_BIG);
  else if (m.lost && m.oneNil) buckets.push(...LOSE_NARROW);
  else if (m.lost) buckets.push(...LOSE_NARROW);

  if (m.lost && m.shutOut) buckets.push(...LOSE_SHUT);
  if (m.cagey && !m.drew) buckets.push(...CAGEY);

  if (m.cardFest) buckets.push(...CARDS_HEAVY);
  else if (m.hotTemper) buckets.push(...CARDS_HEAVY.slice(0, 2));
  if (m.reds > 0) buckets.push(...REDS);
  if (m.pens > 0) buckets.push(...PENS);
  if (m.injuries > 0) buckets.push(...INJURY);

  if (!buckets.length) buckets.push(...GENERIC_COLOR);

  const chosen = pickN(buckets, m.drama || m.thrashing || m.highScoring ? 3 : 2).map((t) =>
    fill(t, m)
  );
  // Garante headline = placar + primeira reação
  const headline = m.won
    ? pick([
        `Vitória! ${m.scoreline}`,
        `Triunfo em casa da história: ${m.scoreline}`,
        `São três pontos: ${m.scoreline}`,
        `Festa no clube: ${m.scoreline}`
      ])
    : m.drew
      ? pick([
          `Empate: ${m.scoreline}`,
          `Um ponto cada: ${m.scoreline}`,
          `Dividiu a conta: ${m.scoreline}`
        ])
      : pick([
          `Derrota: ${m.scoreline}`,
          `Dia amargo: ${m.scoreline}`,
          `Não foi dessa vez: ${m.scoreline}`
        ]);

  // Evita repetir placar seco se a linha já cita score
  for (const line of chosen) {
    if (!lines.includes(line)) lines.push(line);
  }

  // Linhas extras de métrica “// crua” só se forem picantes
  if (m.yellows >= 4) {
    lines.push(
      pick([
        `Árbitro contou ${m.yellows} amarelos. Alguém precisa de aula de fair play.`,
        `Disciplina no vermelho (quase): ${m.yellows} cartões amarelos no boletim.`,
        `${m.yellows} amarelos — o juiz saiu com câimbra no pulso.`
      ])
    );
  }
  if (m.reds >= 1) {
    lines.push(
      pick([
        `Expulsão(ões): ${m.reds}. O plano tático virou improvisação.`,
        `Com um a menos, o jogo mudou de figura. Vermelho pesa.`,
        `Cartão vermelho na conta. Vestiário em silêncio sepulcral.`
      ])
    );
  }
  if (m.totalGoals >= 6) {
    lines.push(
      pick([
        `${m.totalGoals} gols no total. Isso foi festival, não partida.`,
        `Placar de videogame: ${m.totalGoals} bolas na rede.`,
        `Ataque em modo turbo. Defesa… alguém viu a defesa?`
      ])
    );
  }
  if (m.margin >= 4) {
    lines.push(
      pick([
        `Diferença de ${m.margin} gols. Isso fica no currículo (para o bem ou para o mal).`,
        `Goleada de ${m.margin}. O placar pede legenda de aviso.`,
        `${m.margin} de diferença — humilhação com carimbo.`
      ])
    );
  }

  const toastType = m.won ? "info" : m.drew ? "warn" : "warn";
  const toast = pick(
    m.won
      ? [
          `${headline} · ${chosen[0] || "Três pontos no bolso!"}`,
          `Vitória ${m.mine}×${m.theirs}! ${chosen[0] || "Festa no vestiário."}`,
          `Fim de jogo: você venceu. ${m.scoreline}`
        ]
      : m.drew
        ? [
            `Empate ${m.mine}×${m.theirs}. ${chosen[0] || "Um ponto é um ponto."}`,
            `${headline}`
          ]
        : [
            `Derrota ${m.mine}×${m.theirs}. ${chosen[0] || "Cabeça erguida no treino."}`,
            `${headline} · hora de ajustar a escalação.`
          ]
  );

  // Limita tamanho do toast
  const shortToast = toast.length > 140 ? `${toast.slice(0, 137)}…` : toast;

  return {
    headline,
    lines: lines.slice(0, 5),
    toast: shortToast,
    toastType,
    metrics: m
  };
}

/**
 * Comentário curto para um resultado NPC×NPC (jornal da rodada).
 */
export function buildNpcResultBlurb(homeName, awayName, hg, ag, events = []) {
  const m = summarizeMatchMetrics({
    hg,
    ag,
    events,
    playerIsHome: true,
    homeName,
    awayName
  });
  let pool = ROUND_SPICY;
  if (m.drew) pool = ROUND_DRAW;
  if (m.thrashing || m.goleada) pool = ROUND_THRASH;
  if (m.cardFest) {
    return fill(
      pick([
        "{score} — e ainda sobrou cartão para a sobremesa ({yellows} amarelos).",
        "{score} com temperatura de briga de bar. Disciplina no chão.",
        "Na rodada: {score}. O juiz quase pediu reforço."
      ]),
      m
    );
  }
  if (m.highScoring) {
    return fill(
      pick([
        "Festival na rodada: {score} ({total} gols).",
        "{score} — ataque em dia, defesa de férias.",
        "Placar inchado na liga: {score}."
      ]),
      m
    );
  }
  return fill(pick(pool), m);
}

/**
 * Publica no feed o placar do jogador + reações + jornal do resto da rodada.
 */
export function publishMatchEntertainment(game, {
  homeName,
  awayName,
  hg,
  ag,
  events,
  playerIsHome,
  round,
  playerFixture,
  prizeText = ""
}) {
  const reaction = buildPlayerMatchReactions({
    hg,
    ag,
    events,
    playerIsHome,
    homeName,
    awayName
  });

  game.feed(reaction.headline);
  for (const line of reaction.lines) {
    game.feed(line);
  }

  // Jornal da rodada (NPC×NPC e outros jogos da mesma rodada)
  const others = (game.state.seasonFixtures || []).filter(
    (f) =>
      f.round === round &&
      f.played &&
      f.result &&
      f !== playerFixture
  );
  if (others.length) {
    game.feed(
      pick([
        `Jornal da rodada ${round}: os outros gramados também falaram.`,
        `Enquanto isso, na rodada ${round} da liga…`,
        `Boletim paralelo da rodada ${round}:`
      ])
    );
    // Até 5 jogos “quentes” primeiro
    const ranked = [...others].sort((a, b) => {
      const ta = (a.result.hg || 0) + (a.result.ag || 0);
      const tb = (b.result.hg || 0) + (b.result.ag || 0);
      const ma = Math.abs((a.result.hg || 0) - (a.result.ag || 0));
      const mb = Math.abs((b.result.hg || 0) - (b.result.ag || 0));
      return tb + mb * 2 - (ta + ma * 2);
    });
    for (const f of ranked.slice(0, 6)) {
      const h = game.getClub(f.home);
      const a = game.getClub(f.away);
      const blurb = buildNpcResultBlurb(
        h?.name || "Mandante",
        a?.name || "Visitante",
        f.result.hg,
        f.result.ag,
        f.result.events || []
      );
      game.feed(blurb);
    }
    if (others.length > 6) {
      game.feed(
        pick([
          `…e mais ${others.length - 6} resultado(s) fecharam a rodada sem fanfarra.`,
          `O restante da rodada também andou: +${others.length - 6} jogo(s) no placar geral.`,
          `Tabela atualizada com os outros ${others.length - 6} confronto(s) da rodada.`
        ])
      );
    }
  }

  if (prizeText) {
    game.feed(prizeText);
  }

  return reaction;
}
