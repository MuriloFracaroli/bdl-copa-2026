/**
 * Mapa artilheiro com física leve: palpites em molas + repulsão, reagem ao cursor.
 * Fundo “constelação”, oficiais como sóis pulsantes, ligações com traço animado.
 */
(function () {
  const TAU = Math.PI * 2;
  const GOLDEN = Math.PI * (3 - Math.sqrt(5));
  /** Opacidade dos emojis nas bolhas de palpite (0–1). Mais alto = mais sólido sobre o gradiente. */
  const SATELLITE_EMOJI_OPACITY = 0.96;

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function lerpRgb(a, b, t) {
    return [
      a[0] + (b[0] - a[0]) * t,
      a[1] + (b[1] - a[1]) * t,
      a[2] + (b[2] - a[2]) * t,
    ];
  }

  function rgbaStr(rgb, alpha) {
    return `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${alpha})`;
  }

  /**
   * Cores-chave alinhadas aos emojis de destaque: 🏆 troféu (ouro/bronze),
   * 👑 coroa (ouro + violeta + rubi), ⚽ campo (verdes discretos).
   */
  function hubAuraPalette(isLeader, isTopScorer) {
    if (isTopScorer) {
      return {
        ringHi: [255, 228, 115],
        ringLo: [165, 95, 28],
        arc: [255, 205, 75],
        inner0: [255, 205, 95],
        inner1: [165, 75, 20],
        halo: [255, 200, 80],
        strokeHi: [255, 238, 180],
        strokeMid: [240, 175, 95],
        strokeLo: [210, 130, 55],
      };
    }
    if (isLeader) {
      return {
        ringHi: [255, 242, 220],
        ringLo: [120, 55, 160],
        arc: [230, 195, 255],
        inner0: [248, 225, 255],
        inner1: [95, 40, 130],
        halo: [255, 215, 130],
        strokeHi: [255, 230, 245],
        strokeMid: [210, 160, 225],
        strokeLo: [180, 120, 220],
      };
    }
    return {
      ringHi: [200, 238, 210],
      ringLo: [42, 98, 72],
      arc: [130, 205, 165],
      inner0: [175, 220, 190],
      inner1: [32, 78, 58],
      halo: [150, 200, 165],
      strokeHi: [225, 245, 230],
      strokeMid: [175, 205, 178],
      strokeLo: [120, 170, 135],
    };
  }

  /** Aura / anéis dos artilheiros oficiais: 0.22–1 conforme golos (√). */
  function hubGoalsAuraFactor(gols) {
    const g = Number(gols);
    if (!Number.isFinite(g) || g < 0) return 0.22;
    return clamp(0.24 + Math.sqrt(g) * 0.26, 0.24, 1);
  }

  /** Palpites: mesma ideia, amplitude menor que o hub (máx. ~0.52). */
  function satGoalsAuraFactor(gols) {
    const g = Number(gols);
    if (!Number.isFinite(g) || g < 0) return 0.1;
    return clamp(0.12 + Math.sqrt(Math.max(0, g)) * 0.14, 0.12, 0.52);
  }

  function normArtiName(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toUpperCase();
  }

  function nameMatchScore(pickName, officialName) {
    const A = normArtiName(pickName);
    const B = normArtiName(officialName);
    if (!A || !B) return 0;
    if (A === B) return 3;
    if (A.includes(B) || B.includes(A)) return 2;
    return 0;
  }

  function pickRelevance(pick, hub) {
    if (!hub || !String(hub.atleta || "").trim()) {
      let s = 10;
      if (String(pick.artilheiro || "").trim()) s += 12;
      if (Number.isFinite(pick.gols)) s += 8;
      return Math.min(48, s);
    }
    const nm = nameMatchScore(pick.artilheiro, hub.atleta);
    let s = nm * 20;
    const gOff = hub.gols;
    const gP = pick.gols;
    if (Number.isFinite(gOff) && Number.isFinite(gP)) {
      const d = Math.abs(gP - gOff);
      s += Math.max(0, 40 - d * 6);
    }
    return Math.min(100, Math.round(s));
  }

  function rgbCss(rgb) {
    return `rgb(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0})`;
  }

  function rgbaArr(rgb, a) {
    return `rgba(${rgb[0] | 0},${rgb[1] | 0},${rgb[2] | 0},${a})`;
  }

  function parseHexColor(hex) {
    if (!hex || typeof hex !== "string") return null;
    let s = hex.trim().replace(/^#/, "");
    if (s.length === 3) {
      s = s
        .split("")
        .map((c) => c + c)
        .join("");
    }
    if (!/^[0-9a-f]{6}$/i.test(s)) return null;
    const n = parseInt(s, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function hslToRgb(h, s, l) {
    h /= 360;
    s /= 100;
    l /= 100;
    if (s <= 0) {
      const x = Math.round(l * 255);
      return [x, x, x];
    }
    const hue2rgb = (p, q, t) => {
      let tt = t;
      if (tt < 0) tt += 1;
      if (tt > 1) tt -= 1;
      if (tt < 1 / 6) return p + (q - p) * 6 * tt;
      if (tt < 1 / 2) return q;
      if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [
      Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
      Math.round(hue2rgb(p, q, h) * 255),
      Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
    ];
  }

  function hashHueFromString(s) {
    let h = 5381;
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) + h) ^ s.charCodeAt(i);
    }
    return Math.abs(h) % 360;
  }

  function paletteFromHue(h) {
    const fillHi = hslToRgb(h, 44, 72);
    const fillLo = hslToRgb((h + 28) % 360, 52, 36);
    const ringHi = hslToRgb((h + 14) % 360, 48, 68);
    const ringLo = hslToRgb((h + 6) % 360, 55, 42);
    const stroke = hslToRgb((h + 10) % 360, 58, 28);
    return { fillHi, fillLo, ringHi, ringLo, stroke };
  }

  /** Paletas manuais inspiradas nos tons típicos de cada emoji (fundo / aura / contorno). */
  const SAT_EMOJI_PRESET = {
    "⚽": {
      fillHi: [235, 255, 238],
      fillLo: [0, 110, 58],
      ringHi: [160, 255, 190],
      ringLo: [0, 140, 72],
      stroke: [0, 72, 38],
    },
    "🏀": {
      fillHi: [255, 230, 200],
      fillLo: [180, 85, 20],
      ringHi: [255, 180, 120],
      ringLo: [140, 55, 10],
      stroke: [100, 40, 8],
    },
    "🎾": {
      fillHi: [245, 255, 220],
      fillLo: [110, 150, 30],
      ringHi: [220, 255, 140],
      ringLo: [70, 110, 20],
      stroke: [45, 75, 12],
    },
    "☁": {
      fillHi: [250, 252, 255],
      fillLo: [130, 150, 175],
      ringHi: [220, 232, 255],
      ringLo: [90, 110, 145],
      stroke: [55, 75, 110],
    },
    "☁️": {
      fillHi: [250, 252, 255],
      fillLo: [130, 150, 175],
      ringHi: [220, 232, 255],
      ringLo: [90, 110, 145],
      stroke: [55, 75, 110],
    },
    "⛈": {
      fillHi: [230, 240, 255],
      fillLo: [65, 95, 145],
      ringHi: [170, 210, 255],
      ringLo: [40, 65, 120],
      stroke: [28, 48, 92],
    },
    "⛈️": {
      fillHi: [230, 240, 255],
      fillLo: [65, 95, 145],
      ringHi: [170, 210, 255],
      ringLo: [40, 65, 120],
      stroke: [28, 48, 92],
    },
    "🌧": {
      fillHi: [220, 235, 255],
      fillLo: [70, 100, 150],
      ringHi: [160, 200, 255],
      ringLo: [45, 75, 130],
      stroke: [30, 55, 100],
    },
    "🌧️": {
      fillHi: [220, 235, 255],
      fillLo: [70, 100, 150],
      ringHi: [160, 200, 255],
      ringLo: [45, 75, 130],
      stroke: [30, 55, 100],
    },
    "🌩": {
      fillHi: [235, 225, 255],
      fillLo: [90, 70, 140],
      ringHi: [210, 180, 255],
      ringLo: [55, 40, 110],
      stroke: [40, 28, 85],
    },
    "🌩️": {
      fillHi: [235, 225, 255],
      fillLo: [90, 70, 140],
      ringHi: [210, 180, 255],
      ringLo: [55, 40, 110],
      stroke: [40, 28, 85],
    },
    "⛅": {
      fillHi: [255, 250, 230],
      fillLo: [140, 155, 175],
      ringHi: [255, 230, 180],
      ringLo: [100, 125, 155],
      stroke: [75, 95, 120],
    },
    "🌤": {
      fillHi: [255, 248, 220],
      fillLo: [200, 160, 70],
      ringHi: [255, 220, 120],
      ringLo: [180, 130, 40],
      stroke: [120, 85, 25],
    },
    "🌦": {
      fillHi: [235, 245, 255],
      fillLo: [100, 130, 165],
      ringHi: [190, 220, 255],
      ringLo: [60, 95, 140],
      stroke: [40, 70, 105],
    },
    "🌨": {
      fillHi: [248, 252, 255],
      fillLo: [120, 145, 175],
      ringHi: [220, 235, 255],
      ringLo: [80, 110, 145],
      stroke: [50, 75, 105],
    },
    "⚡": {
      fillHi: [255, 255, 200],
      fillLo: [200, 170, 0],
      ringHi: [255, 240, 120],
      ringLo: [180, 140, 0],
      stroke: [120, 90, 0],
    },
    "🌙": {
      fillHi: [255, 250, 235],
      fillLo: [80, 70, 120],
      ringHi: [230, 210, 255],
      ringLo: [50, 45, 95],
      stroke: [35, 30, 75],
    },
    "☀": {
      fillHi: [255, 252, 200],
      fillLo: [230, 150, 30],
      ringHi: [255, 230, 100],
      ringLo: [200, 110, 20],
      stroke: [140, 75, 10],
    },
    "☀️": {
      fillHi: [255, 252, 200],
      fillLo: [230, 150, 30],
      ringHi: [255, 230, 100],
      ringLo: [200, 110, 20],
      stroke: [140, 75, 10],
    },
    "🔥": {
      fillHi: [255, 240, 200],
      fillLo: [200, 60, 20],
      ringHi: [255, 160, 80],
      ringLo: [180, 40, 10],
      stroke: [120, 25, 5],
    },
    "❤": {
      fillHi: [255, 230, 235],
      fillLo: [180, 30, 55],
      ringHi: [255, 150, 170],
      ringLo: [130, 20, 45],
      stroke: [90, 12, 32],
    },
    "❤️": {
      fillHi: [255, 230, 235],
      fillLo: [180, 30, 55],
      ringHi: [255, 150, 170],
      ringLo: [130, 20, 45],
      stroke: [90, 12, 32],
    },
    "💜": {
      fillHi: [245, 230, 255],
      fillLo: [110, 50, 160],
      ringHi: [220, 170, 255],
      ringLo: [75, 30, 120],
      stroke: [50, 18, 85],
    },
    "🖤": {
      fillHi: [200, 200, 210],
      fillLo: [35, 35, 42],
      ringHi: [150, 150, 165],
      ringLo: [25, 25, 32],
      stroke: [12, 12, 18],
    },
    "👑": {
      fillHi: [255, 245, 210],
      fillLo: [160, 110, 30],
      ringHi: [255, 220, 120],
      ringLo: [120, 70, 20],
      stroke: [85, 50, 12],
    },
    "🏆": {
      fillHi: [255, 242, 210],
      fillLo: [175, 120, 35],
      ringHi: [255, 210, 100],
      ringLo: [130, 80, 25],
      stroke: [95, 55, 15],
    },
    "🌈": {
      fillHi: [255, 240, 255],
      fillLo: [120, 80, 160],
      ringHi: [255, 180, 220],
      ringLo: [80, 120, 200],
      stroke: [60, 40, 120],
    },
    "🍑": {
      fillHi: [255, 230, 220],
      fillLo: [220, 120, 90],
      ringHi: [255, 180, 160],
      ringLo: [180, 80, 60],
      stroke: [130, 50, 40],
    },
    "🥭": {
      fillHi: [255, 245, 200],
      fillLo: [230, 160, 40],
      ringHi: [255, 220, 100],
      ringLo: [200, 130, 25],
      stroke: [150, 90, 15],
    },
    "🦄": {
      fillHi: [245, 230, 255],
      fillLo: [160, 90, 200],
      ringHi: [230, 180, 255],
      ringLo: [110, 50, 150],
      stroke: [75, 30, 110],
    },
    "🐵": {
      fillHi: [255, 235, 215],
      fillLo: [120, 80, 50],
      ringHi: [220, 180, 140],
      ringLo: [85, 55, 35],
      stroke: [55, 35, 22],
    },
    "🐄": {
      fillHi: [248, 245, 240],
      fillLo: [90, 85, 80],
      ringHi: [210, 200, 195],
      ringLo: [55, 50, 48],
      stroke: [35, 32, 30],
    },
    "🍺": {
      fillHi: [255, 240, 210],
      fillLo: [200, 140, 40],
      ringHi: [255, 200, 90],
      ringLo: [160, 100, 25],
      stroke: [110, 65, 15],
    },
    "⭐": {
      fillHi: [255, 248, 220],
      fillLo: [200, 150, 40],
      ringHi: [255, 230, 120],
      ringLo: [180, 120, 30],
      stroke: [120, 80, 15],
    },
    "🌟": {
      fillHi: [255, 250, 230],
      fillLo: [210, 140, 40],
      ringHi: [255, 220, 100],
      ringLo: [190, 110, 25],
      stroke: [130, 75, 12],
    },
    "🍕": {
      fillHi: [255, 235, 210],
      fillLo: [200, 100, 45],
      ringHi: [255, 180, 100],
      ringLo: [160, 70, 30],
      stroke: [110, 45, 18],
    },
    "🍔": {
      fillHi: [255, 230, 200],
      fillLo: [160, 95, 45],
      ringHi: [240, 170, 90],
      ringLo: [110, 60, 25],
      stroke: [75, 40, 15],
    },
    "💎": {
      fillHi: [230, 250, 255],
      fillLo: [40, 120, 150],
      ringHi: [160, 230, 255],
      ringLo: [25, 85, 120],
      stroke: [15, 55, 85],
    },
    "🎮": {
      fillHi: [235, 235, 255],
      fillLo: [80, 60, 140],
      ringHi: [180, 170, 255],
      ringLo: [50, 40, 100],
      stroke: [30, 25, 70],
    },
    "🎸": {
      fillHi: [255, 230, 220],
      fillLo: [140, 70, 55],
      ringHi: [255, 160, 130],
      ringLo: [100, 45, 35],
      stroke: [65, 28, 22],
    },
    "🎤": {
      fillHi: [255, 235, 245],
      fillLo: [120, 60, 100],
      ringHi: [240, 150, 200],
      ringLo: [80, 35, 75],
      stroke: [50, 20, 55],
    },
    "🚗": {
      fillHi: [235, 240, 255],
      fillLo: [55, 75, 120],
      ringHi: [160, 190, 255],
      ringLo: [35, 50, 90],
      stroke: [22, 35, 65],
    },
    "🚀": {
      fillHi: [240, 245, 255],
      fillLo: [90, 70, 130],
      ringHi: [200, 180, 255],
      ringLo: [55, 40, 100],
      stroke: [35, 28, 75],
    },
    "🌊": {
      fillHi: [220, 245, 255],
      fillLo: [30, 100, 150],
      ringHi: [120, 210, 255],
      ringLo: [20, 75, 120],
      stroke: [12, 50, 90],
    },
    "🐍": {
      fillHi: [230, 255, 225],
      fillLo: [40, 120, 65],
      ringHi: [150, 230, 170],
      ringLo: [25, 85, 50],
      stroke: [15, 55, 32],
    },
    "🦁": {
      fillHi: [255, 235, 200],
      fillLo: [180, 110, 35],
      ringHi: [255, 190, 100],
      ringLo: [140, 75, 22],
      stroke: [95, 50, 12],
    },
    "🦅": {
      fillHi: [245, 240, 255],
      fillLo: [70, 65, 95],
      ringHi: [190, 185, 230],
      ringLo: [40, 38, 65],
      stroke: [25, 24, 45],
    },
    "🍌": {
      fillHi: [255, 252, 200],
      fillLo: [220, 180, 40],
      ringHi: [255, 235, 100],
      ringLo: [190, 150, 25],
      stroke: [130, 100, 15],
    },
    "🍎": {
      fillHi: [255, 220, 220],
      fillLo: [180, 35, 40],
      ringHi: [255, 140, 140],
      ringLo: [130, 25, 30],
      stroke: [85, 15, 20],
    },
    "🍓": {
      fillHi: [255, 225, 235],
      fillLo: [190, 40, 70],
      ringHi: [255, 130, 160],
      ringLo: [140, 25, 55],
      stroke: [95, 15, 38],
    },
    "💀": {
      fillHi: [235, 240, 230],
      fillLo: [70, 85, 70],
      ringHi: [190, 210, 190],
      ringLo: [45, 55, 45],
      stroke: [25, 32, 25],
    },
    "🤡": {
      fillHi: [255, 245, 240],
      fillLo: [200, 60, 70],
      ringHi: [255, 180, 160],
      ringLo: [160, 40, 50],
      stroke: [110, 25, 35],
    },
    "👻": {
      fillHi: [248, 248, 255],
      fillLo: [200, 200, 220],
      ringHi: [230, 230, 255],
      ringLo: [150, 150, 185],
      stroke: [100, 100, 130],
    },
    "🐸": {
      fillHi: [230, 255, 220],
      fillLo: [40, 130, 60],
      ringHi: [160, 240, 150],
      ringLo: [25, 95, 40],
      stroke: [15, 65, 28],
    },
    "🦋": {
      fillHi: [245, 235, 255],
      fillLo: [120, 80, 180],
      ringHi: [220, 170, 255],
      ringLo: [75, 45, 130],
      stroke: [50, 28, 95],
    },
    "🌹": {
      fillHi: [255, 230, 240],
      fillLo: [160, 35, 70],
      ringHi: [255, 140, 170],
      ringLo: [110, 22, 50],
      stroke: [75, 12, 35],
    },
    "🎯": {
      fillHi: [255, 240, 240],
      fillLo: [180, 45, 45],
      ringHi: [255, 140, 140],
      ringLo: [130, 30, 30],
      stroke: [85, 18, 18],
    },
    "🎲": {
      fillHi: [255, 245, 250],
      fillLo: [90, 70, 110],
      ringHi: [210, 180, 240],
      ringLo: [55, 40, 80],
      stroke: [35, 25, 55],
    },
  };

  let _satEmojiKeysSorted = null;
  function satEmojiPresetKeys() {
    if (!_satEmojiKeysSorted) {
      _satEmojiKeysSorted = Object.keys(SAT_EMOJI_PRESET).sort(
        (a, b) => b.length - a.length
      );
    }
    return _satEmojiKeysSorted;
  }

  function findSatEmojiPreset(avatarRaw) {
    const s = String(avatarRaw || "").trim();
    if (!s) return null;
    for (const key of satEmojiPresetKeys()) {
      if (s.startsWith(key)) return SAT_EMOJI_PRESET[key];
    }
    return null;
  }

  function mergeCorIntoPalette(pal, corHex, amount) {
    const c = parseHexColor(corHex);
    if (!c) return pal;
    const t = amount;
    return {
      fillHi: lerpRgb(pal.fillHi, c, t * 0.35),
      fillLo: lerpRgb(pal.fillLo, c, t * 0.45),
      ringHi: lerpRgb(pal.ringHi, c, t * 0.3),
      ringLo: lerpRgb(pal.ringLo, c, t * 0.35),
      stroke: lerpRgb(pal.stroke, c, t * 0.4),
    };
  }

  /** Paleta visual do palpite a partir do avatar (emoji) e cor da planilha. */
  function emojiAuraPalette(avatarRaw, corHex) {
    const s = String(avatarRaw || "⚽").trim();
    let pal = findSatEmojiPreset(s);
    if (!pal) {
      const g = [...s][0] || "⚽";
      pal = paletteFromHue(hashHueFromString(g + s));
    }
    pal = mergeCorIntoPalette(pal, corHex, 0.55);
    return pal;
  }

  function metaFor(jogadorKey) {
    if (typeof getPlayerMeta === "function") return getPlayerMeta(jogadorKey);
    return { nome: jogadorKey, avatar: "⚽", cor: "#00c853" };
  }

  /** Rótulo amigável do país do artilheiro (planilha + MOCK_DATA.paises). */
  function officialPaisLabel(raw) {
    const s = String(raw || "").trim();
    if (!s) return "";
    if (typeof parsePais === "function" && typeof getCountryInfo === "function") {
      try {
        const info = getCountryInfo(parsePais(s));
        return (info && info.nome) || s;
      } catch {
        return s;
      }
    }
    return s;
  }

  function escHtmlLite(str) {
    const d = document.createElement("div");
    d.textContent = str == null ? "" : String(str);
    return d.innerHTML;
  }

  /** Bandeira regional (emoji) só para ISO2 (ex.: mx); ignora códigos compostos (ex.: gb-eng). */
  function flagEmojiFromIso2Letter(codigo) {
    const raw = String(codigo || "")
      .trim()
      .toLowerCase()
      .replace(/_/g, "");
    if (!/^[a-z]{2}$/.test(raw)) return "";
    const A = 0x1f1e6;
    return String.fromCodePoint(
      A + raw.charCodeAt(0) - 97,
      A + raw.charCodeAt(1) - 97
    );
  }

  /** Texto sob a bolha oficial no canvas: emoji + país (imagem PNG não desenhada aqui). */
  function hubPaisLineCanvas(hub) {
    const label = officialPaisLabel(hub.pais);
    if (!label) return "";
    let emoji = "";
    if (typeof getCountryInfo === "function" && typeof parsePais === "function") {
      try {
        const info = getCountryInfo(parsePais(hub.pais));
        emoji = flagEmojiFromIso2Letter(info.codigo);
      } catch (_) {}
    }
    return emoji ? `${emoji} ${label}` : label;
  }

  /** HTML do tooltip: <img bandeira> + nome. */
  function hubPaisLineTooltipHtml(hub) {
    const label = officialPaisLabel(hub.pais);
    if (!label) return "";
    if (
      typeof getCountryInfo !== "function" ||
      typeof parsePais !== "function" ||
      typeof flagUrl !== "function"
    ) {
      return escHtmlLite(label);
    }
    try {
      const info = getCountryInfo(parsePais(hub.pais));
      const src = flagUrl(info.codigo, 40);
      return `<img class="arti-tip-flag" src="${escHtmlLite(src)}" alt="" width="22" height="16" loading="lazy" crossorigin="anonymous" /><span>${escHtmlLite(info.nome)}</span>`;
    } catch (_) {
      return escHtmlLite(label);
    }
  }

  /** Chave para mapa de fotos (minúsculas, sem acentos). */
  function normPhotoLookupKey(s) {
    return String(s || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }

  /** Cache URL → imagem carregada (CORS anonymous para uso no canvas). */
  const hubPhotoCache = new Map();

  function extractHttpUrlFromString(raw) {
    const s = String(raw || "").trim();
    if (!s) return "";
    const first = s.split(/\s+/)[0];
    if (/^https?:\/\//i.test(first)) return first.replace(/[,;.]+$/u, "");
    const m = s.match(/https?:\/\/[^\s"'<>\]]+/iu);
    return m ? m[0].replace(/[,;.]+$/u, "") : "";
  }

  function resolveHubPhotoUrl(hub) {
    const fromCell = extractHttpUrlFromString(
      hub.foto || hub.fotoUrl || hub.urlFoto || hub.FOTO || ""
    );
    if (fromCell) return fromCell;
    const fb =
      typeof ARTI_SCORER_PHOTO_FALLBACK !== "undefined"
        ? ARTI_SCORER_PHOTO_FALLBACK
        : null;
    if (!fb || typeof fb !== "object") return "";
    const nk = normPhotoLookupKey(hub.atleta);
    if (nk && fb[nk]) return fb[nk];
    for (const [k, url] of Object.entries(fb)) {
      if (!k || !url) continue;
      if (nk && (nk.includes(k) || k.includes(nk))) return url;
    }
    return "";
  }

  function ensureScorerPhoto(url) {
    if (!url || hubPhotoCache.has(url)) return;
    const im = new Image();
    im.crossOrigin = "anonymous";
    hubPhotoCache.set(url, { img: im, ready: false, err: false });
    im.onload = () => {
      const e = hubPhotoCache.get(url);
      if (e) {
        e.ready = true;
        drawScene();
      }
    };
    im.onerror = () => {
      const e = hubPhotoCache.get(url);
      if (e) {
        e.err = true;
        drawScene();
      }
    };
    im.src = url;
  }

  function getHubPhotoState(url) {
    if (!url) return null;
    return hubPhotoCache.get(url) || null;
  }

  /** Recorte circular estilo “capa” (object-fit: cover). */
  function drawCircularPhotoCover(ctx2, cx, cy, radius, img) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    ctx2.save();
    ctx2.beginPath();
    ctx2.arc(cx, cy, radius, 0, TAU);
    ctx2.closePath();
    ctx2.clip();
    const scale = Math.max((radius * 2) / iw, (radius * 2) / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    ctx2.drawImage(img, cx - dw / 2, cy - dh / 2, dw, dh);
    ctx2.restore();
  }

  let canvas;
  let ctx;
  let tooltip;
  let wrap;
  let hits = [];
  let cssW = 400;
  let cssH = 400;
  let dpr = 1;
  let ro;
  let handleMove;
  let handleClick;

  /** Estado da simulação (reconstruído no resize / render). */
  let world = null;
  let simTime = 0;
  let rafId = null;
  let lastTick = 0;
  let ioVisible = true;
  let ioObserver = null;

  const pointer = { x: 0, y: 0, active: false };

  /** Câmera: centro do ecrã mostra (camX, camY) no espaço mundo; zoom. */
  let camX = 0;
  let camY = 0;
  let viewZoom = 1;
  let isPanning = false;
  /** Arrastar bolha: palpite (`sat`) ou artilheiro oficial (`H`). */
  let bubbleDrag = null;
  let lastScreenMx = 0;
  let lastScreenMy = 0;
  let lastStepDt = 0.016;

  let handleWheel;
  let handleDown;
  /** `mousemove` na janela só durante arrasto de bolha (cursor pode sair do canvas). */
  let handleBubbleDragMove = null;

  function startBubbleDragWindowListen() {
    if (handleBubbleDragMove) return;
    handleBubbleDragMove = (e) => {
      onPointerMove(e);
    };
    window.addEventListener("mousemove", handleBubbleDragMove);
  }

  function stopBubbleDragWindowListen() {
    if (handleBubbleDragMove) {
      window.removeEventListener("mousemove", handleBubbleDragMove);
      handleBubbleDragMove = null;
    }
  }

  function resetCamera() {
    camX = cssW / 2;
    camY = cssH / 2;
    viewZoom = 1;
  }

  function screenToWorld(sx, sy) {
    return {
      x: (sx - cssW / 2) / viewZoom + camX,
      y: (sy - cssH / 2) / viewZoom + camY,
    };
  }

  function applyCamera(ctx2) {
    ctx2.translate(cssW / 2, cssH / 2);
    ctx2.scale(viewZoom, viewZoom);
    ctx2.translate(-camX, -camY);
  }

  /** Distância do centro do hub à órbita do palpite j (layout + flutuação). */
  function satelliteOrbitRadius(baseR, j, m) {
    const spr = Math.sqrt(j + 1);
    return baseR + 118 + spr * (m > 12 ? 52 : 48);
  }

  function buildLayout(w, h) {
    const officials =
      (typeof MOCK_DATA !== "undefined" && MOCK_DATA.resultadoArtilheiros) ||
      [];
    const picks =
      (typeof MOCK_DATA !== "undefined" && MOCK_DATA.artilheiro) || [];

    const cx = w / 2;
    const cy = h / 2;
    const n = Math.max(officials.length, 1);
    const R =
      Math.min(w, h) *
      (n <= 4 ? 0.7 : n <= 8 ? 0.74 : 0.79) *
      (1 + Math.min(0.3, (n - 1) * 0.028));

    const HUB_RADIUS_SCALE = 2.12;

    const hubs = officials.map((hub, i) => {
      const ang = -Math.PI / 2 + (TAU * i) / n;
      const x = cx + Math.cos(ang) * R;
      const y = cy + Math.sin(ang) * R;
      const g = Number(hub.gols);
      /** Raio base (px): mais golos → bolha maior; 0 gols → o dobro do mínimo antigo (foto/nó maior que o retrato). */
      const gEff = Number.isFinite(g) && g > 0 ? Math.min(g, 40) : 0;
      const rInner =
        gEff > 0
          ? Math.min(
              68,
              13 + Math.sqrt(gEff) * 12.5 + gEff * 0.48
            )
          : 22;
      const rHub = rInner * HUB_RADIUS_SCALE;
      return { hub, x, y, r: rHub, ang, satellites: [] };
    });

    /** Afasta sóis que ficaram demasiado juntos (raio grande + aura). */
    function relaxHubCenters(hubList, w, h) {
      if (hubList.length < 2) return;
      const passes = 12;
      for (let p = 0; p < passes; p++) {
        for (let i = 0; i < hubList.length; i++) {
          for (let j = i + 1; j < hubList.length; j++) {
            const A = hubList[i];
            const B = hubList[j];
            let dx = B.x - A.x;
            let dy = B.y - A.y;
            let d = Math.hypot(dx, dy);
            if (d < 0.001) {
              dx = 1;
              dy = 0;
              d = 1;
            }
            const need = A.r + B.r + 88;
            if (d < need) {
              const push = (need - d) * 0.62;
              const ux = dx / d;
              const uy = dy / d;
              A.x -= ux * push;
              A.y -= uy * push;
              B.x += ux * push;
              B.y += uy * push;
            }
          }
        }
        hubList.forEach((H) => {
          H.x = clamp(H.x, H.r + 8, w - H.r - 8);
          H.y = clamp(H.y, H.r + 8, h - H.r - 8);
        });
      }
    }
    relaxHubCenters(hubs, w, h);

    /** Posição no ranking = ordem por golos (mais golos = 1). Empates: coluna Pos da planilha, depois nome. */
    const rankRows = hubs.slice();
    rankRows.sort((a, b) => {
      const ga = Number(a.hub.gols);
      const gb = Number(b.hub.gols);
      const aNum = Number.isFinite(ga);
      const bNum = Number.isFinite(gb);
      if (aNum && bNum && gb !== ga) return gb - ga;
      if (aNum && !bNum) return -1;
      if (!aNum && bNum) return 1;
      const pa = Number(a.hub.pos);
      const pb = Number(b.hub.pos);
      if (Number.isFinite(pa) && Number.isFinite(pb) && pa !== pb)
        return pa - pb;
      if (Number.isFinite(pa) && !Number.isFinite(pb)) return -1;
      if (!Number.isFinite(pa) && Number.isFinite(pb)) return 1;
      return String(a.hub.atleta || "").localeCompare(
        String(b.hub.atleta || ""),
        undefined,
        { sensitivity: "base" }
      );
    });
    rankRows.forEach((H, i) => {
      H.rankByGols = i + 1;
    });

    const unmatched = [];

    picks.forEach((pick) => {
      const nm = String(pick.artilheiro || "").trim();
      if (!nm && pick.gols == null) return;
      let best = -1;
      let bestMs = 0;
      hubs.forEach((H, hi) => {
        const ms = nameMatchScore(pick.artilheiro, H.hub.atleta);
        if (ms > bestMs) {
          bestMs = ms;
          best = hi;
        }
      });
      const meta = metaFor(pick.jogador);
      if (best >= 0 && bestMs > 0) {
        const rel = pickRelevance(pick, hubs[best].hub);
        hubs[best].satellites.push({ pick, rel, meta });
      } else {
        const rel = pickRelevance(pick, null);
        unmatched.push({ pick, rel, meta });
      }
    });

    function placePhyllotaxis(clusterX, clusterY, startAng, satellites, baseR) {
      const m = satellites.length;
      satellites.forEach((sat, j) => {
        const ang = j * GOLDEN + startAng;
        const dist = satelliteOrbitRadius(baseR, j, m);
        sat.tx = clusterX + Math.cos(ang) * dist;
        sat.ty = clusterY + Math.sin(ang) * dist;
        sat.r = clamp(14 + (sat.rel / 100) * 11, 14, 26);
      });
    }

    hubs.forEach((H) => {
      placePhyllotaxis(H.x, H.y, H.ang + 0.9, H.satellites, H.r);
    });

    unmatched.forEach((sat, j) => {
      const ang = j * GOLDEN;
      const spr = Math.sqrt(j + 1);
      const dist = 168 + spr * 46;
      sat.tx = cx + Math.cos(ang) * dist;
      sat.ty = cy + Math.sin(ang) * dist;
      sat.r = clamp(12 + (sat.rel / 100) * 10, 12, 22);
    });

    let leaderH = null;
    if (hubs.length) {
      leaderH = hubs.find((H) => H.rankByGols === 1) || hubs[0];
    }
    hubs.forEach((H) => {
      H.isLeader = leaderH != null && H === leaderH;
    });

    let maxGols = -1;
    hubs.forEach((H) => {
      const g = Number(H.hub.gols);
      if (Number.isFinite(g) && g > maxGols) maxGols = g;
    });
    hubs.forEach((H) => {
      const g = Number(H.hub.gols);
      H.isTopScorer =
        maxGols > 0 && Number.isFinite(g) && g === maxGols;
    });

    hubs.forEach((H) => {
      let mul = 1;
      if (H.isLeader) mul *= 1.18;
      if (H.isTopScorer) mul *= 1.06;
      H.rPhys = H.r * mul;
    });

    /** Faixa sob a bolha (nome + golos + país) para repelir palpites na física. */
    hubs.forEach((H) => {
      const sc = H.isLeader ? 1.08 : H.isTopScorer ? 1.04 : 1;
      H._lblScale = sc;
      H._labelPadBelow = 15;
      H._labelDepth = 92;
      H._labelHalfW = Math.max(H.r * 2.75, 120) * sc * 0.5 + 14;
    });

    hubs.forEach((H) => {
      H.satellites.forEach((s) => {
        s._orbitLeader = H.isLeader === true;
      });
    });
    unmatched.forEach((s) => {
      s._orbitLeader = false;
    });

    const allSats = [];
    hubs.forEach((H) => H.satellites.forEach((s) => allSats.push(s)));
    unmatched.forEach((s) => allSats.push(s));
    let maxRelLeader = -1;
    allSats.forEach((s) => {
      if (s._orbitLeader && s.rel > maxRelLeader) maxRelLeader = s.rel;
    });
    allSats.forEach((s) => {
      const inL = s._orbitLeader === true;
      s.isTopAffinity =
        inL && maxRelLeader > 0 && s.rel === maxRelLeader;
      const top = s.isTopAffinity;
      s.isHot = inL && !top && s.rel >= 72;
      s.isWarm = inL && !s.isHot && !top && s.rel >= 52;
      const rd = top ? s.r * 1.12 : s.r;
      const labelPad = 28;
      s._repelR =
        rd +
        labelPad +
        (top ? 58 : s.isHot ? 52 : s.isWarm ? 48 : 44);
    });

    hubs.forEach((H) => {
      H.anchorX = H.x;
      H.anchorY = H.y;
    });

    return { hubs, unmatched, cx, cy, w, h };
  }

  /** Oscilação suave do centro do hub (âncora fixa em anchorX/Y). */
  function hubFloatOffset(H, t) {
    if (H._userDragging) return { ox: 0, oy: 0 };
    const a = H.ang * 4.2 + String(H.hub.atleta || "").length * 0.07;
    const amp = 11 + Math.min(7, H.r * 0.11);
    const wx = 0.4 + 0.08 * Math.sin(H.ang * 2);
    const wy = 0.34 + 0.09 * Math.cos(H.ang * 1.7);
    const ox =
      Math.sin(t * wx + a) * amp +
      Math.cos(t * wx * 0.52 + a * 1.45) * (amp * 0.4);
    const oy =
      Math.cos(t * wy + a * 1.15) * amp +
      Math.sin(t * wy * 0.5 + a * 2.05) * (amp * 0.38);
    return { ox, oy };
  }

  function updateFloatingHubs(w, h, t) {
    if (!world || !world.hubs.length) return;
    world.hubs.forEach((H) => {
      const ax = H.anchorX != null ? H.anchorX : H.x;
      const ay = H.anchorY != null ? H.anchorY : H.y;
      if (H.anchorX == null) {
        H.anchorX = ax;
        H.anchorY = ay;
      }
      const { ox, oy } = hubFloatOffset(H, t);
      H.x = clamp(ax + ox, H.r + 8, w - H.r - 8);
      H.y = clamp(ay + oy, H.r + 8, h - H.r - 8);
      const m = H.satellites.length;
      const baseR = H.r;
      const startAng = H.ang + 0.9;
      if (!H._userDragging) {
        H.satellites.forEach((sat, j) => {
          if (bubbleDrag && bubbleDrag.kind === "sat" && bubbleDrag.sat === sat) {
            return;
          }
          const ang = j * GOLDEN + startAng;
          const dist = satelliteOrbitRadius(baseR, j, m);
          sat.tx = H.x + Math.cos(ang) * dist;
          sat.ty = H.y + Math.sin(ang) * dist;
        });
      }
    });
  }

  function spawnStars(w, h, count) {
    const stars = [];
    for (let i = 0; i < count; i++) {
      stars.push({
        x: Math.random() * w,
        y: Math.random() * h,
        s: 0.4 + Math.random() * 1.2,
        ph: Math.random() * TAU,
      });
    }
    return stars;
  }

  function initParticle(sat, w, h) {
    sat._phase = Math.random() * TAU;
    const j = 64 + Math.random() * 88;
    sat.sx = clamp(sat.tx + (Math.random() - 0.5) * j, 10, w - 10);
    sat.sy = clamp(sat.ty + (Math.random() - 0.5) * j, 10, h - 10);
    sat.vx = (Math.random() - 0.5) * 45;
    sat.vy = (Math.random() - 0.5) * 45;
  }

  function rebuildWorld() {
    if (!canvas) return;
    resetCamera();
    const layout = buildLayout(cssW, cssH);
    layout.stars = spawnStars(cssW, cssH, Math.min(80, Math.floor((cssW * cssH) / 9000)));
    layout.hubs.forEach((H) => {
      H.satellites.forEach((sat) => initParticle(sat, cssW, cssH));
    });
    layout.unmatched.forEach((sat) => initParticle(sat, cssW, cssH));
    layout.hubs.forEach((H) => {
      H.photoUrl = resolveHubPhotoUrl(H.hub);
      if (H.photoUrl) ensureScorerPhoto(H.photoUrl);
    });
    world = layout;
    simTime = 0;
    updateFloatingHubs(cssW, cssH, simTime);
  }

  function roundRect(ctx2, x, y, w, h, rad) {
    const r = Math.min(rad, w / 2, h / 2);
    ctx2.beginPath();
    ctx2.moveTo(x + r, y);
    ctx2.arcTo(x + w, y, x + w, y + h, r);
    ctx2.arcTo(x + w, y + h, x, y + h, r);
    ctx2.arcTo(x, y + h, x, y, r);
    ctx2.arcTo(x, y, x + w, y, r);
    ctx2.closePath();
  }

  function drawBackground(w, h, t, hubs) {
    const list = Array.isArray(hubs) ? hubs : [];
    const hasTrophy = list.some((H) => H && H.isTopScorer);
    const hasCrown = list.some((H) => H && H.isLeader);
    const pitchOnly = list.length > 0 && !hasTrophy && !hasCrown;

    const g0 = ctx.createRadialGradient(
      w * 0.2 + Math.sin(t * 0.15) * 20,
      h * 0.35,
      0,
      w * 0.5,
      h * 0.55,
      Math.max(w, h) * 0.85
    );
    if (hasTrophy) {
      g0.addColorStop(0, "rgba(52, 42, 24, 0.52)");
      g0.addColorStop(0.35, "rgba(18, 14, 10, 0.94)");
      g0.addColorStop(1, "rgba(4, 3, 2, 1)");
    } else if (hasCrown) {
      g0.addColorStop(0, "rgba(38, 28, 58, 0.5)");
      g0.addColorStop(0.38, "rgba(12, 10, 22, 0.96)");
      g0.addColorStop(1, "rgba(3, 2, 8, 1)");
    } else {
      g0.addColorStop(0, "rgba(22, 42, 38, 0.46)");
      g0.addColorStop(0.4, "rgba(6, 18, 16, 0.96)");
      g0.addColorStop(1, "rgba(2, 6, 8, 1)");
    }
    ctx.fillStyle = g0;
    ctx.fillRect(0, 0, w, h);

    const nx = w * 0.75 + Math.cos(t * 0.11) * 30;
    const ny = h * 0.2 + Math.sin(t * 0.09) * 20;
    const g1 = ctx.createRadialGradient(nx, ny, 0, nx, ny, h * 0.55);
    if (hasTrophy) {
      g1.addColorStop(0, "rgba(255, 190, 70, 0.14)");
      g1.addColorStop(0.45, "rgba(180, 110, 30, 0.07)");
      g1.addColorStop(1, "transparent");
    } else if (hasCrown) {
      g1.addColorStop(0, "rgba(180, 100, 220, 0.14)");
      g1.addColorStop(0.5, "rgba(90, 40, 120, 0.08)");
      g1.addColorStop(1, "transparent");
    } else {
      g1.addColorStop(0, "rgba(80, 160, 120, 0.11)");
      g1.addColorStop(0.5, "rgba(30, 70, 55, 0.07)");
      g1.addColorStop(1, "transparent");
    }
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, w, h);

    const g2 = ctx.createRadialGradient(
      w * 0.1,
      h * 0.85,
      0,
      w * 0.25,
      h * 0.9,
      h * 0.45
    );
    if (hasTrophy) {
      g2.addColorStop(0, "rgba(160, 90, 30, 0.11)");
      g2.addColorStop(1, "transparent");
    } else if (hasCrown) {
      g2.addColorStop(0, "rgba(90, 40, 110, 0.11)");
      g2.addColorStop(1, "transparent");
    } else {
      g2.addColorStop(0, "rgba(0, 110, 75, 0.1)");
      g2.addColorStop(1, "transparent");
    }
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, w, h);

    if (pitchOnly) {
      const g3 = ctx.createRadialGradient(
        w * 0.5 + Math.sin(t * 0.08) * 40,
        h * 0.55,
        0,
        w * 0.5,
        h * 0.5,
        h * 0.4
      );
      g3.addColorStop(0, "rgba(60, 140, 95, 0.06)");
      g3.addColorStop(1, "transparent");
      ctx.fillStyle = g3;
      ctx.fillRect(0, 0, w, h);
    }
  }

  function drawWorldStars(t) {
    if (!world || !world.stars) return;
    const trophy = world.hubs && world.hubs.some((H) => H.isTopScorer);
    const crown = world.hubs && world.hubs.some((H) => H.isLeader);
    ctx.save();
    world.stars.forEach((st) => {
      const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 1.8 + st.ph));
      let sr = 230;
      let sg = 245;
      let sb = 255;
      if (trophy) {
        sr = 255;
        sg = 238;
        sb = 205;
      } else if (crown) {
        sr = 238;
        sg = 225;
        sb = 255;
      } else {
        sr = 198;
        sg = 228;
        sb = 212;
      }
      ctx.fillStyle = `rgba(${sr},${sg},${sb},${0.045 * tw * st.s})`;
      ctx.beginPath();
      ctx.arc(st.x, st.y, st.s, 0, TAU);
      ctx.fill();
    });
    ctx.restore();
  }

  function drawOrbitArc(H, t) {
    const gf = hubGoalsAuraFactor(H.hub.gols);
    const lead = H.isLeader ? 1.06 : 1;
    const scorer = H.isTopScorer ? 1.04 : 1;
    const pal = hubAuraPalette(!!H.isLeader, !!H.isTopScorer);
    const nRings = Math.max(1, Math.min(2, Math.round(1 + gf * 0.9)));
    const baseAlpha = (H.isTopScorer ? 0.065 : 0.042) * (0.5 + gf * 0.45);
    const arcRgb = pal.arc;
    ctx.save();
    ctx.lineWidth = 0.75 + gf * 0.45;
    for (let ring = 0; ring < nRings; ring++) {
      const phase = t * 0.9 + H.ang * 2 + ring * 0.7;
      const pulse =
        (H.r + 10 + ring * (6 + gf * 3.2)) * lead * scorer +
        Math.sin(phase) * (1.2 + gf * 1.6);
      const ringMix = ring * 0.22;
      const rr = arcRgb[0] * (1 - ringMix * 0.15) + 255 * (ringMix * 0.12);
      const gg = arcRgb[1] * (1 - ringMix * 0.12) + 230 * (ringMix * 0.08);
      const bb = arcRgb[2] * (1 - ringMix * 0.1) + 120 * (ringMix * 0.06);
      ctx.strokeStyle = `rgba(${rr | 0},${gg | 0},${bb | 0},${
        baseAlpha * (1 - ring * 0.25)
      })`;
      ctx.setLineDash([8 + ring * 2, 12 + ring]);
      ctx.lineDashOffset = -(t * (14 + ring * 3)) % 40;
      ctx.beginPath();
      ctx.arc(H.x, H.y, pulse, 0, TAU);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawLink(x0, y0, x1, y1, alpha, t) {
    const mx = (x0 + x1) / 2 + (y1 - y0) * 0.1;
    const my = (y0 + y1) / 2 - (x1 - x0) * 0.1;
    const trophy =
      world && world.hubs && world.hubs.some((H) => H && H.isTopScorer);
    const crown = world && world.hubs && world.hubs.some((H) => H && H.isLeader);
    let cr = 150;
    let cg = 210;
    let cb = 175;
    if (trophy) {
      cr = 215;
      cg = 195;
      cb = 130;
    } else if (crown) {
      cr = 195;
      cg = 165;
      cb = 235;
    }
    ctx.save();
    ctx.strokeStyle = `rgba(${cr},${cg},${cb},${alpha})`;
    ctx.lineWidth = 1.1;
    ctx.setLineDash([3, 6]);
    ctx.lineDashOffset = -(t * 22 + x0 * 0.05) % 24;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(mx, my, x1, y1);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawHubGlow(x, y, r, t, ang, isLeader, isTopScorer, hubGols, pal) {
    const gf = hubGoalsAuraFactor(hubGols);
    const breathe =
      1 +
      (0.018 + gf * 0.028 + (isLeader ? 0.035 : isTopScorer ? 0.028 : 0.018)) *
        Math.sin(t * 1.05 + ang * 2);
    const baseLayers = Math.round(2 + gf * 4);
    const layers = clamp(
      baseLayers + (isLeader ? 2 : isTopScorer ? 1 : 1),
      3,
      6
    );
    const baseA = (0.01 + gf * 0.028) * (isLeader ? 1.15 : isTopScorer ? 1.08 : 1);
    const stepGlow = 2.55 + gf * 2.05;
    const leaderStep = 3.05 + gf * 2.45;
    for (let i = layers; i >= 1; i--) {
      ctx.beginPath();
      ctx.arc(
        x,
        y,
        (r + i * (isLeader ? leaderStep : isTopScorer ? stepGlow + 0.4 : stepGlow)) *
          breathe,
        0,
        TAU
      );
      const u = i / Math.max(layers, 1);
      const rgb = lerpRgb(pal.ringHi, pal.ringLo, u);
      const ai = clamp(baseA + i * (0.006 + gf * 0.007), 0.012, 0.19);
      ctx.strokeStyle = rgbaStr(rgb, ai * (isLeader ? 1.05 : 1));
      ctx.lineWidth = (isLeader || isTopScorer ? 1.5 : 1.15) + gf * 0.55;
      ctx.stroke();
    }
  }

  function drawHub(H) {
    const { x, y, r, hub } = H;
    const leader = !!H.isLeader;
    const scorer = !!H.isTopScorer;
    const scale = leader ? 1.08 : scorer ? 1.04 : 1;
    const g = hub.gols;
    const a = hub.assistencias;
    const gPart = Number.isFinite(g) ? `${g} gol${g === 1 ? "" : "s"}` : "— gols";
    const gTxt =
      Number.isFinite(a) && a >= 0
        ? `${gPart} · ${a} assist.`
        : gPart;
    const paisTxt = hubPaisLineCanvas(hub);
    const hgf = hubGoalsAuraFactor(g);

    const nome = hub.atleta || "—";
    const nameFontPx = clamp(12 + r * 0.11, 12, leader ? 20 : scorer ? 18 : 17);
    ctx.font = `${leader || scorer ? 600 : 500} ${nameFontPx}px "Bebas Neue", Oswald, Impact, sans-serif`;
    const maxWName = Math.max(r * 2.75, 120) * scale;
    const nameLines = wrapLines(ctx, nome, maxWName);
    const nameLineH = Math.round(nameFontPx * 1.08);
    const nameBlockH = nameLines.length * nameLineH;
    const namePadBelow = 15;
    const gapAfterName = 8;
    const gapAfterGols = 7;
    const nameY0 = y + r * scale + namePadBelow;
    const golsY = nameY0 + nameBlockH + gapAfterName;
    const paisY = paisTxt ? golsY + 14 + gapAfterGols : null;
    const labelBottom = paisY != null ? paisY + 10 : golsY + 9;
    const labelBounds = {
      x1: x - maxWName / 2 - 8,
      x2: x + maxWName / 2 + 8,
      y1: nameY0 - 4,
      y2: labelBottom + 4,
    };

    const auraPal = hubAuraPalette(leader, scorer);

    drawHubGlow(x, y, r, simTime, H.ang, leader, scorer, g, auraPal);

    if (scorer) {
      const gf = hubGoalsAuraFactor(g);
      const pulse = 1 + 0.04 * Math.sin(simTime * 2.2 + H.ang);
      const ext = (r + 12 + gf * 12) * pulse;
      const rg = ctx.createRadialGradient(x, y, 0, x, y, ext);
      const a0 = 0.07 + gf * 0.09;
      const a1 = 0.028 + gf * 0.045;
      rg.addColorStop(0, rgbaStr(auraPal.inner0, a0));
      rg.addColorStop(0.45, rgbaStr(auraPal.inner1, a1));
      rg.addColorStop(1, "transparent");
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(x, y, ext, 0, TAU);
      ctx.fill();
    } else if (Number.isFinite(g) && g > 0) {
      const gf = hubGoalsAuraFactor(g);
      const pulse = 1 + 0.03 * Math.sin(simTime * 1.6 + H.ang);
      const ext = (r + 8 + gf * 10) * pulse;
      const rg = ctx.createRadialGradient(x, y, 0, x, y, ext);
      const c0 = lerpRgb(auraPal.inner0, [255, 255, 255], 0.38);
      const c1 = lerpRgb(auraPal.inner1, [255, 255, 255], 0.22);
      rg.addColorStop(0, rgbaStr(c0, 0.04 + gf * 0.06));
      rg.addColorStop(0.55, rgbaStr(c1, 0.02 + gf * 0.035));
      rg.addColorStop(1, "transparent");
      ctx.fillStyle = rg;
      ctx.beginPath();
      ctx.arc(x, y, ext, 0, TAU);
      ctx.fill();
    }

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.translate(-x, -y);

    if (leader || scorer) {
      ctx.beginPath();
      ctx.arc(x, y, r + (leader ? 4 : 3) + hgf * 2, 0, TAU);
      const pulseA =
        (0.22 + 0.1 * Math.sin(simTime * (leader ? 2.4 : 3.1))) *
        (0.72 + hgf * 0.28);
      const sh = lerpRgb(auraPal.strokeHi, auraPal.halo, 0.35);
      const sm = lerpRgb(auraPal.strokeMid, auraPal.ringLo, 0.25);
      const ringRgb = lerpRgb(sh, sm, 0.5 + 0.5 * Math.sin(simTime * 2.1));
      ctx.strokeStyle = rgbaStr(ringRgb, pulseA);
      ctx.lineWidth = (leader ? 2.4 : 1.9) + hgf * 1.4;
      ctx.stroke();
    }

    const pe = getHubPhotoState(H.photoUrl);
    const hasPhoto = !!(pe && pe.ready && !pe.err && pe.img);
    const photoR = r - 1.5;

    if (hasPhoto) {
      drawCircularPhotoCover(ctx, x, y, photoR, pe.img);
      const vig = ctx.createRadialGradient(
        x,
        y - r * 0.12,
        r * 0.18,
        x,
        y,
        r * 1.02
      );
      vig.addColorStop(0, rgbaStr(lerpRgb([255, 248, 220], auraPal.halo, 0.35), 0.2));
      vig.addColorStop(0.45, rgbaStr(lerpRgb([255, 200, 80], auraPal.strokeMid, 0.4), 0.09));
      vig.addColorStop(0.82, rgbaStr(lerpRgb([40, 12, 2], auraPal.ringLo, 0.4), 0.38));
      vig.addColorStop(1, rgbaStr(lerpRgb([8, 4, 0], auraPal.ringLo, 0.5), 0.58));
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fillStyle = vig;
      ctx.fill();
      const band = ctx.createLinearGradient(x, y + r * 0.02, x, y + r * 0.98);
      band.addColorStop(0, "rgba(0, 0, 0, 0)");
      band.addColorStop(0.4, "rgba(0, 0, 0, 0.22)");
      band.addColorStop(1, "rgba(0, 0, 0, 0.45)");
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fillStyle = band;
      ctx.fill();
      if (leader) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fillStyle = rgbaStr(lerpRgb([255, 215, 60], auraPal.halo, 0.45), 0.14);
        ctx.fill();
      } else if (scorer) {
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fillStyle = rgbaStr(lerpRgb([255, 140, 60], auraPal.inner1, 0.35), 0.12);
        ctx.fill();
      }
    } else {
      const grd = ctx.createRadialGradient(
        x - r * 0.35,
        y - r * 0.35,
        r * 0.08,
        x,
        y,
        r
      );
      if (leader) {
        grd.addColorStop(0, rgbaStr(lerpRgb([255, 254, 248], auraPal.ringHi, 0.22), 1));
        grd.addColorStop(0.28, rgbaStr(auraPal.ringHi, 1));
        grd.addColorStop(0.62, rgbaStr(lerpRgb(auraPal.strokeMid, auraPal.ringLo, 0.45), 1));
        grd.addColorStop(1, rgbaStr(auraPal.ringLo, 1));
      } else if (scorer) {
        grd.addColorStop(0, rgbaStr(lerpRgb([255, 245, 230], auraPal.inner0, 0.28), 1));
        grd.addColorStop(0.3, rgbaStr(auraPal.halo, 1));
        grd.addColorStop(0.65, rgbaStr(auraPal.inner1, 1));
        grd.addColorStop(1, rgbaStr(auraPal.ringLo, 1));
      } else {
        grd.addColorStop(0, rgbaStr(lerpRgb([255, 254, 245], auraPal.ringHi, 0.18), 1));
        grd.addColorStop(0.32, rgbaStr(auraPal.ringHi, 1));
        grd.addColorStop(0.68, rgbaStr(auraPal.strokeMid, 1));
        grd.addColorStop(1, rgbaStr(auraPal.ringLo, 1));
      }

      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fillStyle = grd;
      ctx.fill();
    }

    ctx.strokeStyle = leader
      ? rgbaStr(lerpRgb(auraPal.strokeHi, auraPal.strokeLo, 0.22), 0.52 + hgf * 0.32)
      : scorer
        ? rgbaStr(lerpRgb(auraPal.strokeHi, auraPal.strokeLo, 0.32), 0.45 + hgf * 0.28)
        : rgbaStr(lerpRgb(auraPal.strokeHi, auraPal.strokeLo, 0.48), 0.36 + hgf * 0.34);
    ctx.lineWidth = (leader ? 2.5 : scorer ? 2.2 : 2) + hgf * 1.8;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(x, y, r - 3, 0, TAU);
    ctx.strokeStyle = "rgba(0, 0, 0, 0.15)";
    ctx.lineWidth = 1;
    ctx.stroke();

    const pos =
      H.rankByGols != null &&
      Number.isFinite(H.rankByGols) &&
      H.rankByGols >= 1
        ? H.rankByGols
        : Number(hub.pos);
    if (Number.isFinite(pos) && pos >= 1 && pos <= 99) {
      const pr = leader ? 12 : scorer ? 12 : 11;
      ctx.save();
      if (hasPhoto) {
        ctx.shadowColor = "rgba(0,0,0,0.55)";
        ctx.shadowBlur = 6;
        ctx.shadowOffsetY = 1;
      }
      ctx.beginPath();
      ctx.arc(x + r * 0.62, y - r * 0.62, pr, 0, TAU);
      ctx.fillStyle = leader
        ? rgbaStr(lerpRgb([255, 210, 120], auraPal.halo, 0.4), 0.95)
        : scorer
          ? rgbaStr(lerpRgb([255, 185, 80], auraPal.inner0, 0.35), 0.95)
          : "rgba(8, 14, 24, 0.94)";
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.strokeStyle = leader
        ? rgbaStr(lerpRgb([130, 70, 30], auraPal.ringLo, 0.35), 0.52)
        : scorer
          ? rgbaStr(lerpRgb([140, 55, 20], auraPal.ringLo, 0.4), 0.55)
          : "rgba(255, 210, 100, 0.55)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.font = `700 ${leader || scorer ? 11 : 10}px Outfit, system-ui, sans-serif`;
      ctx.fillStyle = leader ? "#1a0d00" : scorer ? "#2a0a00" : "#ffe9a8";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const posStr = scorer ? `🏆${pos}` : String(pos);
      ctx.fillText(posStr, x + r * 0.62, y - r * 0.62);
      ctx.restore();
    }

    ctx.restore();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.letterSpacing = leader || scorer ? "0.05em" : "0.02em";
    ctx.font = `${leader || scorer ? 600 : 500} ${nameFontPx}px "Bebas Neue", Oswald, Impact, sans-serif`;
    nameLines.forEach((ln, i) => {
      const ty = nameY0 + i * nameLineH + nameLineH / 2;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.55)";
      ctx.strokeText(ln, x, ty);
      ctx.fillStyle = "#fffef5";
      ctx.fillText(ln, x, ty);
    });
    ctx.letterSpacing = "0";

    ctx.font = '600 10px Outfit, system-ui, sans-serif';
    ctx.lineWidth = 2;
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.strokeText(gTxt, x, golsY);
    ctx.fillStyle = "#ffe082";
    ctx.fillText(gTxt, x, golsY);

    if (paisTxt && paisY != null) {
      ctx.font = `600 ${leader ? 9 : 8}px Outfit, system-ui, sans-serif`;
      const pShow = truncate(ctx, paisTxt, maxWName);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.strokeText(pShow, x, paisY);
      ctx.fillStyle = "rgba(255, 248, 230, 0.95)";
      ctx.fillText(pShow, x, paisY);
    }

    const hitR = r * scale + (leader ? 11 : scorer ? 9 : 8);
    hits.push({
      type: "hub",
      layoutHub: H,
      x,
      y,
      r: hitR,
      hub,
      isLeader: leader,
      isTopScorer: scorer,
      labelBounds,
    });
  }

  function wrapLines(context, text, maxWidth) {
    const words = String(text).split(/\s+/);
    const lines = [];
    let line = "";
    words.forEach((word) => {
      const test = line ? `${line} ${word}` : word;
      if (context.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = test;
    });
    if (line) lines.push(line);
    return lines.length ? lines : ["—"];
  }

  function drawSatellite(sat, linkTo, speed) {
    const { sx, sy, r, pick, rel, meta } = sat;
    const top = !!sat.isTopAffinity;
    const hot = !!sat.isHot && !top;
    const warm = !!sat.isWarm && !hot && !top;
    const rd = top ? r * 1.12 : r;
    const emoPal = emojiAuraPalette(meta.avatar, meta.cor);
    const relT = rel / 100;
    const fillMid = lerpRgb(
      emoPal.fillHi,
      emoPal.fillLo,
      0.32 + relT * 0.38
    );
    const fill = rgbCss(fillMid);
    const strokeRgb = lerpRgb(emoPal.stroke, emoPal.ringHi, top ? 0.12 : 0.05);
    const sp = clamp(speed / 80, 0, 1);
    const gfS = satGoalsAuraFactor(pick.gols);
    const ringBoost = 0.72 + gfS * 0.55;
    const bob =
      (top ? 1.05 : hot ? 1.03 : 1) +
      0.04 * sp +
      0.015 * Math.sin(simTime * 2.2 + sat._phase) +
      gfS * 0.04;

    if (linkTo)
      drawLink(
        linkTo.x,
        linkTo.y,
        sx,
        sy,
        (top ? 0.12 : 0.05) + (rel / 100) * 0.11,
        simTime
      );

    if (!top && !hot && !warm) {
      const nr = Math.min(3, Math.max(0, Math.floor(gfS * 5.2)));
      for (let k = 0; k < nr; k++) {
        ctx.beginPath();
        ctx.arc(sx, sy, rd + 4 + k * (3.5 + gfS * 2), 0, TAU);
        const mix = lerpRgb(
          emoPal.ringHi,
          emoPal.ringLo,
          nr <= 1 ? 0.5 : k / Math.max(nr - 1, 1)
        );
        ctx.strokeStyle = rgbaArr(
          mix,
          0.06 + gfS * 0.1 - k * (0.018 + gfS * 0.012)
        );
        ctx.lineWidth = 0.9 + gfS * 0.7;
        ctx.stroke();
      }
    }

    if (top) {
      const rings = Math.min(4, 3 + Math.floor(gfS * 2));
      for (let k = 0; k < rings; k++) {
        ctx.beginPath();
        ctx.arc(
          sx,
          sy,
          rd + 6 + k * (5 + gfS * 4) + Math.sin(simTime * 2.8 + sat._phase) * 2,
          0,
          TAU
        );
        const mix = lerpRgb(
          emoPal.ringHi,
          emoPal.ringLo,
          rings <= 1 ? 0.35 : k / Math.max(rings - 1, 1)
        );
        ctx.strokeStyle = rgbaArr(mix, (0.3 - k * 0.075) * ringBoost);
        ctx.lineWidth = 2.2 + gfS * 1.2;
        ctx.stroke();
      }
    } else if (hot) {
      ctx.beginPath();
      ctx.arc(
        sx,
        sy,
        rd + 8 + gfS * 6 + Math.sin(simTime * 2.4 + sat._phase) * 1.5,
        0,
        TAU
      );
      const hx = lerpRgb(emoPal.ringHi, [95, 255, 165], 0.42);
      ctx.strokeStyle = rgbaArr(
        hx,
        (0.2 + 0.08 * Math.sin(simTime * 3)) * ringBoost
      );
      ctx.lineWidth = 1.6 + gfS * 1.4;
      ctx.stroke();
    } else if (warm) {
      ctx.beginPath();
      ctx.arc(sx, sy, rd + 5 + gfS * 4, 0, TAU);
      const wx = lerpRgb(emoPal.ringHi, [145, 205, 255], 0.38);
      ctx.strokeStyle = rgbaArr(wx, 0.15 * ringBoost);
      ctx.lineWidth = 1.1 + gfS * 0.8;
      ctx.stroke();
    }

    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(bob, bob);
    ctx.translate(-sx, -sy);

    ctx.shadowColor = rgbaArr(emoPal.stroke, top ? 0.42 : 0.35);
    ctx.shadowBlur = (top ? 16 : 9 + gfS * 14) + sp * 2;
    ctx.shadowOffsetY = 3;
    ctx.beginPath();
    ctx.arc(sx, sy, rd, 0, TAU);
    const satGrd = ctx.createRadialGradient(
      sx - rd * 0.35,
      sy - rd * 0.35,
      0,
      sx,
      sy,
      rd
    );
    const hi = lightenColor(
      rgbCss(lerpRgb(emoPal.fillHi, [255, 255, 255], 0.1 + relT * 0.14)),
      0.2
    );
    const lo = rgbCss(
      lerpRgb(emoPal.fillLo, emoPal.stroke, 0.06 + relT * 0.1)
    );
    satGrd.addColorStop(0, hi);
    satGrd.addColorStop(1, lo);
    ctx.fillStyle = satGrd;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    ctx.strokeStyle = rgbCss(strokeRgb);
    ctx.lineWidth =
      (top ? 3.2 : 1.4) + (rel / 100) * 2.2 + sp * 1.2 + gfS * 1.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(sx, sy, rd - 3, 0, TAU);
    ctx.strokeStyle = rgbaArr(lerpRgb([255, 255, 255], emoPal.ringHi, 0.55), 0.16);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();

    const av = meta.avatar || "⚽";
    ctx.save();
    ctx.globalAlpha = SATELLITE_EMOJI_OPACITY;
    ctx.font = `${rd * 1.05}px system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(av, sx, sy + 1);
    ctx.restore();

    if (top) {
      const cr = clamp(rd * 0.42, 11, 17);
      const cbx = sx + rd * 0.55;
      const cby = sy - rd * 0.55;
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.45)";
      ctx.shadowBlur = 5;
      ctx.shadowOffsetY = 1;
      ctx.beginPath();
      ctx.arc(cbx, cby, cr, 0, TAU);
      ctx.fillStyle = rgbaArr(lerpRgb(emoPal.fillLo, [10, 12, 18], 0.55), 0.94);
      ctx.fill();
      ctx.strokeStyle = rgbaArr(
        lerpRgb(emoPal.ringHi, [255, 215, 100], 0.28),
        0.78
      );
      ctx.lineWidth = 1.25;
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.font = `${cr * 1.12}px system-ui, "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.globalAlpha = SATELLITE_EMOJI_OPACITY;
      ctx.fillText("👑", cbx, cby + 0.5);
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    const nome = String(meta.nome || "").trim() || "—";
    const g = pick.gols;
    const gStr = Number.isFinite(g)
      ? `${g} gol${g === 1 ? "" : "s"}`
      : "— gols";
    ctx.font = "600 10px Outfit, system-ui, sans-serif";
    const lineA = truncate(ctx, nome, cssW * 0.16);
    ctx.font = "500 9px Outfit, system-ui, sans-serif";
    const lineB = truncate(ctx, gStr, cssW * 0.18);

    const padX = 10;
    ctx.font = "600 10px Outfit, system-ui, sans-serif";
    const wA = ctx.measureText(lineA).width;
    ctx.font = "500 9px Outfit, system-ui, sans-serif";
    const wB = ctx.measureText(lineB).width;
    const tw = Math.max(wA, wB);
    const bw = clamp(tw + padX * 2, 72, cssW * 0.42);
    const bh = top ? 38 : 34;
    const bx = sx - bw / 2;
    const by = sy + rd + 11;

    ctx.save();
    roundRect(ctx, bx, by, bw, bh, 9);
    ctx.fillStyle = top
      ? rgbaArr(lerpRgb(emoPal.fillLo, [8, 10, 16], 0.52), 0.94)
      : rgbaArr(lerpRgb(emoPal.fillLo, [5, 10, 18], 0.58), 0.9);
    ctx.fill();
    ctx.strokeStyle = top
      ? rgbaArr(
          lerpRgb(emoPal.ringHi, [255, 210, 115], 0.22),
          0.42 + 0.22 * Math.sin(simTime * 2.5)
        )
      : rgbaArr(emoPal.ringHi, 0.14 + relT * 0.32);
    ctx.lineWidth = top ? 2 : 1;
    ctx.stroke();

    if (top) {
      ctx.font = "700 7px Outfit, system-ui, sans-serif";
      ctx.fillStyle = rgbaArr(
        lerpRgb(emoPal.ringHi, [255, 224, 130], 0.35),
        0.95
      );
      ctx.fillText("👑 MAIOR AFINIDADE", sx, by + 8);
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "600 10px Outfit, system-ui, sans-serif";
    ctx.fillStyle = rgbaArr(lerpRgb([248, 252, 255], emoPal.ringHi, 0.12), 0.96);
    ctx.fillText(lineA, sx, by + (top ? 19 : 11));
    ctx.font = "500 9px Outfit, system-ui, sans-serif";
    ctx.fillStyle = rgbaArr(lerpRgb([175, 195, 210], emoPal.ringHi, 0.25), 0.9);
    ctx.fillText(lineB, sx, by + (top ? 31 : 24));
    ctx.restore();

    const hitPad = 4;
    hits.push({
      type: "sat",
      sat,
      bounds: {
        x1: bx - hitPad,
        y1: sy - rd - hitPad,
        x2: bx + bw + hitPad,
        y2: by + bh + hitPad,
      },
    });
  }

  function lightenColor(rgbStr, amt) {
    const m = rgbStr.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (!m) return rgbStr;
    const r = clamp(+m[1] + 255 * amt, 0, 255);
    const g = clamp(+m[2] + 255 * amt, 0, 255);
    const b = clamp(+m[3] + 255 * amt, 0, 255);
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  }

  function truncate(context, text, maxW) {
    const s = String(text);
    if (!s) return "";
    if (context.measureText(s).width <= maxW) return s;
    let lo = 0;
    let hi = s.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      const t = s.slice(0, mid) + "…";
      if (context.measureText(t).width <= maxW) lo = mid;
      else hi = mid - 1;
    }
    return s.slice(0, lo) + (lo < s.length ? "…" : "");
  }

  function drawEmptyState(cx, cy) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "600 14px Outfit, system-ui, sans-serif";
    ctx.fillStyle = "rgba(230, 238, 248, 0.92)";
    ctx.fillText("Ranking oficial ainda não publicado", cx, cy - 8);
    ctx.font = "400 12px Outfit, system-ui, sans-serif";
    ctx.fillStyle = "rgba(150, 175, 195, 0.88)";
    ctx.fillText("Preencha a aba «Resultados Artilheiros» na planilha", cx, cy + 14);
    ctx.font = "500 11px Outfit, system-ui, sans-serif";
    ctx.fillStyle = "rgba(180, 210, 255, 0.28)";
    ctx.fillText("Os palpites ganham vida ao centro", cx, cy + 36);
    ctx.restore();
  }

  function gatherParticles() {
    const list = [];
    if (!world) return list;
    world.unmatched.forEach((sat) => list.push({ sat, hub: null }));
    world.hubs.forEach((H) => {
      H.satellites.forEach((sat) => list.push({ sat, hub: H }));
    });
    return list;
  }

  /** Afasta palpites da faixa de texto (nome, golos, país) por baixo da bolha oficial. */
  function hubLabelRepelForce(sat, H) {
    const sc = H._lblScale != null ? H._lblScale : 1;
    const padB = H._labelPadBelow != null ? H._labelPadBelow : 15;
    const depth = H._labelDepth != null ? H._labelDepth : 92;
    const hw = H._labelHalfW != null ? H._labelHalfW : 130;
    const top = H.y + H.r * sc + padB - 10;
    const bot = top + depth;
    const l = H.x - hw;
    const rgt = H.x + hw;
    const sr = (sat.r || 15) * 0.95 + 12;
    const pad = 18 + sr * 0.72;
    const li = l - pad;
    const ri = rgt + pad;
    const ti = top - pad;
    const bi = bot + pad;
    const sx = sat.sx;
    const sy = sat.sy;
    if (sx < li || sx > ri || sy < ti || sy > bi) {
      return { fx: 0, fy: 0 };
    }
    const dl = sx - li;
    const dr = ri - sx;
    const dt = sy - ti;
    const db = bi - sy;
    const m = Math.min(dl, dr, dt, db);
    const k = 1180;
    const t = clamp((22 - m) / 22, 0, 1);
    if (t <= 0) return { fx: 0, fy: 0 };
    const fmag = k * t * t;
    if (m === dl) return { fx: -fmag, fy: 0 };
    if (m === dr) return { fx: fmag, fy: 0 };
    if (m === dt) return { fx: 0, fy: -fmag };
    return { fx: 0, fy: fmag };
  }

  function stepPhysics(dt) {
    if (!world) return;

    const kSpring = 16;
    const kWhisper = 8;
    const damping = Math.pow(0.985, dt * 60);
    const repelSat = 2920;
    const repelHub = 1580;
    const pointerR = 100;
    const pointerPush = 200;
    const margin = 8;

    const particles = gatherParticles();

    particles.forEach(({ sat, hub }) => {
      if (bubbleDrag && bubbleDrag.kind === "sat" && bubbleDrag.sat === sat) {
        sat.vx = 0;
        sat.vy = 0;
        return;
      }

      const ax0 =
        sat.tx + 5 * Math.sin(simTime * 1.12 + sat._phase);
      const ay0 =
        sat.ty + 5 * Math.cos(simTime * 1.02 + sat._phase * 1.1);
      let ax = kSpring * (ax0 - sat.sx);
      let ay = kSpring * (ay0 - sat.sy);

      if (hub) {
        const dx0 = sat.sx - hub.x;
        const dy0 = sat.sy - hub.y;
        const d0 = Math.hypot(dx0, dy0) || 1;
        ax += (-dy0 / d0) * kWhisper * Math.sin(simTime * 1.35 + sat._phase);
        ay += (dx0 / d0) * kWhisper * Math.sin(simTime * 1.35 + sat._phase);
      }

      if (pointer.active) {
        const mdx = sat.sx - pointer.x;
        const mdy = sat.sy - pointer.y;
        const md = Math.hypot(mdx, mdy);
        if (md < pointerR && md > 0.001) {
          const u = 1 - md / pointerR;
          const f = (pointerPush * u * u) / md;
          ax += mdx * f;
          ay += mdy * f;
        }
      }

      world.hubs.forEach((H) => {
        const dx = sat.sx - H.x;
        const dy = sat.sy - H.y;
        const d = Math.hypot(dx, dy) || 0.001;
        const need = (H.rPhys || H.r) + (sat._repelR || sat.r + 52) + 54;
        if (d < need) {
          const push = ((need - d) / need) * repelHub;
          ax += (dx / d) * push;
          ay += (dy / d) * push;
        }
      });

      particles.forEach((other) => {
        if (other.sat === sat) return;
        const o = other.sat;
        const dx = sat.sx - o.sx;
        const dy = sat.sy - o.sy;
        const d = Math.hypot(dx, dy) || 0.001;
        const ra = sat._repelR || sat.r + 52;
        const rb = o._repelR || o.r + 52;
        const minSep = ra + rb + 52;
        if (d < minSep) {
          const f = ((minSep - d) / minSep) * repelSat;
          ax += (dx / d) * f;
          ay += (dy / d) * f;
        }
      });

      world.hubs.forEach((H) => {
        const f = hubLabelRepelForce(sat, H);
        ax += f.fx;
        ay += f.fy;
      });

      sat.vx = (sat.vx + ax * dt) * damping;
      sat.vy = (sat.vy + ay * dt) * damping;
      sat.sx += sat.vx * dt;
      sat.sy += sat.vy * dt;

      if (sat.sx < margin) {
        sat.sx = margin;
        sat.vx *= -0.35;
      }
      if (sat.sx > cssW - margin) {
        sat.sx = cssW - margin;
        sat.vx *= -0.35;
      }
      if (sat.sy < margin) {
        sat.sy = margin;
        sat.vy *= -0.35;
      }
      if (sat.sy > cssH - margin) {
        sat.sy = cssH - margin;
        sat.vy *= -0.35;
      }

      sat._speed = Math.hypot(sat.vx, sat.vy);
    });
  }

  function drawScene() {
    if (!ctx || !canvas) return;
    if (!world) rebuildWorld();

    hits.length = 0;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    drawBackground(cssW, cssH, simTime, world.hubs);

    ctx.save();
    applyCamera(ctx);
    drawWorldStars(simTime);

    const { hubs, unmatched, cx, cy } = world;

    hubs.forEach((H) => drawOrbitArc(H, simTime));

    unmatched.forEach((sat) =>
      drawSatellite(sat, null, sat._speed || 0)
    );

    if (!hubs.length) {
      drawEmptyState(cx, cy);
    }

    hubs.forEach((H) => {
      H.satellites.forEach((sat) =>
        drawSatellite(sat, H, sat._speed || 0)
      );
    });

    hubs.forEach((H) => drawHub(H));
    ctx.restore();
  }

  function tickFrame(t) {
    rafId = requestAnimationFrame(tickFrame);
    const dt = clamp((t - lastTick) / 1000, 0.001, 0.05);
    lastTick = t;
    lastStepDt = dt;
    if (world) {
      simTime += dt;
      updateFloatingHubs(cssW, cssH, simTime);
      if (ioVisible) {
        stepPhysics(dt);
      }
      drawScene();
    }
  }

  function startAnimationLoop() {
    if (rafId != null) return;
    lastTick = performance.now();
    rafId = requestAnimationFrame(tickFrame);
  }

  function stopAnimationLoop() {
    if (rafId != null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function canvasCssPoint(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * cssW;
    const my = ((e.clientY - rect.top) / rect.height) * cssH;
    return screenToWorld(mx, my);
  }

  function canvasScreenPoint(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      mx: ((e.clientX - rect.left) / rect.width) * cssW,
      my: ((e.clientY - rect.top) / rect.height) * cssH,
    };
  }

  function pointInRect(mx, my, b) {
    return mx >= b.x1 && mx <= b.x2 && my >= b.y1 && my <= b.y2;
  }

  function findHit(mx, my) {
    for (let i = hits.length - 1; i >= 0; i--) {
      const h = hits[i];
      if (h.type === "sat" && h.sat) {
        const s = h.sat;
        const top = !!s.isTopAffinity;
        const rd = top ? s.r * 1.12 : s.r;
        const dx = mx - s.sx;
        const dy = my - s.sy;
        const inBubble = dx * dx + dy * dy <= (rd + 10) * (rd + 10);
        if (inBubble || (h.bounds && pointInRect(mx, my, h.bounds))) {
          return h;
        }
        continue;
      }
      if (h.type === "hub" && h.labelBounds) {
        if (pointInRect(mx, my, h.labelBounds)) return h;
      }
      const dx = mx - h.x;
      const dy = my - h.y;
      if (dx * dx + dy * dy <= h.r * h.r) return h;
    }
    return null;
  }

  function onPointerDown(e) {
    if (e.button !== 0) return;
    const { mx, my } = canvasScreenPoint(e);
    const w = screenToWorld(mx, my);
    const hit = findHit(w.x, w.y);
    if (hit && hit.type === "sat") {
      bubbleDrag = {
        kind: "sat",
        sat: hit.sat,
        ox: w.x - hit.sat.sx,
        oy: w.y - hit.sat.sy,
      };
      isPanning = false;
      tooltip.hidden = true;
      canvas.style.cursor = "grabbing";
      startBubbleDragWindowListen();
      return;
    }
    if (hit && hit.type === "hub" && hit.layoutHub) {
      const H = hit.layoutHub;
      H._userDragging = true;
      bubbleDrag = {
        kind: "hub",
        H,
        ox: w.x - H.x,
        oy: w.y - H.y,
      };
      isPanning = false;
      tooltip.hidden = true;
      canvas.style.cursor = "grabbing";
      startBubbleDragWindowListen();
      return;
    }
    if (!hit) {
      isPanning = true;
      lastScreenMx = mx;
      lastScreenMy = my;
      canvas.style.cursor = "grabbing";
    }
  }

  function onWheel(e) {
    e.preventDefault();
    const { mx, my } = canvasScreenPoint(e);
    const wx = (mx - cssW / 2) / viewZoom + camX;
    const wy = (my - cssH / 2) / viewZoom + camY;
    const factor = e.deltaY < 0 ? 1.11 : 0.9;
    viewZoom = clamp(viewZoom * factor, 0.26, 3.2);
    camX = wx - (mx - cssW / 2) / viewZoom;
    camY = wy - (my - cssH / 2) / viewZoom;
  }

  function onPointerUpWindow() {
    stopBubbleDragWindowListen();
    isPanning = false;
    if (bubbleDrag && bubbleDrag.kind === "hub" && bubbleDrag.H) {
      bubbleDrag.H._userDragging = false;
    }
    bubbleDrag = null;
    if (canvas) canvas.style.cursor = "grab";
  }

  function onPointerMove(e) {
    const { mx, my } = canvasScreenPoint(e);

    if (isPanning) {
      const w0 = screenToWorld(lastScreenMx, lastScreenMy);
      const w1 = screenToWorld(mx, my);
      camX += w0.x - w1.x;
      camY += w0.y - w1.y;
      lastScreenMx = mx;
      lastScreenMy = my;
      const wCur = screenToWorld(mx, my);
      pointer.x = wCur.x;
      pointer.y = wCur.y;
      pointer.active = true;
      tooltip.hidden = true;
      canvas.style.cursor = "grabbing";
      return;
    }

    const { x, y } = screenToWorld(mx, my);

    if (bubbleDrag) {
      const margin = 10;
      if (bubbleDrag.kind === "sat") {
        const sat = bubbleDrag.sat;
        sat.sx = clamp(x - bubbleDrag.ox, margin, cssW - margin);
        sat.sy = clamp(y - bubbleDrag.oy, margin, cssH - margin);
        sat.tx = sat.sx;
        sat.ty = sat.sy;
        sat.vx = 0;
        sat.vy = 0;
      } else if (bubbleDrag.kind === "hub") {
        const H = bubbleDrag.H;
        const nx = clamp(x - bubbleDrag.ox, H.r + margin, cssW - H.r - margin);
        const ny = clamp(y - bubbleDrag.oy, H.r + margin, cssH - H.r - margin);
        const dx = nx - H.x;
        const dy = ny - H.y;
        H.anchorX += dx;
        H.anchorY += dy;
        H.x = nx;
        H.y = ny;
        H.satellites.forEach((s) => {
          s.sx += dx;
          s.sy += dy;
          s.tx += dx;
          s.ty += dy;
        });
      }
      pointer.x = x;
      pointer.y = y;
      pointer.active = true;
      tooltip.hidden = true;
      canvas.style.cursor = "grabbing";
      return;
    }

    pointer.x = x;
    pointer.y = y;
    pointer.active = true;

    const hit = findHit(x, y);
    if (!hit) {
      tooltip.hidden = true;
      canvas.style.cursor = "grab";
      return;
    }
    canvas.style.cursor = "pointer";
    tooltip.hidden = false;
    if (hit.type === "hub") {
      const h = hit.hub;
      const rg = hit.layoutHub && hit.layoutHub.rankByGols;
      const posLabel =
        rg != null && Number.isFinite(rg) && rg >= 1
          ? `${escapeHtml(String(rg))}º`
          : h.pos != null && String(h.pos).trim() !== ""
            ? `${escapeHtml(String(h.pos))}º`
            : "—";
      const paisHtmlInner = hubPaisLineTooltipHtml(h);
      const paisHtml = paisHtmlInner
        ? `<br><span class="arti-tip-pais arti-tip-pais--with-flag">${paisHtmlInner}</span>`
        : "";
      const leaderHtml = hit.isLeader
        ? `<br><span class="arti-tip-leader">1º por golos (classificação)</span>`
        : "";
      const scorerHtml = hit.isTopScorer
        ? `<br><span class="arti-tip-scorer">🏆 Artilheiro com mais golos na tabela</span>`
        : "";
      const ast = h.assistencias;
      const astHtml =
        Number.isFinite(ast) && ast >= 0
          ? `<br><span class="arti-tip-assists">${escapeHtml(String(ast))} assistência${ast === 1 ? "" : "s"}</span>`
          : "";
      tooltip.innerHTML = `<span class="arti-tip-badge">Oficial</span> <strong>${posLabel}</strong><br><span class="arti-tip-name">${escapeHtml(
        h.atleta || "—"
      )}</span><br><span class="arti-tip-gols">${
        Number.isFinite(h.gols)
          ? escapeHtml(String(h.gols)) + " gols"
          : "Gols a definir"
      }</span>${astHtml}${paisHtml}${leaderHtml}${scorerHtml}`;
    } else {
      const { pick, rel, meta } = hit.sat;
      const g = pick.gols;
      const topBadge = hit.sat.isTopAffinity
        ? `<div class="arti-tip-affinity">👑 Maior afinidade com o 1º por golos</div>`
        : "";
      const hotBadge =
        hit.sat.isHot && !hit.sat.isTopAffinity
          ? `<div class="arti-tip-hot">Palpite muito próximo</div>`
          : "";
      tooltip.innerHTML = `${topBadge}${hotBadge}<div class="arti-tip-head"><span class="arti-tip-av">${escapeHtml(
        meta.avatar || ""
      )}</span><div><strong>${escapeHtml(meta.nome)}</strong><br><span class="arti-tip-sub">Palpite</span></div></div><div class="arti-tip-pick">${escapeHtml(
        pick.artilheiro || "—"
      )}</div><div class="arti-tip-meta">${
        Number.isFinite(g) ? escapeHtml(String(g)) + " gols" : "Gols não informados"
      } · <span class="arti-tip-rel">Afinidade ${rel}%</span></div>`;
    }
    const wrapRect = wrap.getBoundingClientRect();
    let left = e.clientX - wrapRect.left + 14;
    let top = e.clientY - wrapRect.top + 14;
    if (left + 240 > wrapRect.width) left -= 250;
    if (top + 130 > wrapRect.height) top -= 135;
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  }

  function onLeave() {
    stopBubbleDragWindowListen();
    isPanning = false;
    if (bubbleDrag && bubbleDrag.kind === "hub" && bubbleDrag.H) {
      bubbleDrag.H._userDragging = false;
    }
    bubbleDrag = null;
    pointer.active = false;
    tooltip.hidden = true;
    canvas.style.cursor = "grab";
  }

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  function resize() {
    if (!canvas || !wrap) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = wrap.getBoundingClientRect();
    cssW = Math.max(300, Math.floor(rect.width));
    const vh =
      typeof window !== "undefined" && window.innerHeight > 0
        ? window.innerHeight
        : 820;
    /* Área jogável: equilíbrio entre largura do painel e altura do ecrã. */
    const hFromWidth = rect.width * 0.48;
    const hFromViewport = vh * 0.34;
    cssH = Math.max(
      300,
      Math.min(560, Math.floor(Math.max(hFromWidth, hFromViewport)))
    );
    wrap.style.height = `${cssH}px`;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;
    rebuildWorld();
    drawScene();
  }

  function render() {
    wrap = document.getElementById("arti-bubble-wrap");
    canvas = document.getElementById("arti-bubble-canvas");
    tooltip = document.getElementById("arti-bubble-tooltip");
    if (!wrap || !canvas || !tooltip) return;
    ctx = canvas.getContext("2d");
    canvas.style.cursor = "grab";

    if (handleMove) {
      canvas.removeEventListener("mousemove", handleMove);
      canvas.removeEventListener("mouseleave", onLeave);
      canvas.removeEventListener("click", handleClick);
    }
    if (handleWheel) {
      canvas.removeEventListener("wheel", handleWheel);
    }
    if (handleDown) {
      canvas.removeEventListener("mousedown", handleDown);
    }
    window.removeEventListener("mouseup", onPointerUpWindow);

    handleMove = onPointerMove;
    handleWheel = onWheel;
    handleDown = onPointerDown;
    handleClick = (e) => {
      const p = canvasCssPoint(e);
      if (findHit(p.x, p.y) && typeof BolaoSounds !== "undefined")
        BolaoSounds.playSubTab();
    };
    canvas.addEventListener("mousemove", handleMove);
    canvas.addEventListener("mouseleave", onLeave);
    canvas.addEventListener("click", handleClick);
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("mousedown", handleDown);
    window.addEventListener("mouseup", onPointerUpWindow);

    if (ioObserver) ioObserver.disconnect();
    ioObserver = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        ioVisible = !!(e && e.isIntersecting && e.intersectionRatio > 0.02);
        if (ioVisible) startAnimationLoop();
        else {
          stopAnimationLoop();
          drawScene();
        }
      },
      { threshold: [0, 0.02, 0.1] }
    );
    ioObserver.observe(wrap);

    if (ro) ro.disconnect();
    ro = new ResizeObserver(() => resize());
    ro.observe(wrap);

    resize();
    startAnimationLoop();
  }

  function destroy() {
    stopAnimationLoop();
    if (ioObserver) {
      ioObserver.disconnect();
      ioObserver = null;
    }
    if (ro) {
      ro.disconnect();
      ro = null;
    }
    if (canvas && handleMove) {
      canvas.removeEventListener("mousemove", handleMove);
      canvas.removeEventListener("mouseleave", onLeave);
      canvas.removeEventListener("click", handleClick);
    }
    if (canvas && handleWheel) {
      canvas.removeEventListener("wheel", handleWheel);
    }
    if (canvas && handleDown) {
      canvas.removeEventListener("mousedown", handleDown);
    }
    window.removeEventListener("mouseup", onPointerUpWindow);
    stopBubbleDragWindowListen();
    handleMove = null;
    handleClick = null;
    handleWheel = null;
    handleDown = null;
    world = null;
    pointer.active = false;
  }

  window.ArtiBubbles = { render, destroy, resize };
})();
