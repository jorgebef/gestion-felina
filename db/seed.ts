/**
 * Seeds the public investment opportunities. Safe to run repeatedly: rows are upserted by slug.
 *
 *   vp run db:seed
 */
import { config } from "dotenv";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "../src/db/schema.ts";

config({ path: [".env.local", ".env"] });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

const db = drizzle(databaseUrl, { schema });

const contact = { contactName: "SpainFolio Deals Desk", contactEmail: "deals@spainfolio.example" };

const opportunities: (typeof schema.opportunity.$inferInsert)[] = [
  {
    slug: "eixample-renovation-flat",
    title: {
      en: "Renovation flat near Sagrada Família",
      es: "Piso para reformar junto a la Sagrada Família",
    },
    summary: {
      en: "Bright three-bedroom flat in a classic Eixample block. Priced below the area average to leave room for a full renovation.",
      es: "Piso luminoso de tres dormitorios en una finca clásica del Eixample. Precio por debajo de la media de la zona para acometer una reforma integral.",
    },
    city: "Barcelona",
    province: "Barcelona",
    type: "apartment",
    askingPrice: 289_000,
    sizeSqm: 72,
    bedrooms: 3,
    bathrooms: 1,
    grossYield: 5.81,
    coverHue: 18,
    tags: ["renovation", "long_term"],
    address: "Carrer de Provença 412, 3º 2ª, 08025 Barcelona",
    description: {
      en: "Third floor with lift in a 1920s modernista building with a renovated façade. The flat keeps its original hydraulic tiles and high ceilings. The plan budgets €28k for kitchen, bathroom and electrics, then letting on a long-term contract. Comparable renovated units in the street let for €1,350–1,450.",
      es: "Tercera planta con ascensor en una finca modernista de los años 20 con la fachada rehabilitada. Conserva el suelo hidráulico original y techos altos. El plan prevé 28.000 € para cocina, baño e instalación eléctrica, y después alquiler de larga estancia. Pisos reformados similares en la misma calle se alquilan por 1.350–1.450 €.",
    },
    estimatedRent: 1_400,
    estimatedExpenses: 190,
    renovationBudget: 28_000,
    acquisitionCosts: 32_400,
    expectedAppreciation: 4.5,
    highlights: [
      {
        en: "Building façade and roof already renovated",
        es: "Fachada y cubierta del edificio ya rehabilitadas",
      },
      { en: "Five minutes from metro L2 and L5", es: "A cinco minutos del metro L2 y L5" },
      { en: "Strong long-term rental demand", es: "Gran demanda de alquiler de larga estancia" },
    ],
    ...contact,
  },
  {
    slug: "ruzafa-corner-apartment",
    title: { en: "Corner apartment in Ruzafa", es: "Piso esquinero en Ruzafa" },
    summary: {
      en: "Turn-key two-bedroom with balconies on two streets in Valencia's most in-demand neighbourhood.",
      es: "Piso de dos dormitorios listo para entrar a vivir, con balcones a dos calles en el barrio más demandado de Valencia.",
    },
    city: "Valencia",
    province: "Valencia",
    type: "apartment",
    askingPrice: 214_000,
    sizeSqm: 68,
    bedrooms: 2,
    bathrooms: 1,
    grossYield: 6.39,
    coverHue: 32,
    tags: ["turn_key", "long_term"],
    address: "Carrer de Sueca 54, 4º, 46006 València",
    description: {
      en: "Renovated in 2022 with aerothermal heating and new windows. It is currently let at €1,140 a month with a tenant in place until 2027, so it produces income from day one.",
      es: "Reformado en 2022 con aerotermia y ventanas nuevas. Actualmente alquilado por 1.140 € al mes con un inquilino hasta 2027, lo que garantiza ingresos desde el primer día.",
    },
    estimatedRent: 1_140,
    estimatedExpenses: 140,
    renovationBudget: 0,
    acquisitionCosts: 23_800,
    expectedAppreciation: 5.2,
    highlights: [
      { en: "Tenant in place, contract until 2027", es: "Inquilino con contrato hasta 2027" },
      { en: "Energy certificate B", es: "Certificado energético B" },
      {
        en: "Rents in Ruzafa rose 9% last year",
        es: "Los alquileres en Ruzafa subieron un 9% el último año",
      },
    ],
    ...contact,
  },
  {
    slug: "malaga-soho-studio",
    title: {
      en: "Licensed holiday studio in Soho",
      es: "Estudio con licencia turística en el Soho",
    },
    summary: {
      en: "Compact studio with an active tourist licence, a short walk from the port and the old town.",
      es: "Estudio compacto con licencia turística activa, a un paseo del puerto y del centro histórico.",
    },
    city: "Málaga",
    province: "Málaga",
    type: "studio",
    askingPrice: 159_000,
    sizeSqm: 38,
    bedrooms: 1,
    bathrooms: 1,
    grossYield: 7.09,
    coverHue: 8,
    tags: ["holiday_rental", "high_yield"],
    address: "Calle Tomás Heredia 18, 1º B, 29001 Málaga",
    description: {
      en: "Sold furnished with a registered VFT licence and 4.9-star reviews. Average occupancy over the last 12 months was 78%. The net figure assumes a 20% management fee.",
      es: "Se vende amueblado, con licencia VFT inscrita y valoraciones de 4,9 estrellas. Ocupación media del 78% en los últimos 12 meses. Las cifras netas asumen una comisión de gestión del 20%.",
    },
    estimatedRent: 940,
    estimatedExpenses: 260,
    renovationBudget: 0,
    acquisitionCosts: 13_900,
    expectedAppreciation: 6.1,
    highlights: [
      { en: "Active tourist licence (VFT)", es: "Licencia turística activa (VFT)" },
      { en: "Sold fully furnished", es: "Se vende totalmente amueblado" },
      { en: "78% trailing occupancy", es: "78% de ocupación en los últimos 12 meses" },
    ],
    ...contact,
  },
  {
    slug: "lavapies-retail-unit",
    title: { en: "Let retail unit in Lavapiés", es: "Local comercial alquilado en Lavapiés" },
    summary: {
      en: "Street-level retail unit with a long-standing café tenant on a busy pedestrian street.",
      es: "Local a pie de calle con una cafetería como inquilino desde hace años, en una calle peatonal muy transitada.",
    },
    city: "Madrid",
    province: "Madrid",
    type: "commercial",
    askingPrice: 340_000,
    sizeSqm: 110,
    bedrooms: null,
    bathrooms: 1,
    grossYield: 6.0,
    coverHue: 200,
    tags: ["commercial", "tenant_in_place"],
    address: "Calle de Argumosa 23, local, 28012 Madrid",
    description: {
      en: "The café has traded here for 11 years and holds a 10-year lease, with annual CPI-linked reviews and a 6-month deposit. The unit has a smoke outlet and a full licence for food service.",
      es: "La cafetería opera desde hace 11 años con un contrato de 10 años, revisión anual según IPC y fianza de 6 meses. El local cuenta con salida de humos y licencia completa de restauración.",
    },
    estimatedRent: 1_700,
    estimatedExpenses: 210,
    renovationBudget: 0,
    acquisitionCosts: 24_500,
    expectedAppreciation: 3.8,
    highlights: [
      { en: "10-year lease with CPI reviews", es: "Contrato de 10 años con revisión por IPC" },
      { en: "Smoke outlet and food licence", es: "Salida de humos y licencia de restauración" },
      { en: "Low vacancy risk", es: "Bajo riesgo de desocupación" },
    ],
    ...contact,
  },
  {
    slug: "san-juan-beachfront-two-bed",
    title: {
      en: "Beachfront two-bed in San Juan",
      es: "Dos dormitorios en primera línea en San Juan",
    },
    summary: {
      en: "Sea-view apartment with a large terrace and a community pool, 50 metres from the sand.",
      es: "Apartamento con vistas al mar, gran terraza y piscina comunitaria, a 50 metros de la arena.",
    },
    city: "Alicante",
    province: "Alicante",
    type: "apartment",
    askingPrice: 248_000,
    sizeSqm: 85,
    bedrooms: 2,
    bathrooms: 2,
    grossYield: 5.2,
    coverHue: 190,
    tags: ["sea_view", "mixed_use"],
    address: "Avenida de Niza 41, 7º C, 03540 Alicante",
    description: {
      en: "The rental plan is a mixed strategy: a mid-term let from October to May and holiday lets in summer. The building has a concierge, a garage space and a storage room, all included in the price.",
      es: "La estrategia de alquiler es mixta: temporada media de octubre a mayo y alquiler vacacional en verano. Edificio con conserjería; plaza de garaje y trastero incluidos en el precio.",
    },
    estimatedRent: 1_075,
    estimatedExpenses: 230,
    renovationBudget: 6_000,
    acquisitionCosts: 27_300,
    expectedAppreciation: 4.9,
    highlights: [
      { en: "Garage space and storage included", es: "Plaza de garaje y trastero incluidos" },
      { en: "Unobstructed sea views", es: "Vistas despejadas al mar" },
      { en: "Year-round rental strategy", es: "Estrategia de alquiler todo el año" },
    ],
    ...contact,
  },
  {
    slug: "alameda-townhouse",
    title: { en: "Townhouse by the Alameda", es: "Casa adosada junto a la Alameda" },
    summary: {
      en: "Four-bedroom Sevillian townhouse with a patio and a roof terrace, suitable for family lets or co-living.",
      es: "Casa sevillana de cuatro dormitorios con patio y azotea, ideal para alquiler familiar o coliving.",
    },
    city: "Sevilla",
    province: "Sevilla",
    type: "house",
    askingPrice: 395_000,
    sizeSqm: 160,
    bedrooms: 4,
    bathrooms: 3,
    grossYield: 4.89,
    coverHue: 42,
    tags: ["value_add", "co_living"],
    address: "Calle Peris Mencheta 12, 41002 Sevilla",
    description: {
      en: "A traditional patio house across three floors. Converting it into five co-living rooms would raise the gross yield to around 7%. The plan budgets €22k for adding an en-suite bathroom and for the licence.",
      es: "Casa patio tradicional en tres plantas. Convertirla en cinco habitaciones de coliving elevaría la rentabilidad bruta a cerca del 7%. El plan prevé 22.000 € para un baño en suite adicional y la licencia.",
    },
    estimatedRent: 1_610,
    estimatedExpenses: 240,
    renovationBudget: 22_000,
    acquisitionCosts: 31_600,
    expectedAppreciation: 4.2,
    highlights: [
      { en: "Upside from a co-living conversion", es: "Potencial de conversión a coliving" },
      { en: "Private patio and roof terrace", es: "Patio privado y azotea" },
      { en: "Walkable to the city centre", es: "Centro de la ciudad a pie" },
    ],
    ...contact,
  },
  {
    slug: "indautxu-family-flat",
    title: { en: "Family flat in Indautxu", es: "Piso familiar en Indautxu" },
    summary: {
      en: "Three-bedroom flat in Bilbao's prime residential district. A stable long-term rental with low vacancy.",
      es: "Piso de tres dormitorios en el distrito residencial más cotizado de Bilbao. Alquiler estable de larga estancia y baja desocupación.",
    },
    city: "Bilbao",
    province: "Bizkaia",
    type: "apartment",
    askingPrice: 268_000,
    sizeSqm: 80,
    bedrooms: 3,
    bathrooms: 1,
    grossYield: 5.01,
    coverHue: 150,
    tags: ["long_term", "low_risk"],
    address: "Calle Licenciado Poza 38, 5º, 48011 Bilbao",
    description: {
      en: "The building has a lift and was renovated in 2019. The flat needs only cosmetic updates. Transfer tax in Bizkaia is 4%, which keeps acquisition costs well below the national average.",
      es: "Edificio con ascensor, rehabilitado en 2019. El piso solo necesita mejoras estéticas. El ITP en Bizkaia es del 4%, lo que reduce los costes de adquisición muy por debajo de la media nacional.",
    },
    estimatedRent: 1_120,
    estimatedExpenses: 150,
    renovationBudget: 7_500,
    acquisitionCosts: 13_200,
    expectedAppreciation: 3.9,
    highlights: [
      { en: "4% transfer tax in Bizkaia", es: "ITP del 4% en Bizkaia" },
      { en: "Building renovated in 2019", es: "Edificio rehabilitado en 2019" },
      { en: "Prime school catchment", es: "Zona con los colegios más demandados" },
    ],
    ...contact,
  },
];

const now = Date.now();
await db
  .insert(schema.opportunity)
  .values(
    // Stagger publish dates so the newest listing comes first.
    opportunities.map((o, i) => ({ ...o, publishedAt: new Date(now - i * 3 * 86_400_000) })),
  )
  .onConflictDoUpdate({
    target: schema.opportunity.slug,
    set: {
      title: sql`excluded.title`,
      summary: sql`excluded.summary`,
      city: sql`excluded.city`,
      province: sql`excluded.province`,
      type: sql`excluded.type`,
      askingPrice: sql`excluded.asking_price`,
      sizeSqm: sql`excluded.size_sqm`,
      bedrooms: sql`excluded.bedrooms`,
      bathrooms: sql`excluded.bathrooms`,
      grossYield: sql`excluded.gross_yield`,
      coverHue: sql`excluded.cover_hue`,
      tags: sql`excluded.tags`,
      address: sql`excluded.address`,
      description: sql`excluded.description`,
      estimatedRent: sql`excluded.estimated_rent`,
      estimatedExpenses: sql`excluded.estimated_expenses`,
      renovationBudget: sql`excluded.renovation_budget`,
      acquisitionCosts: sql`excluded.acquisition_costs`,
      expectedAppreciation: sql`excluded.expected_appreciation`,
      highlights: sql`excluded.highlights`,
      contactName: sql`excluded.contact_name`,
      contactEmail: sql`excluded.contact_email`,
    },
  });

console.log(`Seeded ${opportunities.length} investment opportunities.`);
await db.$client.end();
