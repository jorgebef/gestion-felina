/**
 * Thumbnail of a person, an association, a town hall or a cat (the web app's
 * EntityAvatar): their profile photo (a cat's main photo), or an icon when there is none
 * or it can't load.
 */
import { Building2, Cat, UserRound, Users, type LucideIcon } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";

import type { OrganizationKind } from "@felina/domain/felina";

import { Icon } from "@/components/ui/icon";
import { Image } from "@/components/ui/image";
import { api, useAuthedImageSource } from "@/lib/api";
import { cn } from "@/lib/utils";

export type AvatarEntity =
  /** `avatar` is the person's photo version (null: no photo). */
  | { kind: "user"; id: string | null; avatar: string | null }
  | { kind: OrganizationKind; id: string | null; avatar: string | null }
  /** Cats always have a main photo; `version` is usually their `updatedAt`. */
  | { kind: "cat"; id: string | null; version?: string };

const ICONS: Record<AvatarEntity["kind"], LucideIcon> = {
  user: UserRound,
  association: Users,
  town_hall: Building2,
  cat: Cat,
};

function photoUrl(entity: AvatarEntity): string | undefined {
  if (!entity.id) return undefined;
  if (entity.kind === "cat") return api().cats.photoUrl(entity.id, entity.version);
  if (!entity.avatar) return undefined;
  return entity.kind === "user"
    ? api().users.avatarUrl(entity.id, entity.avatar)
    : api().organizations.avatarUrl(entity.id, entity.avatar);
}

const SIZES = {
  xs: { box: "size-5", icon: 12 },
  sm: { box: "size-7", icon: 14 },
  md: { box: "size-9", icon: 18 },
  lg: { box: "size-14", icon: 24 },
  xl: { box: "size-24", icon: 40 },
} as const;

export function EntityAvatar({
  entity,
  name,
  size = "sm",
  className,
}: {
  entity: AvatarEntity;
  /** Who or what it is, for screen readers. */
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const url = photoUrl(entity);
  const source = useAuthedImageSource(url);
  const [failed, setFailed] = useState<string | null>(null);
  const { box, icon } = SIZES[size];
  const showPhoto = source && failed !== url;
  return (
    <View
      accessibilityRole="image"
      accessibilityLabel={name}
      className={cn(
        "items-center justify-center overflow-hidden rounded-full border border-border bg-brand-soft",
        box,
        className,
      )}
    >
      {showPhoto ? (
        <Image
          source={source}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={url}
          onError={() => setFailed(url ?? null)}
          className="size-full"
        />
      ) : (
        <Icon icon={ICONS[entity.kind]} color="brand-strong" size={icon} />
      )}
    </View>
  );
}

/** Thumbnail followed by the name, inline. */
export function EntityLabel({
  entity,
  name,
  size = "xs",
  className,
  textClassName,
}: {
  entity: AvatarEntity;
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
  textClassName?: string;
}) {
  return (
    <View className={cn("min-w-0 flex-row items-center gap-1.5", className)}>
      <EntityAvatar entity={entity} name={name} size={size} />
      <Text className={cn("shrink text-sm text-foreground", textClassName)} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}
