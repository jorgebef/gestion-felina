import { cn } from "@/lib/utils";

export const APP_NAME = "Licita";

/** A document with a rising signal line: public tenders, surfaced early. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8", className)}>
      <rect width="32" height="32" rx="8" fill="var(--brand)" />
      <path d="M10 8h9l4 4v12H10z" fill="#ffffff" opacity="0.95" />
      <path
        d="M12.5 20.5l3-3.2 2.2 2 3.3-4"
        fill="none"
        stroke="var(--brand)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-[17px] font-semibold tracking-tight text-foreground",
        className,
      )}
    >
      <LogoMark className="size-7" />
      {APP_NAME}
    </span>
  );
}
