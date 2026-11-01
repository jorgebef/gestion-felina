import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { AppShell } from "@/components/app/AppShell";

/**
 * Private area: requires a session and an approved organization (otherwise → login /
 * onboarding). Exposes the membership to every page.
 */
export const Route = createFileRoute("/_app")({
  beforeLoad: ({ context, location }) => {
    if (!context.viewer) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    const membership = context.viewer.membership;
    if (!membership || membership.organization.status !== "approved") {
      if (context.viewer.isPlatformAdmin && !membership) throw redirect({ to: "/admin" });
      throw redirect({ to: "/onboarding" });
    }
    return { viewer: context.viewer, membership };
  },
  component: AppLayout,
});

function AppLayout() {
  const { viewer } = Route.useRouteContext();
  return (
    <AppShell viewer={viewer}>
      <Outlet />
    </AppShell>
  );
}
