import { AlertTriangle, BadgeCheck, CircleDashed, Clock } from "lucide-react-native";
import { Text } from "react-native";

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
import {
  ACTION_STATUS_TONE,
  ORGANIZATION_STATUS_TONE,
  PROPOSAL_STATUS_TONE,
  validationLabel,
  validationTone,
} from "@felina/client/tones";

import { Pill } from "@/components/ui/badge";

export function ActionStatusBadge({ status }: { status: ActionStatus }) {
  return <Pill tone={ACTION_STATUS_TONE[status]}>{ACTION_STATUS_LABELS[status]}</Pill>;
}

export function ActionTypeBadge({ type }: { type: ActionType }) {
  return <Pill>{ACTION_TYPE_LABELS[type]}</Pill>;
}

export function UrgentBadge() {
  return (
    <Pill tone="negative" icon={AlertTriangle}>
      Urgente
    </Pill>
  );
}

export function ValidationBadge({
  validatedAt,
  modifiedAfterValidation = false,
}: {
  validatedAt: string | null;
  modifiedAfterValidation?: boolean;
}) {
  return (
    <Pill
      tone={validationTone(validatedAt, modifiedAfterValidation)}
      icon={validatedAt ? BadgeCheck : CircleDashed}
    >
      {validationLabel(validatedAt, modifiedAfterValidation)}
    </Pill>
  );
}

export function AuthorizationBadge({ authorizedAt }: { authorizedAt: string | null }) {
  return authorizedAt ? (
    <Pill tone="positive" icon={BadgeCheck}>
      Autorizada
    </Pill>
  ) : (
    <Pill tone="muted" icon={Clock}>
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

export function SterilizedBadge({ sterilized }: { sterilized: boolean }) {
  return sterilized ? (
    <Pill tone="positive">Castrado/a</Pill>
  ) : (
    <Pill tone="muted">Sin castrar</Pill>
  );
}

/** "♀ Hembra", "♂ Macho", "? Desconocido". */
export function sexLabel(sex: CatSex): string {
  const symbol = sex === "female" ? "♀" : sex === "male" ? "♂" : "?";
  return `${symbol} ${CAT_SEX_LABELS[sex]}`;
}

export function SexLabel({ sex }: { sex: CatSex }) {
  return <Text className="text-base text-foreground">{sexLabel(sex)}</Text>;
}
