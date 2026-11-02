import { ChevronLeft, ChevronRight } from "lucide-react-native";
import { Text, View } from "react-native";

import { formatInteger } from "@felina/client/format";

import { Button } from "@/components/ui/button";

export function Pager({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  return (
    <View className="flex-row items-center justify-between gap-2">
      <Text className="text-sm text-muted-foreground">
        {formatInteger(total)} · pág. {page} de {pages}
      </Text>
      <View className="flex-row gap-2">
        <Button
          variant="outline"
          size="sm"
          icon={ChevronLeft}
          disabled={page <= 1}
          onPress={() => onPage(page - 1)}
          accessibilityLabel="Página anterior"
        />
        <Button
          variant="outline"
          size="sm"
          icon={ChevronRight}
          disabled={page >= pages}
          onPress={() => onPage(page + 1)}
          accessibilityLabel="Página siguiente"
        />
      </View>
    </View>
  );
}
