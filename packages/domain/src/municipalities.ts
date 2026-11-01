/**
 * Spanish municipalities as published by the INE ("Relación de municipios y códigos").
 * The 5-digit code is the province code (CPRO) followed by the municipality code (CMUN).
 */
import { provinceName } from "./provinces.ts";

export function isMunicipalityCode(code: string): boolean {
  return /^\d{5}$/.test(code);
}

export function provinceOfMunicipality(code: string): string {
  return code.slice(0, 2);
}

const ARTICLE = /^(.+), (el|la|los|las|l'|les|els|es|sa|ses|a|o|as|os|lo)$/i;

function moveArticle(part: string): string {
  const match = ARTICLE.exec(part.trim());
  if (!match) return part.trim();
  const [, rest, article] = match as unknown as [string, string, string];
  const capitalised = article.charAt(0).toUpperCase() + article.slice(1);
  return `${capitalised}${article.endsWith("'") ? "" : " "}${rest}`;
}

/**
 * INE lists names with the article at the end ("Coruña, A", "Rozas de Madrid, Las",
 * "Vila Joiosa, la/Villajoyosa"); people write it first ("A Coruña").
 */
export function municipalityDisplayName(official: string): string {
  return official.split("/").map(moveArticle).join("/");
}

/** "Las Rozas de Madrid (Madrid)". */
export function municipalityLabel(m: { name: string; code: string }): string {
  const province = provinceName(provinceOfMunicipality(m.code));
  return province ? `${m.name} (${province})` : m.name;
}

/** Lower-case, accent-free text for search ("Ávila" → "avila"). */
export function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}
