import { Link, useRouteContext } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";

import { Logo } from "#/components/brand/Logo";
import LocaleSwitcher from "#/components/LocaleSwitcher";
import { Button } from "#/components/ui/button";
import { m } from "#/paraglide/messages";

export function SiteHeader() {
  const { user } = useRouteContext({ from: "__root__" });

  return (
    <header className="sticky top-0 z-40 border-b border-transparent bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
      <div className="page-container flex h-16 items-center gap-6">
        <Link to="/" aria-label="SpainFolio" className="shrink-0">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 text-sm md:flex">
          <Link
            to="/"
            hash="features"
            className="rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            {m.nav_product()}
          </Link>
          <Link
            to="/opportunities"
            className="rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
            activeProps={{ className: "text-foreground bg-black/[0.04]" }}
          >
            {m.nav_opportunities()}
          </Link>
          <Link
            to="/"
            hash="faq"
            className="rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            {m.nav_faq()}
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <LocaleSwitcher />
          {user ? (
            <Button asChild size="sm" className="rounded-full px-4">
              <Link to="/dashboard">
                {m.nav_dashboard()}
                <ArrowRight />
              </Link>
            </Button>
          ) : (
            <>
              <Button
                asChild
                variant="ghost"
                size="sm"
                className="hidden rounded-full sm:inline-flex"
              >
                <Link to="/login">{m.nav_login()}</Link>
              </Button>
              <Button asChild size="sm" className="rounded-full px-4">
                <Link to="/login" search={{ mode: "signup" }}>
                  {m.nav_get_started()}
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
