import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { catDisplayName, type CatSex } from "@felina/domain/felina";
import { formatAge } from "@felina/client/format";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { SterilizedBadge, sexLabel } from "./badges";
import { CatPhoto } from "./cat-photo";

export interface CatSummary {
  id: string;
  name: string | null;
  sex: CatSex;
  birthDate: string | null;
  birthDateApproximate: boolean;
  sterilized: boolean;
  updatedAt: string;
  colonyName?: string | null;
}

/** Photo card of a cat; tapping it opens the cat. */
export function CatCard({ cat, className }: { cat: CatSummary; className?: string }) {
  const name = catDisplayName(cat);
  return (
    <Link href={`/gatos/${cat.id}`} asChild>
      <Pressable
        accessibilityRole="link"
        accessibilityLabel={name}
        className={cn("active:opacity-80", className)}
      >
        <Card>
          <CatPhoto
            catId={cat.id}
            version={cat.updatedAt}
            alt={name}
            className="aspect-square w-full"
          />
          <View className="gap-0.5 p-3">
            <Text numberOfLines={1} className="text-base font-medium text-foreground">
              {name}
            </Text>
            <Text numberOfLines={1} className="text-xs text-muted-foreground">
              {sexLabel(cat.sex)} · {formatAge(cat.birthDate, cat.birthDateApproximate)}
            </Text>
            {cat.colonyName !== undefined ? (
              <Text numberOfLines={1} className="text-xs text-muted-foreground">
                {cat.colonyName ?? "Sin colonia"}
              </Text>
            ) : null}
            <View className="mt-1.5">
              <SterilizedBadge sterilized={cat.sterilized} />
            </View>
          </View>
        </Card>
      </Pressable>
    </Link>
  );
}

/** Two-column grid of cat cards. */
export function CatGrid({ cats }: { cats: CatSummary[] }) {
  return (
    <View className="flex-row flex-wrap justify-between gap-y-3">
      {cats.map((cat) => (
        <CatCard key={cat.id} cat={cat} className="w-[48.5%]" />
      ))}
    </View>
  );
}
