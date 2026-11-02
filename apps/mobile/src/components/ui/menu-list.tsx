import { Link, type Href } from "expo-router";
import { ChevronRight, type LucideIcon } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";

import { cn } from "@/lib/utils";

import { Card } from "./card";
import { Icon, type IconColor } from "./icon";

export interface MenuItem {
  label: string;
  icon: LucideIcon;
  description?: string;
  href?: Href;
  onPress?: () => void;
  destructive?: boolean;
}

/** Grouped rows with a disclosure chevron, like an iOS Settings section. */
export function MenuList({ items, title }: { items: MenuItem[]; title?: string }) {
  return (
    <View className="gap-2">
      {title ? (
        <Text className="px-1 text-xs font-medium tracking-widest text-muted-foreground uppercase">
          {title}
        </Text>
      ) : null}
      <Card>
        {items.map((item, i) => {
          const color: IconColor = item.destructive ? "negative" : "brand";
          const row = (
            <Pressable
              accessibilityRole={item.href ? "link" : "button"}
              onPress={item.onPress}
              className={cn(
                "flex-row items-center gap-3 px-4 py-3.5 active:bg-muted",
                i > 0 && "border-t border-border",
              )}
            >
              <Icon icon={item.icon} color={color} size={20} />
              <View className="flex-1">
                <Text
                  className={cn(
                    "text-base",
                    item.destructive ? "text-negative" : "text-foreground",
                  )}
                >
                  {item.label}
                </Text>
                {item.description ? (
                  <Text className="text-xs text-muted-foreground">{item.description}</Text>
                ) : null}
              </View>
              {item.href ? <Icon icon={ChevronRight} color="muted-foreground" size={18} /> : null}
            </Pressable>
          );
          return item.href ? (
            <Link key={item.label} href={item.href} asChild>
              {row}
            </Link>
          ) : (
            <View key={item.label}>{row}</View>
          );
        })}
      </Card>
    </View>
  );
}
