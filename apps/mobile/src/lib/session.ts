import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Href } from "expo-router";

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

/**
 * Signs out and forgets every cached query. No navigation here: once the viewer is null,
 * the root layout's `Stack.Protected` guards send the person to the login screen.
 */
export function useSignOut() {
  const queryClient = useQueryClient();
  return async () => {
    await authClient.signOut();
    // Set (rather than clear) the viewer so the root navigator stays mounted.
    queryClient.setQueryData(viewerQuery.queryKey, null);
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "viewer" });
  };
}

/** Where each person starts, like the web app's `/`. */
export function homeHref(viewer: Viewer | null): Href {
  if (!viewer) return "/login";
  if (viewer.membership?.organization.status === "approved") return "/panel";
  if (viewer.isPlatformAdmin && !viewer.membership) return "/admin";
  return "/onboarding";
}

/**
 * After signing in, accepting an invitation or changing organization. Returns the fresh
 * viewer. If the current screen is now behind a `Stack.Protected` guard, the root layout
 * moves away from it by itself; navigating here as well races with that redirect and can
 * loop ("Maximum update depth exceeded" on iOS). Screens that stay reachable navigate to
 * `homeHref(viewer)` directly instead of going through `/`.
 */
export async function refreshViewer(
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<Viewer | null> {
  queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "viewer" });
  await queryClient.invalidateQueries({ queryKey: viewerQuery.queryKey });
  return queryClient.getQueryData(viewerQuery.queryKey) ?? null;
}
