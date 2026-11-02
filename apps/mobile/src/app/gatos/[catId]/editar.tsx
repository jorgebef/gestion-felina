import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { toast } from "sonner-native";

import { catDisplayName } from "@felina/domain/felina";

import { Screen } from "@/components/app/screen";
import { ErrorState, ForbiddenState, LoadingState, PageHeader } from "@/components/app/states";
import { CatForm } from "@/components/forms/cat-form";
import { api } from "@/lib/api";
import { catQuery } from "@/lib/queries";

export default function EditCat() {
  const { catId } = useLocalSearchParams<{ catId: string }>();
  const query = useQuery(catQuery(catId));
  const queryClient = useQueryClient();

  if (query.isPending) return <LoadingState />;
  if (query.isError) {
    return (
      <Screen>
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </Screen>
    );
  }
  const { cat, permissions, photoKey } = query.data;
  if (!permissions.canEdit) {
    return (
      <Screen>
        <ForbiddenState message="Solo la asociación gestora puede editar este gato." />
      </Screen>
    );
  }
  return (
    <Screen>
      <PageHeader title={catDisplayName(cat)} />
      <CatForm
        currentPhoto={{ catId: cat.id, version: cat.updatedAt }}
        initial={{
          photoKey,
          name: cat.name ?? "",
          sex: cat.sex,
          birthDate: cat.birthDate ?? "",
          birthDateApproximate: cat.birthDateApproximate,
          sterilized: cat.sterilized,
          description: cat.description ?? "",
          colonyId: cat.colonyId,
          location: {
            latitude: cat.latitude,
            longitude: cat.longitude,
            municipality: { code: cat.municipalityCode, name: cat.municipalityName },
            address: cat.address ?? "",
          },
        }}
        submitLabel="Guardar cambios"
        onSubmit={async (values) => {
          await api().cats.update(catId, values);
          await queryClient.invalidateQueries({ queryKey: ["cats"] });
          await queryClient.invalidateQueries({ queryKey: ["colonies"] });
          await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
          toast.success("Gato actualizado");
          router.back();
        }}
      />
    </Screen>
  );
}
