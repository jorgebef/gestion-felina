// Locale switcher refs:
// - Paraglide docs: https://inlang.com/m/gerre34r/library-inlang-paraglideJs
// - Router example: https://github.com/TanStack/router/tree/main/examples/react/i18n-paraglide#switching-locale
import { Check, Globe } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { cn } from "#/lib/utils";
import { m } from "#/paraglide/messages";
import { getLocale, locales, setLocale } from "#/paraglide/runtime";

const LOCALE_NAMES: Record<(typeof locales)[number], string> = {
  en: "English",
  es: "Español",
};

export default function LocaleSwitcher({
  tone = "dark",
  className,
}: {
  tone?: "dark" | "light";
  className?: string;
}) {
  const currentLocale = getLocale();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={m.language_label()}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium tracking-wide uppercase transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
          tone === "light"
            ? "text-white/80 hover:bg-white/10 hover:text-white"
            : "text-muted-foreground hover:bg-black/5 hover:text-foreground",
          className,
        )}
      >
        <Globe className="size-3.5" strokeWidth={1.8} />
        {currentLocale}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-36 rounded-xl">
        {locales.map((locale) => (
          <DropdownMenuItem
            key={locale}
            onSelect={() => {
              if (locale !== currentLocale) void setLocale(locale);
            }}
            className="justify-between rounded-lg"
          >
            <span>{LOCALE_NAMES[locale]}</span>
            {locale === currentLocale ? <Check className="size-3.5" /> : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
