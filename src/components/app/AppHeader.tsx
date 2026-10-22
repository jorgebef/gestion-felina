import { useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { LogOut, Plus } from "lucide-react";

import { Logo } from "#/components/brand/Logo";
import LocaleSwitcher from "#/components/LocaleSwitcher";
import { Avatar, AvatarFallback, AvatarImage } from "#/components/ui/avatar";
import { Button } from "#/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { authClient } from "#/lib/auth-client";
import { m } from "#/paraglide/messages";
import type { SessionUser } from "#/server/session";

const navItemClass =
  "rounded-full px-4 py-2 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground";
const navActiveClass = "bg-foreground text-white hover:text-white";

export function AppHeader({ user }: { user: SessionUser }) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const signOut = async () => {
    await authClient.signOut();
    queryClient.clear();
    await router.invalidate();
    await router.navigate({ to: "/" });
  };

  const initials = user.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl">
      <div className="page-container flex h-16 items-center gap-4">
        <Link to="/dashboard" aria-label="SpainFolio" className="shrink-0">
          <Logo />
        </Link>

        <nav className="mx-auto hidden items-center gap-1 rounded-full bg-card p-1 shadow-[0_1px_2px_rgba(21,19,15,0.05)] ring-1 ring-border/70 md:flex">
          <AppNav />
        </nav>

        <div className="ml-auto flex items-center gap-1.5 md:ml-0">
          <Button asChild size="sm" className="hidden rounded-full px-4 lg:inline-flex">
            <Link to="/dashboard/properties/new">
              <Plus />
              {m.app_add_property()}
            </Link>
          </Button>
          <LocaleSwitcher />
          <DropdownMenu>
            <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/40">
              <Avatar className="size-9 ring-2 ring-card">
                {user.image ? <AvatarImage src={user.image} alt="" /> : null}
                <AvatarFallback className="bg-foreground text-xs font-medium text-white">
                  {initials || "SF"}
                </AvatarFallback>
              </Avatar>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 rounded-xl">
              <DropdownMenuLabel className="font-normal">
                <p className="truncate text-sm font-medium">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild className="rounded-lg">
                <Link to="/dashboard/properties/new">
                  <Plus />
                  {m.app_add_property()}
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="rounded-lg" onSelect={() => void signOut()}>
                <LogOut />
                {m.app_sign_out()}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <nav className="page-container -mt-1 flex gap-1 overflow-x-auto pb-2 md:hidden">
        <AppNav />
      </nav>
    </header>
  );
}

function AppNav() {
  return (
    <>
      <Link
        to="/dashboard"
        activeOptions={{ exact: true }}
        className={navItemClass}
        activeProps={{ className: navActiveClass }}
      >
        {m.app_nav_overview()}
      </Link>
      <Link
        to="/dashboard/properties"
        className={navItemClass}
        activeProps={{ className: navActiveClass }}
      >
        {m.app_nav_properties()}
      </Link>
      <Link to="/opportunities" className={navItemClass}>
        {m.nav_opportunities()}
      </Link>
    </>
  );
}
