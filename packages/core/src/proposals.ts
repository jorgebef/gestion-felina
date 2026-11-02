/**
 * Change proposals. Town halls never edit colonies or cats: they propose changes, and an
 * admin of the managing association accepts (the changes are applied) or rejects them.
 */
import { and, desc, eq, or, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";

import {
  cats,
  changeProposals,
  colonies,
  getDb,
  organizationMembers,
  organizations,
  users,
  withTenant,
  type ChangeSet,
} from "@felina/db";
import { catDisplayName, type ProposalTarget } from "@felina/domain/felina";
import { sendSafely } from "@felina/notifications/mailer";
import {
  appUrl,
  proposalReceivedEmail,
  proposalResolvedEmail,
} from "@felina/notifications/templates";
import {
  catChangesSchema,
  colonyChangesSchema,
  type CatChanges,
  type ColonyChanges,
  type ProposalListQuery,
  type ProposalResolution,
} from "@felina/schemas/proposal";

import {
  assertAdmin,
  assertAssociation,
  assertTownHall,
  DomainError,
  mapDbError,
  type OrgContext,
} from "./context.ts";

type Changes = ColonyChanges | CatChanges;

/** Keeps only the fields that differ from the current values. */
function diff(current: Record<string, unknown>, changes: Changes) {
  const changed: ChangeSet = {};
  const previous: ChangeSet = {};
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) continue;
    const before = current[key] ?? null;
    if (before === value) continue;
    changed[key] = value as ChangeSet[string];
    previous[key] = before as ChangeSet[string];
  }
  if (!Object.keys(changed).length) {
    throw new DomainError("VALIDATION", "No hay cambios respecto a los datos actuales");
  }
  return { changed, previous };
}

function targetUrl(type: ProposalTarget, id: string) {
  return appUrl(type === "colony" ? `/colonias/${id}` : `/gatos/${id}`);
}

async function notifyAssociationAdmins(
  organizationId: string,
  townHallName: string,
  targetLabel: string,
  url: string,
) {
  const admins = await getDb()
    .select({ email: users.email })
    .from(organizationMembers)
    .innerJoin(users, eq(users.id, organizationMembers.userId))
    .where(
      and(
        eq(organizationMembers.organizationId, organizationId),
        eq(organizationMembers.role, "admin"),
      ),
    );
  await Promise.all(
    admins.map((a) =>
      sendSafely(proposalReceivedEmail({ to: a.email, townHallName, targetLabel, url })),
    ),
  );
}

export async function proposeColonyChange(
  ctx: OrgContext,
  colonyId: string,
  input: { changes: ColonyChanges; message: string | null },
) {
  assertTownHall(ctx);
  const result = await withTenant(ctx.user.id, async (tx) => {
    const [colony] = await tx
      .select({
        name: colonies.name,
        description: colonies.description,
        address: colonies.address,
        municipalityCode: colonies.municipalityCode,
        latitude: colonies.latitude,
        longitude: colonies.longitude,
        organizationId: colonies.organizationId,
      })
      .from(colonies)
      .where(eq(colonies.id, colonyId));
    if (!colony) throw new DomainError("NOT_FOUND", "La colonia no existe o no es de tu municipio");
    const { changed, previous } = diff(colony, input.changes);
    const [row] = await tx
      .insert(changeProposals)
      .values({
        targetType: "colony",
        colonyId,
        proposedByOrganizationId: ctx.membership.organization.id,
        proposedBy: ctx.user.id,
        changes: changed,
        previousValues: previous,
        message: input.message,
      })
      .returning({ id: changeProposals.id });
    return {
      id: row!.id,
      organizationId: colony.organizationId,
      label: `la colonia «${colony.name}»`,
    };
  }).catch((error) =>
    mapDbError(error, { FORBIDDEN: "Solo puedes proponer cambios en colonias de tu municipio" }),
  );
  await notifyAssociationAdmins(
    result.organizationId,
    ctx.membership.organization.name,
    result.label,
    targetUrl("colony", colonyId),
  );
  return { id: result.id };
}

export async function proposeCatChange(
  ctx: OrgContext,
  catId: string,
  input: { changes: CatChanges; message: string | null },
) {
  assertTownHall(ctx);
  const result = await withTenant(ctx.user.id, async (tx) => {
    const [cat] = await tx
      .select({
        name: cats.name,
        sex: cats.sex,
        birthDate: cats.birthDate,
        birthDateApproximate: cats.birthDateApproximate,
        sterilized: cats.sterilized,
        description: cats.description,
        address: cats.address,
        municipalityCode: cats.municipalityCode,
        latitude: cats.latitude,
        longitude: cats.longitude,
        organizationId: cats.organizationId,
      })
      .from(cats)
      .where(eq(cats.id, catId));
    if (!cat) throw new DomainError("NOT_FOUND", "El gato no existe o no es de tu municipio");
    const { changed, previous } = diff(cat, input.changes);
    const [row] = await tx
      .insert(changeProposals)
      .values({
        targetType: "cat",
        catId,
        proposedByOrganizationId: ctx.membership.organization.id,
        proposedBy: ctx.user.id,
        changes: changed,
        previousValues: previous,
        message: input.message,
      })
      .returning({ id: changeProposals.id });
    return {
      id: row!.id,
      organizationId: cat.organizationId,
      label: `el gato «${catDisplayName(cat)}»`,
    };
  }).catch((error) =>
    mapDbError(error, { FORBIDDEN: "Solo puedes proponer cambios en gatos de tu municipio" }),
  );
  await notifyAssociationAdmins(
    result.organizationId,
    ctx.membership.organization.name,
    result.label,
    targetUrl("cat", catId),
  );
  return { id: result.id };
}

const proposer = alias(organizations, "proposer");
const target = alias(organizations, "target");

export function listProposals(
  ctx: OrgContext,
  query: ProposalListQuery & { colonyId?: string; catId?: string },
) {
  return withTenant(ctx.user.id, (tx) => {
    const orgId = ctx.membership.organization.id;
    const filters: (SQL | undefined)[] = [
      or(
        eq(changeProposals.targetOrganizationId, orgId),
        eq(changeProposals.proposedByOrganizationId, orgId),
      ),
      query.status ? eq(changeProposals.status, query.status) : undefined,
      query.colonyId ? eq(changeProposals.colonyId, query.colonyId) : undefined,
      query.catId ? eq(changeProposals.catId, query.catId) : undefined,
    ];
    return tx
      .select({
        id: changeProposals.id,
        targetType: changeProposals.targetType,
        colonyId: changeProposals.colonyId,
        catId: changeProposals.catId,
        colonyName: colonies.name,
        catName: cats.name,
        targetOrganizationName: target.name,
        proposedByOrganizationName: proposer.name,
        changes: changeProposals.changes,
        previousValues: changeProposals.previousValues,
        message: changeProposals.message,
        status: changeProposals.status,
        resolutionNote: changeProposals.resolutionNote,
        resolvedAt: changeProposals.resolvedAt,
        createdAt: changeProposals.createdAt,
        incoming: eq(changeProposals.targetOrganizationId, orgId).mapWith(Boolean),
      })
      .from(changeProposals)
      .leftJoin(colonies, eq(colonies.id, changeProposals.colonyId))
      .leftJoin(cats, eq(cats.id, changeProposals.catId))
      .leftJoin(proposer, eq(proposer.id, changeProposals.proposedByOrganizationId))
      .leftJoin(target, eq(target.id, changeProposals.targetOrganizationId))
      .where(and(...filters))
      .orderBy(desc(changeProposals.createdAt))
      .limit(200);
  });
}

export async function resolveProposal(ctx: OrgContext, id: string, input: ProposalResolution) {
  assertAssociation(ctx);
  assertAdmin(ctx);
  const resolved = await withTenant(ctx.user.id, async (tx) => {
    const [proposal] = await tx
      .select()
      .from(changeProposals)
      .where(
        and(
          eq(changeProposals.id, id),
          eq(changeProposals.targetOrganizationId, ctx.membership.organization.id),
          eq(changeProposals.status, "pending"),
        ),
      )
      .for("update");
    if (!proposal) throw new DomainError("NOT_FOUND", "La propuesta no existe o ya está resuelta");

    let label: string;
    if (proposal.targetType === "colony") {
      const changes = colonyChangesSchema.parse(proposal.changes);
      if (input.decision === "accept") {
        await tx.update(colonies).set(changes).where(eq(colonies.id, proposal.colonyId!));
      }
      const [row] = await tx
        .select({ name: colonies.name })
        .from(colonies)
        .where(eq(colonies.id, proposal.colonyId!));
      label = `la colonia «${row?.name ?? ""}»`;
    } else {
      const changes = catChangesSchema.parse(proposal.changes);
      if (input.decision === "accept") {
        await tx.update(cats).set(changes).where(eq(cats.id, proposal.catId!));
      }
      const [row] = await tx
        .select({ name: cats.name })
        .from(cats)
        .where(eq(cats.id, proposal.catId!));
      label = `el gato «${catDisplayName({ name: row?.name ?? null })}»`;
    }

    await tx
      .update(changeProposals)
      .set({
        status: input.decision === "accept" ? "accepted" : "rejected",
        resolutionNote: input.note,
        resolvedAt: new Date(),
        resolvedBy: ctx.user.id,
      })
      .where(eq(changeProposals.id, id));
    return { proposal, label };
  }).catch((error) =>
    mapDbError(error, { VALIDATION: "Los cambios propuestos ya no son válidos" }),
  );

  if (resolved.proposal.proposedBy) {
    const [author] = await getDb()
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, resolved.proposal.proposedBy));
    if (author) {
      const targetId = resolved.proposal.colonyId ?? resolved.proposal.catId!;
      await sendSafely(
        proposalResolvedEmail({
          to: author.email,
          targetLabel: resolved.label,
          accepted: input.decision === "accept",
          note: input.note,
          url: targetUrl(resolved.proposal.targetType, targetId),
        }),
      );
    }
  }
  return { ok: true as const };
}

export async function withdrawProposal(ctx: OrgContext, id: string) {
  return withTenant(ctx.user.id, async (tx) => {
    const updated = await tx
      .update(changeProposals)
      .set({ status: "withdrawn" })
      .where(
        and(
          eq(changeProposals.id, id),
          eq(changeProposals.proposedByOrganizationId, ctx.membership.organization.id),
          eq(changeProposals.status, "pending"),
        ),
      )
      .returning({ id: changeProposals.id });
    if (!updated.length)
      throw new DomainError("NOT_FOUND", "La propuesta no existe o ya está resuelta");
    return { ok: true as const };
  });
}
