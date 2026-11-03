/**
 * Thumbnail of a person, an association, a town hall or a cat: their profile photo (a
 * cat's main photo), or an icon when there is none or it can't load.
 */
import { Building2, Cat, UserRound, Users, type LucideIcon } from "lucide-react";

import type { OrganizationKind } from "@felina/domain/felina";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { api } from "@/lib/api";
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
  xs: "size-5 [&_svg]:size-3",
  sm: "size-7 [&_svg]:size-3.5",
  md: "size-9 [&_svg]:size-4.5",
  lg: "size-14 [&_svg]:size-6",
  xl: "size-24 [&_svg]:size-10",
} as const;

export function EntityAvatar({
  entity,
  name,
  size = "sm",
  className,
}: {
  entity: AvatarEntity;
  /** Who or what it is, for the image's alt text. */
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const Icon = ICONS[entity.kind];
  const src = photoUrl(entity);
  return (
    <Avatar className={cn(SIZES[size], className)}>
      {src ? <AvatarImage src={src} alt={name} loading="lazy" /> : null}
      <AvatarFallback
        className="bg-brand-soft text-brand-strong"
        aria-label={src ? undefined : name}
        role={src ? undefined : "img"}
      >
        <Icon aria-hidden="true" />
      </AvatarFallback>
    </Avatar>
  );
}

/** Thumbnail followed by the name, inline (facts, bylines). */
export function EntityLabel({
  entity,
  name,
  size = "sm",
  className,
}: {
  entity: AvatarEntity;
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5 align-middle", className)}>
      <EntityAvatar entity={entity} name={name} size={size} />
      <span className="text-balance">{name}</span>
    </span>
  );
}
