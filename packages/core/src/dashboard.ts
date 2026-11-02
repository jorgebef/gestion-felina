/** Home page figures. Associations see their own work; town halls their municipality. */
import { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, or, sql } from "drizzle-orm";

import {
  actions,
  cats,
  changeProposals,
  colonies,
  inSequence,
  organizationMembers,
  organizations,
  withTenant,
} from "@felina/db";
import { madridDayBounds } from "@felina/domain/time";

import { isTownHall, type OrgContext } from "./context.ts";

const actionColumns = {
  id: actions.id,
  name: actions.name,
  actionType: actions.actionType,
  status: actions.status,
  scheduledAt: actions.scheduledAt,
  isUrgent: actions.isUrgent,
  validatedAt: actions.validatedAt,
  colonyName: colonies.name,
  organizationId: actions.organizationId,
  organizationName: organizations.name,
  organizationAvatar: organizations.avatarKey,
};

export function getDashboard(ctx: OrgContext) {
  return withTenant(ctx.user.id, async (tx) => {
    const org = ctx.membership.organization;
    const town = org.municipalityCode ?? "";
    const townHall = isTownHall(ctx);
    const today = madridDayBounds(new Date()).start;

    const colonyScope = townHall
      ? eq(colonies.municipalityCode, town)
      : eq(colonies.organizationId, org.id);
    const catScope = townHall
      ? or(eq(cats.municipalityCode, town), eq(colonies.municipalityCode, town))
      : eq(cats.organizationId, org.id);
    const actionScope = townHall
      ? eq(actions.municipalityCode, town)
      : eq(actions.organizationId, org.id);
    const open = inArray(actions.status, ["planned", "in_progress"]);

    const [
      [colonyStats],
      [catStats],
      [actionStats],
      upcoming,
      recent,
      [proposalStats],
      [memberStats],
    ] = await inSequence([
      tx
        .select({
          total: count(),
          authorized:
            sql<number>`count(*) filter (where ${colonies.authorizedAt} is not null)`.mapWith(
              Number,
            ),
        })
        .from(colonies)
        .where(colonyScope),
      tx
        .select({
          total: count(),
          sterilized: sql<number>`count(*) filter (where ${cats.sterilized})`.mapWith(Number),
          withoutColony: sql<number>`count(*) filter (where ${cats.colonyId} is null)`.mapWith(
            Number,
          ),
        })
        .from(cats)
        .leftJoin(colonies, eq(colonies.id, cats.colonyId))
        .where(catScope),
      tx
        .select({
          open: sql<number>`count(*) filter (where ${open})`.mapWith(Number),
          urgentOpen: sql<number>`count(*) filter (where ${open} and ${actions.isUrgent})`.mapWith(
            Number,
          ),
          pendingValidation: sql<number>`count(*) filter (where ${actions.validatedAt} is null
            and ${actions.status} <> 'cancelled')`.mapWith(Number),
          doneThisYear: sql<number>`count(*) filter (where ${actions.status} = 'done'
            and ${actions.scheduledAt} >= date_trunc('year', now()))`.mapWith(Number),
        })
        .from(actions)
        .where(actionScope),
      tx
        .select(actionColumns)
        .from(actions)
        .leftJoin(colonies, eq(colonies.id, actions.colonyId))
        .leftJoin(organizations, eq(organizations.id, actions.organizationId))
        .where(and(actionScope, open, gte(actions.scheduledAt, today)))
        .orderBy(desc(actions.isUrgent), asc(actions.scheduledAt))
        .limit(8),
      // Town halls: latest actions in the feed waiting for validation.
      townHall
        ? tx
            .select(actionColumns)
            .from(actions)
            .leftJoin(colonies, eq(colonies.id, actions.colonyId))
            .leftJoin(organizations, eq(organizations.id, actions.organizationId))
            .where(and(actionScope, isNull(actions.validatedAt)))
            .orderBy(desc(actions.createdAt))
            .limit(8)
        : tx
            .select(actionColumns)
            .from(actions)
            .leftJoin(colonies, eq(colonies.id, actions.colonyId))
            .leftJoin(organizations, eq(organizations.id, actions.organizationId))
            .where(and(actionScope, isNotNull(actions.validatedAt)))
            .orderBy(desc(actions.validatedAt))
            .limit(5),
      tx
        .select({ pending: count() })
        .from(changeProposals)
        .where(
          and(
            eq(changeProposals.status, "pending"),
            townHall
              ? eq(changeProposals.proposedByOrganizationId, org.id)
              : eq(changeProposals.targetOrganizationId, org.id),
          ),
        ),
      tx
        .select({ total: count() })
        .from(organizationMembers)
        .where(eq(organizationMembers.organizationId, org.id)),
    ]);

    return {
      kind: org.kind,
      colonies: { total: colonyStats?.total ?? 0, authorized: colonyStats?.authorized ?? 0 },
      cats: {
        total: catStats?.total ?? 0,
        sterilized: catStats?.sterilized ?? 0,
        withoutColony: catStats?.withoutColony ?? 0,
      },
      actions: {
        open: actionStats?.open ?? 0,
        urgentOpen: actionStats?.urgentOpen ?? 0,
        pendingValidation: actionStats?.pendingValidation ?? 0,
        doneThisYear: actionStats?.doneThisYear ?? 0,
      },
      upcoming,
      recent,
      pendingProposals: proposalStats?.pending ?? 0,
      members: memberStats?.total ?? 0,
    };
  });
}
