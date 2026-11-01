import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { AppShell } from "@/components/app/AppShell";

/** Private area: requires a session and a company (otherwise → login / onboarding). */
export const Route = createFileRoute("/_app")({
  beforeLoad: ({ context, location }) => {
    if (!context.viewer) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    if (!context.viewer.company) throw redirect({ to: "/onboarding" });
    return { viewer: context.viewer, company: context.viewer.company };
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
