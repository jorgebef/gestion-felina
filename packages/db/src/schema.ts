/**
 * Drizzle mapping of the SQL schema in db/migrations. The SQL files are the source of
 * truth (they also hold RLS policies, triggers and generated columns); this file only
 * gives the query builder typed access to the same tables and must be kept in sync.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  customType,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/** JSON values as stored in jsonb columns (serializable as JSON over the API). */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json | undefined };
export type JsonObject = { [key: string]: Json | undefined };

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });
const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const euros = (name: string) => numeric(name, { precision: 16, scale: 2, mode: "number" });
const textArray = (name: string) =>
  text(name)
    .array()
    .notNull()
    .default(sql`'{}'`);

/* --------------------------------- People --------------------------------- */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  // Better Auth maps its `name` field here (see src/lib/auth.ts).
  fullName: text("full_name"),
  locale: text("locale").notNull().default("es"),
  timezone: text("timezone").notNull().default("Europe/Madrid"),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const authSessions = pgTable("auth_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: ts("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const authAccounts = pgTable("auth_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: ts("access_token_expires_at"),
  refreshTokenExpiresAt: ts("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const authVerifications = pgTable("auth_verifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: ts("expires_at").notNull(),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/* -------------------------------- Companies ------------------------------- */

export const companies = pgTable("companies", {
  id: uuid("id").primaryKey().defaultRandom(),
  legalName: text("legal_name").notNull(),
  displayName: text("display_name"),
  taxId: text("tax_id"),
  businessDescription: text("business_description"),
  companyType: text("company_type"),
  baseProvinceCode: char("base_province_code", { length: 2 }),
  baseMunicipality: text("base_municipality"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export type MemberRole = "owner" | "admin" | "member";

export const companyMembers = pgTable(
  "company_members",
  {
    companyId: uuid("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<MemberRole>().notNull().default("member"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.companyId, t.userId] })],
);

export type EmailFrequency = "instant" | "daily" | "weekly" | "off";

export const alertProfiles = pgTable("alert_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  serviceDescription: text("service_description").notNull(),
  cpvCodes: textArray("cpv_codes"),
  includeKeywords: textArray("include_keywords"),
  excludeKeywords: textArray("exclude_keywords"),
  provinceCodes: textArray("province_codes"),
  nationwide: boolean("nationwide").notNull().default(false),
  contractTypes: textArray("contract_types"),
  minBudgetEur: euros("min_budget_eur"),
  maxBudgetEur: euros("max_budget_eur"),
  emailFrequency: text("email_frequency").$type<EmailFrequency>().notNull().default("daily"),
  isActive: boolean("is_active").notNull().default(true),
  sectors: textArray("sectors"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/* ------------------------------ Public tenders ---------------------------- */

export const contractingAuthorities = pgTable("contracting_authorities", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  placspAuthorityId: text("placsp_authority_id"),
  taxId: text("tax_id"),
  administrationType: text("administration_type"),
  provinceCode: char("province_code", { length: 2 }),
  municipality: text("municipality"),
  parentAuthorityId: uuid("parent_authority_id"),
  profileUrl: text("profile_url"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export type TenderStatus =
  | "planned"
  | "open"
  | "closed"
  | "awarded"
  | "formalized"
  | "cancelled"
  | "suspended"
  | "unknown";

export const tenders = pgTable("tenders", {
  id: uuid("id").primaryKey().defaultRandom(),
  authorityId: uuid("authority_id").references(() => contractingAuthorities.id),
  expedienteNumber: text("expediente_number"),
  title: text("title").notNull(),
  description: text("description"),
  contractType: text("contract_type"),
  procedureType: text("procedure_type"),
  status: text("status").$type<TenderStatus>().notNull().default("unknown"),
  mainCpvCode: text("main_cpv_code"),
  cpvCodes: textArray("cpv_codes"),
  executionProvinces: textArray("execution_provinces"),
  executionMunicipality: text("execution_municipality"),
  baseBudgetExVatEur: euros("base_budget_ex_vat_eur"),
  estimatedValueEur: euros("estimated_value_eur"),
  firstPublishedAt: ts("first_published_at"),
  submissionDeadlineAt: ts("submission_deadline_at"),
  primaryOfficialUrl: text("primary_official_url"),
  rawSummary: jsonb("raw_summary").$type<JsonObject>().notNull().default({}),
  firstSeenAt: ts("first_seen_at").notNull().defaultNow(),
  lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
  searchDocument: tsvector("search_document").generatedAlwaysAs(sql``),
});

export const tenderLots = pgTable("tender_lots", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenderId: uuid("tender_id")
    .notNull()
    .references(() => tenders.id, { onDelete: "cascade" }),
  sourceLotCode: text("source_lot_code").notNull(),
  title: text("title"),
  description: text("description"),
  cpvCodes: textArray("cpv_codes"),
  executionProvinces: textArray("execution_provinces"),
  baseBudgetExVatEur: euros("base_budget_ex_vat_eur"),
  estimatedValueEur: euros("estimated_value_eur"),
  submissionDeadlineAt: ts("submission_deadline_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const tenderSources = pgTable("tender_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenderId: uuid("tender_id")
    .notNull()
    .references(() => tenders.id, { onDelete: "cascade" }),
  sourcePlatform: text("source_platform").notNull(),
  externalRecordId: text("external_record_id").notNull(),
  officialUrl: text("official_url").notNull(),
  sourceUpdatedAt: ts("source_updated_at"),
  firstSeenAt: ts("first_seen_at").notNull().defaultNow(),
  lastSeenAt: ts("last_seen_at").notNull().defaultNow(),
  rawPayload: jsonb("raw_payload").$type<unknown>(),
});

export const tenderEvents = pgTable("tender_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenderId: uuid("tender_id")
    .notNull()
    .references(() => tenders.id, { onDelete: "cascade" }),
  tenderSourceId: uuid("tender_source_id").references(() => tenderSources.id, {
    onDelete: "set null",
  }),
  externalNoticeId: text("external_notice_id"),
  eventType: text("event_type").notNull(),
  headline: text("headline"),
  details: text("details"),
  effectiveAt: ts("effective_at"),
  officialUrl: text("official_url"),
  payload: jsonb("payload").$type<JsonObject>().notNull().default({}),
  createdAt: ts("created_at").notNull().defaultNow(),
});

/* ------------------------------ Matching ---------------------------------- */

export const tenderMatches = pgTable("tender_matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  alertProfileId: uuid("alert_profile_id")
    .notNull()
    .references(() => alertProfiles.id, { onDelete: "cascade" }),
  tenderId: uuid("tender_id")
    .notNull()
    .references(() => tenders.id, { onDelete: "cascade" }),
  score: numeric("score", { precision: 5, scale: 2, mode: "number" }).notNull(),
  matchReason: text("match_reason"),
  matchedLotCodes: textArray("matched_lot_codes"),
  feedback: text("feedback").$type<"relevant" | "irrelevant">(),
  calculatedAt: ts("calculated_at").notNull().defaultNow(),
  firstMatchedAt: ts("first_matched_at").notNull().defaultNow(),
});

/* ------------------------------ Tracking ---------------------------------- */

export type WorkflowStatus =
  | "saved"
  | "evaluating"
  | "preparing"
  | "submitted"
  | "won"
  | "lost"
  | "archived";

export const trackedTenders = pgTable("tracked_tenders", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  tenderId: uuid("tender_id")
    .notNull()
    .references(() => tenders.id, { onDelete: "cascade" }),
  assignedUserId: uuid("assigned_user_id").references(() => users.id, { onDelete: "set null" }),
  workflowStatus: text("workflow_status").$type<WorkflowStatus>().notNull().default("saved"),
  notes: text("notes"),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const tenderTasks = pgTable("tender_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  trackedTenderId: uuid("tracked_tender_id")
    .notNull()
    .references(() => trackedTenders.id, { onDelete: "cascade" }),
  assignedUserId: uuid("assigned_user_id").references(() => users.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  dueAt: ts("due_at"),
  completedAt: ts("completed_at"),
  origin: text("origin")
    .$type<"manual" | "template" | "ai_suggested">()
    .notNull()
    .default("manual"),
  sourceReference: text("source_reference"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

/* ---------------------------- Notifications ------------------------------- */

export type DeliveryStatus = "queued" | "sent" | "failed" | "cancelled";

export const notificationDeliveries = pgTable("notification_deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  companyId: uuid("company_id")
    .notNull()
    .references(() => companies.id, { onDelete: "cascade" }),
  alertProfileId: uuid("alert_profile_id").references(() => alertProfiles.id, {
    onDelete: "set null",
  }),
  tenderId: uuid("tender_id").references(() => tenders.id, { onDelete: "set null" }),
  tenderEventId: uuid("tender_event_id").references(() => tenderEvents.id, {
    onDelete: "set null",
  }),
  notificationType: text("notification_type").notNull(),
  channel: text("channel").$type<"email" | "in_app">().notNull().default("email"),
  dedupeKey: text("dedupe_key").notNull().unique(),
  status: text("status").$type<DeliveryStatus>().notNull().default("queued"),
  scheduledAt: ts("scheduled_at").notNull().defaultNow(),
  sentAt: ts("sent_at"),
  providerMessageId: text("provider_message_id"),
  errorMessage: text("error_message"),
  attemptCount: integer("attempt_count").notNull().default(0),
  lastAttemptAt: ts("last_attempt_at"),
});

export const companySubscriptions = pgTable("company_subscriptions", {
  id: uuid("id").primaryKey().defaultRandom(),
  companyId: uuid("company_id")
    .notNull()
    .unique()
    .references(() => companies.id, { onDelete: "cascade" }),
  planCode: text("plan_code").notNull().default("free"),
  status: text("status").notNull().default("inactive"),
  billingProvider: text("billing_provider"),
  externalCustomerId: text("external_customer_id"),
  externalSubscriptionId: text("external_subscription_id"),
  currentPeriodEnd: ts("current_period_end"),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/* ------------------------------ Auxiliary --------------------------------- */

export type ImportRunStatus = "running" | "succeeded" | "partial" | "failed";

export const importRuns = pgTable("import_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  connector: text("connector").notNull(),
  sourceUrl: text("source_url").notNull(),
  triggeredBy: text("triggered_by").notNull().default("cli"),
  status: text("status").$type<ImportRunStatus>().notNull().default("running"),
  startedAt: ts("started_at").notNull().defaultNow(),
  finishedAt: ts("finished_at"),
  pagesFetched: integer("pages_fetched").notNull().default(0),
  entriesSeen: integer("entries_seen").notNull().default(0),
  tendersCreated: integer("tenders_created").notNull().default(0),
  tendersUpdated: integer("tenders_updated").notNull().default(0),
  tendersUnchanged: integer("tenders_unchanged").notNull().default(0),
  eventsCreated: integer("events_created").notNull().default(0),
  errorsCount: integer("errors_count").notNull().default(0),
  errors: jsonb("errors").$type<ImportError[]>().notNull().default([]),
  highWaterMark: ts("high_water_mark"),
  message: text("message"),
});

/** Every page fetched by an import run; `storage_key` points at the archived raw copy. */
export const importRunPages = pgTable(
  "import_run_pages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    importRunId: uuid("import_run_id")
      .notNull()
      .references(() => importRuns.id, { onDelete: "cascade" }),
    pageNumber: integer("page_number").notNull(),
    sourceUrl: text("source_url").notNull(),
    contentSha256: text("content_sha256").notNull(),
    byteSize: integer("byte_size").notNull(),
    storageKey: text("storage_key"),
    fetchedAt: ts("fetched_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("import_run_pages_run_page_uq").on(t.importRunId, t.pageNumber)],
);

export interface ImportError {
  externalRecordId?: string;
  message: string;
}

export const cpvCodes = pgTable("cpv_codes", {
  code: text("code").primaryKey(),
  labelEs: text("label_es").notNull(),
  searchDocument: tsvector("search_document").generatedAlwaysAs(sql``),
});
