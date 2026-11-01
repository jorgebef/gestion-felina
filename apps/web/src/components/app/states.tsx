import { Link, useRouter, type ErrorComponentProps } from "@tanstack/react-router";
import { AlertTriangle, Loader2, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow ? <div className="eyebrow mb-1.5">{eyebrow}</div> : null}
        <h1 className="text-2xl font-semibold tracking-tight text-balance">{title}</h1>
        {description ? (
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center rounded-xl border border-dashed bg-card px-6 py-12 text-center",
        className,
      )}
    >
      <div className="mb-4 grid size-11 place-items-center rounded-full bg-brand-soft text-brand">
        <Icon className="size-5" />
      </div>
      <h3 className="font-medium">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center rounded-xl border border-negative/20 bg-negative-soft px-6 py-10 text-center"
    >
      <AlertTriangle className="mb-3 size-6 text-negative" />
      <p className="font-medium text-negative">{errorMessage(error)}</p>
      {onRetry ? (
        <Button variant="outline" size="sm" className="mt-4 bg-card" onClick={onRetry}>
          Reintentar
        </Button>
      ) : null}
    </div>
  );
}

export function LoadingState({ label = "Cargando…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" />
      {label}
    </div>
  );
}

export function DefaultCatchBoundary({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  const message = error instanceof Error ? error.message : "";
  if (message.includes("UNAUTHORIZED")) {
    return (
      <div className="page-container py-16">
        <EmptyState
          icon={AlertTriangle}
          title="Tu sesión ha caducado"
          action={
            <Button asChild>
              <Link to="/login">Iniciar sesión</Link>
            </Button>
          }
        />
      </div>
    );
  }
  return (
    <div className="page-container py-16">
      <ErrorState
        error={error}
        onRetry={() => {
          reset();
          void router.invalidate();
        }}
      />
    </div>
  );
}

export function ForbiddenState({
  message = "No tienes permiso para ver o hacer esto.",
}: {
  message?: string;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed bg-card px-6 py-12 text-center">
      <AlertTriangle className="mb-3 size-6 text-warning" />
      <p className="font-medium">{message}</p>
    </div>
  );
}

/** Two-column label/value list used on detail pages. */
export function Facts({ items }: { items: { label: string; value: ReactNode }[] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="min-w-0">
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="mt-0.5 break-words">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
