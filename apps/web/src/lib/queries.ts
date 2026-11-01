import { queryOptions } from "@tanstack/react-query";

import type { WorkflowStatusValue } from "@licita/domain/tenders";
import type { MatchListQuery } from "@licita/schemas/matches";
import type { TenderSearch } from "@licita/schemas/tender-search";

import { api } from "./api";

export const viewerQuery = queryOptions({
  queryKey: ["viewer"],
  queryFn: () => api().me.get(),
  staleTime: 60_000,
});

export const authConfigQuery = queryOptions({
  queryKey: ["auth-config"],
  queryFn: () => api().public.authConfig(),
  staleTime: Infinity,
});

export const publicStatsQuery = queryOptions({
  queryKey: ["public-stats"],
  queryFn: () => api().public.stats(),
  staleTime: 5 * 60_000,
});

export const dashboardQuery = queryOptions({
  queryKey: ["dashboard"],
  queryFn: () => api().dashboard.get(),
});

export const matchesQuery = (search: MatchListQuery) =>
  queryOptions({
    queryKey: ["matches", search],
    queryFn: () => api().matches.list(search),
  });

export const tenderSearchQuery = (search: TenderSearch) =>
  queryOptions({
    queryKey: ["tenders", "search", search],
    queryFn: () => api().tenders.search(search),
    placeholderData: (previous) => previous,
  });

export const tenderQuery = (id: string) =>
  queryOptions({
    queryKey: ["tenders", id],
    queryFn: () => api().tenders.get(id),
  });

export const trackedListQuery = (status?: WorkflowStatusValue) =>
  queryOptions({
    queryKey: ["tracked", status ?? "all"],
    queryFn: () => api().tracked.list({ status }),
  });

export const trackedDetailQuery = (tenderId: string) =>
  queryOptions({
    queryKey: ["tracked", "detail", tenderId],
    queryFn: () => api().tenders.tracking(tenderId),
  });

export const alertProfilesQuery = queryOptions({
  queryKey: ["alert-profiles"],
  queryFn: () => api().alertProfiles.list(),
});

export const alertProfileQuery = (id: string) =>
  queryOptions({
    queryKey: ["alert-profiles", id],
    queryFn: () => api().alertProfiles.get(id),
  });

export const companySettingsQuery = queryOptions({
  queryKey: ["company-settings"],
  queryFn: () => api().companies.current(),
});

export const deliveriesQuery = queryOptions({
  queryKey: ["deliveries"],
  queryFn: () => api().notifications.list(),
});
