import { Link } from "@tanstack/react-router";

import { Logo } from "#/components/brand/Logo";
import LocaleSwitcher from "#/components/LocaleSwitcher";
import { m } from "#/paraglide/messages";

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-24 border-t border-border/80 bg-card/60">
      <div className="page-container grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="max-w-sm space-y-4">
          <Logo />
          <p className="text-sm leading-relaxed text-muted-foreground">{m.footer_tagline()}</p>
        </div>
        <div className="space-y-3 text-sm">
          <p className="eyebrow">{m.footer_product()}</p>
          <ul className="space-y-2">
            <li>
              <Link to="/" hash="features" className="text-muted-foreground hover:text-foreground">
                {m.nav_product()}
              </Link>
            </li>
            <li>
              <Link to="/opportunities" className="text-muted-foreground hover:text-foreground">
                {m.nav_opportunities()}
              </Link>
            </li>
            <li>
              <Link to="/" hash="faq" className="text-muted-foreground hover:text-foreground">
                {m.nav_faq()}
              </Link>
            </li>
          </ul>
        </div>
        <div className="space-y-3 text-sm">
          <p className="eyebrow">{m.footer_account()}</p>
          <ul className="space-y-2">
            <li>
              <Link to="/login" className="text-muted-foreground hover:text-foreground">
                {m.nav_login()}
              </Link>
            </li>
            <li>
              <Link
                to="/login"
                search={{ mode: "signup" }}
                className="text-muted-foreground hover:text-foreground"
              >
                {m.nav_get_started()}
              </Link>
            </li>
            <li>
              <Link to="/dashboard" className="text-muted-foreground hover:text-foreground">
                {m.nav_dashboard()}
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border/70">
        <div className="page-container flex flex-col items-start justify-between gap-3 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center">
          <p>
            © {year} SpainFolio. {m.footer_disclaimer()}
          </p>
          <LocaleSwitcher />
        </div>
      </div>
    </footer>
  );
}
