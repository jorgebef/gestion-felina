import { queryOptions } from "@tanstack/react-query";

import type { ActionListQuery } from "@felina/schemas/action";
import type { CatListQuery } from "@felina/schemas/cat";
import type { ColonyListQuery } from "@felina/schemas/colony";
import type { OrganizationListQuery } from "@felina/schemas/organization";
import type { ProposalStatus } from "@felina/domain/felina";

import { api } from "./api";

export const viewerQuery = queryOptions({
  queryKey: ["viewer"],
  queryFn: () => api().me.get(),
  staleTime: 60_000,
});

export const profileQuery = queryOptions({
  queryKey: ["viewer", "profile"],
  queryFn: () => api().me.profile(),
});

export const authConfigQuery = queryOptions({
  queryKey: ["auth-config"],
  queryFn: () => api().public.authConfig(),
  staleTime: Infinity,
});

export const invitationQuery = (token: string) =>
  queryOptions({
    queryKey: ["invitation", token],
    queryFn: () => api().public.invitation(token),
  });

export const dashboardQuery = queryOptions({
  queryKey: ["dashboard"],
  queryFn: () => api().dashboard.get(),
});

export const coloniesQuery = (query: ColonyListQuery = {}) =>
  queryOptions({
    queryKey: ["colonies", "list", query],
    queryFn: () => api().colonies.list(query),
  });

export const colonyQuery = (id: string) =>
  queryOptions({
    queryKey: ["colonies", id],
    queryFn: () => api().colonies.get(id),
  });

export const colonyOptionsQuery = queryOptions({
  queryKey: ["colonies", "options"],
  queryFn: () => api().colonies.options(),
});

export const catsQuery = (query: CatListQuery = {}) =>
  queryOptions({
    queryKey: ["cats", "list", query],
    queryFn: () => api().cats.list(query),
  });

export const catQuery = (id: string) =>
  queryOptions({
    queryKey: ["cats", id],
    queryFn: () => api().cats.get(id),
  });

export const catOptionsQuery = queryOptions({
  queryKey: ["cats", "options"],
  queryFn: () => api().actions.catOptions(),
});

export const actionsQuery = (query: Partial<ActionListQuery> = {}) =>
  queryOptions({
    queryKey: ["actions", "list", query],
    queryFn: () => api().actions.list(query),
  });

export const actionQuery = (id: string) =>
  queryOptions({
    queryKey: ["actions", id],
    queryFn: () => api().actions.get(id),
  });

export const proposalsQuery = (
  query: { status?: ProposalStatus; colonyId?: string; catId?: string } = {},
) =>
  queryOptions({
    queryKey: ["proposals", query],
    queryFn: () => api().proposals.list(query),
  });

export const organizationQuery = queryOptions({
  queryKey: ["organization"],
  queryFn: () => api().organizations.current(),
});

export const membersQuery = queryOptions({
  queryKey: ["organization", "members"],
  queryFn: () => api().organizations.members(),
});

export const invitationsQuery = queryOptions({
  queryKey: ["organization", "invitations"],
  queryFn: () => api().organizations.invitations(),
});

export const adminOrganizationsQuery = (query: OrganizationListQuery = {}) =>
  queryOptions({
    queryKey: ["admin", "organizations", query],
    queryFn: () => api().admin.organizations(query),
  });

export const adminOrganizationQuery = (id: string) =>
  queryOptions({
    queryKey: ["admin", "organizations", id],
    queryFn: () => api().admin.organization(id),
  });
