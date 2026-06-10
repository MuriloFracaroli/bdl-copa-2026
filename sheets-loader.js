/**
 * Carrega dados da planilha Google Sheets (COPA_BDL)
 * Aba Palpites — GRUPO, PAIS, JOGADOR, PALPITE
 * Aba Resultados — GRUPO, PAIS, RESULTADO
 * Aba Palpites Mata-Mata — FASE + países (longo ou matriz por jogador)
 * Aba Resultados do Mata-Mata — FASE + países classificados
 * Aba JOGOS MATA MATA — FASE, PAIS 1, PAIS 2 (confrontos)
 * Aba Artilheiro — NOME, ARTILHEIRO (jogador da copa), GOLS (ex.: "11 gols")
 * Aba «Resultados Artilheiros» — ranking oficial: POS/ORDEM + ATLETA/ARTILHEIRO + PAÍS (opc.) + GOLS (ou atleta + gols / atleta + país + gols).
 * Cuidado: «Resultado Artilheiros» (sem s) não é esta aba; o gviz pode devolver a primeira aba e o parse zera os dados.
 * Aba Jogos — calendário fase de grupos: DATA, HORA, PAÍS 1, PAÍS 2 (células podem ter emoji + nome).
 * Coluna DATA no padrão Brasil: **dia/mês** (ex.: 11/06 = 11 de junho), ou fórmula DATE(ano,mês,dia) do Sheets, ou AAAA-MM-DD.
 * No JSON do Google, o texto formatado da célula (`f`) tem prioridade sobre o número serial (`v`) quando ambos existem, para bater com o que vês na planilha.
 * https://docs.google.com/spreadsheets/d/1iQ1xBKKcgRA8ESFQdZp8-ZWUWZrxc62a14aTy8UN4Ig
 */

const SHEETS_CONFIG = {
  sheetId: "1iQ1xBKKcgRA8ESFQdZp8-ZWUWZrxc62a14aTy8UN4Ig",
  palpites: {
    sheetName: "Palpites",
    gid: "0",
  },
  resultados: {
    sheetName: "Resultados",
    gid: "8228515",
  },
  palpitesMataMata: {
    sheetName: "Palpites Mata-Mata",
    gid: "2133817703",
  },
  resultadosMataMata: {
    sheetName: "Resultados do Mata-Mata",
    gid: "1686740892",
  },
  jogosMataMata: {
    sheetName: "JOGOS MATA MATA",
    gid: "560138314",
  },
  jogos: {
    sheetName: "Jogos",
  },
  artilheiro: {
    sheetName: "Artilheiro",
  },
  resultadoArtilheiros: {
    /** Nome real da aba na planilha COPA_BDL (plural «Resultados»). */
    sheetName: "Resultados Artilheiros",
  },
};

const FASE_MATA_MATA_ORDER = ["oitavas", "quartas", "semi", "final", "campeao"];

const JOGADOR_ALIASES = {
  BATONGA: "BATONGAS",
  TOZZI: "TQZZI",
  DANGERZ: "DNGRZ",
  "FELIPE OURO": "FELIPE OURO",
  SYNCH: "SYNCH",
  KAROZ: "KAROZ",
  NAZI: "NAZI",
  LUISIN: "LUISIN",
  MURILOFF: "MURILOFF",
  DUDA: "DUDA",
};

const PAIS_ALIASES = {
  "REP. TCHECA": "REPUBLICA TCHECA",
  "REP TCHECA": "REPUBLICA TCHECA",
  "AFRICA DO SUL": "AFRICA DO SUL",
  "COREIA DO SUL": "COREIA DO SUL",
  "ESTADOS UNIDOS": "ESTADOS UNIDOS",
  "COSTA DO MARFIM": "COSTA DO MARFIM",
  "ARABIA SAUDITA": "ARABIA SAUDITA",
  "NOVA ZELANDIA": "NOVA ZELANDIA",
  "RD CONGO": "RD CONGO",
  FRANCE: "FRANCA",
  SPAIN: "ESPANHA",
  ENGLAND: "INGLATERRA",
  GERMANY: "ALEMANHA",
  BRAZIL: "BRASIL",
  ARGENTINA: "ARGENTINA",
  PORTUGAL: "PORTUGAL",
  NETHERLANDS: "HOLANDA",
  CROATIA: "CROACIA",
  MOROCCO: "MARROCOS",
  COLOMBIA: "COLOMBIA",
  ITALY: "ITALIA",
  MEXICO: "MEXICO",
  USA: "ESTADOS UNIDOS",
  "UNITED STATES": "ESTADOS UNIDOS",
};

function normKey(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

function parseGrupo(value) {
  const s = normKey(value);
  const match = s.match(/GRUPO\s*([A-L])/);
  if (match) return match[1];
  if (/^[A-L]$/.test(s)) return s;
  return "";
}

function parseJogador(value) {
  const key = normKey(value);
  return JOGADOR_ALIASES[key] || key;
}

function parsePais(value) {
  const key = normKey(value);
  return PAIS_ALIASES[key] || key;
}

function rowKey(grupo, pais) {
  return `${grupo}|${parsePais(pais)}`;
}

function isHeaderGrupoPais(c0, c1) {
  const a = normKey(c0);
  const b = normKey(c1);
  return a === "GRUPO" || (a.includes("GRUPO") && b.includes("PAIS"));
}

function isHeaderArtilheiro(c0, c1) {
  const a = normKey(c0);
  const b = normKey(c1);
  return a === "NOME" && (b === "ARTILHEIRO" || b.includes("ARTILHEIRO"));
}

/** Extrai número de células como "11 gols", "7", 9. */
function parseGolsArtilheiroCell(raw) {
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  const s = String(raw).trim();
  if (!s) return null;
  const m = s.match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const n = Number(m[1].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Remove emojis (ex.: bandeiras na coluna País) para extrair o nome antes de parsePais. */
function stripEmojisForTextCell(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  try {
    return s
      .replace(/\p{Extended_Pictographic}+/gu, " ")
      .replace(/\uFE0F/g, "")
      .replace(/\u200D/g, "")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return s.replace(/\s+/g, " ").trim();
  }
}

/** Primeira URL http(s) na célula (ex.: coluna Foto com texto extra ou fórmula). */
function extractPhotoUrlFromCell(raw) {
  if (raw === undefined || raw === null) return "";
  const s = String(raw).trim();
  if (!s) return "";
  const firstToken = s.split(/\s+/)[0];
  if (/^https?:\/\//i.test(firstToken))
    return firstToken.replace(/[,;.]+$/u, "");
  const m = s.match(/https?:\/\/[^\s"'<>\]]+/iu);
  return m ? m[0].replace(/[,;.]+$/u, "") : "";
}

/** Lê valor de objeto de linha (gviz) com rótulos normalizados. */
function pickRowField(row, ...keys) {
  for (const key of keys) {
    const k = normKey(key);
    if (row[k] !== undefined && row[k] !== "") return row[k];
  }
  return undefined;
}

/** Como pickRowField, mas considera string vazia (célula em branco na planilha). */
function pickRowCell(row, ...keys) {
  for (const key of keys) {
    const k = normKey(key);
    if (row[k] !== undefined) return row[k];
  }
  return undefined;
}

function nextPalpitePorOrdem(ordemMap, grupo, jogador) {
  const key = `${grupo}|${jogador}`;
  const next = (ordemMap.get(key) || 0) + 1;
  if (next > 4) return null;
  ordemMap.set(key, next);
  return next;
}

/** Traço, só sublinhados, ou 0 (= sem posição; Sheets costuma não enviar "-"). Não pontua nem infere ordem. */
function isPalpiteGrupoAusente(raw) {
  if (raw === undefined || raw === null) return false;
  if (typeof raw === "number" && raw === 0) return true;
  const s = String(raw).trim();
  if (!s) return false;
  if (/^[-–—−_]+$/u.test(s)) return true;
  const normalized = s.replace(",", ".");
  if (/^(0+)(\.0+)?$/i.test(normalized)) return true;
  return false;
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === ",") {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if (!inQuotes && (ch === "\n" || ch === "\r")) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cell.trim());
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += ch;
  }

  if (cell.length || row.length) {
    row.push(cell.trim());
    if (row.some((c) => c !== "")) rows.push(row);
  }

  return rows;
}

/** Célula DATA (gviz): evita String({v,f}) → "[object Object]" e favorece texto formatado quando for serial. */
function jogoDataCellToPrimitive(dataRaw) {
  if (dataRaw == null) return dataRaw;
  if (typeof dataRaw === "object" && !Array.isArray(dataRaw)) {
    if ("v" in dataRaw || "f" in dataRaw) return gvizCellRawValue(dataRaw);
  }
  return dataRaw;
}

/** Valor bruto da célula gviz (v + f). Quando v vem vazio/null mas há texto em f, usa f — evita perder "-" formatado. */
function gvizCellRawValue(cell) {
  if (!cell) return "";
  const v = cell.v;
  const f = cell.f != null ? String(cell.f).trim() : "";
  const vEmpty = v === "" || v === null || v === undefined;

  const vLooksLikeSerialString =
    typeof v === "string" && /^\s*\d{5,7}(\.\d+)?\s*$/.test(v);
  const vIsNumericSerial = typeof v === "number" && Number.isFinite(v);
  const vIsGoogleDateArray = Array.isArray(v) && v.length >= 3;

  /**
   * Preferir o texto `f` quando parece data (barras, hífens, «de …», meses em português, ISO),
   * para não substituir números genéricos cujo `f` é só outra forma do mesmo valor.
   */
  const fLooksLikeSpreadsheetDate =
    /[\/\-]/.test(f) ||
    /\b(de|jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)\b/i.test(f) ||
    /^\d{4}-\d{2}-\d{2}/.test(f) ||
    /\d{1,2}\.\d{1,2}\.\d{4}/.test(f);

  if (
    (vIsNumericSerial || vLooksLikeSerialString || vIsGoogleDateArray) &&
    f !== "" &&
    fLooksLikeSpreadsheetDate
  ) {
    return f;
  }

  if (vIsGoogleDateArray) {
    const y = Number(v[0]);
    const m0 = Number(v[1]);
    const d = Number(v[2]);
    if (
      [y, m0, d].every(Number.isFinite) &&
      m0 >= 0 &&
      m0 <= 11 &&
      d >= 1 &&
      d <= 31
    ) {
      const mm = String(m0 + 1).padStart(2, "0");
      const dd = String(d).padStart(2, "0");
      return `${y}-${mm}-${dd}`;
    }
  }

  if (vEmpty) {
    if (f !== "") return f;
    return "";
  }
  return v;
}

function gvizTableToObjects(table) {
  if (!table?.rows) return [];

  const cols = table.cols.map((c, i) => {
    const label = String(c.label || "").trim();
    return label ? normKey(label) : `COL${i}`;
  });
  return table.rows.map((r) => {
    const obj = {};
    /** Ordem física das colunas (FASE, PAÍS 1, …) — evita rowToCells errado por sort alfabético. */
    const order = [];
    (r.c || []).forEach((cell, i) => {
      const val = gvizCellRawValue(cell);
      const key = cols[i] || `COL${i}`;
      obj[key] = val;
      order.push(val);
    });
    obj.__cellOrder = order;
    return obj;
  });
}

function rowToCells(row) {
  if (Array.isArray(row)) return row.map((c) => (c == null ? "" : c));
  if (row && Array.isArray(row.__cellOrder)) {
    return row.__cellOrder.map((c) => (c == null ? "" : c));
  }
  return Object.keys(row)
    .sort((a, b) => {
      const ai = Number(String(a).replace(/\D/g, "")) || 0;
      const bi = Number(String(b).replace(/\D/g, "")) || 0;
      if (String(a).startsWith("COL") && String(b).startsWith("COL")) return ai - bi;
      return String(a).localeCompare(String(b));
    })
    .map((k) => row[k]);
}

function parseFase(value) {
  const s = normKey(value);
  if (!s) return "";
  if (s.includes("OITAVA")) return "oitavas";
  if (s.includes("QUARTA")) return "quartas";
  if (s.includes("SEMI")) return "semi";
  if (s === "FINAL" || s.includes("FINAL")) return "final";
  if (s.includes("CAMPEAO") || s.includes("CAMPEÃO")) return "campeao";
  return "";
}

function mataMataKey(fase, pais) {
  return `${fase}|${parsePais(pais)}`;
}

function isKnockoutMetaRow(cells) {
  if (!cells.length) return true;
  if (parseFase(cells[0])) return false;
  const text = cells.map((c) => normKey(c)).join(" ");
  if (!text) return true;
  return (
    text.includes("PONTO PARA") ||
    text.includes("PONTO PARA ACERTO") ||
    text.includes("MAXIMO POR") ||
    text.includes("MAXIMO POR RODADA") ||
    text === "PAIS" ||
    text.includes("FASE OITAVAS")
  );
}

function isGruposPalpitesSheet(rows) {
  for (const row of rows.slice(0, 8)) {
    const g = pickRowField(row, "GRUPO");
    if (parseGrupo(g)) return true;
  }
  return false;
}

function isMataMataPalpitesSheet(rows) {
  for (const row of rows.slice(0, 8)) {
    if (pickRowField(row, "FASE") && pickRowField(row, "JOGADOR")) return true;
  }
  return false;
}

/** Países classificados por fase (chave fase|pais). */
function parseMataMataResultados(rows) {
  const advance = new Set();
  const byFase = {};

  rows.forEach((row) => {
    const cells = rowToCells(row);
    if (!cells.length || isKnockoutMetaRow(cells)) return;

    const fase = parseFase(
      pickRowField(row, "FASE") ?? cells[0]
    );
    if (!fase) return;

    const startIdx = normKey(cells[0]) === normKey(fase) ? 1 : 0;
    for (let i = startIdx; i < cells.length; i++) {
      const raw = cells[i];
      if (raw == null || raw === "") continue;
      const pais = parsePais(raw);
      if (!pais) continue;
      const key = mataMataKey(fase, pais);
      advance.add(key);
      if (!byFase[fase]) byFase[fase] = [];
      if (!byFase[fase].includes(pais)) byFase[fase].push(pais);
    }
  });

  return { advance, byFase };
}

function parseMataMataPalpitesLong(rows) {
  const palpites = [];

  rows.forEach((row) => {
    const cells = rowToCells(row);
    if (!cells.length || isKnockoutMetaRow(cells)) return;

    const fase = parseFase(pickRowField(row, "FASE") ?? cells[0]);
    if (!fase) return;

    const jogador = parseJogador(
      pickRowField(row, "JOGADOR", "PARTICIPANTE", "NOME") ??
        (normKey(cells[0]) === normKey(fase) ? cells[1] : cells[0])
    );

    const rawPaisCol = pickRowField(row, "PAIS", "SELECAO", "SELEÇÃO");
    const paisColPreenchido =
      rawPaisCol != null && String(rawPaisCol).trim() !== "";

    if (jogador && paisColPreenchido) {
      const pais = parsePais(rawPaisCol);
      if (pais) {
        palpites.push({
          fase,
          jogador,
          pais,
          mmPaisDaPlanilha: true,
        });
      }
      return;
    }

    if (jogador) {
      const countries = new Set();
      const start = normKey(cells[0]) === normKey(fase) ? 2 : 1;
      for (let i = start; i < cells.length; i++) {
        const pais = parsePais(cells[i]);
        if (pais && pais !== jogador) countries.add(pais);
      }
      countries.forEach((pais) =>
        palpites.push({ fase, jogador, pais, mmPaisDaPlanilha: false })
      );
      return;
    }

    for (let i = 1; i < cells.length; i++) {
      const j = parseJogador(cells[i]);
      if (!j) continue;
      for (let k = i + 1; k < cells.length; k++) {
        const pais = parsePais(cells[k]);
        if (pais) {
          palpites.push({
            fase,
            jogador: j,
            pais,
            mmPaisDaPlanilha: false,
          });
        }
      }
    }
  });

  return palpites;
}

/** Matriz: cabeçalho com países; linhas = jogador + países palpitados. */
function parseMataMataPalpitesWide(rows) {
  const palpites = [];
  let headerIdx = -1;
  let countryCols = [];

  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const cells = rowToCells(rows[i]);
    const labels = cells.map((c) => normKey(c));
    const countryStart = labels.findIndex(
      (l, idx) =>
        idx > 0 &&
        l &&
        !l.includes("JOGADOR") &&
        !l.includes("PARTICIPANTE") &&
        !l.includes("FASE") &&
        !l.includes("PONTO")
    );
    if (countryStart > 0) {
      headerIdx = i;
      countryCols = cells
        .map((c, idx) => ({ idx, pais: parsePais(c), label: normKey(c) }))
        .filter((x) => x.idx >= countryStart && x.pais);
      break;
    }
  }

  if (headerIdx < 0 || !countryCols.length) return [];

  /** Blocos em que a coluna A é o jogador e a fase vem só em linhas-título (OITAVAS / QUARTAS / …). */
  let currentFase = "oitavas";

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    const cells = rowToCells(row);
    if (!cells.length || isKnockoutMetaRow(cells)) continue;

    const f0 = parseFase(cells[0]);
    const jogadorNaCol1 = cells[1] != null ? parseJogador(cells[1]) : "";

    if (f0) {
      const temMarcaEmPais = countryCols.some(({ idx }) => {
        const v = cells[idx];
        return v != null && String(v).trim() !== "";
      });
      if (!temMarcaEmPais) {
        currentFase = f0;
        continue;
      }
    }

    const faseDaColuna = parseFase(pickRowField(row, "FASE"));
    let fase;
    let jogadorCol;
    if (faseDaColuna) {
      fase = faseDaColuna;
      jogadorCol = f0 && jogadorNaCol1 ? 1 : 0;
    } else if (f0 && jogadorNaCol1) {
      fase = f0;
      jogadorCol = 1;
    } else {
      fase = currentFase;
      jogadorCol = 0;
    }

    const jogador = parseJogador(cells[jogadorCol]);
    if (!jogador) continue;

    countryCols.forEach(({ idx, pais }) => {
      const mark = cells[idx];
      if (mark == null || mark === "" || mark === 0 || mark === false) return;
      const mk = normKey(mark);
      if (mk === "X" || mk === "1" || mk === "SIM" || mk === "TRUE") {
        palpites.push({
          fase,
          jogador,
          pais,
          mmPaisDaPlanilha: true,
        });
        return;
      }
      const picked = parsePais(mark);
      if (picked) {
        palpites.push({
          fase,
          jogador,
          pais: picked,
          mmPaisDaPlanilha: true,
        });
      } else {
        palpites.push({
          fase,
          jogador,
          pais,
          mmPaisDaPlanilha: true,
        });
      }
    });
  }

  return palpites;
}

function parseMataMataPalpites(rows) {
  if (!rows.length) return [];
  if (isGruposPalpitesSheet(rows) && !isMataMataPalpitesSheet(rows)) {
    console.warn(
      'Aba "Palpites Mata-Mata" carregou a planilha de grupos — confira o gid/nome da aba.'
    );
    return [];
  }

  const long = parseMataMataPalpitesLong(rows);
  const wide = parseMataMataPalpitesWide(rows);
  /**
   * Se o «long» devolver poucas linhas (ruído / linhas-meta) mas a matriz larga
   * tiver muito mais palpites, usar o wide — evita ficar só em oitavas no site
   * em cache antigo ou com heurística long a falhar.
   */
  if (wide.length > 0 && long.length < wide.length) {
    return wide;
  }
  if (long.length > 0) {
    return long;
  }
  return wide;
}

function countryDisplayName(paisKey) {
  const key = parsePais(paisKey);
  return MOCK_DATA?.paises?.[key]?.nome || key;
}

function formatConfrontoLabel(pais1Key, pais2Key) {
  const a = countryDisplayName(pais1Key);
  if (!a) return "";
  if (!pais2Key) return a;
  return `${a} × ${countryDisplayName(pais2Key)}`;
}

/** Aba JOGOS MATA MATA: FASE | PAIS 1 | PAIS 2 */
function parseJogosMataMata(rows) {
  const jogos = [];

  rows.forEach((row) => {
    const cells = rowToCells(row);
    if (!cells.length || isKnockoutMetaRow(cells)) return;

    const fase = parseFase(pickRowField(row, "FASE") ?? cells[0]);
    if (!fase) return;

    const pais1Raw =
      pickRowField(
        row,
        "PAIS 1",
        "PAIS1",
        "PAIS_1",
        "PAÍS 1",
        "TIME 1",
        "TIME1",
        "CASA"
      ) ?? cells[1];
    const pais2Raw =
      pickRowField(
        row,
        "PAIS 2",
        "PAIS2",
        "PAIS_2",
        "PAÍS 2",
        "TIME 2",
        "TIME2",
        "VISITANTE"
      ) ?? cells[2];

    const pais1 = parsePais(stripEmojisForTextCell(pais1Raw));
    const pais2Clean = stripEmojisForTextCell(pais2Raw ?? "");
    const pais2 =
      pais2Raw != null && String(pais2Raw).trim() !== ""
        ? parsePais(pais2Clean)
        : null;

    if (!pais1) return;

    jogos.push({
      fase,
      pais1,
      pais2,
      confronto: formatConfrontoLabel(pais1, pais2),
      campeao: fase === "campeao" && !pais2,
    });
  });

  return jogos;
}

function groupJogosMataMataPorFase(jogos) {
  const byFase = {};
  jogos.forEach((jogo) => {
    if (!byFase[jogo.fase]) byFase[jogo.fase] = [];
    byFase[jogo.fase].push(jogo);
  });
  return byFase;
}

function isHeaderJogosFaseGrupos(c0, c1) {
  const a = normKey(c0);
  const b = normKey(c1);
  if (a === "DATA" && (b === "HORA" || b.includes("HORA"))) return true;
  if (a === "DATA" && (b.includes("PAIS") || b.includes("SELECAO"))) return true;
  return false;
}

/**
 * Aba Jogos: DATA | HORA | PAÍS 1 | PAÍS 2 (opc.: GRUPO, RODADA).
 * DATA em formato brasileiro **dia/mês[/ano]** (11/06 = 11 de junho), além de DATE() ou serial.
 * Nomes de país podem vir com emoji (planilha); normaliza com parsePais após strip.
 */
function parseJogosFaseGruposRows(rows) {
  const out = [];

  rows.forEach((row) => {
    let dataRaw;
    let horaRaw;
    let pais1Raw;
    let pais2Raw;
    let grupoRaw;

    if (Array.isArray(row)) {
      if (row.length < 4) return;
      if (isHeaderJogosFaseGrupos(row[0], row[1])) return;
      dataRaw = row[0];
      horaRaw = row[1];
      pais1Raw = row[2];
      pais2Raw = row[3];
      grupoRaw = row.length >= 5 ? row[4] : undefined;
    } else {
      dataRaw = pickRowField(row, "DATA", "DATE", "DIA");
      horaRaw = pickRowField(row, "HORA", "HORARIO", "HORÁRIO");
      pais1Raw = pickRowField(
        row,
        "PAIS 1",
        "PAIS1",
        "PAIS_1",
        "PAÍS 1",
        "TIME 1",
        "TIME1",
        "CASA"
      );
      pais2Raw = pickRowField(
        row,
        "PAIS 2",
        "PAIS2",
        "PAIS_2",
        "PAÍS 2",
        "TIME 2",
        "TIME2",
        "VISITANTE"
      );
      grupoRaw = pickRowField(row, "GRUPO", "GRUPO_");
    }

    const dataRawP = jogoDataCellToPrimitive(dataRaw);
    const data = dataRawP != null ? String(dataRawP).trim() : "";
    const hora = horaRaw != null ? String(horaRaw).trim() : "";

    const pais1 = parsePais(stripEmojisForTextCell(pais1Raw));
    const pais2 = parsePais(stripEmojisForTextCell(pais2Raw));
    if (!pais1 || !pais2) return;

    const grupo = grupoRaw != null ? parseGrupo(grupoRaw) : "";

    out.push({
      data,
      hora,
      pais1,
      pais2,
      grupo: grupo || undefined,
      confronto: formatConfrontoLabel(pais1, pais2),
    });
  });

  return out;
}

function joinMataMataPalpitesResultados(palpites, resultadosAdvance) {
  return palpites.map((p) => {
    const key = mataMataKey(p.fase, p.pais);
    const classificou = resultadosAdvance.has(key);
    return {
      fase: p.fase,
      jogador: p.jogador,
      palpite: p.pais,
      pais: p.pais,
      mmPaisDaPlanilha: p.mmPaisDaPlanilha === true,
      classificou,
      vencedorReal: classificou ? p.pais : null,
    };
  });
}

function parseGvizJson(text) {
  const jsonStr = text.replace(/^[^{]*/, "").replace(/\);?\s*$/, "");
  const data = JSON.parse(jsonStr);
  return gvizTableToObjects(data.table);
}

/** Evita corrida quando duas abas carregam JSONP ao mesmo tempo. */
let gvizLoadChain = Promise.resolve();

function enqueueGvizLoad(task) {
  const run = gvizLoadChain.then(task, task);
  gvizLoadChain = run.catch(() => {});
  return run;
}

function fetchSheetGvizOnce(params) {
  const { sheetId } = SHEETS_CONFIG;

  return enqueueGvizLoad(
    () =>
      new Promise((resolve, reject) => {
        const script = document.createElement("script");
        let settled = false;

        function finish(err, data) {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          window._bolaoGvizResolve = null;
          script.remove();
          if (err) reject(err);
          else resolve(data);
        }

        const timer = setTimeout(
          () => finish(new Error("Tempo esgotado ao ler planilha")),
          15000
        );

        window._bolaoGvizResolve = (response) => {
          if (response?.status === "error") {
            const msg =
              response.errors?.[0]?.detailed_message ||
              response.errors?.[0]?.message ||
              "Erro ao ler aba";
            finish(new Error(msg));
            return;
          }
          finish(null, gvizTableToObjects(response.table));
        };

        const q = new URLSearchParams({ tqx: "out:json", headers: "1" });
        if (params.sheet) q.set("sheet", params.sheet);
        if (params.gid) q.set("gid", params.gid);

        script.src = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?${q}`;
        script.async = true;
        script.onerror = () => finish(new Error("Falha na rede (script)"));
        document.head.appendChild(script);
      })
  );
}

async function fetchSheetCsv(tabConfig) {
  const { sheetId } = SHEETS_CONFIG;
  const encSheet = tabConfig.sheetName
    ? encodeURIComponent(tabConfig.sheetName)
    : "";
  const urls = [
    tabConfig.gid != null &&
      tabConfig.gid !== "" &&
      `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${tabConfig.gid}`,
    tabConfig.gid != null &&
      tabConfig.gid !== "" &&
      `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${tabConfig.gid}`,
    tabConfig.sheetName &&
      `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encSheet}`,
  ].filter(Boolean);

  let lastError;
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const matrix = parseCSV(await res.text());
      if (matrix.length > 0) return matrix;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("CSV indisponível");
}

async function fetchSheetJsonFetch(tabConfig) {
  const { sheetId } = SHEETS_CONFIG;
  const encSheet = tabConfig.sheetName
    ? encodeURIComponent(tabConfig.sheetName)
    : "";
  const urls = [
    tabConfig.gid != null &&
      tabConfig.gid !== "" &&
      `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&headers=1&gid=${tabConfig.gid}`,
    tabConfig.sheetName &&
      `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:json&headers=1&sheet=${encSheet}`,
  ].filter(Boolean);

  let lastError;
  for (const url of urls) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const rows = parseGvizJson(await res.text());
      if (rows.length) return rows;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error("JSON indisponível");
}

function getTabAttempts(tabConfig) {
  const attempts = [];
  if (tabConfig.gid != null && tabConfig.gid !== "") {
    attempts.push({ gid: String(tabConfig.gid) });
  }
  if (tabConfig.sheetName) {
    attempts.push({ sheet: tabConfig.sheetName });
  }
  return attempts;
}

async function loadSheetTab(tabConfig) {
  const label = tabConfig.sheetName || `gid ${tabConfig.gid}`;
  const attempts = getTabAttempts(tabConfig);

  // CSV primeiro: preserva traços em PALPITE: a API gviz JSON costuma mandar v=null e f=null para "-",
  // o que virava "" e acionava inferência por ordem das linhas (posições erradas).
  try {
    const matrix = await fetchSheetCsv(tabConfig);
    if (matrix.length) return matrix;
  } catch (err) {
    console.warn(`fetch csv ${label}:`, err.message || err);
  }

  try {
    const rows = await fetchSheetJsonFetch(tabConfig);
    if (rows.length) return rows;
  } catch (err) {
    console.warn(`fetch json ${label}:`, err.message || err);
  }

  for (const params of attempts) {
    try {
      const rows = await fetchSheetGvizOnce(params);
      if (rows.length) return rows;
    } catch (err) {
      console.warn(`gviz ${label}:`, err.message || err);
    }
  }

  return [];
}

/**
 * Aba Palpites: GRUPO | PAIS | JOGADOR | PALPITE
 * Posição (1–4) = coluna PALPITE numérica, ou ordem das linhas (planilha antiga sem PALPITE).
 * Sem palpite: traço (-, –, …), 0, ou 0,0 — não pontua; não infere posição pela ordem das linhas.
 */
function parsePalpitesRows(rows) {
  const palpites = [];
  const ordemPorJogadorGrupo = new Map();

  rows.forEach((row) => {
    let grupo, pais, jogador, palpite;
    let rawPalpiteCell;

    if (Array.isArray(row)) {
      if (row.length < 3) return;
      if (isHeaderGrupoPais(row[0], row[1])) return;

      grupo = parseGrupo(row[0]);
      pais = parsePais(row[1]);
      jogador = parseJogador(row[2]);
      rawPalpiteCell = row.length >= 4 ? row[3] : undefined;
      if (
        row.length >= 4 &&
        row[3] !== "" &&
        row[3] != null &&
        !isPalpiteGrupoAusente(row[3])
      ) {
        palpite = Number(row[3]);
      }
    } else {
      grupo = parseGrupo(pickRowField(row, "GRUPO", "GRUPO_"));
      pais = parsePais(pickRowField(row, "PAIS", "PAÍS", "SELECAO", "SELEÇÃO"));
      jogador = parseJogador(
        pickRowField(row, "JOGADOR", "PARTICIPANTE", "NOME")
      );
      rawPalpiteCell = pickRowField(
        row,
        "PALPITE",
        "POSICAO",
        "POSIÇÃO",
        "POS",
        "CLASSIFICACAO",
        "CLASSIFICAÇÃO"
      );
      if (
        rawPalpiteCell !== undefined &&
        !isPalpiteGrupoAusente(rawPalpiteCell)
      ) {
        palpite = Number(rawPalpiteCell);
      }
    }

    if (!grupo || !pais || !jogador) return;

    if (isPalpiteGrupoAusente(rawPalpiteCell)) {
      palpites.push({
        grupo,
        pais,
        jogador,
        palpite: null,
        palpiteDaPlanilha: false,
      });
      return;
    }

    let palpiteDaPlanilha = false;
    if (!Number.isFinite(palpite) || palpite < 1 || palpite > 4) {
      palpite = nextPalpitePorOrdem(ordemPorJogadorGrupo, grupo, jogador);
      if (palpite == null) return;
      palpiteDaPlanilha = false;
    } else {
      palpiteDaPlanilha = true;
    }

    palpites.push({ grupo, pais, jogador, palpite, palpiteDaPlanilha });
  });

  return palpites;
}

/** Aba Resultados: GRUPO | PAIS | RESULTADO (0 = ainda não definido) */
function parseResultadosMap(rows) {
  const map = new Map();
  const gruposOficiais = {};

  rows.forEach((row) => {
    let grupo, pais, resultado;

    if (Array.isArray(row)) {
      if (row.length < 3) return;
      if (isHeaderGrupoPais(row[0], row[1])) return;

      grupo = parseGrupo(row[0]);
      pais = parsePais(row[1]);
      resultado = Number(row[2]);
    } else {
      grupo = parseGrupo(pickRowField(row, "GRUPO", "GRUPO_"));
      pais = parsePais(pickRowField(row, "PAIS", "PAÍS", "SELECAO", "SELEÇÃO"));
      resultado = Number(
        pickRowField(row, "RESULTADO", "POSICAO", "POSIÇÃO", "POS", "PLACAR")
      );
    }

    if (!grupo || !pais) return;
    if (!Number.isFinite(resultado) || resultado < 0 || resultado > 4) return;

    const key = rowKey(grupo, pais);
    map.set(key, resultado);

    // Classificação oficial só com posições 1–4 (0 = grupo ainda sem placar)
    if (resultado >= 1 && resultado <= 4) {
      if (!gruposOficiais[grupo]) gruposOficiais[grupo] = [];
      if (!gruposOficiais[grupo].includes(pais)) gruposOficiais[grupo].push(pais);
    }
  });

  return { map, gruposOficiais };
}

/**
 * Aba Artilheiro: NOME | ARTILHEIRO (atleta) | GOLS (texto ou número).
 * Ignora linha TOTAL e cabeçalho.
 */
function parseArtilheiroRows(rows) {
  const out = [];

  rows.forEach((row) => {
    let nomeCol, artilheiroCol, golsRaw;

    if (Array.isArray(row)) {
      if (row.length < 2) return;
      if (isHeaderArtilheiro(row[0], row[1])) return;

      nomeCol = row[0];
      artilheiroCol = row.length >= 2 ? row[1] : "";
      golsRaw = row.length >= 3 ? row[2] : "";
    } else {
      nomeCol = pickRowField(row, "NOME", "JOGADOR", "PARTICIPANTE");
      artilheiroCol = pickRowCell(
        row,
        "ARTILHEIRO",
        "ARTILHEIRO COPA",
        "JOGADOR COPA",
        "ATLETA"
      );
      golsRaw = pickRowCell(row, "GOLS", "GOL", "GOL(S)");
    }

    if (nomeCol == null || String(nomeCol).trim() === "") return;
    if (normKey(nomeCol) === "TOTAL") return;

    const jogador = parseJogador(nomeCol);
    if (!jogador) return;

    const artilheiro =
      artilheiroCol != null ? String(artilheiroCol).trim() : "";
    const gols = parseGolsArtilheiroCell(golsRaw);

    out.push({
      jogador,
      artilheiro,
      gols,
    });
  });

  return out;
}

/** Primeira linha parece cabeçalho da aba Palpites (GRUPO | PAIS). */
function resultadoArtilheiroLooksLikePalpitesTab(rows) {
  const first = rows[0];
  if (!first) return false;
  const cells = rowToCells(first);
  if (cells.length >= 2 && isHeaderGrupoPais(cells[0], cells[1])) return true;
  return false;
}

function headerCellsToNormIndexMap(headerCells) {
  const m = {};
  headerCells.forEach((cell, idx) => {
    const k = normKey(cell);
    if (k) m[k] = idx;
  });
  return m;
}

function getColIndexFromHeaderMap(m, patterns) {
  for (const p of patterns) {
    const pn = normKey(p);
    if (pn && m[pn] !== undefined) return m[pn];
  }
  for (const p of patterns) {
    const pn = normKey(p);
    if (!pn) continue;
    for (const [key, idx] of Object.entries(m)) {
      if (key.includes(pn)) return idx;
    }
  }
  return -1;
}

/** Fallback: linhas com duas colunas (atleta | gols), sem GRUPO. */
function parseResultadoArtilheiroSimpleTwoCol(rows) {
  const out = [];
  rows.forEach((row) => {
    if (!Array.isArray(row)) return;
    if (row.length < 2) return;
    if (isHeaderGrupoPais(row[0], row[1])) return;
    if (normKey(row[0]) === "TOTAL") return;
    if (parseGrupo(row[0])) return;
    const atleta = String(row[0] || "").trim();
    if (!atleta) return;
    const nk = normKey(atleta);
    if (
      nk === "POS" ||
      nk === "ORDEM" ||
      nk === "RANK" ||
      nk === "ATLETA" ||
      nk === "ARTILHEIRO" ||
      nk === "GOLEADOR" ||
      nk === "GOLS" ||
      nk === "TOTAL"
    )
      return;
    if (row.length >= 3) {
      const golsLast = parseGolsArtilheiroCell(row[row.length - 1]);
      const golsMid = parseGolsArtilheiroCell(row[1]);
      if (Number.isFinite(golsLast) && !Number.isFinite(golsMid)) {
        const pais = String(row[1] || "").trim();
        const gols = golsLast;
        out.push({ pos: out.length + 1, atleta, gols, pais, foto: "", assistencias: null });
        return;
      }
    }
    const gols = parseGolsArtilheiroCell(row[1]);
    out.push({ pos: out.length + 1, atleta, gols, pais: "", foto: "", assistencias: null });
  });
  return out;
}

/**
 * Aba Resultados Artilheiros — classificação oficial de goleadores.
 * Cabeçalho: POS, ATLETA/ARTILHEIRO, PAÍS (opcional), GOLS, ASSISTÊNCIAS (opcional), FOTO/URL (opcional, ex.: coluna «Foto» com link da imagem).
 * Ignora linha TOTAL; evita confundir com a aba Palpites (GRUPO|PAIS).
 */
function parseResultadoArtilheiroRows(rows) {
  if (!rows.length) return [];
  if (resultadoArtilheiroLooksLikePalpitesTab(rows)) {
    console.warn(
      'Aba «Resultados Artilheiros»: conteúdo parece Palpites (GRUPO/PAIS). Confira o nome da aba no Sheets ou defina gid em SHEETS_CONFIG.resultadoArtilheiros.'
    );
    return [];
  }

  const allObjects = rows.every((r) => r && !Array.isArray(r));
  if (allObjects) {
    const outObj = [];
    rows.forEach((row) => {
      const g = pickRowField(row, "GRUPO", "GRUPO_");
      if (g != null && parseGrupo(g)) return;

      const atletaRaw = pickRowCell(
        row,
        "ATLETA",
        "GOLEADOR",
        "ARTILHEIRO REAL",
        "ARTILHEIRO OFICIAL",
        "NICK REAL",
        "ARTILHEIRO",
        "NOME"
      );
      const atleta =
        atletaRaw != null ? String(atletaRaw).trim() : "";
      if (!atleta || normKey(atleta) === "TOTAL") return;

      const posRaw = pickRowField(row, "POS", "POSICAO", "POSIÇÃO", "#", "ORDEM", "RANK");
      let pos = Number(posRaw);
      if (!Number.isFinite(pos) || pos < 1) pos = outObj.length + 1;

      const golsRaw = pickRowCell(row, "GOLS", "GOL", "GOL(S)");
      const gols = parseGolsArtilheiroCell(golsRaw);

      const paisRaw = pickRowCell(
        row,
        "PAIS",
        "PAÍS",
        "SELECAO",
        "SELEÇÃO",
        "NACAO",
        "NAÇÃO",
        "NACIONALIDADE",
        "COUNTRY"
      );
      const pais = paisRaw != null ? String(paisRaw).trim() : "";

      const fotoRaw = pickRowCell(
        row,
        "FOTO",
        "FOTOS",
        "FOTO DO ATLETA",
        "FOTO DO JOGADOR",
        "URL_FOTO",
        "FOTO_URL",
        "IMAGEM",
        "IMG",
        "PHOTO",
        "AVATAR",
        "LINK_FOTO",
        "URL IMAGEM"
      );
      const foto = extractPhotoUrlFromCell(fotoRaw);

      const assistRaw = pickRowCell(
        row,
        "ASSISTENCIAS",
        "ASSISTÊNCIAS",
        "ASSIST",
        "ASSISTS",
        "AST",
        "PASSE",
        "PASSES GOL",
        "PASSES DE GOL"
      );
      const assistencias = parseGolsArtilheiroCell(assistRaw);

      outObj.push({ pos, atleta, gols, pais, foto, assistencias });
    });
    return outObj.sort((a, b) => a.pos - b.pos || a.atleta.localeCompare(b.atleta));
  }

  let headerIdx = -1;
  let colMap = null;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const cells = rowToCells(rows[i]);
    if (!cells.some((c) => c !== "" && c != null)) continue;
    if (parseGrupo(cells[0])) continue;
    const m = headerCellsToNormIndexMap(cells);
    const golsI = getColIndexFromHeaderMap(m, ["GOLS", "GOL", "GOL(S)"]);
    const atletaI = getColIndexFromHeaderMap(m, [
      "ATLETA",
      "GOLEADOR",
      "ARTILHEIRO REAL",
      "ARTILHEIRO OFICIAL",
      "NICK REAL",
      "ARTILHEIRO",
      "NOME",
    ]);
    if (golsI >= 0 && atletaI >= 0) {
      headerIdx = i;
      const paisI = getColIndexFromHeaderMap(m, [
        "PAIS",
        "PAÍS",
        "SELECAO",
        "SELEÇÃO",
        "NACAO",
        "NAÇÃO",
        "NACIONALIDADE",
        "COUNTRY",
      ]);
      const fotoI = getColIndexFromHeaderMap(m, [
        "FOTO",
        "FOTOS",
        "FOTO DO ATLETA",
        "FOTO DO JOGADOR",
        "URL_FOTO",
        "FOTO_URL",
        "IMAGEM",
        "IMG",
        "PHOTO",
        "AVATAR",
        "LINK_FOTO",
        "URL IMAGEM",
      ]);
      const assistI = getColIndexFromHeaderMap(m, [
        "ASSISTENCIAS",
        "ASSISTÊNCIAS",
        "ASSIST",
        "ASSISTS",
        "AST",
        "PASSE",
        "PASSES GOL",
        "PASSES DE GOL",
      ]);
      colMap = {
        atleta: atletaI,
        gols: golsI,
        pos: getColIndexFromHeaderMap(m, ["POS", "POSICAO", "POSIÇÃO", "#", "ORDEM", "RANK"]),
        pais: paisI,
        foto: fotoI,
        assistencias: assistI,
      };
      break;
    }
  }

  if (headerIdx < 0 || !colMap) {
    const simple = parseResultadoArtilheiroSimpleTwoCol(rows);
    if (simple.length) return simple;
    return [];
  }

  const out = [];
  for (let r = headerIdx + 1; r < rows.length; r++) {
    const cells = rowToCells(rows[r]);
    if (!cells.some((c) => c !== "" && c != null)) continue;
    const atleta = String(cells[colMap.atleta] ?? "").trim();
    if (!atleta || normKey(atleta) === "TOTAL") continue;

    let pos =
      colMap.pos >= 0 ? Number(cells[colMap.pos]) : NaN;
    if (!Number.isFinite(pos) || pos < 1) pos = out.length + 1;

    const gols = parseGolsArtilheiroCell(cells[colMap.gols]);
    const pais =
      colMap.pais >= 0 ? String(cells[colMap.pais] ?? "").trim() : "";
    const fotoRaw =
      colMap.foto >= 0 ? String(cells[colMap.foto] ?? "").trim() : "";
    const foto = extractPhotoUrlFromCell(fotoRaw);
    const assistRaw =
      colMap.assistencias >= 0
        ? String(cells[colMap.assistencias] ?? "").trim()
        : "";
    const assistencias = assistRaw
      ? parseGolsArtilheiroCell(assistRaw)
      : null;
    out.push({ pos, atleta, gols, pais, foto, assistencias });
  }

  return out.sort((a, b) => a.pos - b.pos || a.atleta.localeCompare(b.atleta));
}

function joinPalpitesComResultados(palpites, resultadosMap, gruposOficiaisResultados) {
  const faseGrupos = [];
  const gruposOficiais = { ...gruposOficiaisResultados };

  palpites.forEach((p) => {
    const key = rowKey(p.grupo, p.pais);
    const resultado = resultadosMap.get(key);

    if (!gruposOficiais[p.grupo]) gruposOficiais[p.grupo] = [];
    if (!gruposOficiais[p.grupo].includes(p.pais)) {
      gruposOficiais[p.grupo].push(p.pais);
    }

    faseGrupos.push({
      grupo: p.grupo,
      pais: p.pais,
      jogador: p.jogador,
      palpite: p.palpite,
      palpiteDaPlanilha: p.palpiteDaPlanilha === true,
      resultado: resultado ?? null,
    });
  });

  return { faseGrupos, gruposOficiais };
}

function buildClassificacaoFromResultadosMap(resultadosMap) {
  const byGroup = {};

  resultadosMap.forEach((resultado, key) => {
    if (resultado < 1 || resultado > 4) return;
    const sep = key.indexOf("|");
    const grupo = key.slice(0, sep);
    const pais = key.slice(sep + 1);
    if (!byGroup[grupo]) byGroup[grupo] = [];
    byGroup[grupo].push({ pais, resultado });
  });

  const classificacao = {};
  Object.entries(byGroup).forEach(([grupo, list]) => {
    classificacao[grupo] = list
      .sort((a, b) => a.resultado - b.resultado)
      .map((x) => x.pais);
  });

  return classificacao;
}

function resultadosMapToObject(map) {
  const obj = {};
  map.forEach((resultado, key) => {
    const sep = key.indexOf("|");
    const grupo = key.slice(0, sep);
    const pais = key.slice(sep + 1);
    if (!obj[grupo]) obj[grupo] = {};
    obj[grupo][pais] = resultado;
  });
  return obj;
}

async function loadFromGoogleSheets() {
  // Sequencial — evita corrida no callback JSONP do Google
  const palpitesRaw = await loadSheetTab(SHEETS_CONFIG.palpites);
  const resultadosRaw = await loadSheetTab(SHEETS_CONFIG.resultados);
  const palpitesMmRaw = await loadSheetTab(SHEETS_CONFIG.palpitesMataMata);
  const resultadosMmRaw = await loadSheetTab(SHEETS_CONFIG.resultadosMataMata);
  const jogosMmRaw = await loadSheetTab(SHEETS_CONFIG.jogosMataMata);
  const jogosRaw = await loadSheetTab(SHEETS_CONFIG.jogos);
  const artilheiroRaw = await loadSheetTab(SHEETS_CONFIG.artilheiro);
  const resultadoArtilheirosRaw = await loadSheetTab(
    SHEETS_CONFIG.resultadoArtilheiros
  );

  const palpites = parsePalpitesRows(palpitesRaw);
  const { map: resultadosMap, gruposOficiais: gruposResultados } =
    parseResultadosMap(resultadosRaw);

  if (!palpites.length) {
    throw new Error('Aba "Palpites" está vazia ou com formato inválido.');
  }

  const { faseGrupos, gruposOficiais } = joinPalpitesComResultados(
    palpites,
    resultadosMap,
    gruposResultados
  );

  const classificacaoGrupos = buildClassificacaoFromResultadosMap(resultadosMap);

  const { advance: mmAdvance, byFase: mmResultadosPorFase } =
    parseMataMataResultados(resultadosMmRaw);
  const palpitesMm = parseMataMataPalpites(palpitesMmRaw);
  const mataMata = joinMataMataPalpitesResultados(palpitesMm, mmAdvance);
  const jogosMataMata = parseJogosMataMata(jogosMmRaw);
  const jogosMataMataPorFase = groupJogosMataMataPorFase(jogosMataMata);
  const jogos = parseJogosFaseGruposRows(jogosRaw);
  const artilheiro = parseArtilheiroRows(artilheiroRaw);
  const resultadoArtilheiros = parseResultadoArtilheiroRows(
    resultadoArtilheirosRaw
  );

  return {
    faseGrupos,
    gruposOficiais,
    classificacaoGrupos,
    resultadosGrupos: resultadosMapToObject(resultadosMap),
    mataMata,
    mmResultadosPorFase,
    jogosMataMata,
    jogosMataMataPorFase,
    jogos,
    artilheiro,
    resultadoArtilheiros,
    stats: {
      palpites: palpites.length,
      resultados: resultadosMap.size,
      gruposPalpites: new Set(palpites.map((p) => p.grupo)).size,
      gruposResultados: Object.keys(classificacaoGrupos).length,
      palpitesMataMata: palpitesMm.length,
      resultadosMataMata: mmAdvance.size,
      jogosMataMata: jogosMataMata.length,
      jogos: jogos.length,
      artilheiro: artilheiro.length,
      resultadoArtilheiros: resultadoArtilheiros.length,
    },
  };
}

function clearSheetData() {
  MOCK_DATA.faseGrupos = [];
  MOCK_DATA.faseGruposPlanilha = [];
  MOCK_DATA.classificacaoGrupos = {};
  MOCK_DATA.gruposOficiais = {};
  MOCK_DATA.resultadosGrupos = {};
  MOCK_DATA.gruposPlanilha = [];
  MOCK_DATA.jogadoresPlanilha = [];
  MOCK_DATA.mataMata = [];
  MOCK_DATA.mmResultadosPorFase = {};
  MOCK_DATA.jogosMataMata = [];
  MOCK_DATA.jogosMataMataPorFase = {};
  MOCK_DATA.jogos = [];
  MOCK_DATA.artilheiro = [];
  MOCK_DATA.resultadoArtilheiros = [];
}

/** Posição 1–4 na fase de grupos (palpite contabilizado). */
function palpiteGrupoPosicaoValida(palpite) {
  const n = Number(palpite);
  return Number.isFinite(n) && n >= 1 && n <= 4;
}

/**
 * Só entram no app jogadores com:
 * - pelo menos uma linha em Palpites com valor explícito na coluna PALPITE (1–4), ou
 * - pelo menos uma linha em Palpites Mata-Mata com país vindo da coluna PAIS (formato longo).
 * Palpites inferidos só por ordem das linhas (coluna vazia) ou MM sem coluna PAIS não contam.
 */
function jogadoresComPalpitesVisiveis(faseGrupos, mataMata) {
  const candidatos = new Set([
    ...faseGrupos.map((r) => parseJogador(r.jogador)),
    ...mataMata.map((r) => parseJogador(r.jogador)),
  ]);
  return [...candidatos]
    .filter(
      (j) =>
        faseGrupos.some(
          (r) =>
            parseJogador(r.jogador) === j &&
            r.palpiteDaPlanilha === true &&
            palpiteGrupoPosicaoValida(r.palpite)
        ) ||
        mataMata.some(
          (r) =>
            parseJogador(r.jogador) === j &&
            r.mmPaisDaPlanilha === true &&
            r.pais != null &&
            String(r.pais).trim() !== ""
        )
    )
    .sort((a, b) => a.localeCompare(b, "pt-BR"));
}

async function applyGoogleSheetsToMockData() {
  if (typeof MOCK_DATA === "undefined") {
    throw new Error("mockData.js deve carregar antes de sheets-loader.js");
  }

  const {
    faseGrupos,
    gruposOficiais,
    classificacaoGrupos,
    resultadosGrupos,
    mataMata,
    mmResultadosPorFase,
    jogosMataMata,
    jogosMataMataPorFase,
    jogos,
    artilheiro,
    resultadoArtilheiros,
    stats,
  } = await loadFromGoogleSheets();

  const gruposNaPlanilha = [...new Set(faseGrupos.map((r) => r.grupo))];
  const linhas = faseGrupos.map((r) => ({ ...r }));

  MOCK_DATA.faseGrupos = linhas;
  MOCK_DATA.faseGruposPlanilha = linhas;
  MOCK_DATA.classificacaoGrupos = classificacaoGrupos;
  MOCK_DATA.gruposOficiais = { ...gruposOficiais };
  MOCK_DATA.resultadosGrupos = resultadosGrupos;
  MOCK_DATA.meta.dataSource = "google-sheets";
  MOCK_DATA.meta.planilhaUrl =
    "https://docs.google.com/spreadsheets/d/1iQ1xBKKcgRA8ESFQdZp8-ZWUWZrxc62a14aTy8UN4Ig";

  MOCK_DATA.gruposPlanilha = gruposNaPlanilha;
  MOCK_DATA.mataMata = mataMata;
  MOCK_DATA.mmResultadosPorFase = mmResultadosPorFase || {};
  MOCK_DATA.jogosMataMata = jogosMataMata || [];
  MOCK_DATA.jogosMataMataPorFase = jogosMataMataPorFase || {};
  MOCK_DATA.jogos = jogos || [];
  MOCK_DATA.jogadoresPlanilha = jogadoresComPalpitesVisiveis(
    faseGrupos,
    mataMata
  );
  MOCK_DATA.artilheiro = artilheiro || [];
  MOCK_DATA.resultadoArtilheiros = resultadoArtilheiros || [];

  return {
    rows: stats.palpites,
    grupos: stats.gruposPalpites,
    resultados: stats.resultados,
    gruposComResultado: stats.gruposResultados,
    palpitesMataMata: stats.palpitesMataMata,
    resultadosMataMata: stats.resultadosMataMata,
    jogosMataMata: stats.jogosMataMata,
    jogos: stats.jogos,
    artilheiro: stats.artilheiro,
    resultadoArtilheiros: stats.resultadoArtilheiros,
  };
}
