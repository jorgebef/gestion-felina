import { useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { toast } from "sonner-native";

import { Screen } from "@/components/app/screen";
import { ForbiddenState, PageHeader } from "@/components/app/states";
import { ActionForm, emptyAction } from "@/components/forms/action-form";
import { api } from "@/lib/api";
import { useMembership } from "@/lib/session";

export default function NewAction() {
  const { colonyId, catId } = useLocalSearchParams<{ colonyId?: string; catId?: string }>();
  const { viewer, isAssociation } = useMembership();
  const queryClient = useQueryClient();
  if (!isAssociation) {
    return (
      <Screen>
        <ForbiddenState message="Las acciones las registran las asociaciones." />
      </Screen>
    );
  }
  return (
    <Screen>
      <PageHeader description="Quedará en el historial de los gatos y llegará al feed del ayuntamiento." />
      <ActionForm
        initial={{
          ...emptyAction,
          colonyId: colonyId ?? null,
          catIds: catId ? [catId] : [],
          participantIds: [viewer.user.id],
        }}
        submitLabel="Guardar acción"
        onSubmit={async (values) => {
          const { id } = await api().actions.create(values);
          await queryClient.invalidateQueries();
          toast.success("Acción guardada");
          router.dismiss();
          router.push(`/acciones/${id}`);
        }}
      />
    </Screen>
  );
}
