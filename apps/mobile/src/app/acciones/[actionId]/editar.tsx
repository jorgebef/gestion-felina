import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { toast } from "sonner-native";

import { Screen } from "@/components/app/screen";
import { ErrorState, ForbiddenState, LoadingState, PageHeader } from "@/components/app/states";
import { ActionForm } from "@/components/forms/action-form";
import { api } from "@/lib/api";
import { actionQuery } from "@/lib/queries";

export default function EditAction() {
  const { actionId } = useLocalSearchParams<{ actionId: string }>();
  const query = useQuery(actionQuery(actionId));
  const queryClient = useQueryClient();

  if (query.isPending) return <LoadingState />;
  if (query.isError) {
    return (
      <Screen>
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </Screen>
    );
  }
  const { action: a, permissions } = query.data;
  if (!permissions.canEdit) {
    return (
      <Screen>
        <ForbiddenState message="Solo la asociación que gestiona la acción puede editarla." />
      </Screen>
    );
  }
  return (
    <Screen>
      <PageHeader title={a.name} />
      <ActionForm
        initial={{
          actionType: a.actionType,
          name: a.name,
          description: a.description ?? "",
          scheduledAt: new Date(a.scheduledAt),
          isUrgent: a.isUrgent,
          status: a.status,
          colonyId: a.colonyId,
          municipality: a.colonyId ? null : { code: a.municipalityCode, name: a.municipalityName },
          catIds: query.data.cats.map((c) => c.id),
          participantIds: query.data.participants.map((p) => p.userId),
        }}
        submitLabel="Guardar cambios"
        onSubmit={async (values) => {
          await api().actions.update(actionId, values);
          await queryClient.invalidateQueries();
          toast.success("Acción actualizada");
          router.back();
        }}
      />
    </Screen>
  );
}
