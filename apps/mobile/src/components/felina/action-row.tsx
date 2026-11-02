import { Link } from "expo-router";
import { CalendarClock } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";

import type { ActionStatus, ActionType } from "@felina/domain/felina";
import { formatShortDateTime } from "@felina/client/format";

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

import { ActionStatusBadge, ActionTypeBadge, UrgentBadge, ValidationBadge } from "./badges";
import { EntityLabel } from "./entity-avatar";

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

/** One action in a list: name, when, where and its badges. Tapping it opens the action. */
export function ActionRow({
  action,
  showOrganization = false,
  trailing,
  footer,
  first = false,
}: {
  action: ActionSummary;
  showOrganization?: boolean;
  trailing?: ReactNode;
  footer?: string;
  /** No divider above the first row of a card. */
  first?: boolean;
}) {
  return (
    <View className={cn("gap-3 px-4 py-3", !first && "border-t border-border")}>
      <Link href={`/acciones/${action.id}`} asChild>
        <Pressable accessibilityRole="link" className="gap-1 active:opacity-70">
          <Text className="text-base font-medium text-foreground">{action.name}</Text>
          <View className="flex-row flex-wrap items-center gap-x-1.5">
            <Icon icon={CalendarClock} color="muted-foreground" size={13} />
            <Text className="text-sm text-muted-foreground">
              {formatShortDateTime(action.scheduledAt)}
              {action.colonyName ? ` · ${action.colonyName}` : ""}
            </Text>
          </View>
          {showOrganization && action.organizationName ? (
            <EntityLabel
              entity={{
                kind: "association",
                id: action.organizationId ?? null,
                avatar: action.organizationAvatar ?? null,
              }}
              name={action.organizationName}
              textClassName="text-sm text-muted-foreground"
            />
          ) : null}
          <View className="mt-1 flex-row flex-wrap gap-1.5">
            {action.isUrgent ? <UrgentBadge /> : null}
            <ActionTypeBadge type={action.actionType} />
            <ActionStatusBadge status={action.status} />
            <ValidationBadge
              validatedAt={action.validatedAt}
              modifiedAfterValidation={action.modifiedAfterValidation}
            />
          </View>
          {footer ? <Text className="mt-1 text-xs text-muted-foreground">{footer}</Text> : null}
        </Pressable>
      </Link>
      {trailing ? <View className="flex-row">{trailing}</View> : null}
    </View>
  );
}
