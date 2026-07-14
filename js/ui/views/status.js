import { formatMoney } from "../../core/utils.js";
import { skillBar, ensureBossSkillXp } from "../../systems/skillProgress.js";

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function skillWithXp(label, key, level, skillXp, cls = "") {
  const xp = skillXp[key] || 0;
  const bar = skillBar(level, xp);
  const levelPct = Math.min(100, (level / 99) * 100);
  return `
    <div class="stat-bar">
      <div class="lbl"><span>${label}</span><strong>${level}</strong></div>
      <div class="bar ${cls}"><i style="width:${levelPct}%"></i></div>
      <div class="skill-xp-lbl" style="margin-top:0.25rem"><span>XP → +1</span><span>${bar.cur}/${bar.need}</span></div>
      <div class="bar blue" style="height:5px"><i style="width:${bar.pct}%"></i></div>
    </div>`;
}

export function viewStatus(_game, s) {
  const b = s.boss;
  const st = b.stats;
  const skillXp = ensureBossSkillXp(b);

  return `
    <h1 class="view-title">Técnico / presidente</h1>
    <p class="view-sub">Presidente e técnico do projeto · o elenco é quem entra em campo.</p>
    <div class="grid-2">
      <div class="panel">
        <h3>${esc(b.name)} <span class="tag">Nv. ${b.level}</span></h3>
        <dl class="kv">
          <dt>Seu time</dt><dd>${esc(s.club.name)}</dd>
          <dt>Projeto</dt><dd>${s.club.typeLabel || "—"}</dd>
          <dt>Filosofia</dt><dd>${b.style}</dd>
          <dt>Dinheiro</dt><dd>R$ ${formatMoney(b.money)}</dd>
          <dt>Prestígio</dt><dd>★ ${b.rep}</dd>
          <dt>Energia</dt><dd>${Math.floor(b.energy)}/${b.maxEnergy}</dd>
          <dt>Saúde</dt><dd>${Math.floor(b.health)}%</dd>
          <dt>Lesão</dt><dd>${b.injury ? `${b.injury.name} (${b.injury.daysLeft}d)` : "—"}</dd>
          <dt>XP de nível</dt><dd>${b.xp} / ${b.level * 100}</dd>
        </dl>
      </div>
      <div class="panel">
        <h3>Atributos</h3>
        ${skillWithXp("Tática", "tatica", st.tatica, skillXp, "blue")}
        ${skillWithXp("Scouting", "scouting", st.scouting, skillXp)}
        ${skillWithXp("Negócio", "negocio", st.negocio, skillXp, "gold")}
        ${skillWithXp("Liderança", "lideranca", st.lideranca, skillXp, "orange")}
        ${skillWithXp("Condicionamento", "condicionamento", st.condicionamento, skillXp, "red")}
      </div>
    </div>
    <div class="panel">
      <h3>Identidade do dirigente</h3>
      <p style="color:var(--muted);font-size:0.9rem;line-height:1.5">Este nome representa você no clube, na Arena e nos rankings. Ele deve ser único.</p>
      <label for="manager-name-edit">Nome do presidente / técnico</label>
      <div class="btn-row" style="margin-top:0.4rem">
        <input id="manager-name-edit" type="text" maxlength="20" autocomplete="name" value="${esc(b.name)}" style="flex:1" />
        <button class="btn btn-secondary btn-sm" id="btn-random-manager" type="button">Gerar nome</button>
        <button class="btn btn-primary btn-sm" id="btn-save-manager" type="button">Salvar nome</button>
      </div>
      <p id="manager-name-help" style="color:var(--dim);font-size:0.78rem;margin-top:0.45rem">De 2 a 20 caracteres. Letras, números, espaços, ponto, apóstrofo e hífen.</p>
    </div>
    <div class="panel">
      <h3>Áreas de trabalho</h3>
      <p style="color:var(--muted);font-size:0.9rem;line-height:1.55">
        Cada treino soma progresso na área. Quando a barra enche, o atributo sobe um ponto.
        <br><br>
        <strong>Tática</strong> ajuda nas partidas ·
        <strong>Scouting</strong> nas operações de base ·
        <strong>Negócio</strong> no mercado ·
        <strong>Liderança</strong> com a torcida e o vestiário ·
        <strong>Condicionamento</strong> na resistência a lesões.
      </p>
    </div>`;
}
