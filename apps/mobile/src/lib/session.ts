import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";

import type { Viewer } from "@felina/client/api";

import { authClient } from "./auth-client";
import { viewerQuery } from "./queries";

/** The signed-in viewer, or null when anonymous (undefined while loading). */
export function useViewer(): Viewer | null | undefined {
  return useQuery(viewerQuery).data;
}

/**
 * Viewer and membership on screens behind the "approved organization" guard of the root
 * layout, where both always exist.
 */
export function useMembership() {
  const viewer = useViewer();
  const membership = viewer?.membership;
  if (!viewer || !membership) throw new Error("useMembership() outside the approved area");
  const organization = membership.organization;
  return {
    viewer,
    membership,
    organization,
    isTownHall: organization.kind === "town_hall",
    isAssociation: organization.kind === "association",
    isAdmin: membership.role === "admin",
  };
}

/** Signs out, forgets every cached query and goes back to the start. */
export function useSignOut() {
  const queryClient = useQueryClient();
  return async () => {
    await authClient.signOut();
    queryClient.clear();
    await queryClient.fetchQuery(viewerQuery);
    router.replace("/");
  };
}

/** After signing in, accepting an invitation or registering an organization. */
export async function refreshViewer(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "viewer" });
  await queryClient.invalidateQueries({ queryKey: viewerQuery.queryKey });
}
