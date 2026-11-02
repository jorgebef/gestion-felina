import { useQuery } from "@tanstack/react-query";
import { Check, ChevronsUpDown, MapPin } from "lucide-react-native";
import { useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "@/components/ui/safe-area";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import type { MunicipalityValue } from "@felina/client/location";

import { municipalitySearchQuery } from "@/lib/queries";
import { useDebounced } from "@/lib/use-debounced";
import { cn } from "@/lib/utils";

export type { MunicipalityValue } from "@felina/client/location";

/** Searchable picker over the INE municipality catalogue (8.000+ entries), in a sheet. */
export function MunicipalityPicker({
  value,
  onChange,
  disabled,
  invalid,
}: {
  value: MunicipalityValue | null;
  onChange: (value: MunicipalityValue | null) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const q = useDebounced(term.trim(), 200);
  const results = useQuery({ ...municipalitySearchQuery(q), enabled: open && q.length >= 2 });

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Municipio"
        disabled={disabled}
        onPress={() => setOpen(true)}
        className={cn(
          "h-11 flex-row items-center gap-2 rounded-lg border border-input bg-card px-3",
          invalid && "border-negative",
          disabled && "opacity-60",
        )}
      >
        <Icon icon={MapPin} color="muted-foreground" size={16} />
        <Text
          numberOfLines={1}
          className={cn("flex-1 text-base", value ? "text-foreground" : "text-muted-foreground")}
        >
          {value
            ? `${value.name}${value.provinceName ? ` (${value.provinceName})` : ""}`
            : "Busca el municipio"}
        </Text>
        <Icon icon={ChevronsUpDown} color="muted-foreground" size={16} />
      </Pressable>

      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaView className="flex-1 bg-background" edges={["top", "bottom"]}>
          <View className="flex-row items-center justify-between px-4 pt-3 pb-2">
            <Text className="text-lg font-semibold text-foreground">Municipio</Text>
            <Button variant="ghost" size="sm" onPress={() => setOpen(false)}>
              Cerrar
            </Button>
          </View>
          <View className="px-4 pb-2">
            <Input
              autoFocus
              placeholder="Escribe al menos 2 letras"
              value={term}
              onChangeText={setTerm}
              autoCorrect={false}
              accessibilityLabel="Buscar municipio"
            />
          </View>
          {q.length < 2 ? (
            <Text className="px-4 py-6 text-center text-sm text-muted-foreground">
              Escribe al menos 2 letras del nombre.
            </Text>
          ) : results.isFetching ? (
            <ActivityIndicator className="py-6" />
          ) : (
            <FlatList
              data={results.data ?? []}
              keyExtractor={(m) => m.code}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No hay municipios con ese nombre.
                </Text>
              }
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    onChange({ code: item.code, name: item.name, provinceName: item.provinceName });
                    setOpen(false);
                    setTerm("");
                  }}
                  className="flex-row items-center justify-between border-b border-border px-4 py-3 active:bg-muted"
                >
                  <View className="flex-1">
                    <Text className="text-base text-foreground">{item.name}</Text>
                    <Text className="text-xs text-muted-foreground">{item.provinceName}</Text>
                  </View>
                  {value?.code === item.code ? <Icon icon={Check} color="brand" size={18} /> : null}
                </Pressable>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>
    </>
  );
}
