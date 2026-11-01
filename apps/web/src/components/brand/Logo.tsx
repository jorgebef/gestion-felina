import { cn } from "@/lib/utils";

export const APP_NAME = "GestiónFelina";

/** A cat's head: ears, eyes and whiskers on the brand colour. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn("size-8", className)}>
      <rect width="32" height="32" rx="8" fill="var(--brand)" />
      <path
        d="M8.5 23.5V11l4.2 3.6h6.6l4.2-3.6v12.5c0 1.6-1.3 2.5-2.9 2.5H11.4c-1.6 0-2.9-.9-2.9-2.5z"
        fill="#ffffff"
      />
      <circle cx="13" cy="19" r="1.3" fill="var(--brand)" />
      <circle cx="19" cy="19" r="1.3" fill="var(--brand)" />
      <path
        d="M16 21.3v1.2M4.5 20.5l4 .6M4.5 23.5l4-.6M27.5 20.5l-4 .6M27.5 23.5l-4-.6"
        stroke="var(--brand)"
        strokeWidth="1"
        strokeLinecap="round"
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

export const FAVICON =
  "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='8' fill='%23b4530a'/><path d='M8.5 23.5V11l4.2 3.6h6.6l4.2-3.6v12.5c0 1.6-1.3 2.5-2.9 2.5H11.4c-1.6 0-2.9-.9-2.9-2.5z' fill='white'/></svg>";
