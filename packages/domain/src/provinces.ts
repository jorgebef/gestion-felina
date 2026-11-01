/**
 * Spanish provinces with their official INE code: the first two digits of every
 * municipality code (`municipalities.code`). NUTS 2021 codes are kept for reference.
 */
export interface Province {
  code: string;
  name: string;
  region: string;
  nuts: readonly string[];
}

export const PROVINCES: readonly Province[] = [
  { code: "01", name: "Araba/Álava", region: "País Vasco", nuts: ["ES211"] },
  { code: "02", name: "Albacete", region: "Castilla-La Mancha", nuts: ["ES421"] },
  { code: "03", name: "Alicante/Alacant", region: "Comunitat Valenciana", nuts: ["ES521"] },
  { code: "04", name: "Almería", region: "Andalucía", nuts: ["ES611"] },
  { code: "05", name: "Ávila", region: "Castilla y León", nuts: ["ES411"] },
  { code: "06", name: "Badajoz", region: "Extremadura", nuts: ["ES431"] },
  {
    code: "07",
    name: "Illes Balears",
    region: "Illes Balears",
    nuts: ["ES531", "ES532", "ES533", "ES530"],
  },
  { code: "08", name: "Barcelona", region: "Cataluña", nuts: ["ES511"] },
  { code: "09", name: "Burgos", region: "Castilla y León", nuts: ["ES412"] },
  { code: "10", name: "Cáceres", region: "Extremadura", nuts: ["ES432"] },
  { code: "11", name: "Cádiz", region: "Andalucía", nuts: ["ES612"] },
  { code: "12", name: "Castellón/Castelló", region: "Comunitat Valenciana", nuts: ["ES522"] },
  { code: "13", name: "Ciudad Real", region: "Castilla-La Mancha", nuts: ["ES422"] },
  { code: "14", name: "Córdoba", region: "Andalucía", nuts: ["ES613"] },
  { code: "15", name: "A Coruña", region: "Galicia", nuts: ["ES111"] },
  { code: "16", name: "Cuenca", region: "Castilla-La Mancha", nuts: ["ES423"] },
  { code: "17", name: "Girona", region: "Cataluña", nuts: ["ES512"] },
  { code: "18", name: "Granada", region: "Andalucía", nuts: ["ES614"] },
  { code: "19", name: "Guadalajara", region: "Castilla-La Mancha", nuts: ["ES424"] },
  { code: "20", name: "Gipuzkoa", region: "País Vasco", nuts: ["ES212"] },
  { code: "21", name: "Huelva", region: "Andalucía", nuts: ["ES615"] },
  { code: "22", name: "Huesca", region: "Aragón", nuts: ["ES241"] },
  { code: "23", name: "Jaén", region: "Andalucía", nuts: ["ES616"] },
  { code: "24", name: "León", region: "Castilla y León", nuts: ["ES413"] },
  { code: "25", name: "Lleida", region: "Cataluña", nuts: ["ES513"] },
  { code: "26", name: "La Rioja", region: "La Rioja", nuts: ["ES230"] },
  { code: "27", name: "Lugo", region: "Galicia", nuts: ["ES112"] },
  { code: "28", name: "Madrid", region: "Comunidad de Madrid", nuts: ["ES300"] },
  { code: "29", name: "Málaga", region: "Andalucía", nuts: ["ES617"] },
  { code: "30", name: "Murcia", region: "Región de Murcia", nuts: ["ES620"] },
  { code: "31", name: "Navarra", region: "Comunidad Foral de Navarra", nuts: ["ES220"] },
  { code: "32", name: "Ourense", region: "Galicia", nuts: ["ES113"] },
  { code: "33", name: "Asturias", region: "Principado de Asturias", nuts: ["ES120"] },
  { code: "34", name: "Palencia", region: "Castilla y León", nuts: ["ES414"] },
  {
    code: "35",
    name: "Las Palmas",
    region: "Canarias",
    nuts: ["ES704", "ES705", "ES708", "ES701"],
  },
  { code: "36", name: "Pontevedra", region: "Galicia", nuts: ["ES114"] },
  { code: "37", name: "Salamanca", region: "Castilla y León", nuts: ["ES415"] },
  {
    code: "38",
    name: "Santa Cruz de Tenerife",
    region: "Canarias",
    nuts: ["ES703", "ES706", "ES707", "ES709", "ES702"],
  },
  { code: "39", name: "Cantabria", region: "Cantabria", nuts: ["ES130"] },
  { code: "40", name: "Segovia", region: "Castilla y León", nuts: ["ES416"] },
  { code: "41", name: "Sevilla", region: "Andalucía", nuts: ["ES618"] },
  { code: "42", name: "Soria", region: "Castilla y León", nuts: ["ES417"] },
  { code: "43", name: "Tarragona", region: "Cataluña", nuts: ["ES514"] },
  { code: "44", name: "Teruel", region: "Aragón", nuts: ["ES242"] },
  { code: "45", name: "Toledo", region: "Castilla-La Mancha", nuts: ["ES425"] },
  { code: "46", name: "Valencia/València", region: "Comunitat Valenciana", nuts: ["ES523"] },
  { code: "47", name: "Valladolid", region: "Castilla y León", nuts: ["ES418"] },
  { code: "48", name: "Bizkaia", region: "País Vasco", nuts: ["ES213"] },
  { code: "49", name: "Zamora", region: "Castilla y León", nuts: ["ES419"] },
  { code: "50", name: "Zaragoza", region: "Aragón", nuts: ["ES243"] },
  { code: "51", name: "Ceuta", region: "Ciudad de Ceuta", nuts: ["ES630"] },
  { code: "52", name: "Melilla", region: "Ciudad de Melilla", nuts: ["ES640"] },
];

const BY_CODE = new Map(PROVINCES.map((p) => [p.code, p]));

export const PROVINCE_CODES = PROVINCES.map((p) => p.code);

export function provinceName(code: string | null | undefined): string | undefined {
  return code ? BY_CODE.get(code)?.name : undefined;
}

export function isProvinceCode(code: string): boolean {
  return BY_CODE.has(code);
}

/** Groups provinces by autonomous community, sorted by name, for pickers. */
export function provincesByRegion(): { region: string; provinces: Province[] }[] {
  const groups = new Map<string, Province[]>();
  for (const p of PROVINCES) groups.set(p.region, [...(groups.get(p.region) ?? []), p]);
  return [...groups.entries()]
    .map(([region, provinces]) => ({
      region,
      provinces: provinces.toSorted((a, b) => a.name.localeCompare(b.name, "es")),
    }))
    .toSorted((a, b) => a.region.localeCompare(b.region, "es"));
}
