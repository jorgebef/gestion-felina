import { Outlet, createFileRoute, redirect } from "@tanstack/react-router";

import { Logo } from "@/components/brand/Logo";

/** Signed-in users without a company finish their setup here. */
export const Route = createFileRoute("/onboarding")({
  beforeLoad: ({ context, location }) => {
    if (!context.viewer) throw redirect({ to: "/login", search: { redirect: location.href } });
    return { viewer: context.viewer };
  },
  component: OnboardingLayout,
});

function OnboardingLayout() {
  return (
    <div className="min-h-screen">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
          <Logo />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <Outlet />
      </main>
    </div>
  );
}
