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

function calcGroupRowPoints(palpite, resultado) {
  if (
    palpite == null ||
    !Number.isFinite(Number(palpite)) ||
    Number(palpite) < 1 ||
    Number(palpite) > 4
  ) {
    return 0;
  }
  let pts = 0;
  const p = Number(palpite);
  const r = Number(resultado);

  // Classificou no top 2 (real) e palpitou top 2
  if ((r === 1 || r === 2) && (p === 1 || p === 2)) pts += 1;

  // 3º colocado que avança — palpite na 3ª posição
  if (r === 3 && p === 3) pts += 1;

  // Acertou que a seleção classificaria (posições 1–3), sem posição exata
  if (p >= 1 && p <= 3 && r >= 1 && r <= 3 && pts === 0) pts += 1;

  // Bônus 1º lugar exato
  if (p === 1 && r === 1) pts += 1;

  // Bônus 2º lugar exato
  if (p === 2 && r === 2) pts += 1;

  return pts;
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
  return (
    MOCK_DATA.paises[paisKey] || {
      nome: paisKey,
      codigo: "un",
    }
  );
}

function flagUrl(codigo, size = 40) {
  return `https://flagcdn.com/w${size}/${codigo}.png`;
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
    const jogos =
      jogosMataMata != null ? ` · ${jogosMataMata} jogo(s) mata-mata` : "";
    status.textContent = `Planilha conectada · ${rows} palpites (Palpites) · ${grupos} grupo(s)${res}${mm}${jogos}`;
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

  el.innerHTML = groups
    .map(
      (g) => `
      <button class="group-tab ${g === activeGroup ? "active" : ""}" data-group="${g}">
        GRUPO ${g}
      </button>`
    )
    .join("");

  el.querySelectorAll(".group-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
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

function sortPlayersByGroupPoints(players, totals) {
  return [...players].sort(
    (a, b) =>
      (totals.get(b) || 0) - (totals.get(a) || 0) ||
      getPlayerMeta(a)
        .nome.localeCompare(getPlayerMeta(b).nome, "pt-BR")
  );
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
  const players = sortPlayersByGroupPoints(
    [...new Set(rows.map((r) => r.jogador))].filter(comPalpiteNesteGrupo),
    totals
  );
  const el = document.getElementById("group-unified-table");
  if (!el) return;

  if (!players.length) {
    el.innerHTML =
      '<p class="empty-state">Ninguém com a coluna <strong>PALPITE</strong> preenchida (1–4) neste grupo ainda. Valores inferidos pela ordem das linhas não contam — preencha a célula na aba Palpites para a coluna aparecer aqui.</p>';
    return;
  }

  const maxPts = players.length ? totals.get(players[0]) || 0 : 0;

  let html = `<table class="data-table data-table--unified" style="--player-cols:${players.length}"><thead><tr>
    <th class="th-selecao" scope="col"><span class="visually-hidden">Seleção</span></th>
    ${players
      .map((j) => {
        const pts = totals.get(j) || 0;
        const lead =
          pts === maxPts && maxPts > 0 ? " th-jogador--lead" : "";
        const meta = getPlayerMeta(j);
        return `<th scope="col" class="th-jogador${lead}">
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
          <img class="standing-flag" src="${flagUrl(s.paisInfo.codigo)}" alt="" loading="lazy" crossorigin="anonymous" width="22" height="16" />
          <span class="standing-name">${escapeHtml(s.paisInfo.nome)}</span>
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

  if (!activeGroup || !groups.includes(activeGroup)) activeGroup = groups[0];
  renderGroupTabs(groups);
  renderGroupUnified(activeGroup);
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

function renderBracketScorerChip(entry, { compact = false } = {}) {
  const nome = entry.meta?.nome || entry.jogador;
  const short = compact && nome.length > 9 ? `${nome.slice(0, 8)}…` : nome;
  return `<li class="bracket-scorer-chip" title="${escapeHtml(nome)}">
    <span class="bracket-scorer-avatar" style="border-color:${entry.meta.cor}">${entry.meta.avatar}</span>
    <span class="bracket-scorer-name">${escapeHtml(short)}</span>
  </li>`;
}

function renderTeamScorers(acertadores, paisNome) {
  if (!acertadores.length) return "";
  return `<ul class="bracket-team-scorers" aria-label="Pontuaram ${escapeHtml(paisNome)}">
    ${acertadores.map((e) => renderBracketScorerChip(e, { compact: true })).join("")}
  </ul>`;
}

function bracketTeamLine(paisKey, fase, acertadoresIndex) {
  const info = getCountryInfo(paisKey);
  const acertadores = getAcertadoresForPais(fase, paisKey, acertadoresIndex);
  return `<div class="bracket-team-line">
    <div class="bracket-team">
      <img class="bracket-team-flag" src="${flagUrl(info.codigo, 40)}" alt="" width="20" height="14" loading="lazy" />
      <span class="bracket-team-name">${escapeHtml(info.nome)}</span>
    </div>
    ${renderTeamScorers(acertadores, info.nome)}
  </div>`;
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

/* ---------- Navigation ---------- */

function setContainerWidth(sectionId) {
  const container = document.getElementById("main-container");
  if (!container) return;
  container.classList.toggle("container--groups", sectionId === "groups");
  container.classList.toggle("container--bracket", sectionId === "bracket");
}

function initNavigation() {
  const tabs = document.querySelectorAll(".nav-tab");
  const sections = document.querySelectorAll(".section");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const id = tab.dataset.section;
      tabs.forEach((t) => t.classList.toggle("active", t === tab));
      sections.forEach((s) => {
        s.classList.toggle("section--active", s.id === id);
      });
      setContainerWidth(id);
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

  const refreshBtn = document.getElementById("btn-sheet-refresh");
  if (refreshBtn && !refreshBtn.dataset.bound) {
    refreshBtn.dataset.bound = "1";
    refreshBtn.addEventListener("click", async () => {
      refreshBtn.disabled = true;
      setSheetLoading(true);
      try {
        const stats = await loadSheetData();
        updateSheetStatus({ ok: true, ...stats });
        renderHeader();
        renderAll();
      } catch (err) {
        if (typeof clearSheetData === "function") clearSheetData();
        updateSheetStatus({ ok: false, error: String(err.message || err) });
        renderHeader();
        renderAll();
      } finally {
        setSheetLoading(false);
        refreshBtn.disabled = false;
      }
    });
  }
}

document.addEventListener("DOMContentLoaded", init);
