import { useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import {
  Cat,
  ClipboardList,
  GitPullRequestArrow,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Menu,
  Newspaper,
  Settings,
  ShieldCheck,
  Trash2,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useState, type ReactNode } from "react";

import { ORGANIZATION_KIND_LABELS } from "@felina/domain/felina";

import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
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

type NavTarget =
  | "/panel"
  | "/feed"
  | "/colonias"
  | "/gatos"
  | "/acciones"
  | "/propuestas"
  | "/eliminaciones"
  | "/equipo"
  | "/ajustes"
  | "/admin";

interface NavItem {
  to: NavTarget;
  label: string;
  icon: LucideIcon;
}

function navFor(viewer: Viewer): NavItem[] {
  const kind = viewer.membership?.organization.kind;
  const items: NavItem[] = [];
  if (viewer.membership?.organization.status === "approved") {
    items.push({ to: "/panel", label: "Panel", icon: LayoutDashboard });
    if (kind === "town_hall")
      items.push({ to: "/feed", label: "Feed de acciones", icon: Newspaper });
    items.push(
      { to: "/colonias", label: "Colonias", icon: MapPinned },
      { to: "/gatos", label: "Gatos", icon: Cat },
    );
    if (kind === "association")
      items.push({ to: "/acciones", label: "Acciones", icon: ClipboardList });
    items.push({ to: "/propuestas", label: "Propuestas", icon: GitPullRequestArrow });
    if (kind === "association")
      items.push({ to: "/eliminaciones", label: "Eliminaciones", icon: Trash2 });
    items.push(
      { to: "/equipo", label: "Equipo", icon: Users },
      { to: "/ajustes", label: "Ajustes", icon: Settings },
    );
  }
  if (viewer.isPlatformAdmin) items.push({ to: "/admin", label: "Superadmin", icon: ShieldCheck });
  return items;
}

function NavLinks({ viewer, onNavigate }: { viewer: Viewer; onNavigate?: () => void }) {
  return (
    <nav aria-label="Principal" className="grid gap-0.5">
      {navFor(viewer).map((item) => (
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
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-accent",
              compact && "w-auto",
            )}
          />
        }
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
          {initials}
        </span>
        {!compact ? (
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">
              {viewer.membership?.organization.name ?? "Sin organización"}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {viewer.user.email}
            </span>
          </span>
        ) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {/* Base UI menu labels must live inside a group. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="font-normal">
            <span className="block truncate text-sm font-medium">
              {viewer.user.name || "Mi cuenta"}
            </span>
            <span className="block truncate text-xs text-muted-foreground">
              {viewer.user.email}
            </span>
            {viewer.membership ? (
              <span className="mt-1 block truncate text-xs text-muted-foreground">
                {ORGANIZATION_KIND_LABELS[viewer.membership.organization.kind]} ·{" "}
                {viewer.membership.organization.name}
              </span>
            ) : null}
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link to="/perfil" />}>
          <UserRound />
          Mi perfil
        </DropdownMenuItem>
        {viewer.membership?.organization.status === "approved" ? (
          <DropdownMenuItem render={<Link to="/ajustes" />}>
            <Settings />
            Ajustes de la organización
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => void signOut()}>
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
        <Link to="/" className="mb-6 px-2" aria-label="Ir al panel">
          <Logo />
        </Link>
        <NavLinks viewer={viewer} />
        <div className="mt-auto border-t pt-3">
          <UserMenu viewer={viewer} />
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/90 px-4 backdrop-blur lg:hidden">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger render={<Button variant="ghost" size="icon" aria-label="Abrir menú" />}>
              <Menu />
            </SheetTrigger>
            <SheetContent side="left" className="w-[85vw] max-w-xs gap-0 px-3 py-4">
              <SheetTitle className="mb-1 px-2">
                <Logo />
              </SheetTitle>
              <SheetDescription className="sr-only">Navegación principal</SheetDescription>
              <div className="mt-5">
                <NavLinks viewer={viewer} onNavigate={() => setOpen(false)} />
              </div>
              <div className="mt-auto border-t pt-3">
                <UserMenu viewer={viewer} />
              </div>
            </SheetContent>
          </Sheet>
          <Link to="/panel" aria-label="Ir al panel">
            <Logo />
          </Link>
          <UserMenu viewer={viewer} compact />
        </header>
        <main className="page-container py-6 sm:py-8">{children}</main>
      </div>
    </div>
  );
}
