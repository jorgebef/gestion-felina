import { AlertTriangle, BadgeCheck, CircleDashed, Clock } from "lucide-react";

import {
  ACTION_STATUS_LABELS,
  ACTION_TYPE_LABELS,
  CAT_SEX_LABELS,
  DELETION_STATUS_LABELS,
  ORGANIZATION_STATUS_LABELS,
  PROPOSAL_STATUS_LABELS,
  type ActionStatus,
  type ActionType,
  type CatSex,
  type DeletionStatus,
  type OrganizationStatus,
  type ProposalStatus,
} from "@felina/domain/felina";

import {
  ACTION_STATUS_TONE,
  DELETION_STATUS_TONE,
  ORGANIZATION_STATUS_TONE,
  PROPOSAL_STATUS_TONE,
  TONE_STYLES,
  type Tone,
} from "@felina/client/tones";

import { cn } from "@/lib/utils";

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
        TONE_STYLES[tone].box,
        TONE_STYLES[tone].text,
        className,
      )}
    >
      {children}
    </span>
  );
}

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

export function OrganizationStatusBadge({ status }: { status: OrganizationStatus }) {
  return <Pill tone={ORGANIZATION_STATUS_TONE[status]}>{ORGANIZATION_STATUS_LABELS[status]}</Pill>;
}

export function ProposalStatusBadge({ status }: { status: ProposalStatus }) {
  return <Pill tone={PROPOSAL_STATUS_TONE[status]}>{PROPOSAL_STATUS_LABELS[status]}</Pill>;
}

export function DeletionStatusBadge({ status }: { status: DeletionStatus }) {
  return <Pill tone={DELETION_STATUS_TONE[status]}>{DELETION_STATUS_LABELS[status]}</Pill>;
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
