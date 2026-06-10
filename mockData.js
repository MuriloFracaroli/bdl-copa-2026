/**
 * Bolão Copa 2026 — configuração estática (bandeiras, jogadores).
 * Palpites e resultados vêm somente da planilha Google Sheets.
 * Cada jogador: id = chave interna (parseJogador); nome = rótulo só para exibição.
 */

const PAISES_INFO = {
  MEXICO: { nome: "México", codigo: "mx" },
  "AFRICA DO SUL": { nome: "África do Sul", codigo: "za" },
  "COREIA DO SUL": { nome: "Coreia do Sul", codigo: "kr" },
  "REPUBLICA TCHECA": { nome: "Rep. Tcheca", codigo: "cz" },
  CANADA: { nome: "Canadá", codigo: "ca" },
  BOSNIA: { nome: "Bósnia", codigo: "ba" },
  CATAR: { nome: "Catar", codigo: "qa" },
  SUICA: { nome: "Suíça", codigo: "ch" },
  BRASIL: { nome: "Brasil", codigo: "br" },
  MARROCOS: { nome: "Marrocos", codigo: "ma" },
  HAITI: { nome: "Haiti", codigo: "ht" },
  ESCOCIA: { nome: "Escócia", codigo: "gb-sct" },
  "ESTADOS UNIDOS": { nome: "Estados Unidos", codigo: "us" },
  PARAGUAI: { nome: "Paraguai", codigo: "py" },
  AUSTRALIA: { nome: "Austrália", codigo: "au" },
  TURQUIA: { nome: "Turquia", codigo: "tr" },
  ALEMANHA: { nome: "Alemanha", codigo: "de" },
  CURACAO: { nome: "Curaçao", codigo: "cw" },
  "COSTA DO MARFIM": { nome: "Costa do Marfim", codigo: "ci" },
  EQUADOR: { nome: "Equador", codigo: "ec" },
  HOLANDA: { nome: "Holanda", codigo: "nl" },
  JAPAO: { nome: "Japão", codigo: "jp" },
  SUECIA: { nome: "Suécia", codigo: "se" },
  TUNISIA: { nome: "Tunísia", codigo: "tn" },
  BELGICA: { nome: "Bélgica", codigo: "be" },
  EGITO: { nome: "Egito", codigo: "eg" },
  IRA: { nome: "Irã", codigo: "ir" },
  "NOVA ZELANDIA": { nome: "Nova Zelândia", codigo: "nz" },
  ESPANHA: { nome: "Espanha", codigo: "es" },
  "CABO VERDE": { nome: "Cabo Verde", codigo: "cv" },
  "ARABIA SAUDITA": { nome: "Arábia Saudita", codigo: "sa" },
  URUGUAI: { nome: "Uruguai", codigo: "uy" },
  FRANCA: { nome: "França", codigo: "fr" },
  SENEGAL: { nome: "Senegal", codigo: "sn" },
  IRAQUE: { nome: "Iraque", codigo: "iq" },
  NORUEGA: { nome: "Noruega", codigo: "no" },
  ARGENTINA: { nome: "Argentina", codigo: "ar" },
  ARGELIA: { nome: "Argélia", codigo: "dz" },
  AUSTRIA: { nome: "Áustria", codigo: "at" },
  JORDANIA: { nome: "Jordânia", codigo: "jo" },
  PORTUGAL: { nome: "Portugal", codigo: "pt" },
  "RD CONGO": { nome: "RD Congo", codigo: "cd" },
  UZBEQUISTAO: { nome: "Uzbequistão", codigo: "uz" },
  COLOMBIA: { nome: "Colômbia", codigo: "co" },
  INGLATERRA: { nome: "Inglaterra", codigo: "gb-eng" },
  CROACIA: { nome: "Croácia", codigo: "hr" },
  GANA: { nome: "Gana", codigo: "gh" },
  PANAMA: { nome: "Panamá", codigo: "pa" },
};

const MOCK_DATA = {
  meta: {
    titulo: "Bolão Copa 2026",
    temporada: "2026",
    dataSource: "google-sheets",
    get atualizadoEm() {
      return new Date().toLocaleDateString("pt-BR");
    },
  },

  /**
   * id = chave canónica (igual ao campo JOGADOR depois de parseJogador no sheets-loader).
   *    Não deve aparecer na UI — só para casar com a planilha / dados em memória.
   * nome = texto mostrado em todas as páginas (leaderboard, grupos, mata-mata, etc.).
   */
  jogadores: [
    { id: "BATONGAS", nome: "Polvo Paul", avatar: "🐙", cor: "#c2185b" },
    { id: "DNGRZ", nome: "mae_dinah1337", avatar: "🔮", cor: "#7e57c2" },
    { id: "DUDA", nome: "MollyT", avatar: "🪵", cor: "#6d4c41" },
    { id: "FELIPE O", nome: "eu quero que o adm se foda", avatar: "🐒", cor: "#a1887f" },
    { id: "KAROZ", nome: "cumulus nimbus", avatar: "⛈️", cor: "#546e7a" },
    { id: "LH", nome: "RIZZARDIOLA", avatar: "🍻", cor: "#ff8f00" },
    { id: "MALUKY", nome: "Xurupita", avatar: "🐀", cor: "#78909c" },
    { id: "MOLLY", nome: "mister boombastic", avatar: "🐭", cor: "#b0bec5" },
    { id: "MURILOFF", nome: "Zé Da Manga", avatar: "🥭", cor: "#ffb300" },
    { id: "PAYDAY", nome: "mago siberiano", avatar: "🥶", cor: "#29b6f6" },
    { id: "RIZZARDO", nome: "Rizzardeus", avatar: "🫏", cor: "#8d6e63" },
    { id: "ROQUE", nome: "Zé Pilantrinha", avatar: "🔥", cor: "#ff5722" },
    { id: "SYNCH", nome: "TOURO REPRODUTOR", avatar: "🐂", cor: "#5d4037" },
    { id: "TQZZI", nome: "Dangerz Pangaré véio", avatar: "🍑", cor: "#ff8a65" },
  ],

  paises: PAISES_INFO,
  gruposOficiais: {},
  classificacaoGrupos: {},
  resultadosGrupos: {},
  faseGrupos: [],
  faseGruposPlanilha: [],
  gruposPlanilha: [],
  jogadoresPlanilha: [],
  mataMata: [],
  mmResultadosPorFase: {},
  jogosMataMata: [],
  jogosMataMataPorFase: {},
  /** Calendário da aba Jogos: { data, hora, pais1, pais2, confronto, grupo? } — data texto tipo BR dia/mês. */
  jogos: [],
  /** Palpites da aba Artilheiro: { jogador, artilheiro, gols } (preenchido pelo sheets-loader). */
  artilheiro: [],
  /** Ranking oficial da aba Resultados Artilheiros: { pos, atleta, gols, pais?, foto? (URL, col. Foto), assistencias? } */
  resultadoArtilheiros: [],
};
