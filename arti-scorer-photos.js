/**
 * Fotos de artilheiros (fallback) quando a planilha não tem coluna FOTO/URL.
 * URLs: miniaturas Wikimedia Commons (CC/licenças da própria Commons).
 * Pode editar ou acrescentar chaves = nome em minúsculas, sem acentos, como na planilha.
 */
(function (global) {
  const MB =
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e5/Kylian_Mbapp%C3%A9_2018.jpg/480px-Kylian_Mbapp%C3%A9_2018.jpg";
  const YA =
    "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e3/Lamine_Yamal_in_2025.jpg/480px-Lamine_Yamal_in_2025.jpg";
  const KA =
    "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f0/Harry_Kane_2018.jpg/480px-Harry_Kane_2018.jpg";

  global.ARTI_SCORER_PHOTO_FALLBACK = {
    mbappe: MB,
    "kylian mbappe": MB,
    "kylian mbappe lottin": MB,
    "lamine yamal": YA,
    yamal: YA,
    "lamine yamal nasraoui ebana": YA,
    "harry kane": KA,
    kane: KA,
  };
})(typeof window !== "undefined" ? window : globalThis);
