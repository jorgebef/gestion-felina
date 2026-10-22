import { cn } from "#/lib/utils";

/** An arch over three steps: a nod to Spanish arcades and a rising portfolio. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8", className)}>
      <rect width="32" height="32" rx="10" fill="currentColor" />
      <path
        d="M9 23V15.5a7 7 0 0 1 14 0V23"
        fill="none"
        stroke="var(--logo-accent, #f3a25a)"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
      <path d="M13 23v-3h2.6v-2.4h2.8V23" fill="#ffffff" />
    </svg>
  );
}

export function Logo({
  className,
  tone = "dark",
}: {
  className?: string;
  tone?: "dark" | "light";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 text-[17px] font-semibold tracking-tight",
        tone === "light" ? "text-white" : "text-foreground",
        className,
      )}
    >
      <LogoMark className={tone === "light" ? "text-white/15" : "text-foreground"} />
      <span>
        Spain<span className={tone === "light" ? "text-white/70" : "text-brand"}>Folio</span>
      </span>
    </span>
  );
}
