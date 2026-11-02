import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { toast } from "sonner-native";

import { Screen } from "@/components/app/screen";
import { ErrorState, ForbiddenState, LoadingState, PageHeader } from "@/components/app/states";
import { ColonyForm } from "@/components/forms/colony-form";
import { api } from "@/lib/api";
import { colonyQuery } from "@/lib/queries";

export default function EditColony() {
  const { colonyId } = useLocalSearchParams<{ colonyId: string }>();
  const query = useQuery(colonyQuery(colonyId));
  const queryClient = useQueryClient();

  if (query.isPending) return <LoadingState />;
  if (query.isError) {
    return (
      <Screen>
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </Screen>
    );
  }
  const c = query.data.colony;
  if (!query.data.permissions.canEdit) {
    return (
      <Screen>
        <ForbiddenState message="Solo los administradores de la asociación gestora pueden editar la colonia." />
      </Screen>
    );
  }
  return (
    <Screen>
      <PageHeader title={c.name} />
      <ColonyForm
        initial={{
          name: c.name,
          description: c.description ?? "",
          location: {
            latitude: c.latitude,
            longitude: c.longitude,
            municipality: { code: c.municipalityCode, name: c.municipalityName },
            address: c.address ?? "",
          },
        }}
        submitLabel="Guardar cambios"
        onSubmit={async (values) => {
          await api().colonies.update(colonyId, values);
          await queryClient.invalidateQueries({ queryKey: ["colonies"] });
          toast.success("Colonia actualizada");
          router.back();
        }}
      />
    </Screen>
  );
}
