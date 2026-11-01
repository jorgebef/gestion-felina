import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { AppShell } from "@/components/app/AppShell";

/** Super-admin area (granted from the CLI: `vp run admin:grant <email>`). */
export const Route = createFileRoute("/admin")({
  beforeLoad: ({ context, location }) => {
    if (!context.viewer) throw redirect({ to: "/login", search: { redirect: location.href } });
    if (!context.viewer.isPlatformAdmin) throw redirect({ to: "/panel" });
    return { viewer: context.viewer };
  },
  component: AdminLayout,
});

function AdminLayout() {
  const { viewer } = Route.useRouteContext();
  return (
    <AppShell viewer={viewer}>
      <Outlet />
    </AppShell>
  );
}
