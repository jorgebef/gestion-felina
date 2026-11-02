import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, UserRoundCog, X } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";
import { toast } from "sonner-native";

import { errorMessage } from "@felina/client/errors";

import { RowsSkeleton } from "@/components/app/skeletons";
import { SectionTitle } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/controls";
import { api } from "@/lib/api";
import { membersQuery } from "@/lib/queries";

import { EntityAvatar } from "./entity-avatar";

export interface ColonyManager {
  userId: string;
  name: string | null;
  email: string;
  avatar: string | null;
}

const NOBODY = "none";

/**
 * Members who manage the colony (edit it and its cats); the web app's ColonyManagers.
 * Admins manage every colony, so only other members are named, and only by admins.
 */
export function ColonyManagers({
  colonyId,
  managers,
  canManageManagers,
  loading,
}: {
  colonyId: string;
  managers: ColonyManager[];
  canManageManagers: boolean;
  loading: boolean;
}) {
  const queryClient = useQueryClient();
  const members = useQuery({ ...membersQuery, enabled: canManageManagers });
  const [selected, setSelected] = useState<string>(NOBODY);
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["colonies"] });

  const add = useMutation({
    mutationFn: (userId: string) => api().colonies.addManager(colonyId, userId),
    onSuccess: async () => {
      toast.success("Gestor añadido");
      setSelected(NOBODY);
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: (userId: string) => api().colonies.removeManager(colonyId, userId),
    onSuccess: async () => {
      toast.success("Gestor retirado");
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const candidates = (members.data ?? []).filter(
    (m) => m.role !== "admin" && !managers.some((x) => x.userId === m.userId),
  );
  const items: Record<string, string> = Object.fromEntries([
    [NOBODY, "Elige una persona del equipo"],
    ...candidates.map((m) => [m.userId, m.name || m.email]),
  ]);

  return (
    <View className="gap-3">
      <SectionTitle icon={UserRoundCog}>Gestores</SectionTitle>
      <Text className="text-sm text-muted-foreground">
        Editan la colonia y registran o editan sus gatos. Los administradores de la asociación
        gestionan todas las colonias.
      </Text>
      {loading ? (
        <RowsSkeleton rows={2} label="Cargando gestores…" />
      ) : managers.length ? (
        <Card>
          {managers.map((m, i) => (
            <View
              key={m.userId}
              className={`flex-row items-center justify-between gap-2 px-4 py-3 ${i ? "border-t border-border" : ""}`}
            >
              <EntityAvatar
                entity={{ kind: "user", id: m.userId, avatar: m.avatar }}
                name={m.name || m.email}
              />
              <View className="min-w-0 flex-1">
                <Text className="font-medium text-foreground" numberOfLines={1}>
                  {m.name || m.email}
                </Text>
                {m.name ? (
                  <Text className="text-xs text-muted-foreground" numberOfLines={1}>
                    {m.email}
                  </Text>
                ) : null}
              </View>
              {canManageManagers ? (
                <Button
                  size="icon"
                  variant="ghost"
                  icon={X}
                  accessibilityLabel={`Quitar a ${m.name || m.email}`}
                  disabled={remove.isPending}
                  onPress={() => remove.mutate(m.userId)}
                />
              ) : null}
            </View>
          ))}
        </Card>
      ) : (
        <Text className="text-sm text-muted-foreground">Sin gestores asignados.</Text>
      )}
      {canManageManagers && candidates.length ? (
        <View className="gap-2">
          <Select value={selected} items={items} onValueChange={setSelected} />
          <Button
            variant="outline"
            icon={Plus}
            loading={add.isPending}
            disabled={selected === NOBODY}
            onPress={() => add.mutate(selected)}
          >
            Añadir gestor
          </Button>
        </View>
      ) : null}
    </View>
  );
}
