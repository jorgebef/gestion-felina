import { CalendarClock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  CONTRACT_TYPE_LABELS,
  TENDER_STATUS_LABELS,
  WORKFLOW_LABELS,
  type ContractType,
  type TenderStatusValue,
  type WorkflowStatusValue,
} from "@licita/domain/tenders";
import { daysUntil, formatDateTime, formatRelativeDays } from "@/lib/format";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<TenderStatusValue, string> = {
  planned: "bg-brand-soft text-brand-strong",
  open: "bg-positive-soft text-positive",
  closed: "bg-warning-soft text-warning",
  awarded: "bg-secondary text-secondary-foreground",
  formalized: "bg-secondary text-secondary-foreground",
  cancelled: "bg-negative-soft text-negative",
  suspended: "bg-warning-soft text-warning",
  unknown: "bg-secondary text-muted-foreground",
};

export function TenderStatusBadge({ status }: { status: string }) {
  const value = (status in TENDER_STATUS_LABELS ? status : "unknown") as TenderStatusValue;
  return (
    <Badge className={cn("rounded-md font-medium", STATUS_STYLES[value])}>
      {TENDER_STATUS_LABELS[value]}
    </Badge>
  );
}

export function ContractTypeLabel({ type }: { type: string | null }) {
  if (!type) return <span className="text-muted-foreground">—</span>;
  return <>{CONTRACT_TYPE_LABELS[type as ContractType] ?? type}</>;
}

export function WorkflowBadge({ status }: { status: string }) {
  const label = WORKFLOW_LABELS[status as WorkflowStatusValue] ?? status;
  const tone =
    status === "won"
      ? "bg-positive-soft text-positive"
      : status === "lost" || status === "archived"
        ? "bg-secondary text-muted-foreground"
        : "bg-brand-soft text-brand-strong";
  return <Badge className={cn("rounded-md", tone)}>{label}</Badge>;
}

export function ScoreBadge({ score, className }: { score: number | null; className?: string }) {
  if (score == null) return null;
  const rounded = Math.round(score);
  const tone =
    rounded >= 75
      ? "bg-positive-soft text-positive border-positive/20"
      : rounded >= 50
        ? "bg-brand-soft text-brand-strong border-brand/20"
        : "bg-secondary text-muted-foreground border-border";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "tabular inline-flex h-6 min-w-9 items-center justify-center rounded-md border px-1.5 text-xs font-semibold",
            tone,
            className,
          )}
          aria-label={`Relevancia ${rounded} sobre 100`}
        >
          {rounded}
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-60">
        Relevancia para tu perfil (0–100). No indica probabilidad de adjudicación ni que cumplas los
        requisitos para licitar.
      </TooltipContent>
    </Tooltip>
  );
}

export function Deadline({
  value,
  compact = false,
}: {
  value: Date | string | null;
  compact?: boolean;
}) {
  if (!value) return <span className="text-muted-foreground">Sin plazo publicado</span>;
  const days = daysUntil(value);
  const tone =
    days == null || days < 0
      ? "text-muted-foreground"
      : days <= 3
        ? "text-negative"
        : days <= 10
          ? "text-warning"
          : "text-foreground";
  return (
    <span className={cn("inline-flex items-center gap-1.5", tone)}>
      {!compact ? <CalendarClock className="size-3.5 shrink-0" /> : null}
      <span className="tabular">{formatDateTime(value)}</span>
      {days != null && days >= 0 ? (
        <span className="text-xs text-muted-foreground">({formatRelativeDays(value)})</span>
      ) : null}
    </span>
  );
}
