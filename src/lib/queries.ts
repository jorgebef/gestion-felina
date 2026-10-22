import { queryOptions } from "@tanstack/react-query";

import { getOpportunity, listOpportunities } from "#/server/opportunities";
import { getProperty, listProperties } from "#/server/properties";
import { getAuthConfig, getSessionUser } from "#/server/session";

export const sessionQuery = queryOptions({
  queryKey: ["session"],
  queryFn: () => getSessionUser(),
  staleTime: 60_000,
});

export const authConfigQuery = queryOptions({
  queryKey: ["auth-config"],
  queryFn: () => getAuthConfig(),
  staleTime: Infinity,
});

export const propertiesQuery = queryOptions({
  queryKey: ["properties"],
  queryFn: () => listProperties(),
});

export const propertyQuery = (id: string) =>
  queryOptions({
    queryKey: ["properties", id],
    queryFn: () => getProperty({ data: { id } }),
  });

export const opportunitiesQuery = queryOptions({
  queryKey: ["opportunities"],
  queryFn: () => listOpportunities(),
  staleTime: 5 * 60_000,
});

export const opportunityQuery = (slug: string) =>
  queryOptions({
    queryKey: ["opportunities", slug],
    queryFn: () => getOpportunity({ data: { slug } }),
  });
