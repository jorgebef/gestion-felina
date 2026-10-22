import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { AppHeader } from "#/components/app/AppHeader";
import { m } from "#/paraglide/messages";

export const Route = createFileRoute("/dashboard")({
  beforeLoad: ({ context, location }) => {
    if (!context.user) {
      throw redirect({ to: "/login", search: { redirect: location.href } });
    }
    return { user: context.user };
  },
  head: () => ({ meta: [{ title: `${m.app_nav_overview()} · SpainFolio` }] }),
  component: DashboardLayout,
});

function DashboardLayout() {
  const { user } = Route.useRouteContext();
  return (
    <div className="min-h-screen pb-20">
      <AppHeader user={user} />
      <Outlet />
    </div>
  );
}
