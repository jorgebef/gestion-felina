import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { toast } from "sonner-native";

import { Screen } from "@/components/app/screen";
import { ForbiddenState, PageHeader } from "@/components/app/states";
import { ColonyForm, emptyColony } from "@/components/forms/colony-form";
import { api } from "@/lib/api";
import { useMembership } from "@/lib/session";

export default function NewColony() {
  const { isAssociation, isAdmin } = useMembership();
  const queryClient = useQueryClient();
  if (!isAssociation || !isAdmin) {
    return (
      <Screen>
        <ForbiddenState message="Solo los administradores de la asociación registran colonias." />
      </Screen>
    );
  }
  return (
    <Screen>
      <PageHeader description="La verá también el ayuntamiento del municipio." />
      <ColonyForm
        initial={emptyColony}
        submitLabel="Registrar colonia"
        onSubmit={async (values) => {
          const { id } = await api().colonies.create(values);
          await queryClient.invalidateQueries({ queryKey: ["colonies"] });
          await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
          toast.success("Colonia registrada");
          router.dismiss();
          router.push(`/colonias/${id}`);
        }}
      />
    </Screen>
  );
}
