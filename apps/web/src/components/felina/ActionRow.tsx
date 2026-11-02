import { Link } from "@tanstack/react-router";
import { CalendarClock } from "lucide-react";

import type { ActionStatus, ActionType } from "@felina/domain/felina";

import { formatShortDateTime } from "@/lib/format";

import { ActionStatusBadge, ActionTypeBadge, UrgentBadge, ValidationBadge } from "./badges";
import { EntityLabel } from "./EntityAvatar";

export interface ActionSummary {
  id: string;
  name: string;
  actionType: ActionType;
  status: ActionStatus;
  scheduledAt: string;
  isUrgent: boolean;
  validatedAt: string | null;
  modifiedAfterValidation?: boolean;
  colonyName?: string | null;
  organizationId?: string | null;
  organizationName?: string | null;
  organizationAvatar?: string | null;
}

/** One action in a list: name, when, where and its badges. */
export function ActionRow({
  action,
  showOrganization = false,
  trailing,
  footer,
}: {
  action: ActionSummary;
  showOrganization?: boolean;
  trailing?: React.ReactNode;
  /** Extra line under the badges. */
  footer?: React.ReactNode;
}) {
  return (
    <li className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <Link
          to="/acciones/$actionId"
          params={{ actionId: action.id }}
          className="font-medium hover:underline"
        >
          {action.name}
        </Link>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="size-3.5" />
            {formatShortDateTime(action.scheduledAt)}
          </span>
          {action.colonyName ? <span>· {action.colonyName}</span> : null}
          {showOrganization && action.organizationName ? (
            <span className="inline-flex min-w-0 items-center gap-1">
              ·{" "}
              <EntityLabel
                entity={{
                  kind: "association",
                  id: action.organizationId ?? null,
                  avatar: action.organizationAvatar ?? null,
                }}
                name={action.organizationName}
              />
            </span>
          ) : null}
        </p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {action.isUrgent ? <UrgentBadge /> : null}
          <ActionTypeBadge type={action.actionType} />
          <ActionStatusBadge status={action.status} />
          <ValidationBadge
            validatedAt={action.validatedAt}
            modifiedAfterValidation={action.modifiedAfterValidation}
          />
        </div>
        {footer ? <p className="mt-1.5 text-xs text-muted-foreground">{footer}</p> : null}
      </div>
      {trailing ? <div className="shrink-0">{trailing}</div> : null}
    </li>
  );
}
