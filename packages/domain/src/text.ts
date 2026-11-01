/**
 * Cheap, deterministic Spanish text normalisation used by matching and CPV
 * suggestions. Deliberately simple (no dictionaries, no AI): lower-case, strip
 * accents, drop stop words and reduce words to a light stem so that "limpieza",
 * "limpiar" and "Limpiezas" compare equal.
 */

const STOP_WORDS = new Set(
  (
    "a al algo algun alguna algunas alguno algunos ante antes aquel aquella como con contra cual " +
    "cuando de del desde donde durante e el ella ellas ello ellos en entre era es esa esas ese eso " +
    "esos esta estas este esto estos fue ha hacia han hasta hay la las le les lo los mas me mi mis " +
    "mucho muy nada ni no nos nuestra nuestro o otra otras otro otros para pero poco por porque que " +
    "quien se sea segun ser si sin sino sobre son su sus tambien tanto te tiene todo todos tu un una " +
    "uno unos y ya yo " +
    // Domain-generic words that appear in almost every tender title.
    "contrato contratacion servicio servicios suministro suministros obra obras expediente lote " +
    "lotes municipal ayuntamiento empresa empresas nuestros ofrecemos realizamos hacemos trabajos " +
    "trabajo tipo general generales diverso diversos varios varias"
  ).split(" "),
);

const SUFFIXES = [
  "amientos",
  "imientos",
  "aciones",
  "uciones",
  "amiento",
  "imiento",
  "idades",
  "ciones",
  "mente",
  "acion",
  "ucion",
  "ables",
  "ibles",
  "istas",
  "cion",
  "idad",
  "able",
  "ible",
  "ista",
  "ador",
  "ores",
  "eza",
  "ar",
  "er",
  "ir",
  "os",
  "as",
  "es",
  "or",
  "a",
  "o",
  "e",
  "s",
];

const MIN_STEM = 4;
const MAX_STEM = 8;

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ]+/g, " ")
    .trim();
}

export function stem(word: string): string {
  // Plural first ("limpiezas" → "limpieza"), then one derivational/gender suffix.
  let result = word.length > MIN_STEM + 1 && word.endsWith("s") ? word.slice(0, -1) : word;
  for (const suffix of SUFFIXES) {
    if (result.endsWith(suffix) && result.length - suffix.length >= MIN_STEM) {
      result = result.slice(0, -suffix.length);
      break;
    }
  }
  return result.slice(0, MAX_STEM);
}

export interface Token {
  word: string;
  stem: string;
}

/** Meaningful words of a text, in order, with their stems. */
export function tokenize(value: string): Token[] {
  return normalizeText(value)
    .split(" ")
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w) && !/^\d+$/.test(w))
    .map((word) => ({ word, stem: stem(word) }));
}

export function stemSet(value: string): Set<string> {
  return new Set(tokenize(value).map((t) => t.stem));
}

/**
 * A keyword (possibly several words) matches when every one of its meaningful stems
 * appears in the text. Keywords made only of stop words never match.
 */
export function keywordMatches(keyword: string, textStems: Set<string>): boolean {
  const stems = tokenize(keyword).map((t) => t.stem);
  return stems.length > 0 && stems.every((s) => textStems.has(s));
}

/** Splits a user-entered list ("limpieza, jardinería; poda") into clean entries. */
export function parseKeywordList(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[,;\n]/)
        .map((k) => k.trim().replace(/\s+/g, " "))
        .filter(Boolean),
    ),
  ];
}
