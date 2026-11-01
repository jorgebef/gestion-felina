import { AlertTriangle, BadgeCheck, CircleDashed, Clock } from "lucide-react";

import {
  ACTION_STATUS_LABELS,
  ACTION_TYPE_LABELS,
  CAT_SEX_LABELS,
  ORGANIZATION_STATUS_LABELS,
  PROPOSAL_STATUS_LABELS,
  type ActionStatus,
  type ActionType,
  type CatSex,
  type OrganizationStatus,
  type ProposalStatus,
} from "@felina/domain/felina";

import { cn } from "@/lib/utils";

type Tone = "neutral" | "brand" | "positive" | "warning" | "negative" | "muted";

const TONES: Record<Tone, string> = {
  neutral: "border-border bg-card text-foreground",
  brand: "border-brand/20 bg-brand-soft text-brand-strong",
  positive: "border-positive/20 bg-positive-soft text-positive",
  warning: "border-warning/20 bg-warning-soft text-warning",
  negative: "border-negative/20 bg-negative-soft text-negative",
  muted: "border-border bg-muted text-muted-foreground",
};

export function Pill({
  tone = "neutral",
  className,
  children,
  title,
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

const ACTION_STATUS_TONE: Record<ActionStatus, Tone> = {
  planned: "brand",
  in_progress: "warning",
  done: "positive",
  cancelled: "muted",
};

export function ActionStatusBadge({ status }: { status: ActionStatus }) {
  return <Pill tone={ACTION_STATUS_TONE[status]}>{ACTION_STATUS_LABELS[status]}</Pill>;
}

export function ActionTypeBadge({ type }: { type: ActionType }) {
  return <Pill>{ACTION_TYPE_LABELS[type]}</Pill>;
}

export function UrgentBadge() {
  return (
    <Pill tone="negative">
      <AlertTriangle className="size-3" />
      Urgente
    </Pill>
  );
}

export function ValidationBadge({
  validatedAt,
  modifiedAfterValidation = false,
}: {
  validatedAt: string | Date | null;
  modifiedAfterValidation?: boolean;
}) {
  if (!validatedAt) {
    return (
      <Pill tone="muted">
        <CircleDashed className="size-3" />
        Sin validar
      </Pill>
    );
  }
  return (
    <Pill
      tone={modifiedAfterValidation ? "warning" : "positive"}
      title={
        modifiedAfterValidation ? "La asociación la modificó después de la validación" : undefined
      }
    >
      <BadgeCheck className="size-3" />
      {modifiedAfterValidation ? "Validada · modificada" : "Validada"}
    </Pill>
  );
}

export function AuthorizationBadge({ authorizedAt }: { authorizedAt: string | Date | null }) {
  return authorizedAt ? (
    <Pill tone="positive">
      <BadgeCheck className="size-3" />
      Autorizada
    </Pill>
  ) : (
    <Pill tone="muted">
      <Clock className="size-3" />
      Sin autorizar
    </Pill>
  );
}

const ORG_STATUS_TONE: Record<OrganizationStatus, Tone> = {
  pending: "warning",
  approved: "positive",
  rejected: "negative",
  suspended: "negative",
};

export function OrganizationStatusBadge({ status }: { status: OrganizationStatus }) {
  return <Pill tone={ORG_STATUS_TONE[status]}>{ORGANIZATION_STATUS_LABELS[status]}</Pill>;
}

const PROPOSAL_TONE: Record<ProposalStatus, Tone> = {
  pending: "warning",
  accepted: "positive",
  rejected: "negative",
  withdrawn: "muted",
};

export function ProposalStatusBadge({ status }: { status: ProposalStatus }) {
  return <Pill tone={PROPOSAL_TONE[status]}>{PROPOSAL_STATUS_LABELS[status]}</Pill>;
}

export function SexLabel({ sex }: { sex: CatSex }) {
  const symbol = sex === "female" ? "♀" : sex === "male" ? "♂" : "?";
  return (
    <span className="inline-flex items-center gap-1">
      <span aria-hidden="true" className="text-muted-foreground">
        {symbol}
      </span>
      {CAT_SEX_LABELS[sex]}
    </span>
  );
}

export function SterilizedBadge({ sterilized }: { sterilized: boolean }) {
  return sterilized ? (
    <Pill tone="positive">Castrado/a</Pill>
  ) : (
    <Pill tone="muted">Sin castrar</Pill>
  );
}
