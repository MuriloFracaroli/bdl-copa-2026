/**
 * Bolão Copa 2026 — lógica e renderização
 */

/** Pontuação mata-mata (planilha / regras do bolão). */
const KNOCKOUT_POINTS = {
  oitavas: 1,
  quartas: 2,
  semi: 3,
  final: 4,
  campeao: 5,
};

const KNOCKOUT_LABELS = {
  oitavas: "Oitavas",
  quartas: "Quartas",
  semi: "Semi",
  final: "Final",
  campeao: "Campeão",
};

const KNOCKOUT_PHASE_ORDER = [
  "oitavas",
  "quartas",
  "semi",
  "final",
  "campeao",
];

/** Vagas por fase (denominador do placar acertos/total). */
const KNOCKOUT_PHASE_SLOTS = {
  oitavas: 16,
  quartas: 16,
  semi: 12,
  final: 8,
  campeao: 5,
};

/** Colunas do chaveamento (referência visual BDL). */
const BRACKET_PHASE_META = [
  { fase: "oitavas", badgePrefix: "", ptsLabel: "1 PONTO POR ACERTO" },
  { fase: "quartas", badgePrefix: "Q", ptsLabel: "2 PONTOS POR ACERTO" },
  { fase: "semi", badgePrefix: "S", ptsLabel: "3 PONTOS POR ACERTO" },
  { fase: "final", badgePrefix: "F", ptsLabel: "4 PONTOS POR ACERTO" },
  { fase: "campeao", badgePrefix: "", ptsLabel: "5 PONTOS POR ACERTO" },
];

const MEDALS = ["", "🥇", "🥈", "🥉"];

/** Aba extra na fase de grupos: visão agregada de pontuação. */
const GROUP_TAB_TOTAL = "__TOTAL__";

/** Títulos fixos por posição no ranking geral (1º–14º). */
const RANK_TITLES = [
  "THE CHOSEN ONE",
  "Shape Acima da Tabela",
  "Australium Mindset",
  "Global Elite do Chaveamento",
  "Radiant Visionário",
  "Elo Inflado",
  "Cagão da Smartfit",
  "Speedrunner falido",
  "Spy Disfarçado de Competente",
  "Consultou o Capeta e Ainda Errou",
  "Bronze 1 da FIFA",
  "Scout Perdido no Payload",
  "Heavy Sem Uber",
  "Comedor de Sabonete",
];

function getRankTitle(position) {
  const idx = Number(position) - 1;
  return idx >= 0 && idx < RANK_TITLES.length ? RANK_TITLES[idx] : "";
}

/* ---------- Scoring: Fase de Grupos ---------- */

/**
 * Decomposição por regra (+1 cada) — usada por `calcGroupRowPoints` e pela
 * agregação da aba TOTAL (uma única fonte de verdade).
 *
 * Critério por **palpite** (posição que o jogador marcou na seleção):
 * - “1º palpite” (pod1): marcou **1** e a seleção ficou no **top 3** (1–3).
 * - “1 exato” (ex1): marcou **1** e ficou **1º**.
 * - “2º palpite” (pod2): marcou **2** e a seleção ficou no **top 3**.
 * - “2 exato” (ex2): marcou **2** e ficou **2º**.
 * - “3º palpite” (col3): marcou **3** e a seleção ficou no **top 3**.
 */
function decomposeGroupPhaseRowPoints(palpite, resultado) {
  const empty = { pod1: 0, ex1: 0, pod2: 0, ex2: 0, col3: 0, total: 0 };
  if (
    palpite == null ||
    !Number.isFinite(Number(palpite)) ||
    Number(palpite) < 1 ||
    Number(palpite) > 4
  ) {
    return empty;
  }
  const p = Number(palpite);
  const r = Number(resultado);
  if (!Number.isFinite(r) || r < 1 || r > 4) return empty;

  let pod1 = 0;
  let ex1 = 0;
  let pod2 = 0;
  let ex2 = 0;
  let col3 = 0;

  if (p === 1 && r >= 1 && r <= 3) pod1 = 1;
  if (p === 1 && r === 1) ex1 = 1;

  if (p === 2 && r >= 1 && r <= 3) pod2 = 1;
  if (p === 2 && r === 2) ex2 = 1;

  if (p === 3 && r >= 1 && r <= 3) col3 = 1;

  const total = pod1 + ex1 + pod2 + ex2 + col3;
  return { pod1, ex1, pod2, ex2, col3, total };
}

function calcGroupRowPoints(palpite, resultado) {
  return decomposeGroupPhaseRowPoints(palpite, resultado).total;
}

function calcKnockoutRowPoints(row) {
  if (!row.classificou && !row.vencedorReal) return 0;
  return KNOCKOUT_POINTS[row.fase] || 0;
}

/* ---------- Data processing ---------- */

/** Mesma normalização que parseJogador no sheets-loader (acentos → maiúsculas). */
function normKeyPlayer(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

const PLAYER_META_ALIASES = {
  "felipe ouro": "felipe o",
  luisin: "lh",
  tozzi: "tqzzi",
  dangerz: "dngrz",
  batonga: "batongas",
};

function getPlayerMeta(nome) {
  const raw = String(nome || "").trim();
  const key = raw.toLowerCase();
  const nk = normKeyPlayer(raw);
  const alias = PLAYER_META_ALIASES[key];
  const lookup = normKeyPlayer(alias || key);

  const exact = MOCK_DATA.jogadores.find((j) => {
    const jId = normKeyPlayer(j.id);
    const jNome = normKeyPlayer(j.nome);
    return (
      jId === nk ||
      jNome === nk ||
      jId === lookup ||
      jNome === lookup ||
      j.nome.toLowerCase() === key ||
      String(j.id).toLowerCase() === key
    );
  });
  if (exact) return exact;

  const partial = MOCK_DATA.jogadores.find((j) => {
    const jn = j.nome.toLowerCase();
    const lk = (alias || key).toLowerCase();
    return (
      jn.startsWith(lk) ||
      lk.startsWith(jn) ||
      jn.split(" ")[0] === lk.split(" ")[0]
    );
  });
  if (partial) return partial;

  return { nome: raw, avatar: "⚽", cor: "#00c853", id: nk };
}

function getCountryInfo(paisKey) {
  const key = String(paisKey ?? "").trim();
  const isPlaceholderKey = !key || /^[?？]+$/u.test(key);
  const base =
    MOCK_DATA.paises[key] ||
    ({
      nome: isPlaceholderKey ? "?" : key,
      codigo: "un",
    });
  return {
    ...base,
    nome: base.nome != null && String(base.nome).trim() !== "" ? base.nome : "?",
    codigo: normalizeFlagCdnCode(base.codigo),
  };
}

/**
 * Códigos válidos no flagcdn: ISO2 ou subcódigos tipo gb-eng.
 * Qualquer outro valor (ex.: "?" da planilha) → ONU (`un`).
 */
function normalizeFlagCdnCode(codigo) {
  const raw = String(codigo ?? "")
    .trim()
    .toLowerCase()
    .replace(/_/g, "-");
  if (!raw || raw.includes("?")) return "un";
  if (/^[a-z]{2}$/i.test(raw)) return raw;
  if (/^[a-z]{2}-[a-z0-9]{2,12}$/i.test(raw)) return raw;
  return "un";
}

/** Larguras PNG suportadas por https://flagcdn.com (w64 etc. não existem → 404). */
const FLAGCDN_WIDTHS = [20, 40, 80, 160, 320, 640, 1280, 2560];

function flagCdnSnapWidth(requested) {
  const n = Number(requested);
  if (!Number.isFinite(n) || n <= 0) return 40;
  if (FLAGCDN_WIDTHS.includes(n)) return n;
  return FLAGCDN_WIDTHS.find((w) => w >= n) || 2560;
}

function flagUrl(codigo, size = 40) {
  const w = flagCdnSnapWidth(size);
  const code = normalizeFlagCdnCode(codigo);
  return `https://flagcdn.com/w${w}/${code}.png`;
}

function hasPlanilhaData() {
  return Array.isArray(MOCK_DATA.faseGrupos) && MOCK_DATA.faseGrupos.length > 0;
}

/** Resultado informado na aba Resultados (0 = pendente, 1–4 = posição final). */
function resultadoNaPlanilha(row) {
  const r = Number(row?.resultado);
  return Number.isFinite(r) && r >= 0 && r <= 4;
}

/** Só posições 1–4 entram no placar e na pontuação. */
function resultadoParaPontos(row) {
  const r = Number(row?.resultado);
  return Number.isFinite(r) && r >= 1 && r <= 4;
}

/** Linha com posição 1–4; 0 ou traço na planilha viram null no loader e aqui não contam. */
function rowTemPalpiteGrupo(row) {
  const p = row?.palpite;
  if (p == null) return false;
  const n = Number(p);
  return Number.isFinite(n) && n >= 1 && n <= 4;
}

function mapGroupRows(rows) {
  return rows.map((row) => ({
    ...row,
    pontos:
      rowTemPalpiteGrupo(row) && resultadoParaPontos(row)
        ? calcGroupRowPoints(row.palpite, row.resultado)
        : 0,
    paisInfo: getCountryInfo(row.pais),
  }));
}

function processGroupData() {
  return mapGroupRows(MOCK_DATA.faseGrupos || []);
}

function processGroupDataForRanking() {
  return processGroupData();
}

/**
 * Colunas da visão TOTAL: numerador = +1 ganhos na regra; denominador = nº de linhas
 * em que o jogador marcou explicitamente palpite 1, 2 ou 3 (oportunidades daquele “slot”).
 */
const GROUP_TOTAL_COLUMNS = [
  {
    keyHits: "pod1",
    denomKey: "denPod1",
    label: "1º palpite",
    title:
      "+1 pt: marcou 1 para a seleção e ela ficou entre 1º e 3º. Denominador = vezes que marcou 1 na planilha.",
  },
  {
    keyHits: "ex1",
    denomKey: "denEx1",
    label: "1 exato",
    title:
      "+1 pt extra: marcou 1 e a seleção ficou em 1º. Denominador = linhas com palpite 1 explícito.",
  },
  {
    keyHits: "pod2",
    denomKey: "denPod2",
    label: "2º palpite",
    title:
      "+1 pt: marcou 2 e a seleção ficou entre 1º e 3º. Denominador = vezes que marcou 2.",
  },
  {
    keyHits: "ex2",
    denomKey: "denEx2",
    label: "2 exato",
    title:
      "+1 pt extra: marcou 2 e a seleção ficou em 2º. Denominador = linhas com palpite 2 explícito.",
  },
  {
    keyHits: "col3",
    denomKey: "denCol3",
    label: "3º palpite",
    title:
      "+1 pt: marcou 3 e a seleção ficou entre 1º e 3º. Denominador = vezes que marcou 3.",
  },
];

function emptyGroupAgg(chavePlanilha, nome) {
  return {
    chavePlanilha,
    nome,
    ptsTotal: 0,
    pod1: 0,
    ex1: 0,
    pod2: 0,
    ex2: 0,
    col3: 0,
    denPod1: 0,
    denEx1: 0,
    denPod2: 0,
    denEx2: 0,
    denCol3: 0,
  };
}

function buildGroupPhaseDetailByPlayer() {
  let keys = (MOCK_DATA.jogadoresPlanilha || []).map((j) => normKeyPlayer(j));
  if (!keys.length) {
    keys = [
      ...new Set(
        (MOCK_DATA.faseGrupos || []).map((r) => normKeyPlayer(r.jogador))
      ),
    ];
  }
  const visivel = new Set(keys.filter(Boolean));
  const byKey = new Map();
  visivel.forEach((k) => {
    const meta = getPlayerMeta(k);
    byKey.set(k, emptyGroupAgg(k, meta.nome));
  });

  processGroupData().forEach((row) => {
    const k = normKeyPlayer(row.jogador);
    if (!visivel.has(k)) return;
    if (row.palpiteDaPlanilha !== true) return;
    if (!rowTemPalpiteGrupo(row)) return;

    const agg = byKey.get(k);
    if (!agg) return;

    const p = Number(row.palpite);
    if (p === 1) {
      agg.denPod1 += 1;
      agg.denEx1 += 1;
    }
    if (p === 2) {
      agg.denPod2 += 1;
      agg.denEx2 += 1;
    }
    if (p === 3) agg.denCol3 += 1;

    if (resultadoParaPontos(row)) {
      const d = decomposeGroupPhaseRowPoints(row.palpite, row.resultado);
      agg.ptsTotal += d.total;
      agg.pod1 += d.pod1;
      agg.ex1 += d.ex1;
      agg.pod2 += d.pod2;
      agg.ex2 += d.ex2;
      agg.col3 += d.col3;
    }
  });

  return [...byKey.values()];
}

function formatGrpTotalRatio(hits, opps) {
  const h = Number(hits) || 0;
  const o = Number(opps) || 0;
  if (!o) return "0/0";
  return `${h}/${o}`;
}

function renderGroupTotalCellClass(hits, opps) {
  const o = Number(opps) || 0;
  const h = Number(hits) || 0;
  if (!o || h === 0) return "";
  const pct = Math.round((h / o) * 100);
  if (pct >= 50) return "gt-score-fase--hit";
  return "gt-score-fase--partial";
}

function renderGroupTotal() {
  const el = document.getElementById("group-unified-table");
  if (!el) return;

  const details = buildGroupPhaseDetailByPlayer();
  details.sort(
    (a, b) =>
      b.ptsTotal - a.ptsTotal ||
      b.pod1 +
        b.ex1 +
        b.pod2 +
        b.ex2 +
        b.col3 -
        (a.pod1 + a.ex1 + a.pod2 + a.ex2 + a.col3) ||
      a.nome.localeCompare(b.nome, "pt-BR")
  );

  if (!details.length) {
    el.innerHTML =
      '<p class="empty-state">Nenhum jogador listado na planilha (aba Palpites) para exibir o total.</p>';
    return;
  }

  const heads = GROUP_TOTAL_COLUMNS.map(
    (col) =>
      `<span class="gt-score-fase gt-score-fase--head" title="${escapeHtml(col.title)}">${escapeHtml(col.label)}</span>`
  ).join("");

  el.innerHTML = `
    <div class="group-total-wrap">
      <p class="group-total-intro">
        Estatísticas da <strong>fase de grupos</strong> por <strong>posição que você marcou na planilha</strong>
        (1, 2 ou 3): <span class="group-total-ratio-hint">acertos / quantas vezes marcou aquele palpite</span>
        (só células com PALPITE explícito). O <strong>Pts</strong> soma as mesmas regras que as tabelas por grupo.
      </p>
      <div class="knockout-scores-wrap group-total-scroll">
        <div class="gt-score-head">
          <span class="gt-score-col gt-score-col--player">Jogador</span>
          <span class="gt-score-col gt-score-col--total" title="Pontos totais fase de grupos">Pts</span>
          ${heads}
        </div>
        <ul class="gt-score-list">
          ${details
            .map((a) => {
              const meta = getPlayerMeta(a.nome);
              const cells = GROUP_TOTAL_COLUMNS.map((col) => {
                const ptsGanhos = a[col.keyHits];
                const teto = a[col.denomKey] ?? 0;
                const text = formatGrpTotalRatio(ptsGanhos, teto);
                const hitClass = renderGroupTotalCellClass(ptsGanhos, teto);
                const tip = `${ptsGanhos}/${teto} pts · ${escapeHtml(col.title)}`;
                return `<span class="gt-score-fase ${hitClass}" title="${tip}">
                  <span class="gt-ratio">${text}</span>
                </span>`;
              }).join("");
              return `
            <li class="gt-score-row">
              <span class="gt-score-col gt-score-col--player">
                <span class="gt-score-avatar" style="border-color:${meta.cor}">${meta.avatar}</span>
                ${escapeHtml(meta.nome)}
              </span>
              <span class="gt-score-col gt-score-col--total">${a.ptsTotal}</span>
              ${cells}
            </li>`;
            })
            .join("")}
        </ul>
      </div>
    </div>`;
}

function processKnockoutData() {
  return (MOCK_DATA.mataMata || []).map((row) => {
    const pontos = calcKnockoutRowPoints(row);
    return {
      ...row,
      pontos,
      acertou: pontos > 0,
      paisInfo: getCountryInfo(row.pais || row.palpite),
    };
  });
}

function buildKnockoutPlayerTotals(knockoutRows) {
  const map = new Map();
  knockoutRows.forEach((row) => {
    if (row.mmPaisDaPlanilha !== true) return;
    const key = normKeyPlayer(row.jogador);
    if (!map.has(key)) {
      map.set(key, {
        jogador: row.jogador,
        pts: 0,
        acertos: 0,
        palpites: 0,
        porFase: {},
      });
    }
    const p = map.get(key);
    p.palpites += 1;
    p.pts += row.pontos;
    if (row.acertou) p.acertos += 1;
    if (!p.porFase[row.fase]) {
      p.porFase[row.fase] = { acertos: 0, palpites: 0, pts: 0 };
    }
    const f = p.porFase[row.fase];
    f.palpites += 1;
    f.pts += row.pontos;
    if (row.acertou) f.acertos += 1;
  });
  return [...map.values()].sort((a, b) => b.pts - a.pts || b.acertos - a.acertos);
}

function getKnockoutPhaseDenominator(fase, palpitesNaFase) {
  const slots = KNOCKOUT_PHASE_SLOTS[fase];
  if (slots) return slots;
  return palpitesNaFase || 0;
}

function formatKnockoutRatio(acertos, palpitesNaFase, fase) {
  const total = getKnockoutPhaseDenominator(fase, palpitesNaFase);
  if (!total && !acertos && !palpitesNaFase) return "—";
  return `${acertos}/${total}`;
}

function getKnockoutPhaseCell(faseStats, fase) {
  if (!faseStats) {
    const total = KNOCKOUT_PHASE_SLOTS[fase];
    return { text: total ? `0/${total}` : "—", acertos: 0, total: total || 0, pts: 0 };
  }
  const acertos = faseStats.acertos || 0;
  const palpites = faseStats.palpites || 0;
  const total = getKnockoutPhaseDenominator(fase, palpites);
  return {
    text: formatKnockoutRatio(acertos, palpites, fase),
    acertos,
    total,
    pts: faseStats.pts || 0,
  };
}

function ensurePlayerInMap(players, nome) {
  const key = normKeyPlayer(nome);
  if (!players.has(key)) {
    const meta = getPlayerMeta(nome);
    players.set(key, {
      chavePlanilha: key,
      nome: meta.nome,
      avatar: meta.avatar,
      cor: meta.cor,
      id: meta.id,
      ptsGrupos: 0,
      ptsMataMata: 0,
      palpitesMm: 0,
      acertosGrupos: 0,
      acertosExatos: 0,
      totalLinhas: 0,
    });
  }
  return players.get(key);
}

function buildRankings() {
  const groupRows = processGroupDataForRanking();
  const knockoutRows =
    MOCK_DATA.mataMata?.length > 0 ? processKnockoutData() : [];
  const players = new Map();

  const visivel = new Set(
    (MOCK_DATA.jogadoresPlanilha || []).map((j) => normKeyPlayer(j))
  );

  (MOCK_DATA.jogadoresPlanilha || []).forEach((nome) =>
    ensurePlayerInMap(players, nome)
  );

  groupRows.forEach((row) => {
    if (!visivel.has(normKeyPlayer(row.jogador))) return;
    const p = ensurePlayerInMap(players, row.jogador);
    p.ptsGrupos += row.pontos;
    if (rowTemPalpiteGrupo(row) && row.palpiteDaPlanilha === true) {
      p.totalLinhas += 1;
      if (row.pontos > 0) p.acertosGrupos += 1;
      if (resultadoParaPontos(row) && row.palpite === row.resultado) {
        p.acertosExatos += 1;
      }
    }
  });

  knockoutRows.forEach((row) => {
    if (!visivel.has(normKeyPlayer(row.jogador))) return;
    if (row.mmPaisDaPlanilha !== true) return;
    const p = ensurePlayerInMap(players, row.jogador);
    p.ptsMataMata += row.pontos;
    p.palpitesMm += 1;
  });

  const list = [...players.values()]
    .filter((p) => p.totalLinhas > 0 || (p.palpitesMm || 0) > 0)
    .map((p) => ({
      ...p,
      total: p.ptsGrupos + p.ptsMataMata,
      precisao:
        p.totalLinhas > 0
          ? Math.round((p.acertosExatos / p.totalLinhas) * 100)
          : 0,
    }));

  list.sort(
    (a, b) =>
      b.total - a.total ||
      b.ptsGrupos - a.ptsGrupos ||
      b.acertosExatos - a.acertosExatos
  );
  return list;
}

/** Pontos atrás do colocado imediatamente acima (null = 1º lugar). */
function getPtsBehindPrevious(rankings, rankIndexZeroBased) {
  if (rankIndexZeroBased <= 0 || !rankings.length) return null;
  const above = rankings[rankIndexZeroBased - 1];
  const current = rankings[rankIndexZeroBased];
  if (!above || !current) return null;
  return above.total - current.total;
}

function renderPtsGapLine(behind, { variant = "lb" } = {}) {
  if (behind === null) return "";
  const cls = variant === "podium" ? "podium-gap" : "lb-gap";
  if (behind === 0) {
    return `<span class="${cls} ${cls}--tie" title="Empatado com o acima">=</span>`;
  }
  return `<span class="${cls}" title="Pontos atrás do acima">−${behind}</span>`;
}

function getGroupResults(grupo, rowsIn = null) {
  const ordem = MOCK_DATA.classificacaoGrupos?.[grupo];
  const resultadosGrupo = MOCK_DATA.resultadosGrupos?.[grupo] || {};

  if (ordem?.length) {
    return ordem.map((pais) => ({
      pais,
      paisInfo: getCountryInfo(pais),
      resultado: resultadosGrupo[pais] ?? ordem.indexOf(pais) + 1,
    }));
  }

  const rows =
    rowsIn ?? processGroupData().filter((r) => r.grupo === grupo);
  const byCountry = {};

  rows.forEach((r) => {
    if (!resultadoNaPlanilha(r)) return;
    if (!byCountry[r.pais]) {
      byCountry[r.pais] = {
        pais: r.pais,
        paisInfo: r.paisInfo,
        resultado: Number(r.resultado),
      };
    }
  });

  return Object.values(byCountry).sort((a, b) => {
    if (a.resultado === 0 && b.resultado === 0) {
      return a.pais.localeCompare(b.pais);
    }
    if (a.resultado === 0) return 1;
    if (b.resultado === 0) return -1;
    return a.resultado - b.resultado || a.pais.localeCompare(b.pais);
  });
}

function getUniqueGroups() {
  return [...new Set((MOCK_DATA.faseGrupos || []).map((r) => r.grupo))].sort(
    (a, b) => a.localeCompare(b, "pt-BR")
  );
}

function findMostAccurate(rankings) {
  if (!rankings.length) return null;
  const sorted = [...rankings].sort(
    (a, b) =>
      b.precisao - a.precisao ||
      b.acertosExatos - a.acertosExatos ||
      b.total - a.total
  );
  return sorted[0];
}

/* ---------- Render helpers ---------- */

function ptsBadgeClass(pts) {
  if (pts === 0) return "pts-badge--0";
  if (pts === 1) return "pts-badge--1";
  if (pts === 2) return "pts-badge--2";
  return "pts-badge--3plus";
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Bandeira (img) + nome do país, sempre adjacentes (use dentro de um flex com nowrap).
 * @param {string} paisKey chave canónica (ex.: MEXICO)
 */
function countryFlagAndNameHtml(paisKey, options = {}) {
  const {
    imgClass = "standing-flag",
    nameClass = "standing-name",
    flagSize = 40,
    imgWidth = 22,
    imgHeight = 16,
  } = options;
  const info = getCountryInfo(paisKey);
  const src = flagUrl(info.codigo, flagSize);
  return `<img class="${imgClass}" src="${escapeHtml(src)}" alt="" width="${imgWidth}" height="${imgHeight}" loading="lazy" crossorigin="anonymous" /><span class="${nameClass}">${escapeHtml(info.nome)}</span>`;
}

/* ---------- Render: Header ---------- */

function renderHeader() {
  const { meta } = MOCK_DATA;
  document.getElementById("app-title").textContent = meta.titulo;
  document.getElementById("app-date").textContent =
    `Atualizado em ${meta.atualizadoEm}`;
}

function setSheetLoading(visible) {
  const el = document.getElementById("sheet-loading");
  if (el) el.hidden = !visible;
}

function updateSheetStatus({
  ok,
  rows,
  grupos,
  resultados,
  gruposComResultado,
  palpitesMataMata,
  resultadosMataMata,
  jogosMataMata,
  jogos,
  artilheiro,
  resultadoArtilheiros,
  error,
}) {
  const status = document.getElementById("sheet-status");
  const refresh = document.getElementById("btn-sheet-refresh");
  if (!status) return;

  status.hidden = false;
  if (refresh) refresh.hidden = false;

  if (ok) {
    status.className = "sheet-status sheet-status--ok";
    const res =
      resultados != null
        ? ` · ${resultados} resultado(s) em Resultados · ${gruposComResultado || 0} grupo(s) com placar`
        : "";
    const mm =
      palpitesMataMata != null
        ? ` · ${palpitesMataMata} palpite(s) mata-mata · ${resultadosMataMata || 0} classificado(s)`
        : "";
    const jogosMmTxt =
      jogosMataMata != null ? ` · ${jogosMataMata} jogo(s) mata-mata` : "";
    const jogosFaseTxt =
      jogos != null ? ` · ${jogos} jogo(s) (aba Jogos)` : "";
    const art =
      artilheiro != null ? ` · ${artilheiro} linha(s) Artilheiro` : "";
    const ra =
      resultadoArtilheiros != null
        ? ` · ${resultadoArtilheiros} linha(s) Resultados Artilheiros`
        : "";
    status.textContent = `Planilha conectada · ${rows} palpites (Palpites) · ${grupos} grupo(s)${res}${mm}${jogosMmTxt}${jogosFaseTxt}${art}${ra}`;
  } else {
    status.className = "sheet-status sheet-status--warn";
    status.textContent = error || "Não foi possível ler a planilha.";
  }
}

/* ---------- Render: Leaderboard ---------- */

function renderLeaderboard(rankings) {
  const list = document.getElementById("leaderboard-list");
  const maxPts = rankings[0]?.total || 1;
  const rest = rankings.slice(3);

  if (!rankings.length) {
    list.innerHTML = `<li class="lb-empty">Nenhum palpite na planilha ainda.</li>`;
    return;
  }

  if (!rest.length) {
    list.innerHTML =
      rankings.length <= 3
        ? `<li class="lb-empty">Os primeiros colocados estão no pódio acima.</li>`
        : `<li class="lb-empty">Menos de 4 jogadores no bolão.</li>`;
    return;
  }

  list.innerHTML = rest
    .map((p, i) => {
      const pos = i + 4;
      const meta = getPlayerMeta(p.nome);
      const pct = Math.round((p.total / maxPts) * 100);
      const delay = i * 0.06;
      const rIdx = i + 3;
      const behind = getPtsBehindPrevious(rankings, rIdx);
      const gapLine = renderPtsGapLine(behind, { variant: "lb" });

      return `
        <li class="lb-row" style="animation-delay:${delay}s">
          <span class="lb-pos">${pos}</span>
          <div class="lb-player">
            <div class="lb-avatar" style="border-color:${meta.cor};box-shadow:0 0 12px ${meta.cor}44">${meta.avatar}</div>
            <div>
              <div class="lb-name">${escapeHtml(p.nome)}</div>
              <div class="lb-rank-title">${escapeHtml(getRankTitle(pos))}</div>
              <div class="lb-bar-wrap">
                <div class="lb-bar" data-width="${pct}%" style="width:0"></div>
              </div>
            </div>
          </div>
          <div class="lb-pts-wrap">
            <span class="lb-pts">${p.total}</span>
            ${gapLine}
          </div>
        </li>`;
    })
    .join("");

  requestAnimationFrame(() => {
    list.querySelectorAll(".lb-bar").forEach((bar) => {
      bar.style.width = bar.dataset.width;
    });
  });
}

function renderStats(rankings, groupRows) {
  const row = document.getElementById("stats-row");
  const totalPts = rankings.reduce((s, p) => s + p.total, 0);
  const avgPts = rankings.length
    ? Math.round(totalPts / rankings.length)
    : 0;
  const grupos = getUniqueGroups().length;
  const ptsGrupos = rankings.reduce((s, p) => s + p.ptsGrupos, 0);

  row.innerHTML = `
    <div class="stat-pill">
      <span class="stat-pill-value">${rankings.length}</span>
      <span class="stat-pill-label">Jogadores</span>
    </div>
    <div class="stat-pill">
      <span class="stat-pill-value">${grupos}</span>
      <span class="stat-pill-label">Grupos</span>
    </div>
    <div class="stat-pill">
      <span class="stat-pill-value">${avgPts}</span>
      <span class="stat-pill-label">Média Pts</span>
    </div>
    <div class="stat-pill">
      <span class="stat-pill-value">${ptsGrupos}</span>
      <span class="stat-pill-label">Pts fase grupos</span>
    </div>`;
}

function renderMVP(rankings) {
  const mvp = findMostAccurate(rankings);
  const nameEl = document.getElementById("mvp-name");
  const detailEl = document.getElementById("mvp-detail");
  if (!mvp) {
    nameEl.textContent = "—";
    detailEl.textContent = hasPlanilhaData()
      ? "Aguardando palpites na planilha."
      : "Conecte a planilha para ver estatísticas.";
    return;
  }
  nameEl.textContent = mvp.nome;
  detailEl.textContent =
    `${mvp.precisao}% de posições exatas · ${mvp.acertosExatos} acertos · ${mvp.total} pts totais`;
}

/* ---------- Render: Podium ---------- */

function renderPodium(rankings) {
  const el = document.getElementById("podium-view");
  if (!rankings.length) {
    el.innerHTML = `<p class="empty-state">Nenhum palpite na planilha ainda.</p>`;
    return;
  }

  const top3 = rankings.slice(0, 3);
  const order =
    top3.length >= 3
      ? [top3[1], top3[0], top3[2]]
      : top3.length === 2
        ? [top3[1], top3[0], null]
        : [null, top3[0], null];
  const slots =
    top3.length >= 3 ? [2, 1, 3] : top3.length === 2 ? [2, 1, 3] : [2, 1, 3];

  el.innerHTML = order
    .map((p, idx) => {
      if (!p) return "";
      const slot = slots[idx];
      const rankPos =
        rankings.findIndex((r) => r.chavePlanilha === p.chavePlanilha) +
        1;
      const meta = getPlayerMeta(p.nome);
      const crown = slot === 1 ? '<span class="podium-crown">👑</span>' : "";
      const rankTitle = getRankTitle(rankPos);
      const rIdx = rankPos - 1;
      const behind = getPtsBehindPrevious(rankings, rIdx);
      const gapLine = renderPtsGapLine(behind, { variant: "podium" });

      return `
        <div class="podium-slot podium-slot--${slot}">
          <div style="position:relative">
            ${crown}
            <div class="podium-avatar" style="border-color:${meta.cor};background:${meta.cor}22">${meta.avatar}</div>
          </div>
          <div class="podium-name">${escapeHtml(p.nome)}</div>
          ${rankTitle ? `<div class="podium-rank-title">${escapeHtml(rankTitle)}</div>` : ""}
          <div class="podium-pts-wrap">
            <div class="podium-pts">${p.total} PTS</div>
            ${gapLine}
          </div>
          <div class="podium-block">${slot}</div>
        </div>`;
    })
    .join("");
}

/* ---------- Render: Groups ---------- */

let activeGroup = null;

function renderGroupTabs(groups) {
  const el = document.getElementById("group-tabs");
  if (!activeGroup) activeGroup = groups[0];

  const tabsHtml = [
    ...groups.map(
      (g) => `
      <button type="button" class="group-tab ${g === activeGroup ? "active" : ""}" data-group="${g}">
        GRUPO ${g}
      </button>`
    ),
    `<button type="button" class="group-tab group-tab--total ${activeGroup === GROUP_TAB_TOTAL ? "active" : ""}" data-group="${GROUP_TAB_TOTAL}">
      TOTAL
    </button>`,
  ].join("");

  el.innerHTML = tabsHtml;

  el.querySelectorAll(".group-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (typeof BolaoSounds !== "undefined") BolaoSounds.playSubTab();
      activeGroup = btn.dataset.group;
      renderGroups();
    });
  });
}

function getGroupPlayerTotals(rows) {
  const totals = new Map();
  rows.forEach((r) => {
    totals.set(r.jogador, (totals.get(r.jogador) || 0) + (r.pontos || 0));
  });
  return totals;
}

/**
 * Ordem fixa das colunas na tabela por grupo: lista em `MOCK_DATA.jogadores`,
 * depois nomes em `jogadoresPlanilha` que ainda não apareceram; por fim, quem
 * só existir nos dados, por nome (sem ordenar por pontos).
 */
function getFixedPlayerOrderKeys() {
  const keys = [];
  const seen = new Set();
  (MOCK_DATA.jogadores || []).forEach((j) => {
    const k = normKeyPlayer(j.id || j.nome);
    if (!k || seen.has(k)) return;
    seen.add(k);
    keys.push(k);
  });
  (MOCK_DATA.jogadoresPlanilha || []).forEach((raw) => {
    const k = normKeyPlayer(raw);
    if (!k || seen.has(k)) return;
    seen.add(k);
    keys.push(k);
  });
  return keys;
}

function sortPlayersFixedGroupOrder(playersInGroup) {
  const list = [...new Set(playersInGroup)];
  const keyFor = (j) => normKeyPlayer(j);
  const orderKeys = getFixedPlayerOrderKeys();
  const ordered = [];
  const used = new Set();
  orderKeys.forEach((k) => {
    const m = list.find((x) => keyFor(x) === k);
    if (m != null) {
      ordered.push(m);
      used.add(keyFor(m));
    }
  });
  const rest = list
    .filter((j) => !used.has(keyFor(j)))
    .sort((a, b) =>
      getPlayerMeta(a).nome.localeCompare(getPlayerMeta(b).nome, "pt-BR")
    );
  return [...ordered, ...rest];
}

function renderGroupUnified(grupo) {
  const rows = processGroupData().filter((r) => r.grupo === grupo);
  const standings = getGroupResults(grupo, rows);
  const totals = getGroupPlayerTotals(rows);
  const comPalpiteNesteGrupo = (j) =>
    rows.some(
      (r) =>
        r.jogador === j &&
        r.palpiteDaPlanilha === true &&
        rowTemPalpiteGrupo(r)
    );
  const players = sortPlayersFixedGroupOrder(
    [...new Set(rows.map((r) => r.jogador))].filter(comPalpiteNesteGrupo)
  );
  const el = document.getElementById("group-unified-table");
  if (!el) return;

  if (!players.length) {
    el.innerHTML =
      '<p class="empty-state">Ninguém com a coluna <strong>PALPITE</strong> preenchida (1–4) neste grupo ainda. Valores inferidos pela ordem das linhas não contam — preencha a célula na aba Palpites para a coluna aparecer aqui.</p>';
    return;
  }

  let html = `<table class="data-table data-table--unified" style="--player-cols:${players.length}"><thead><tr>
    <th class="th-selecao" scope="col"><span class="visually-hidden">Seleção</span></th>
    ${players
      .map((j) => {
        const pts = totals.get(j) || 0;
        const meta = getPlayerMeta(j);
        return `<th scope="col" class="th-jogador">
          <span class="th-jogador-name">
            <span class="th-jogador-avatar" style="border-color:${meta.cor}">${meta.avatar}</span>
            <span class="th-jogador-label">${escapeHtml(meta.nome)}</span>
          </span>
          <span class="th-jogador-pts">${pts} pts</span>
        </th>`;
      })
      .join("")}
  </tr></thead><tbody>`;

  standings.forEach((s) => {
    const pendente = s.resultado === 0;
    const advanceClass =
      !pendente && s.resultado <= 3 ? "standing-pos--advance" : "";
    const badge = pendente
      ? '<span class="standing-badge standing-badge--pending">—</span>'
      : s.resultado <= 3
        ? `<span class="standing-badge standing-badge--${s.resultado}">${s.resultado}º</span>`
        : `<span class="standing-badge">${s.resultado}º</span>`;

    html += `<tr>
      <td class="td-selecao">
        <div class="standing-row standing-row--unified">
          <span class="standing-pos ${advanceClass}">${pendente ? "—" : s.resultado}</span>
          <span class="standing-country-pair">${countryFlagAndNameHtml(s.pais, {
            imgClass: "standing-flag",
            nameClass: "standing-name",
            flagSize: 40,
            imgWidth: 22,
            imgHeight: 16,
          })}</span>
          ${badge}
        </div>
      </td>`;

    players.forEach((jogador) => {
      const cell = rows.find(
        (r) => r.pais === s.pais && r.jogador === jogador
      );
      if (!cell) {
        html += "<td>—</td>";
        return;
      }

      if (!rowTemPalpiteGrupo(cell)) {
        html += `<td>
        <div class="palpite-cell palpite-cell--sem-palpite">
          <span class="pos-dot pos-dot--sem-palpite" title="Sem palpite (0 ou traço na planilha)">-</span>
        </div>
      </td>`;
        return;
      }

      if (!resultadoNaPlanilha(cell)) {
        html += `<td>
        <div class="palpite-cell">
          <span class="pos-dot pos-dot--miss">${cell.palpite}</span>
          <span class="pts-badge pts-badge--pending" title="País sem linha na aba Resultados">—</span>
        </div>
      </td>`;
        return;
      }
      const hit =
        resultadoParaPontos(cell) && cell.palpite === cell.resultado;
      html += `<td>
        <div class="palpite-cell">
          <span class="pos-dot ${hit ? "pos-dot--hit" : "pos-dot--miss"}">${cell.palpite}</span>
          <span class="pts-badge ${ptsBadgeClass(cell.pontos)}">+${cell.pontos}</span>
        </div>
      </td>`;
    });

    html += `</tr>`;
  });

  html += "</tbody></table>";
  el.innerHTML = html;
}

function renderGroups() {
  const groups = getUniqueGroups();
  const tableEl = document.getElementById("group-unified-table");
  const tabsEl = document.getElementById("group-tabs");

  if (!groups.length) {
    tabsEl.innerHTML = "";
    tableEl.innerHTML =
      '<p class="empty-state">Nenhum grupo na planilha. Na aba Palpites use GRUPO, PAIS e JOGADOR (4 linhas por jogador, na ordem da classificação). Resultados na aba Resultados.</p>';
    return;
  }

  if (!activeGroup || (!groups.includes(activeGroup) && activeGroup !== GROUP_TAB_TOTAL)) {
    activeGroup = groups[0];
  }
  renderGroupTabs(groups);
  if (activeGroup === GROUP_TAB_TOTAL) {
    renderGroupTotal();
  } else {
    renderGroupUnified(activeGroup);
  }
}

/* ---------- Render: Knockout ---------- */

function renderKnockoutRules() {
  const el = document.getElementById("knockout-rules");
  if (!el) return;
  el.innerHTML = KNOCKOUT_PHASE_ORDER.map(
    (fase) => `
    <div class="knockout-rule">
      <span class="knockout-rule-pts">+${KNOCKOUT_POINTS[fase]}</span>
      <span class="knockout-rule-label">${KNOCKOUT_LABELS[fase]}</span>
    </div>`
  ).join("");
}

/** Índice fase|país → jogadores que pontuaram naquele palpite. */
function buildKnockoutAcertadoresIndex() {
  const index = new Map();
  processKnockoutData()
    .filter((row) => row.acertou && row.mmPaisDaPlanilha === true)
    .forEach((row) => {
      const key = `${row.fase}|${row.pais}`;
      if (!index.has(key)) index.set(key, []);
      const list = index.get(key);
      const jKey = normKeyPlayer(row.jogador);
      if (!list.some((e) => normKeyPlayer(e.jogador) === jKey)) {
        list.push({ jogador: row.jogador, meta: getPlayerMeta(row.jogador) });
      }
    });
  return index;
}

function getAcertadoresForPais(fase, pais, acertadoresIndex) {
  return [...(acertadoresIndex.get(`${fase}|${pais}`) || [])].sort((a, b) =>
    a.meta.nome.localeCompare(b.meta.nome, "pt-BR")
  );
}

/** Final e campeão: lista sempre aberta com nome completo de cada acertador. */
const BRACKET_FULL_NAME_PHASES = new Set(["final", "campeao"]);

function renderScorerEmojiRowLi(entry) {
  const nome = entry.meta?.nome || entry.jogador;
  return `<li class="bracket-scorer-emoji-slot bracket-scorer-emoji-slot--row" title="${escapeHtml(nome)}">
    <span class="bracket-scorer-emoji" aria-hidden="true">${entry.meta.avatar}</span>
  </li>`;
}

function renderTeamScorers(acertadores, paisNome, fase) {
  if (!acertadores.length) return "";

  if (BRACKET_FULL_NAME_PHASES.has(fase)) {
    const label = `${acertadores.length} acertador(es) em ${escapeHtml(paisNome)}`;
    const rows = acertadores
      .map((e) => {
        const nome = e.meta?.nome || e.jogador;
        return `<li class="bracket-scorers-final-item">
    <span class="bracket-scorers-final-emoji" aria-hidden="true">${e.meta.avatar}</span>
    <span class="bracket-scorers-final-name">${escapeHtml(nome)}</span>
  </li>`;
      })
      .join("");
    return `<div class="bracket-team-scorers-final">
    <ul class="bracket-scorers-final-list" aria-label="${label}">${rows}</ul>
  </div>`;
  }

  const n = acertadores.length;
  const stripLabel = `${n} acertador(es) em ${escapeHtml(paisNome)}`;
  const popLabel = `Acertadores em ${escapeHtml(paisNome)} — nomes completos`;
  const stripList = acertadores.map((e) => renderScorerEmojiRowLi(e)).join("");
  const popRows = acertadores
    .map((e) => {
      const nome = e.meta?.nome || e.jogador;
      return `<li class="bracket-team-popover-row">
    <span class="bracket-team-popover-emoji" aria-hidden="true">${e.meta.avatar}</span>
    <span class="bracket-team-popover-name">${escapeHtml(nome)}</span>
  </li>`;
    })
    .join("");

  return `<div class="bracket-team-scorers-hover-zone">
    <ul class="bracket-scorers-emoji-row bracket-scorers-emoji-row--strip" aria-label="${stripLabel}">${stripList}</ul>
    <aside class="bracket-team-popover" aria-label="${popLabel}" role="region">
      <div class="bracket-team-popover-inner">
        <ul class="bracket-team-popover-list">${popRows}</ul>
      </div>
    </aside>
  </div>`;
}

function bracketTeamLine(paisKey, fase, acertadoresIndex) {
  const info = getCountryInfo(paisKey);
  const acertadores = getAcertadoresForPais(fase, paisKey, acertadoresIndex);
  const n = acertadores.length;
  const countBadge =
    n > 0
      ? `<span class="bracket-acertadores-count" title="${n} jogador(es) pontuaram neste país">${n}</span>`
      : "";
  const fullPhase = BRACKET_FULL_NAME_PHASES.has(fase);
  const head = `<div class="bracket-team-line-head">
    <div class="bracket-team">
      ${countryFlagAndNameHtml(paisKey, {
        imgClass: "bracket-team-flag",
        nameClass: "bracket-team-name",
        flagSize: 40,
        imgWidth: 28,
        imgHeight: 20,
      })}
    </div>
    ${countBadge}
    </div>`;
  const scorers = renderTeamScorers(acertadores, info.nome, fase);
  const inner = `${head}${scorers}`;
  if (!fullPhase && n > 0) {
    return `<div class="bracket-team-line bracket-team-line--hover-legend">
    <div class="bracket-team-hover-anchor" tabindex="0">
    ${inner}
    </div>
  </div>`;
  }
  return `<div class="bracket-team-line">${inner}</div>`;
}

function bracketMatchBadge(meta, index) {
  if (meta.fase === "campeao") return "";
  const n = index + 1;
  return meta.badgePrefix ? `${meta.badgePrefix}${n}` : String(n);
}

function bracketMatchCard(jogo, acertadoresIndex) {
  if (jogo.campeao || !jogo.pais2) {
    return `<div class="bracket-match-card bracket-match-card--champion">
      ${bracketTeamLine(jogo.pais1, jogo.fase, acertadoresIndex)}
    </div>`;
  }
  return `<div class="bracket-match-card">
    ${bracketTeamLine(jogo.pais1, jogo.fase, acertadoresIndex)}
    ${bracketTeamLine(jogo.pais2, jogo.fase, acertadoresIndex)}
  </div>`;
}

function getBracketGridPlacement(fase, index, totalOitavas) {
  const rows = Math.max(totalOitavas * 2, 8);
  const phaseTotals = {
    oitavas: totalOitavas,
    quartas: Math.max(Math.ceil(totalOitavas / 2), 1),
    semi: Math.max(Math.ceil(totalOitavas / 4), 1),
    final: 1,
    campeao: 1,
  };
  const count = phaseTotals[fase] || 1;
  const span = Math.max(Math.floor(rows / count), 1);
  const rowStart = index * span + 1;
  return { rowStart, rowSpan: span };
}

function renderBracketColumn(meta, jogos, totalOitavas, acertadoresIndex) {
  const fase = meta.fase;
  const label = KNOCKOUT_LABELS[fase];
  const maxPts = KNOCKOUT_PHASE_SLOTS[fase];
  const isChampionCol = fase === "campeao";

  const matchesHtml = jogos.length
    ? jogos
        .map((jogo, i) => {
          const badge = bracketMatchBadge(meta, i);
          const { rowStart, rowSpan } = getBracketGridPlacement(
            fase,
            i,
            totalOitavas
          );
          return `<article class="bracket-match" style="grid-row: ${rowStart} / span ${rowSpan}">
            ${badge ? `<span class="bracket-match-badge">${badge}</span>` : ""}
            ${bracketMatchCard(jogo, acertadoresIndex)}
          </article>`;
        })
        .join("")
    : `<p class="bracket-empty">Sem jogos</p>`;

  return `<div class="bracket-col bracket-col--${fase}" data-fase="${fase}">
    <header class="bracket-col-head">
      <h3 class="bracket-col-title">${label}</h3>
      <p class="bracket-col-rule">${meta.ptsLabel} | Máximo: ${maxPts}</p>
    </header>
    <div class="bracket-col-matches" style="--bracket-rows: ${Math.max(totalOitavas * 2, 8)}">
      ${isChampionCol ? `<div class="bracket-champion-label" aria-hidden="true">🏆 Campeão</div>` : ""}
      ${matchesHtml}
    </div>
  </div>`;
}

function renderBracketSummary() {
  const el = document.getElementById("bracket-summary");
  if (!el) return;
  el.innerHTML = KNOCKOUT_PHASE_ORDER.map((fase) => `
    <div class="bracket-summary-item">
      <span class="bracket-summary-icon" aria-hidden="true">🎯</span>
      <span class="bracket-summary-fase">${KNOCKOUT_LABELS[fase]}</span>
      <span class="bracket-summary-pts">+${KNOCKOUT_POINTS[fase]} / máx. ${KNOCKOUT_PHASE_SLOTS[fase]}</span>
    </div>`
  ).join("");
}

function renderBracket() {
  const board = document.getElementById("bracket-board");
  if (!board) return;

  const porFase = MOCK_DATA.jogosMataMataPorFase || {};
  const jogos = MOCK_DATA.jogosMataMata || [];
  const totalOitavas = (porFase.oitavas || []).length || 8;

  renderBracketSummary();

  if (!jogos.length) {
    board.innerHTML =
      '<p class="empty-state bracket-empty-state">Nenhum jogo na aba <strong>JOGOS MATA MATA</strong>. Atualize a planilha.</p>';
    return;
  }

  const acertadoresIndex = buildKnockoutAcertadoresIndex();

  board.innerHTML = BRACKET_PHASE_META.map((meta) =>
    renderBracketColumn(
      meta,
      porFase[meta.fase] || [],
      totalOitavas,
      acertadoresIndex
    )
  ).join("");

  board.style.setProperty("--bracket-rows", String(Math.max(totalOitavas * 2, 8)));
}

function renderKnockoutScores(rankings, knockoutRows) {
  const el = document.getElementById("knockout-scores");
  if (!el) return;

  const mmByPlayer = buildKnockoutPlayerTotals(knockoutRows);
  const rankingMap = new Map(
    rankings.map((r) => [r.chavePlanilha, r])
  );

  const players = [...rankingMap.values()].map((r) => {
    const mm =
      mmByPlayer.find(
        (x) => normKeyPlayer(x.jogador) === r.chavePlanilha
      ) || {
      pts: 0,
      acertos: 0,
      palpites: 0,
      porFase: {},
    };
    return {
      ...r,
      ptsMm: mm.pts,
      acertosMm: mm.acertos,
      palpitesMm: mm.palpites,
      porFase: mm.porFase,
      totalGeral: r.ptsGrupos + mm.pts,
    };
  });

  players.sort(
    (a, b) =>
      b.totalGeral - a.totalGeral ||
      b.ptsMm - a.ptsMm ||
      b.ptsGrupos - a.ptsGrupos
  );

  if (!players.length) {
    el.innerHTML =
      '<p class="empty-state">Nenhum participante com palpites carregados.</p>';
    return;
  }

  const phaseHeads = KNOCKOUT_PHASE_ORDER.map(
    (f) =>
      `<span class="mm-score-fase mm-score-fase--head" title="+${KNOCKOUT_POINTS[f]} pts por acerto">${KNOCKOUT_LABELS[f]}</span>`
  ).join("");

  el.innerHTML = `
    <div class="mm-score-head">
      <span class="mm-score-col mm-score-col--player">Jogador</span>
      <span class="mm-score-col mm-score-col--grupos">Grupos</span>
      ${phaseHeads}
      <span class="mm-score-col mm-score-col--pts">Pts MM</span>
      <span class="mm-score-col mm-score-col--total">Total</span>
    </div>
    <ul class="mm-score-list">
      ${players
        .map((p) => {
          const meta = getPlayerMeta(p.nome);
          const mm = mmByPlayer.find(
            (x) => normKeyPlayer(x.jogador) === p.chavePlanilha
          );
          const faseCells = KNOCKOUT_PHASE_ORDER.map((fase) => {
            const cell = getKnockoutPhaseCell(mm?.porFase?.[fase], fase);
            const pct =
              cell.total > 0 ? Math.round((cell.acertos / cell.total) * 100) : 0;
            const hitClass =
              cell.acertos > 0
                ? pct >= 50
                  ? "mm-score-fase--hit"
                  : "mm-score-fase--partial"
                : "";
            return `<span class="mm-score-fase ${hitClass}" title="${cell.acertos} acerto(s) · +${cell.pts} pts">
              <span class="mm-ratio">${cell.text}</span>
            </span>`;
          }).join("");
          return `
          <li class="mm-score-row">
            <span class="mm-score-col mm-score-col--player">
              <span class="mm-score-avatar" style="border-color:${meta.cor}">${meta.avatar}</span>
              ${escapeHtml(p.nome)}
            </span>
            <span class="mm-score-col mm-score-col--grupos">${p.ptsGrupos}</span>
            ${faseCells}
            <span class="mm-score-col mm-score-col--pts">${p.ptsMm}</span>
            <span class="mm-score-col mm-score-col--total">${p.totalGeral}</span>
          </li>`;
        })
        .join("")}
    </ul>`;
}

function renderKnockout() {
  const knockoutRows = processKnockoutData();
  const rankings = buildRankings();
  renderKnockoutRules();
  renderKnockoutScores(rankings, knockoutRows);
}

/* ---------- Guia Artilheiro — mapa de bolhas (arti-bubbles.js) ---------- */

function renderPicksPage() {
  const wrap = document.getElementById("arti-bubble-wrap");
  if (!wrap) return;

  if (!hasPlanilhaData()) {
    if (typeof ArtiBubbles !== "undefined") ArtiBubbles.destroy();
    wrap.hidden = true;
    return;
  }

  wrap.hidden = false;
  if (typeof ArtiBubbles !== "undefined") ArtiBubbles.render();
}

const CAL_WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function pad2(n) {
  return String(n).padStart(2, "0");
}

function startOfLocalDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dateKeyLocal(d) {
  const x = startOfLocalDay(d);
  return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
}

function parseLocalDateKey(key) {
  const m = String(key).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const day = parseInt(m[3], 10);
  const d = new Date(y, mo - 1, day);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Planilhas Google: DATE(ano, mês 1–12, dia), número serial, AAAA-MM-DD (com ou sem hora), ou **dia/mês[/ano]** (Brasil). */
function parseJogoDateUniversal(raw) {
  if (raw === undefined || raw === null) return null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) {
    return new Date(raw.getFullYear(), raw.getMonth(), raw.getDate());
  }
  if (Array.isArray(raw) && raw.length >= 3) {
    const y = Number(raw[0]);
    const m0 = Number(raw[1]);
    const d = Number(raw[2]);
    if (
      [y, m0, d].every(Number.isFinite) &&
      m0 >= 0 &&
      m0 <= 11 &&
      d >= 1 &&
      d <= 31 &&
      y >= 1900 &&
      y <= 2100
    ) {
      const dt = new Date(y, m0, d);
      return Number.isNaN(dt.getTime()) ? null : dt;
    }
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return sheetsSerialToLocalDate(raw);
  }
  const s = String(raw).trim();
  if (!s || s === "—") return null;

  const t = normalizeJogoDateString(s);
  if (!t) return null;

  const dm = t.match(
    /^DATE\s*\(\s*(\d{1,4})\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})\s*\)\s*$/i
  );
  if (dm) {
    const y = parseInt(dm[1], 10);
    const month = parseInt(dm[2], 10);
    const day = parseInt(dm[3], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const dt = new Date(y, month - 1, day);
    return Number.isNaN(dt.getTime()) ? null : dt;
  }

  const serial = t.match(/^(\d{5,6})(?:\.\d+)?$/);
  if (serial) {
    const n = parseInt(serial[1], 10);
    const d = sheetsSerialToLocalDate(n);
    if (d) return d;
  }

  /** ISO AAAA-MM-DD (só data). */
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const y = parseInt(iso[1], 10);
    const month = parseInt(iso[2], 10);
    const day = parseInt(iso[3], 10);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const dt = new Date(y, month - 1, day);
      if (!Number.isNaN(dt.getTime())) return dt;
    }
  }

  const isoLoose = parseIsoYyyyMmDdPrefix(t);
  if (isoLoose) return isoLoose;

  const ptBr = parsePtBrLooseDateText(t);
  if (ptBr) return ptBr;

  return parseSlashDatePreferBrAmbiguous(t);
}

function normalizeJogoDateString(s) {
  let x = String(s ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/^=\s*/, "");
  x = x.replace(/[\u200e\u200f\u202a-\u202e]/g, "");
  x = x.replace(/[\u2215\u2044\uFF0F／]/g, "/");
  return x.trim();
}

/** `2026-06-09T00:00:00.000Z` ou `2026-06-09 00:00:00` (exportação / JSON). */
function parseIsoYyyyMmDdPrefix(t) {
  const m = String(t).match(/^(\d{4})-(\d{2})-(\d{2})(?:[T\s].*)?$/i);
  if (!m) return null;
  const y = parseInt(m[1], 10);
  const mo = parseInt(m[2], 10);
  const d = parseInt(m[3], 10);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const dt = new Date(y, mo - 1, d);
  if (Number.isNaN(dt.getTime())) return null;
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d)
    return null;
  return dt;
}

/** Planilha em português: «9 de jul. de 2026», «09 de julho de 2026» (valor `f` do gviz). */
const PT_MES_PALAVRA_PARA_NUM = new Map(
  Object.entries({
    janeiro: 1,
    jan: 1,
    fevereiro: 2,
    fev: 2,
    marco: 3,
    mar: 3,
    abril: 4,
    abr: 4,
    maio: 5,
    mai: 5,
    junho: 6,
    jun: 6,
    julho: 7,
    jul: 7,
    agosto: 8,
    ago: 8,
    setembro: 9,
    set: 9,
    outubro: 10,
    out: 10,
    novembro: 11,
    nov: 11,
    dezembro: 12,
    dez: 12,
  })
);

function parsePtBrLooseDateText(tRaw) {
  const t = normalizeJogoDateString(tRaw).replace(/\s+/g, " ").trim();
  if (!t) return null;
  const tl = t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ç/g, "c")
    .toLowerCase();
  const m = tl.match(/^(\d{1,2})\s+de\s+([a-z]+)\.?\s+de\s+(\d{4})\s*$/i);
  if (!m) return null;
  const day = parseInt(m[1], 10);
  const monWord = m[2].replace(/\.$/, "");
  const year = parseInt(m[3], 10);
  const month = PT_MES_PALAVRA_PARA_NUM.get(monWord);
  if (!month || day < 1 || day > 31) return null;
  const dt = new Date(year, month - 1, day);
  if (Number.isNaN(dt.getTime())) return null;
  if (
    dt.getFullYear() !== year ||
    dt.getMonth() !== month - 1 ||
    dt.getDate() !== day
  ) {
    return null;
  }
  return dt;
}

/**
 * Texto **dia/mês[/ano]** (Brasil). Com **ano de 4 dígitos** (ex.: 09/06/2026) valida calendário e,
 * em empate dia/mês vs mês/dia, prefere **dia/mês** (o que a barra de fórmulas mostra em pt-BR).
 * Sem ano completo, ambíguo usa a janela da Copa 2026.
 */
function parseSlashDatePreferBrAmbiguous(raw) {
  const t0 = normalizeJogoDateString(raw);
  if (!t0) return null;
  const t = t0.replace(/\s/g, "");

  const m4 = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (m4) {
    const a = parseInt(m4[1], 10);
    const b = parseInt(m4[2], 10);
    const y = parseInt(m4[3], 10);
    const buildY = (day, month) => {
      if (month < 1 || month > 12 || day < 1 || day > 31) return null;
      const dt = new Date(y, month - 1, day);
      if (Number.isNaN(dt.getTime())) return null;
      if (
        dt.getFullYear() !== y ||
        dt.getMonth() !== month - 1 ||
        dt.getDate() !== day
      ) {
        return null;
      }
      return dt;
    };
    const asBr = buildY(a, b);
    const asUs = buildY(b, a);
    if (asBr && !asUs) return asBr;
    if (asUs && !asBr) return asUs;
    if (asBr && asUs && asBr.getTime() === asUs.getTime()) return asBr;

    const copaStart = new Date(2026, 4, 15).getTime();
    const copaEnd = new Date(2026, 6, 31, 23, 59, 59, 999).getTime();
    const inCopa = (dt) => {
      if (!dt) return false;
      const x = dt.getTime();
      return x >= copaStart && x <= copaEnd;
    };
    const brIn = inCopa(asBr);
    const usIn = inCopa(asUs);
    if (brIn && !usIn) return asBr;
    if (usIn && !brIn) return asUs;
    if (asBr && asUs) return asBr;
    return asBr || asUs;
  }

  const m = t.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/);
  if (!m) return null;
  const a = parseInt(m[1], 10);
  const b = parseInt(m[2], 10);
  let year = 2026;
  if (m[3]) {
    const yy = parseInt(m[3], 10);
    year = yy < 100 ? 2000 + yy : yy;
  }
  const build2 = (day, month) => {
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const dt = new Date(year, month - 1, day);
    if (Number.isNaN(dt.getTime())) return null;
    if (
      dt.getFullYear() !== year ||
      dt.getMonth() !== month - 1 ||
      dt.getDate() !== day
    ) {
      return null;
    }
    return dt;
  };

  if (a > 12) return build2(a, b);
  if (b > 12) return build2(b, a);

  const asBr = build2(a, b);
  const asUs = build2(b, a);
  if (asBr && asUs && asBr.getTime() === asUs.getTime()) return asBr;

  const copaStart = new Date(2026, 4, 15).getTime();
  const copaEnd = new Date(2026, 6, 31, 23, 59, 59, 999).getTime();
  const inCopa = (dt) => {
    if (!dt) return false;
    const x = dt.getTime();
    return x >= copaStart && x <= copaEnd;
  };

  const brIn = inCopa(asBr);
  const usIn = inCopa(asUs);
  if (brIn && !usIn) return asBr;
  if (usIn && !brIn) return asUs;

  return asBr || asUs;
}

/** Epoch alinhado a planilhas (30/12/1899 local) + dias inteiros. */
function sheetsSerialToLocalDate(serial) {
  const n = Math.floor(Number(serial));
  if (!Number.isFinite(n) || n < 1 || n > 800000) return null;
  const epoch = new Date(1899, 11, 30);
  const d = new Date(
    epoch.getFullYear(),
    epoch.getMonth(),
    epoch.getDate() + n
  );
  return Number.isNaN(d.getTime()) ? null : d;
}

function jogoDataSortKey(dataStr) {
  const d = parseJogoDateUniversal(dataStr);
  if (!d) return Number.MAX_SAFE_INTEGER;
  return startOfLocalDay(d).getTime();
}

function formatDateLongTitlePt(d) {
  if (!d || Number.isNaN(d.getTime())) return "";
  try {
    const w = d.toLocaleDateString("pt-BR", { weekday: "long" });
    const rest = d.toLocaleDateString("pt-BR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    return `${w.charAt(0).toUpperCase()}${w.slice(1)} · ${rest}`;
  } catch {
    return "";
  }
}

function formatMonthRangeTitlePt(dMin, dMax) {
  if (!dMin || !dMax) return "";
  const same =
    dMin.getMonth() === dMax.getMonth() &&
    dMin.getFullYear() === dMax.getFullYear();
  if (same) {
    const t = dMin.toLocaleDateString("pt-BR", {
      month: "long",
      year: "numeric",
    });
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  const a = dMin.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  const b = dMax.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
  return `${a} – ${b}`;
}

function startOfWeekSunday(d) {
  const s = startOfLocalDay(d);
  const day = s.getDay();
  s.setDate(s.getDate() - day);
  return s;
}

function endOfWeekSaturday(d) {
  const s = startOfWeekSunday(d);
  const e = new Date(s.getFullYear(), s.getMonth(), s.getDate() + 6);
  return startOfLocalDay(e);
}

function horaJogoSortKey(hora) {
  const s = String(hora ?? "").trim();
  const m = s.match(/(\d{1,2})/);
  if (!m) return 999;
  const n = parseInt(m[1], 10);
  return Number.isFinite(n) ? n : 999;
}

/** Minutos no dia a partir de "16h", "23h", "16:30". */
function horaToMinutesLocal(horaRaw) {
  const s = String(horaRaw ?? "").trim().toLowerCase();
  const m = s.match(/(\d{1,2})\s*h?\s*(?::(\d{1,2}))?/);
  if (!m) return null;
  const hh = parseInt(m[1], 10);
  const mm = m[2] != null ? parseInt(m[2], 10) : 0;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return hh * 60 + mm;
}

function minutesNowLocal() {
  const n = new Date();
  return n.getHours() * 60 + n.getMinutes();
}

function calendarCellDayCategory(cellDate, now = new Date()) {
  const t0 = startOfLocalDay(now).getTime();
  const t1 = startOfLocalDay(cellDate).getTime();
  if (t1 < t0) return "past";
  if (t1 > t0) return "future";
  return "today";
}

function calendarMatchTimeCategory(horaRaw, now = new Date()) {
  const hm = horaToMinutesLocal(horaRaw);
  if (hm == null) return "unknown";
  const nowM = minutesNowLocal();
  if (hm < nowM) return "past";
  return "today";
}

function buildCalendarGridFromJogos(jogos, now = new Date()) {
  const byKey = new Map();
  const unknown = [];

  (jogos || []).forEach((j) => {
    const dt = parseJogoDateUniversal(j.data);
    if (!dt) {
      unknown.push(j);
      return;
    }
    const key = dateKeyLocal(dt);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(j);
  });

  byKey.forEach((arr) => {
    arr.sort((a, b) => horaJogoSortKey(a.hora) - horaJogoSortKey(b.hora));
  });

  const keys = [...byKey.keys()].sort();
  if (!keys.length) {
    return { cells: [], unknown, monthTitle: "" };
  }

  const minD = parseLocalDateKey(keys[0]);
  const maxD = parseLocalDateKey(keys[keys.length - 1]);
  if (!minD || !maxD) {
    return { cells: [], unknown, monthTitle: "" };
  }

  /** Incluir sempre o dia civil de hoje na grelha (efeito “hoje” / fogo), mesmo sem jogos. */
  const today0 = startOfLocalDay(now);
  const rangeMin = new Date(Math.min(minD.getTime(), today0.getTime()));
  const rangeMax = new Date(Math.max(maxD.getTime(), today0.getTime()));

  const gridStart = startOfWeekSunday(rangeMin);
  const gridEnd = endOfWeekSaturday(rangeMax);
  const cells = [];
  const iter = new Date(gridStart);
  while (iter.getTime() <= gridEnd.getTime()) {
    const key = dateKeyLocal(iter);
    cells.push({
      date: new Date(iter.getFullYear(), iter.getMonth(), iter.getDate()),
      key,
      matches: byKey.get(key) || [],
    });
    iter.setDate(iter.getDate() + 1);
  }

  const monthTitle = formatMonthRangeTitlePt(rangeMin, rangeMax);
  return { cells, unknown, monthTitle };
}

/** Jogo do Brasil no calendário (chave canónica ou código de bandeira `br`). */
function isSelecaoBrasilPaisKey(paisKey) {
  return getCountryInfo(paisKey).codigo === "br";
}

function calendarMatchHasBrasil(m) {
  return isSelecaoBrasilPaisKey(m?.pais1) || isSelecaoBrasilPaisKey(m?.pais2);
}

function calendarTeamFlagNameHtml(paisKey) {
  const br = isSelecaoBrasilPaisKey(paisKey);
  return countryFlagAndNameHtml(paisKey, {
    imgClass: br
      ? "calendar-team-flag calendar-team-flag--brasil"
      : "calendar-team-flag",
    nameClass: br
      ? "calendar-team-name calendar-team-name--brasil"
      : "calendar-team-name",
    flagSize: br ? 56 : 40,
    imgWidth: br ? 26 : 22,
    imgHeight: br ? 17 : 15,
  });
}

function renderCalendarMatchHtml(m, dayCategory, now = new Date()) {
  const hora = String(m.hora ?? "").trim();
  const timeClass = hora
    ? "calendar-match__time"
    : "calendar-match__time calendar-match__time--tbd";
  const timeLabel = hora || "—";

  let timeCat = "";
  if (dayCategory === "today") {
    timeCat = calendarMatchTimeCategory(m.hora, now);
  }

  const matchClasses = ["calendar-match"];
  if (dayCategory === "today") {
    matchClasses.push("calendar-match--today");
    if (timeCat === "past") matchClasses.push("calendar-match--past");
  } else if (dayCategory === "future") {
    matchClasses.push("calendar-match--future");
  } else if (dayCategory === "past") {
    matchClasses.push("calendar-match--past");
  }
  if (calendarMatchHasBrasil(m)) matchClasses.push("calendar-match--brasil");

  const grupo =
    m.grupo && String(m.grupo).trim()
      ? `<div class="calendar-match__meta"><span class="calendar-badge-grupo">Grupo ${escapeHtml(String(m.grupo).trim())}</span></div>`
      : "";

  return `<li class="${matchClasses.join(" ")}">
    <div class="${timeClass}">${escapeHtml(timeLabel)}</div>
    <div class="calendar-match__teams">
      <div class="calendar-team">${calendarTeamFlagNameHtml(m.pais1)}</div>
      <div class="calendar-team">${calendarTeamFlagNameHtml(m.pais2)}</div>
    </div>${grupo}
  </li>`;
}

function renderCalendarUnknownBucket(matches) {
  if (!matches.length) return "";
  const inner = matches
    .map((m) => renderCalendarMatchHtml(m, "future"))
    .join("");
  return `<div class="calendar-unknown">
    <h4>Sem data reconhecida</h4>
    <ol class="calendar-cell-matches">${inner}</ol>
  </div>`;
}

function renderCalendar() {
  const body = document.getElementById("calendar-body");
  if (!body) return;

  const jogos = Array.isArray(MOCK_DATA.jogos) ? MOCK_DATA.jogos : [];
  const now = new Date();

  if (!jogos.length) {
    body.innerHTML = `<div class="calendar-empty">Sem jogos na planilha.</div>`;
    return;
  }

  const { cells, unknown, monthTitle } = buildCalendarGridFromJogos(jogos, now);

  if (!cells.length && unknown.length) {
    body.innerHTML = renderCalendarUnknownBucket(unknown);
    return;
  }

  if (!cells.length) {
    body.innerHTML = `<div class="calendar-empty">Sem datas válidas na coluna Data.</div>`;
    return;
  }

  const weekdaysHtml = CAL_WEEKDAY_LABELS.map(
    (lab) => `<span>${escapeHtml(lab)}</span>`
  ).join("");

  const cellsHtml = cells
    .map((cell) => {
      const dayCat = calendarCellDayCategory(cell.date, now);
      const cellClasses = ["calendar-cell", `calendar-cell--${dayCat}`];
      if (!cell.matches.length) cellClasses.push("calendar-cell--empty");

      const dow = CAL_WEEKDAY_LABELS[cell.date.getDay()];
      const dayNum = cell.date.getDate();
      const monthShort = cell.date.toLocaleDateString("pt-BR", {
        month: "short",
      });

      if (!cell.matches.length) {
        return `<div class="${cellClasses.join(" ")}" aria-label="${escapeHtml(
          `${dow} ${dayNum}`
        )}">
          <div class="calendar-cell-head">
            <span class="calendar-cell-dow">${escapeHtml(dow)}</span>
            <span class="calendar-cell-daynum">${dayNum}</span>
            <span class="calendar-cell-month">${escapeHtml(monthShort)}</span>
          </div>
        </div>`;
      }

      const matchesHtml = cell.matches
        .map((m) => renderCalendarMatchHtml(m, dayCat, now))
        .join("");

      return `<div class="${cellClasses.join(" ")}" role="gridcell" aria-label="${escapeHtml(
        formatDateLongTitlePt(cell.date)
      )}">
        <div class="calendar-cell-head">
          <span class="calendar-cell-dow">${escapeHtml(dow)}</span>
          <span class="calendar-cell-daynum">${dayNum}</span>
          <span class="calendar-cell-month">${escapeHtml(monthShort)}</span>
        </div>
        <ol class="calendar-cell-matches">${matchesHtml}</ol>
      </div>`;
    })
    .join("");

  const unknownBlock = renderCalendarUnknownBucket(unknown);

  body.innerHTML = `<div class="calendar-real card card--glass">
    <h3 class="calendar-real__title">${escapeHtml(monthTitle || "Jogos")}</h3>
    <div class="calendar-weekdays" role="row">${weekdaysHtml}</div>
    <div class="calendar-grid" role="grid">${cellsHtml}</div>
    ${unknownBlock}
  </div>`;

  requestAnimationFrame(() => {
    const todayEl = body.querySelector(".calendar-cell--today");
    if (todayEl) {
      todayEl.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  });
}

/* ---------- X1 ---------- */

function getDuelPlayerKeys() {
  const set = new Set();
  (MOCK_DATA.jogadoresPlanilha || []).forEach((n) => {
    const k = normKeyPlayer(n);
    if (k) set.add(k);
  });
  if (!set.size) {
    (MOCK_DATA.faseGrupos || []).forEach((r) => {
      const k = normKeyPlayer(r.jogador);
      if (k) set.add(k);
    });
  }
  return [...set].sort((a, b) =>
    getPlayerMeta(a).nome.localeCompare(getPlayerMeta(b).nome, "pt-BR")
  );
}

function fillDuelSelects() {
  const selA = document.getElementById("duel-select-a");
  const selB = document.getElementById("duel-select-b");
  if (!selA || !selB) return;
  const keys = getDuelPlayerKeys();
  const prevA = selA.value;
  const prevB = selB.value;
  const opts =
    `<option value="">— escolher —</option>` +
    keys
      .map((k) => {
        const m = getPlayerMeta(k);
        return `<option value="${escapeHtml(k)}">${escapeHtml(m.nome)}</option>`;
      })
      .join("");
  selA.innerHTML = opts;
  selB.innerHTML = opts;
  let va = keys.includes(prevA) ? prevA : keys[0] || "";
  let vb = keys.includes(prevB) ? prevB : keys[1] || keys[0] || "";
  if (va && vb && va === vb && keys.length > 1) {
    vb = keys.find((k) => k !== va) || vb;
  }
  selA.value = va;
  selB.value = vb;
}

function duelPalpitePtsCell(row) {
  if (!row || row.palpiteDaPlanilha !== true || !rowTemPalpiteGrupo(row)) {
    return { label: "—", pts: 0 };
  }
  const pts = resultadoParaPontos(row) ? row.pontos : 0;
  return { label: String(row.palpite), pts };
}

/** Célula «Classif.» no X1 — destaque forte em Sim. */
function duelClassifCellHtml(ok) {
  if (ok === "Sim") {
    return `<span class="duel-classif duel-classif--sim" title="Acertou a classificação">Sim</span>`;
  }
  if (ok === "Não") {
    return `<span class="duel-classif duel-classif--nao">Não</span>`;
  }
  return `<span class="duel-classif duel-classif--empty">—</span>`;
}

function grupoPaisKeyFromParts(grupo, pais) {
  return `${grupo}|${pais}`;
}

function splitGrupoPaisKey(cellKey) {
  const i = String(cellKey).indexOf("|");
  if (i < 0) return { grupo: "", pais: cellKey };
  return { grupo: cellKey.slice(0, i), pais: cellKey.slice(i + 1) };
}

function buildDuelGroupMatrix(keyA, keyB) {
  const rows = processGroupData();
  const mapA = new Map();
  const mapB = new Map();
  rows.forEach((r) => {
    const k = normKeyPlayer(r.jogador);
    if (!r.grupo || !r.pais) return;
    const ck = grupoPaisKeyFromParts(r.grupo, r.pais);
    if (k === keyA) mapA.set(ck, r);
    if (k === keyB) mapB.set(ck, r);
  });
  const keys = new Set([...mapA.keys(), ...mapB.keys()]);
  return [...keys]
    .sort((ka, kb) => {
      const a = splitGrupoPaisKey(ka);
      const b = splitGrupoPaisKey(kb);
      return (
        String(a.grupo).localeCompare(String(b.grupo), "pt-BR") ||
        String(a.pais).localeCompare(String(b.pais), "pt-BR")
      );
    })
    .map((cellKey) => {
      const ra = mapA.get(cellKey);
      const rb = mapB.get(cellKey);
      let res = null;
      if (ra && resultadoNaPlanilha(ra)) res = Number(ra.resultado);
      else if (rb && resultadoNaPlanilha(rb)) res = Number(rb.resultado);
      const { grupo, pais } = splitGrupoPaisKey(cellKey);
      return { cellKey, grupo, pais, ra, rb, res };
    });
}

function buildDuelKnockoutMatrix(keyA, keyB) {
  const rows = processKnockoutData();
  const mapA = new Map();
  const mapB = new Map();
  rows.forEach((r) => {
    if (r.mmPaisDaPlanilha !== true) return;
    const k = normKeyPlayer(r.jogador);
    const ck = `${r.fase}|${r.pais}`;
    if (k === keyA) mapA.set(ck, r);
    if (k === keyB) mapB.set(ck, r);
  });
  const keys = new Set([...mapA.keys(), ...mapB.keys()]);
  const orderIdx = (f) => {
    const i = KNOCKOUT_PHASE_ORDER.indexOf(f);
    return i < 0 ? 99 : i;
  };
  return [...keys]
    .sort((ka, kb) => {
      const [fa, pa] = ka.split("|");
      const [fb, pb] = kb.split("|");
      return (
        orderIdx(fa) - orderIdx(fb) ||
        String(pa).localeCompare(String(pb), "pt-BR")
      );
    })
    .map((cellKey) => {
      const [fase, pais] = cellKey.split("|");
      return {
        cellKey,
        fase,
        pais,
        ra: mapA.get(cellKey),
        rb: mapB.get(cellKey),
      };
    });
}

function rankingEntryForKey(rankings, key) {
  return rankings.find((r) => r.chavePlanilha === key) || null;
}

/**
 * Linha da aba Artilheiro para a chave usada no X1 (lista de jogadores).
 * O nome na aba Artilheiro pode ser id (LH), apelido ou nome à mostra; o select
 * usa o texto da planilha. Cruzamos por `getPlayerMeta(...).id` e por chaves normalizadas.
 */
function artilheiroRowForDuelKey(playKey) {
  const rows = MOCK_DATA.artilheiro || [];
  if (!rows.length || !playKey) return null;
  const metaSel = getPlayerMeta(playKey);
  const selId = normKeyPlayer(metaSel.id || "");
  const cand = new Set(
    [playKey, metaSel.id, metaSel.nome]
      .filter((x) => x != null && String(x).trim() !== "")
      .map((x) => normKeyPlayer(x))
  );

  return (
    rows.find((r) => {
      if (!r || r.jogador == null) return false;
      const mArt = getPlayerMeta(r.jogador);
      const artId = normKeyPlayer(mArt.id || "");
      if (selId && artId && selId === artId) return true;
      return cand.has(normKeyPlayer(r.jogador));
    }) || null
  );
}

function renderDuelContent() {
  const body = document.getElementById("duel-body");
  const selA = document.getElementById("duel-select-a");
  const selB = document.getElementById("duel-select-b");
  if (!body || !selA || !selB) return;

  const keyA = selA.value;
  const keyB = selB.value;
  if (!keyA || !keyB) {
    body.innerHTML = `<p class="duel-empty">Escolhe dois jogadores nos menus acima.</p>`;
    return;
  }
  if (keyA === keyB) {
    body.innerHTML = `<p class="duel-empty">Escolhe dois jogadores <strong>diferentes</strong> para comparar.</p>`;
    return;
  }

  const rankings = buildRankings();
  const metaA = getPlayerMeta(keyA);
  const metaB = getPlayerMeta(keyB);
  const ra = rankingEntryForKey(rankings, keyA);
  const rb = rankingEntryForKey(rankings, keyB);
  const totalA = ra?.total ?? 0;
  const totalB = rb?.total ?? 0;
  const dTotal = totalA - totalB;
  const midLine =
    dTotal === 0
      ? `Empate · ${totalA} pts`
      : dTotal > 0
        ? `${metaA.nome} +${dTotal} pts`
        : `${metaB.nome} +${Math.abs(dTotal)} pts`;

  const grpA = ra?.ptsGrupos ?? 0;
  const grpB = rb?.ptsGrupos ?? 0;
  const mmA = ra?.ptsMataMata ?? 0;
  const mmB = rb?.ptsMataMata ?? 0;
  const exA = ra?.acertosExatos ?? 0;
  const exB = rb?.acertosExatos ?? 0;

  const groupRows = buildDuelGroupMatrix(keyA, keyB);
  const groupBody = groupRows.length
    ? groupRows
        .map((line) => {
          const pa = duelPalpitePtsCell(line.ra);
          const pb = duelPalpitePtsCell(line.rb);
          const clsA =
            pa.pts > pb.pts
              ? "duel-pts--lead"
              : pa.pts < pb.pts
                ? ""
                : pa.label !== "—" || pb.label !== "—"
                  ? "duel-pts--tie"
                  : "";
          const clsB =
            pb.pts > pa.pts
              ? "duel-pts--lead"
              : pb.pts < pa.pts
                ? ""
                : pa.label !== "—" || pb.label !== "—"
                  ? "duel-pts--tie"
                  : "";
          const resHtml =
            line.res != null && line.res >= 1 && line.res <= 4
              ? `<span class="duel-res-badge">${line.res}º</span>`
              : `<span class="duel-res-badge">—</span>`;
          return `<tr>
          <td class="duel-td--left"><strong>${escapeHtml(String(line.grupo))}</strong></td>
          <td class="duel-td--left">${countryFlagAndNameHtml(line.pais, {
            imgClass: "calendar-team-flag",
            nameClass: "calendar-team-name",
            flagSize: 40,
            imgWidth: 22,
            imgHeight: 15,
          })}</td>
          <td>${resHtml}</td>
          <td class="${clsA}">${escapeHtml(pa.label)}</td>
          <td class="${clsA}">${pa.pts}</td>
          <td class="${clsB}">${escapeHtml(pb.label)}</td>
          <td class="${clsB}">${pb.pts}</td>
        </tr>`;
        })
        .join("")
    : `<tr><td colspan="7" class="duel-empty" style="padding:1rem">Sem linhas de fase de grupos para estes jogadores.</td></tr>`;

  const mmRows = buildDuelKnockoutMatrix(keyA, keyB);
  const mmBody = mmRows.length
    ? mmRows
        .map((line) => {
          const ptsA = line.ra ? line.ra.pontos : 0;
          const ptsB = line.rb ? line.rb.pontos : 0;
          const clsA =
            ptsA > ptsB
              ? "duel-pts--lead"
              : ptsA < ptsB
                ? ""
                : ptsA || ptsB
                  ? "duel-pts--tie"
                  : "";
          const clsB =
            ptsB > ptsA
              ? "duel-pts--lead"
              : ptsB < ptsA
                ? ""
                : ptsA || ptsB
                  ? "duel-pts--tie"
                  : "";
          const okA = line.ra?.classificou ? "Sim" : line.ra ? "Não" : "—";
          const okB = line.rb?.classificou ? "Sim" : line.rb ? "Não" : "—";
          const faseLabel = KNOCKOUT_LABELS[line.fase] || line.fase;
          return `<tr>
          <td class="duel-td--left">${escapeHtml(faseLabel)}</td>
          <td class="duel-td--left">${countryFlagAndNameHtml(line.pais, {
            imgClass: "calendar-team-flag",
            nameClass: "calendar-team-name",
            flagSize: 40,
            imgWidth: 22,
            imgHeight: 15,
          })}</td>
          <td>${duelClassifCellHtml(okA)}</td>
          <td class="${clsA}">${ptsA}</td>
          <td>${duelClassifCellHtml(okB)}</td>
          <td class="${clsB}">${ptsB}</td>
        </tr>`;
        })
        .join("")
    : `<tr><td colspan="6" class="duel-empty" style="padding:1rem">Sem palpites de mata-mata registados na planilha.</td></tr>`;

  const diffs = [];
  groupRows.forEach((line) => {
    const pa = duelPalpitePtsCell(line.ra);
    const pb = duelPalpitePtsCell(line.rb);
    if (line.res == null || line.res < 1) return;
    if (pa.pts === pb.pts) return;
    const { grupo, pais } = line;
    const info = getCountryInfo(pais);
    diffs.push({
      label: `Grupo ${grupo} · ${info.nome}`,
      diff: Math.abs(pa.pts - pb.pts),
      lead: pa.pts > pb.pts ? metaA.nome : metaB.nome,
    });
  });
  mmRows.forEach((line) => {
    const ptsA = line.ra ? line.ra.pontos : 0;
    const ptsB = line.rb ? line.rb.pontos : 0;
    if (ptsA === ptsB) return;
    const faseLabel = KNOCKOUT_LABELS[line.fase] || line.fase;
    const info = getCountryInfo(line.pais);
    diffs.push({
      label: `${faseLabel} · ${info.nome}`,
      diff: Math.abs(ptsA - ptsB),
      lead: ptsA > ptsB ? metaA.nome : metaB.nome,
    });
  });
  diffs.sort((a, b) => b.diff - a.diff);
  const topDiffs = diffs.slice(0, 8);
  const diffBlock =
    topDiffs.length > 0
      ? `<div class="card card--glass" style="padding:0.85rem">
      <h3 class="duel-block-title">Onde mais divergiu a pontuação</h3>
      <ul class="duel-diff-list">
        ${topDiffs
          .map(
            (d) => `<li class="duel-diff-item">
          <span>${escapeHtml(d.label)}</span>
          <span><strong>+${d.diff}</strong> <span class="duel-diff-meta">(${escapeHtml(d.lead)})</span></span>
        </li>`
          )
          .join("")}
      </ul>
    </div>`
      : "";

  const artA = artilheiroRowForDuelKey(keyA);
  const artB = artilheiroRowForDuelKey(keyB);
  const artBlock =
    artA || artB
      ? `<div class="card card--glass" style="padding:0.85rem">
      <h3 class="duel-block-title">Palpite artilheiro</h3>
      <div class="duel-table-wrap">
        <table class="duel-table" style="min-width:0">
          <thead><tr>
            <th></th>
            <th>${escapeHtml(metaA.nome)}</th>
            <th>${escapeHtml(metaB.nome)}</th>
          </tr></thead>
          <tbody><tr>
            <th class="duel-td--left">Atleta (gols)</th>
            <td>${artA ? escapeHtml(`${artA.artilheiro || "—"} (${artA.gols ?? "—"})`) : "—"}</td>
            <td>${artB ? escapeHtml(`${artB.artilheiro || "—"} (${artB.gols ?? "—"})`) : "—"}</td>
          </tr></tbody>
        </table>
      </div>
    </div>`
      : "";

  body.innerHTML = `
    <div class="duel-summary">
      <div class="duel-card">
        <div class="duel-card-head">
          <span class="duel-card-avatar" style="border-color:${metaA.cor}">${metaA.avatar}</span>
          <span class="duel-card-name">${escapeHtml(metaA.nome)}</span>
        </div>
        <div class="duel-card-total">${totalA}</div>
        <div class="duel-card-sub">Grupos ${grpA} · Mata-mata ${mmA} · Exatos ${exA}/${ra?.totalLinhas ?? 0}</div>
      </div>
      <div class="duel-summary-mid">
        <div class="duel-delta-total">${dTotal === 0 ? "=" : dTotal > 0 ? `+${dTotal}` : String(dTotal)}</div>
        <p class="duel-delta-sub">${escapeHtml(midLine)}</p>
      </div>
      <div class="duel-card">
        <div class="duel-card-head">
          <span class="duel-card-avatar" style="border-color:${metaB.cor}">${metaB.avatar}</span>
          <span class="duel-card-name">${escapeHtml(metaB.nome)}</span>
        </div>
        <div class="duel-card-total">${totalB}</div>
        <div class="duel-card-sub">Grupos ${grpB} · Mata-mata ${mmB} · Exatos ${exB}/${rb?.totalLinhas ?? 0}</div>
      </div>
    </div>

    <div class="card card--glass" style="padding:0.85rem">
      <h3 class="duel-block-title">Fase de grupos — palpite vs resultado</h3>
      <div class="duel-table-wrap">
        <table class="duel-table">
          <thead><tr>
            <th>Grp</th>
            <th>Seleção</th>
            <th>Res.</th>
            <th colspan="2">${escapeHtml(metaA.nome)}</th>
            <th colspan="2">${escapeHtml(metaB.nome)}</th>
          </tr>
          <tr>
            <th></th><th></th><th></th>
            <th>Palp.</th><th>Pts</th><th>Palp.</th><th>Pts</th>
          </tr></thead>
          <tbody>${groupBody}</tbody>
        </table>
      </div>
    </div>

    <div class="card card--glass" style="padding:0.85rem">
      <h3 class="duel-block-title">Mata-mata</h3>
      <div class="duel-table-wrap">
        <table class="duel-table">
          <thead><tr>
            <th>Fase</th>
            <th>País</th>
            <th colspan="2">${escapeHtml(metaA.nome)}</th>
            <th colspan="2">${escapeHtml(metaB.nome)}</th>
          </tr>
          <tr>
            <th></th><th></th>
            <th>Classif.</th><th>Pts</th><th>Classif.</th><th>Pts</th>
          </tr></thead>
          <tbody>${mmBody}</tbody>
        </table>
      </div>
    </div>
    ${diffBlock}
    ${artBlock}
  `;
}

function renderDuel() {
  fillDuelSelects();
  renderDuelContent();
}

function initDuelControls() {
  const a = document.getElementById("duel-select-a");
  const b = document.getElementById("duel-select-b");
  if (!a || !b || a.dataset.duelBound === "1") return;
  a.dataset.duelBound = "1";
  const onChange = () => renderDuelContent();
  a.addEventListener("change", onChange);
  b.addEventListener("change", onChange);
}

/* ---------- Navigation ---------- */

function setContainerWidth(sectionId) {
  const container = document.getElementById("main-container");
  if (!container) return;
  container.classList.toggle("container--groups", sectionId === "groups");
  container.classList.toggle("container--bracket", sectionId === "bracket");
  container.classList.toggle("container--picks", sectionId === "picks");
  container.classList.toggle("container--calendar", sectionId === "calendar");
  container.classList.toggle("container--duel", sectionId === "duel");
  const sheetBar = document.getElementById("sheet-bar");
  if (sheetBar) {
    sheetBar.classList.toggle(
      "sheet-bar--calendar-focus",
      sectionId === "calendar"
    );
  }
}

function initNavigation() {
  const tabs = document.querySelectorAll(".nav-tab");
  const sections = document.querySelectorAll(".section");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      if (typeof BolaoSounds !== "undefined") BolaoSounds.playNav();
      const id = tab.dataset.section;
      tabs.forEach((t) => t.classList.toggle("active", t === tab));
      sections.forEach((s) => {
        s.classList.toggle("section--active", s.id === id);
      });
      setContainerWidth(id);
      if (id === "picks" && typeof ArtiBubbles !== "undefined") {
        requestAnimationFrame(() => ArtiBubbles.resize());
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  });

  setContainerWidth("ranking");
}

/* ---------- Init ---------- */

function renderAll() {
  const groupRows = processGroupDataForRanking();
  const rankings = buildRankings();

  renderLeaderboard(rankings);
  renderStats(rankings, groupRows);
  renderMVP(rankings);
  renderPodium(rankings);
  renderGroups();
  renderKnockout();
  renderBracket();
  renderPicksPage();
  renderCalendar();
  renderDuel();
}

async function loadSheetData() {
  if (typeof applyGoogleSheetsToMockData !== "function") {
    throw new Error("sheets-loader.js não carregado");
  }
  return applyGoogleSheetsToMockData();
}

async function init() {
  if (typeof MOCK_DATA === "undefined") {
    console.error("mockData.js não carregado");
    return;
  }

  setSheetLoading(true);

  try {
    const stats = await loadSheetData();
    updateSheetStatus({ ok: true, ...stats });
  } catch (err) {
    console.warn("Planilha:", err);
    if (typeof clearSheetData === "function") clearSheetData();
    const viaFile = window.location.protocol === "file:";
    updateSheetStatus({
      ok: false,
      error: viaFile
        ? "Abra com servidor local (python -m http.server 8765) — file:// bloqueia a planilha."
        : err?.message || "Não foi possível ler a planilha.",
    });
  } finally {
    setSheetLoading(false);
  }

  renderHeader();
  renderAll();
  initNavigation();
  initDuelControls();

  if (typeof BolaoSounds !== "undefined") {
    BolaoSounds.initToggle("btn-sound-toggle");
  }

  const refreshBtn = document.getElementById("btn-sheet-refresh");
  if (refreshBtn && !refreshBtn.dataset.bound) {
    refreshBtn.dataset.bound = "1";
    refreshBtn.addEventListener("click", async () => {
      if (typeof BolaoSounds !== "undefined") BolaoSounds.playRefresh();
      refreshBtn.disabled = true;
      setSheetLoading(true);
      try {
        const stats = await loadSheetData();
        updateSheetStatus({ ok: true, ...stats });
        renderHeader();
        renderAll();
        if (typeof BolaoSounds !== "undefined") BolaoSounds.playSheetOk();
      } catch (err) {
        if (typeof clearSheetData === "function") clearSheetData();
        updateSheetStatus({ ok: false, error: String(err.message || err) });
        renderHeader();
        renderAll();
        if (typeof BolaoSounds !== "undefined") BolaoSounds.playSheetError();
      } finally {
        setSheetLoading(false);
        refreshBtn.disabled = false;
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", init);
