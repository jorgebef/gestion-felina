import { monthKey, mortgageForMonth, toMonthIndex } from "#/lib/portfolio";
import type { PropertyData } from "#/lib/portfolio";
import type { OneOffItemInput, PropertyType, RecurringItemInput } from "#/lib/schemas";

type Locale = "en" | "es";

interface SampleProperty {
  name: string;
  type: PropertyType;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  sizeSqm: number;
  bedrooms: number;
  purchaseDate: string;
  purchasePrice: number;
  transferTax: number;
  notaryFees: number;
  agencyFees: number;
  renovationCosts: number;
  currentValue: number;
  hasMortgage: boolean;
  mortgagePrincipal: number;
  mortgageInterestRate: number;
  mortgageTermYears: number;
  mortgageStartDate: string | null;
  mortgagePaidOff: number;
  recurringItems: RecurringItemInput[];
  oneOffItems: OneOffItemInput[];
  valuations: { date: string; value: number }[];
}

const LABELS: Record<string, { en: string; es: string }> = {
  rent: { en: "Long-term rent", es: "Alquiler de larga estancia" },
  holiday: { en: "Holiday lettings (average)", es: "Alquiler vacacional (media)" },
  community: { en: "Community fees", es: "Gastos de comunidad" },
  ibi: { en: "IBI property tax", es: "IBI" },
  insurance: { en: "Home insurance", es: "Seguro de hogar" },
  maintenance: { en: "Maintenance reserve", es: "Reserva de mantenimiento" },
  management: { en: "Holiday rental management (15%)", es: "Gestión vacacional (15%)" },
  utilities: { en: "Utilities", es: "Suministros" },
  pool: { en: "Pool & garden service", es: "Mantenimiento de piscina y jardín" },
  boiler: { en: "Boiler replacement", es: "Cambio de caldera" },
  furniture: { en: "Furniture package", es: "Mobiliario" },
  painting: { en: "Full repaint between tenants", es: "Pintura completa entre inquilinos" },
  claim: { en: "Insurance payout (water damage)", es: "Indemnización del seguro (daños por agua)" },
  poolRepair: { en: "Pool pump repair", es: "Reparación de la bomba de la piscina" },
  fitOut: { en: "Tenant fit-out contribution", es: "Aportación a la reforma del inquilino" },
  lawyer: { en: "Lease renewal legal fees", es: "Honorarios legales por renovación" },
};

function isoFromMonth(month: number, day = 1): string {
  return `${monthKey(month)}-${String(day).padStart(2, "0")}`;
}

/** Monthly valuations with a gentle trend and deterministic seasonal noise. */
function buildValuations(
  purchaseMonth: number,
  currentMonth: number,
  purchasePrice: number,
  currentValue: number,
  seed: number,
): { date: string; value: number }[] {
  const firstMonth = Math.max(purchaseMonth + 1, currentMonth - 23);
  const points: { date: string; value: number }[] = [];
  for (let m = firstMonth; m <= currentMonth; m++) {
    const t = (m - purchaseMonth) / Math.max(1, currentMonth - purchaseMonth);
    const trend = purchasePrice + (currentValue - purchasePrice) * t;
    const noise = m === currentMonth ? 0 : Math.sin(m * 1.7 + seed) * 0.006;
    points.push({ date: isoFromMonth(m, 28), value: Math.round(trend * (1 + noise)) });
  }
  return points;
}

function paidOffSoFar(p: SampleProperty, now: number) {
  const data: PropertyData = { ...p, id: "", recurringItems: [], oneOffItems: [], valuations: [] };
  const start = toMonthIndex(p.mortgageStartDate ?? p.purchaseDate);
  let paid = 0;
  for (let m = start; m < now; m++) {
    const { payment, interest } = mortgageForMonth(data, m);
    paid += payment - interest;
  }
  return Math.round(paid);
}

export function buildSamplePortfolio(now: Date, locale: Locale): SampleProperty[] {
  const current = toMonthIndex(now);
  const label = (key: string) => LABELS[key][locale];
  const recurring = (
    kind: "income" | "expense",
    category: string,
    key: string,
    amount: number,
    frequency: "monthly" | "quarterly" | "yearly",
    startMonth: number,
  ): RecurringItemInput => ({
    kind,
    category,
    label: label(key),
    amount,
    frequency,
    startDate: isoFromMonth(startMonth),
    endDate: null,
  });
  const oneOff = (
    kind: "income" | "expense",
    category: string,
    key: string,
    amount: number,
    month: number,
  ): OneOffItemInput => ({
    kind,
    category,
    label: label(key),
    amount,
    date: isoFromMonth(month, 12),
  });

  const madridPurchase = current - 38;
  const valenciaPurchase = current - 26;
  const marbellaPurchase = current - 14;
  const sevillaPurchase = current - 74;

  const samples: Omit<SampleProperty, "valuations" | "mortgagePaidOff">[] = [
    {
      name: "Ático Chamberí",
      type: "apartment",
      address: "Calle de Fuencarral 142, 6º",
      city: "Madrid",
      province: "Madrid",
      postalCode: "28010",
      sizeSqm: 86,
      bedrooms: 2,
      purchaseDate: isoFromMonth(madridPurchase, 14),
      purchasePrice: 385_000,
      transferTax: 23_100,
      notaryFees: 2_400,
      agencyFees: 0,
      renovationCosts: 18_000,
      currentValue: 452_000,
      hasMortgage: true,
      mortgagePrincipal: 270_000,
      mortgageInterestRate: 2.9,
      mortgageTermYears: 25,
      mortgageStartDate: isoFromMonth(madridPurchase, 14),
      recurringItems: [
        recurring("income", "rent", "rent", 1_850, "monthly", madridPurchase + 2),
        recurring("expense", "community_fees", "community", 140, "monthly", madridPurchase),
        recurring("expense", "ibi_tax", "ibi", 780, "yearly", madridPurchase),
        recurring("expense", "insurance", "insurance", 320, "yearly", madridPurchase),
        recurring("expense", "maintenance", "maintenance", 60, "monthly", madridPurchase),
      ],
      oneOffItems: [
        oneOff("expense", "furniture", "furniture", 3_400, madridPurchase + 1),
        oneOff("expense", "repairs", "boiler", 1_150, current - 7),
      ],
    },
    {
      name: "Piso Cabanyal",
      type: "apartment",
      address: "Carrer de la Reina 87, 2º",
      city: "Valencia",
      province: "Valencia",
      postalCode: "46011",
      sizeSqm: 74,
      bedrooms: 3,
      purchaseDate: isoFromMonth(valenciaPurchase, 3),
      purchasePrice: 235_000,
      transferTax: 23_500,
      notaryFees: 1_900,
      agencyFees: 0,
      renovationCosts: 9_000,
      currentValue: 268_000,
      hasMortgage: false,
      mortgagePrincipal: 0,
      mortgageInterestRate: 0,
      mortgageTermYears: 0,
      mortgageStartDate: null,
      recurringItems: [
        recurring("income", "rent", "rent", 1_250, "monthly", valenciaPurchase + 1),
        recurring("expense", "community_fees", "community", 85, "monthly", valenciaPurchase),
        recurring("expense", "ibi_tax", "ibi", 420, "yearly", valenciaPurchase),
        recurring("expense", "insurance", "insurance", 260, "yearly", valenciaPurchase),
      ],
      oneOffItems: [
        oneOff("income", "insurance_claim", "claim", 600, current - 11),
        oneOff("expense", "repairs", "painting", 1_800, current - 4),
      ],
    },
    {
      name: "Villa Nueva Andalucía",
      type: "villa",
      address: "Calle Los Naranjos 9",
      city: "Marbella",
      province: "Málaga",
      postalCode: "29660",
      sizeSqm: 245,
      bedrooms: 4,
      purchaseDate: isoFromMonth(marbellaPurchase, 20),
      purchasePrice: 690_000,
      transferTax: 48_300,
      notaryFees: 3_800,
      agencyFees: 0,
      renovationCosts: 35_000,
      currentValue: 742_000,
      hasMortgage: true,
      mortgagePrincipal: 414_000,
      mortgageInterestRate: 3.4,
      mortgageTermYears: 30,
      mortgageStartDate: isoFromMonth(marbellaPurchase, 20),
      recurringItems: [
        recurring("income", "holiday_rent", "holiday", 4_200, "monthly", marbellaPurchase + 3),
        recurring("expense", "management", "management", 630, "monthly", marbellaPurchase + 3),
        recurring("expense", "utilities", "utilities", 280, "monthly", marbellaPurchase),
        recurring("expense", "community_fees", "community", 210, "monthly", marbellaPurchase),
        recurring("expense", "maintenance", "pool", 120, "monthly", marbellaPurchase),
        recurring("expense", "ibi_tax", "ibi", 2_100, "yearly", marbellaPurchase),
        recurring("expense", "insurance", "insurance", 950, "yearly", marbellaPurchase),
      ],
      oneOffItems: [
        oneOff("expense", "furniture", "furniture", 12_000, marbellaPurchase + 1),
        oneOff("expense", "repairs", "poolRepair", 2_600, current - 2),
      ],
    },
    {
      name: "Local Triana",
      type: "commercial",
      address: "Calle San Jacinto 31",
      city: "Sevilla",
      province: "Sevilla",
      postalCode: "41010",
      sizeSqm: 92,
      bedrooms: 0,
      purchaseDate: isoFromMonth(sevillaPurchase, 9),
      purchasePrice: 145_000,
      transferTax: 10_150,
      notaryFees: 1_500,
      agencyFees: 4_350,
      renovationCosts: 0,
      currentValue: 171_000,
      hasMortgage: false,
      mortgagePrincipal: 0,
      mortgageInterestRate: 0,
      mortgageTermYears: 0,
      mortgageStartDate: null,
      recurringItems: [
        recurring("income", "rent", "rent", 1_050, "monthly", sevillaPurchase + 2),
        recurring("expense", "community_fees", "community", 55, "monthly", sevillaPurchase),
        recurring("expense", "ibi_tax", "ibi", 640, "yearly", sevillaPurchase),
        recurring("expense", "insurance", "insurance", 210, "yearly", sevillaPurchase),
      ],
      oneOffItems: [
        oneOff("expense", "repairs", "fitOut", 4_000, sevillaPurchase + 2),
        oneOff("expense", "legal", "lawyer", 650, current - 9),
      ],
    },
  ];

  return samples.map((sample, index) => {
    const purchaseMonth = toMonthIndex(sample.purchaseDate);
    const withPaidOff = {
      ...sample,
      valuations: [],
      mortgagePaidOff: 0,
    } satisfies SampleProperty;
    return {
      ...withPaidOff,
      mortgagePaidOff: sample.hasMortgage ? paidOffSoFar(withPaidOff, current) : 0,
      valuations: buildValuations(
        purchaseMonth,
        current,
        sample.purchasePrice,
        sample.currentValue,
        index * 2.3,
      ),
    };
  });
}
