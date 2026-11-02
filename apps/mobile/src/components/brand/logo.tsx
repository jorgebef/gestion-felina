import { Cat } from "lucide-react-native";
import { Text, View } from "react-native";

import { Icon } from "@/components/ui/icon";

export const APP_NAME = "GestiónFelina";

export function Logo() {
  return (
    <View className="flex-row items-center gap-2">
      <View className="size-9 items-center justify-center rounded-lg bg-brand">
        <Icon icon={Cat} color="primary-foreground" size={20} />
      </View>
      <Text className="text-lg font-semibold tracking-tight text-foreground">{APP_NAME}</Text>
    </View>
  );
}
