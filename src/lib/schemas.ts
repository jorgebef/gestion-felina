import { z } from "zod";

export const PROPERTY_TYPES = [
  "apartment",
  "house",
  "villa",
  "studio",
  "commercial",
  "parking",
  "land",
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const FREQUENCIES = ["monthly", "quarterly", "yearly"] as const;

export const INCOME_CATEGORIES = [
  "rent",
  "holiday_rent",
  "parking_rent",
  "insurance_claim",
  "other_income",
] as const;

export const EXPENSE_CATEGORIES = [
  "community_fees",
  "ibi_tax",
  "insurance",
  "maintenance",
  "repairs",
  "utilities",
  "management",
  "taxes",
  "legal",
  "furniture",
  "other_expense",
] as const;

export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];
export type Category = IncomeCategory | ExpenseCategory;

/** The 50 Spanish provinces plus the autonomous cities. */
export const PROVINCES = [
  "A Coruña",
  "Álava",
  "Albacete",
  "Alicante",
  "Almería",
  "Asturias",
  "Ávila",
  "Badajoz",
  "Barcelona",
  "Bizkaia",
  "Burgos",
  "Cáceres",
  "Cádiz",
  "Cantabria",
  "Castellón",
  "Ceuta",
  "Ciudad Real",
  "Córdoba",
  "Cuenca",
  "Gipuzkoa",
  "Girona",
  "Granada",
  "Guadalajara",
  "Huelva",
  "Huesca",
  "Illes Balears",
  "Jaén",
  "La Rioja",
  "Las Palmas",
  "León",
  "Lleida",
  "Lugo",
  "Madrid",
  "Málaga",
  "Melilla",
  "Murcia",
  "Navarra",
  "Ourense",
  "Palencia",
  "Pontevedra",
  "Salamanca",
  "Santa Cruz de Tenerife",
  "Segovia",
  "Sevilla",
  "Soria",
  "Tarragona",
  "Teruel",
  "Toledo",
  "Valencia",
  "Valladolid",
  "Zamora",
  "Zaragoza",
] as const;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "invalid_date");
const money = z.number().finite().min(0);

export const recurringItemSchema = z.object({
  kind: z.enum(["income", "expense"]),
  category: z.string().min(1),
  label: z.string().trim().min(1).max(120),
  amount: z.number().finite().positive(),
  frequency: z.enum(FREQUENCIES),
  startDate: isoDate,
  endDate: isoDate.nullable(),
});
export type RecurringItemInput = z.infer<typeof recurringItemSchema>;

export const oneOffItemSchema = z.object({
  kind: z.enum(["income", "expense"]),
  category: z.string().min(1),
  label: z.string().trim().min(1).max(120),
  amount: z.number().finite().positive(),
  date: isoDate,
});
export type OneOffItemInput = z.infer<typeof oneOffItemSchema>;

export const valuationSchema = z.object({
  date: isoDate,
  value: z.number().finite().positive(),
});

const propertyFields = z.object({
  name: z.string().trim().min(1).max(120),
  type: z.enum(PROPERTY_TYPES),
  address: z.string().trim().min(1).max(200),
  city: z.string().trim().min(1).max(80),
  province: z.string().trim().min(1).max(80),
  postalCode: z.string().trim().max(10).nullable(),
  sizeSqm: z.number().int().positive().nullable(),
  bedrooms: z.number().int().min(0).max(50).nullable(),
  purchaseDate: isoDate,
  purchasePrice: z.number().finite().positive(),
  transferTax: money,
  notaryFees: money,
  agencyFees: money,
  renovationCosts: money,
  currentValue: z.number().finite().positive(),
  hasMortgage: z.boolean(),
  mortgagePrincipal: money,
  mortgageInterestRate: z.number().finite().min(0).max(30),
  mortgageTermYears: z.number().int().min(0).max(50),
  mortgageStartDate: isoDate.nullable(),
  mortgagePaidOff: money,
});

type PropertyFields = z.infer<typeof propertyFields>;

function refineMortgage(value: PropertyFields, ctx: z.RefinementCtx) {
  if (!value.hasMortgage) return;
  if (value.mortgagePrincipal <= 0) {
    ctx.addIssue({ code: "custom", path: ["mortgagePrincipal"], message: "required" });
  }
  if (value.mortgageTermYears <= 0) {
    ctx.addIssue({ code: "custom", path: ["mortgageTermYears"], message: "required" });
  }
  if (value.mortgagePaidOff > value.mortgagePrincipal) {
    ctx.addIssue({ code: "custom", path: ["mortgagePaidOff"], message: "paid_off_too_high" });
  }
}

export const propertyInputSchema = propertyFields.superRefine(refineMortgage);
export type PropertyInput = z.infer<typeof propertyInputSchema>;

export const createPropertySchema = propertyFields
  .extend({ recurringItems: z.array(recurringItemSchema).max(40) })
  .superRefine(refineMortgage);
export type CreatePropertyInput = z.infer<typeof createPropertySchema>;
