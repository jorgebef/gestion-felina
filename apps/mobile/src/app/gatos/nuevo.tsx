import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import { toast } from "sonner-native";

import { Screen } from "@/components/app/screen";
import { ForbiddenState, LoadingState, PageHeader } from "@/components/app/states";
import { CatForm, emptyCat } from "@/components/forms/cat-form";
import { api } from "@/lib/api";
import { colonyOptionsQuery } from "@/lib/queries";
import { useMembership } from "@/lib/session";

export default function NewCat() {
  const { colonyId } = useLocalSearchParams<{ colonyId?: string }>();
  const { isAssociation } = useMembership();
  const colonies = useQuery({ ...colonyOptionsQuery, enabled: isAssociation });
  const queryClient = useQueryClient();
  if (!isAssociation) {
    return (
      <Screen>
        <ForbiddenState message="Los gatos los registran las asociaciones." />
      </Screen>
    );
  }
  if (colonies.isPending) return <LoadingState />;
  const colony = colonies.data?.find((c) => c.id === colonyId);
  return (
    <Screen>
      <PageHeader description="Con su foto principal y su ubicación." />
      <CatForm
        initial={{
          ...emptyCat,
          colonyId: colony?.id ?? null,
          location: colony
            ? {
                latitude: colony.latitude,
                longitude: colony.longitude,
                municipality: { code: colony.municipalityCode, name: colony.municipalityName },
                address: colony.address ?? "",
              }
            : emptyCat.location,
        }}
        submitLabel="Registrar gato"
        onSubmit={async (values) => {
          const { id } = await api().cats.create(values);
          await queryClient.invalidateQueries({ queryKey: ["cats"] });
          await queryClient.invalidateQueries({ queryKey: ["colonies"] });
          await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
          toast.success("Gato registrado");
          router.dismiss();
          router.push(`/gatos/${id}`);
        }}
      />
    </Screen>
  );
}
