import { useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import {
  BellRing,
  Bookmark,
  Building2,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  Target,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import type { Viewer } from "@/lib/api";

interface NavItem {
  to:
    | "/dashboard"
    | "/oportunidades"
    | "/licitaciones"
    | "/mis-licitaciones"
    | "/alertas"
    | "/ajustes";
  label: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Panel", icon: LayoutDashboard },
  { to: "/oportunidades", label: "Oportunidades", icon: Target },
  { to: "/licitaciones", label: "Buscador", icon: Search },
  { to: "/mis-licitaciones", label: "Mis licitaciones", icon: Bookmark },
  { to: "/alertas", label: "Alertas", icon: BellRing },
  { to: "/ajustes", label: "Ajustes", icon: Settings },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Principal" className="grid gap-0.5">
      {NAV.map((item) => (
        <Link
          key={item.to}
          to={item.to}
          onClick={onNavigate}
          className="group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          activeProps={{
            className:
              "bg-sidebar-accent text-sidebar-accent-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          }}
          activeOptions={{ includeSearch: false }}
        >
          <item.icon className="size-4 shrink-0" />
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

function UserMenu({ viewer, compact = false }: { viewer: Viewer; compact?: boolean }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const initials = (viewer.user.name || viewer.user.email).slice(0, 1).toUpperCase();

  const signOut = async () => {
    await authClient.signOut();
    queryClient.clear();
    await router.invalidate();
    await router.navigate({ to: "/" });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-accent",
            compact && "w-auto",
          )}
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
            {initials}
          </span>
          {!compact ? (
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">
                {viewer.company?.name ?? "Sin empresa"}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {viewer.user.email}
              </span>
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-medium">
            {viewer.user.name || "Mi cuenta"}
          </span>
          <span className="block truncate text-xs text-muted-foreground">{viewer.user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/ajustes">
            <Building2 />
            Empresa y cuenta
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => void signOut()}>
          <LogOut />
          Cerrar sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({ viewer, children }: { viewer: Viewer; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_1fr]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r bg-sidebar px-3 py-4 lg:flex">
        <Link to="/dashboard" className="mb-6 px-2" aria-label="Ir al panel">
          <Logo />
        </Link>
        <NavLinks />
        <div className="mt-auto border-t pt-3">
          <UserMenu viewer={viewer} />
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/90 px-4 backdrop-blur lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Abrir menú">
                <Menu />
              </Button>
            </SheetTrigger>
            <SheetContent className="px-3 py-4">
              <SheetTitle className="mb-1 px-2">
                <Logo />
              </SheetTitle>
              <SheetDescription className="sr-only">Navegación principal</SheetDescription>
              <div className="mt-5">
                <NavLinks onNavigate={() => setOpen(false)} />
              </div>
              <div className="mt-auto border-t pt-3">
                <UserMenu viewer={viewer} />
              </div>
            </SheetContent>
          </Sheet>
          <Link to="/dashboard" aria-label="Ir al panel">
            <Logo />
          </Link>
          <UserMenu viewer={viewer} compact />
        </header>
        <main className="page-container py-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
