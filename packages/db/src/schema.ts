/**
 * Drizzle mapping of the SQL schema in ../migrations. The SQL files are the source of
 * truth (they also hold RLS policies, triggers and generated columns); this file only
 * gives the query builder typed access to the same tables and must be kept in sync.
 */
import { sql } from "drizzle-orm";
import {
  boolean,
  char,
  date,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import type {
  ActionStatus,
  ActionType,
  CatSex,
  MemberRole,
  OrganizationKind,
  OrganizationStatus,
  ProposalStatus,
  ProposalTarget,
} from "@felina/domain/felina";

/** JSON values as stored in jsonb columns (serializable as JSON over the API). */
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json | undefined };
export type JsonObject = { [key: string]: Json | undefined };
/** Field → value of a change proposal (all proposable fields are scalars). */
export type ChangeSet = Record<string, string | number | boolean | null>;

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });
const municipality = (name: string) => char(name, { length: 5 });

/* --------------------------------- People --------------------------------- */

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  // Better Auth maps its `name` field here (see apps/api/src/auth.ts).
  fullName: text("full_name"),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  isPlatformAdmin: boolean("is_platform_admin").notNull().default(false),
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

/* ------------------------------ Municipalities ---------------------------- */

export const municipalities = pgTable("municipalities", {
  code: municipality("code").primaryKey(),
  provinceCode: char("province_code", { length: 2 }).notNull(),
  name: text("name").notNull(),
  officialName: text("official_name").notNull(),
  searchName: text("search_name"),
});

/* ------------------------------ Organizations ----------------------------- */

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  kind: text("kind").$type<OrganizationKind>().notNull(),
  name: text("name").notNull(),
  taxId: text("tax_id"),
  municipalityCode: municipality("municipality_code").references(() => municipalities.code),
  description: text("description"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  status: text("status").$type<OrganizationStatus>().notNull().default("pending"),
  reviewNote: text("review_note"),
  reviewedAt: ts("reviewed_at"),
  reviewedBy: uuid("reviewed_by").references(() => users.id, { onDelete: "set null" }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const organizationMembers = pgTable("organization_members", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  role: text("role").$type<MemberRole>().notNull().default("member"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const organizationInvitations = pgTable("organization_invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").$type<MemberRole>().notNull().default("member"),
  tokenHash: text("token_hash").notNull().unique(),
  invitedBy: uuid("invited_by").references(() => users.id, { onDelete: "set null" }),
  expiresAt: ts("expires_at").notNull(),
  acceptedAt: ts("accepted_at"),
  acceptedBy: uuid("accepted_by").references(() => users.id, { onDelete: "set null" }),
  revokedAt: ts("revoked_at"),
  createdAt: ts("created_at").notNull().defaultNow(),
});

/* ------------------------------ Colonies and cats ------------------------- */

export const colonies = pgTable("colonies", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  municipalityCode: municipality("municipality_code")
    .notNull()
    .references(() => municipalities.code),
  address: text("address"),
  authorizedAt: ts("authorized_at"),
  authorizedBy: uuid("authorized_by").references(() => users.id, { onDelete: "set null" }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const cats = pgTable("cats", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  colonyId: uuid("colony_id").references(() => colonies.id, { onDelete: "set null" }),
  name: text("name"),
  sex: text("sex").$type<CatSex>().notNull().default("unknown"),
  /** `YYYY-MM-DD`, or null when unknown. */
  birthDate: date("birth_date", { mode: "string" }),
  birthDateApproximate: boolean("birth_date_approximate").notNull().default(false),
  /** Edited by hand; also set when a sterilization action with the cat is done. */
  sterilized: boolean("sterilized").notNull().default(false),
  description: text("description"),
  photoKey: text("photo_key").notNull(),
  latitude: doublePrecision("latitude").notNull(),
  longitude: doublePrecision("longitude").notNull(),
  municipalityCode: municipality("municipality_code")
    .notNull()
    .references(() => municipalities.code),
  address: text("address"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

/* --------------------------------- Actions -------------------------------- */

export const actions = pgTable("actions", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  colonyId: uuid("colony_id").references(() => colonies.id, { onDelete: "set null" }),
  municipalityCode: municipality("municipality_code")
    .notNull()
    .references(() => municipalities.code),
  actionType: text("action_type").$type<ActionType>().notNull(),
  name: text("name").notNull(),
  description: text("description"),
  scheduledAt: ts("scheduled_at").notNull(),
  isUrgent: boolean("is_urgent").notNull().default(false),
  status: text("status").$type<ActionStatus>().notNull().default("planned"),
  validatedAt: ts("validated_at"),
  validatedBy: uuid("validated_by").references(() => users.id, { onDelete: "set null" }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at").notNull().defaultNow(),
});

export const actionCats = pgTable(
  "action_cats",
  {
    actionId: uuid("action_id")
      .notNull()
      .references(() => actions.id, { onDelete: "cascade" }),
    catId: uuid("cat_id")
      .notNull()
      .references(() => cats.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.actionId, t.catId] })],
);

export const actionParticipants = pgTable(
  "action_participants",
  {
    actionId: uuid("action_id")
      .notNull()
      .references(() => actions.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.actionId, t.userId] })],
);

/* ----------------------------- Change proposals --------------------------- */

export const changeProposals = pgTable("change_proposals", {
  id: uuid("id").primaryKey().defaultRandom(),
  targetType: text("target_type").$type<ProposalTarget>().notNull(),
  colonyId: uuid("colony_id").references(() => colonies.id, { onDelete: "cascade" }),
  catId: uuid("cat_id").references(() => cats.id, { onDelete: "cascade" }),
  // Filled in by a BEFORE INSERT trigger from the target; never written by the application
  // (the `default` only makes it optional for inserts: the column has no SQL default).
  targetOrganizationId: uuid("target_organization_id")
    .notNull()
    .default(sql`null`),
  proposedByOrganizationId: uuid("proposed_by_organization_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  proposedBy: uuid("proposed_by").references(() => users.id, { onDelete: "set null" }),
  changes: jsonb("changes").$type<ChangeSet>().notNull(),
  previousValues: jsonb("previous_values").$type<ChangeSet>().notNull().default({}),
  message: text("message"),
  status: text("status").$type<ProposalStatus>().notNull().default("pending"),
  resolutionNote: text("resolution_note"),
  resolvedAt: ts("resolved_at"),
  resolvedBy: uuid("resolved_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: ts("created_at").notNull().defaultNow(),
});

/* ------------------------------ Notifications ----------------------------- */

export const notificationDeliveries = pgTable("notification_deliveries", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  notificationType: text("notification_type").notNull(),
  dedupeKey: text("dedupe_key").notNull().unique(),
  status: text("status").$type<"queued" | "sent" | "failed">().notNull().default("queued"),
  attemptCount: integer("attempt_count").notNull().default(0),
  providerMessageId: text("provider_message_id"),
  errorMessage: text("error_message"),
  createdAt: ts("created_at").notNull().defaultNow(),
  sentAt: ts("sent_at"),
});
