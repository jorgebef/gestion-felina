import { relations } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/* -------------------------------------------------------------------------- */
/*                                 Better Auth                                */
/* -------------------------------------------------------------------------- */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .$onUpdate(() => new Date()),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [index("session_user_id_idx").on(table.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("account_user_id_idx").on(table.userId)],
);

export const verification = pgTable(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

/* -------------------------------------------------------------------------- */
/*                                  Portfolio                                 */
/* -------------------------------------------------------------------------- */

export const propertyTypeEnum = pgEnum("property_type", [
  "apartment",
  "house",
  "villa",
  "studio",
  "commercial",
  "parking",
  "land",
]);

export const cashFlowKindEnum = pgEnum("cash_flow_kind", ["income", "expense"]);

export const frequencyEnum = pgEnum("frequency", ["monthly", "quarterly", "yearly"]);

const money = (name: string) => numeric(name, { precision: 14, scale: 2, mode: "number" });

export const property = pgTable(
  "property",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: propertyTypeEnum("type").notNull().default("apartment"),
    address: text("address").notNull(),
    city: text("city").notNull(),
    province: text("province").notNull(),
    postalCode: text("postal_code"),
    sizeSqm: integer("size_sqm"),
    bedrooms: integer("bedrooms"),
    purchaseDate: date("purchase_date", { mode: "string" }).notNull(),
    purchasePrice: money("purchase_price").notNull(),
    transferTax: money("transfer_tax").notNull().default(0),
    notaryFees: money("notary_fees").notNull().default(0),
    agencyFees: money("agency_fees").notNull().default(0),
    renovationCosts: money("renovation_costs").notNull().default(0),
    currentValue: money("current_value").notNull(),
    hasMortgage: boolean("has_mortgage").notNull().default(false),
    mortgagePrincipal: money("mortgage_principal").notNull().default(0),
    mortgageInterestRate: numeric("mortgage_interest_rate", {
      precision: 6,
      scale: 3,
      mode: "number",
    })
      .notNull()
      .default(0),
    mortgageTermYears: integer("mortgage_term_years").notNull().default(0),
    mortgageStartDate: date("mortgage_start_date", { mode: "string" }),
    mortgagePaidOff: money("mortgage_paid_off").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("property_user_id_idx").on(table.userId)],
);

export const recurringItem = pgTable(
  "recurring_item",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    propertyId: text("property_id")
      .notNull()
      .references(() => property.id, { onDelete: "cascade" }),
    kind: cashFlowKindEnum("kind").notNull(),
    category: text("category").notNull(),
    label: text("label").notNull(),
    amount: money("amount").notNull(),
    frequency: frequencyEnum("frequency").notNull().default("monthly"),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("recurring_item_property_id_idx").on(table.propertyId)],
);

export const oneOffItem = pgTable(
  "one_off_item",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    propertyId: text("property_id")
      .notNull()
      .references(() => property.id, { onDelete: "cascade" }),
    kind: cashFlowKindEnum("kind").notNull(),
    category: text("category").notNull(),
    label: text("label").notNull(),
    amount: money("amount").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("one_off_item_property_id_idx").on(table.propertyId)],
);

export const valuation = pgTable(
  "valuation",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    propertyId: text("property_id")
      .notNull()
      .references(() => property.id, { onDelete: "cascade" }),
    date: date("date", { mode: "string" }).notNull(),
    value: money("value").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [index("valuation_property_id_idx").on(table.propertyId)],
);

export const propertyRelations = relations(property, ({ many }) => ({
  recurringItems: many(recurringItem),
  oneOffItems: many(oneOffItem),
  valuations: many(valuation),
}));

export const recurringItemRelations = relations(recurringItem, ({ one }) => ({
  property: one(property, { fields: [recurringItem.propertyId], references: [property.id] }),
}));

export const oneOffItemRelations = relations(oneOffItem, ({ one }) => ({
  property: one(property, { fields: [oneOffItem.propertyId], references: [property.id] }),
}));

export const valuationRelations = relations(valuation, ({ one }) => ({
  property: one(property, { fields: [valuation.propertyId], references: [property.id] }),
}));

/* -------------------------------------------------------------------------- */
/*                           Investment opportunities                         */
/* -------------------------------------------------------------------------- */

export type LocalizedText = { en: string; es: string };

export const opportunity = pgTable("opportunity", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  slug: text("slug").notNull().unique(),
  // Public fields
  title: jsonb("title").$type<LocalizedText>().notNull(),
  summary: jsonb("summary").$type<LocalizedText>().notNull(),
  city: text("city").notNull(),
  province: text("province").notNull(),
  type: propertyTypeEnum("type").notNull(),
  askingPrice: money("asking_price").notNull(),
  sizeSqm: integer("size_sqm").notNull(),
  bedrooms: integer("bedrooms"),
  bathrooms: integer("bathrooms"),
  grossYield: numeric("gross_yield", { precision: 5, scale: 2, mode: "number" }).notNull(),
  coverHue: integer("cover_hue").notNull().default(20),
  tags: jsonb("tags").$type<string[]>().notNull().default([]),
  // Members-only fields
  address: text("address").notNull(),
  description: jsonb("description").$type<LocalizedText>().notNull(),
  estimatedRent: money("estimated_rent").notNull(),
  estimatedExpenses: money("estimated_expenses").notNull(),
  renovationBudget: money("renovation_budget").notNull().default(0),
  acquisitionCosts: money("acquisition_costs").notNull(),
  expectedAppreciation: numeric("expected_appreciation", {
    precision: 5,
    scale: 2,
    mode: "number",
  }).notNull(),
  highlights: jsonb("highlights").$type<LocalizedText[]>().notNull().default([]),
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  publishedAt: timestamp("published_at").notNull().defaultNow(),
});
