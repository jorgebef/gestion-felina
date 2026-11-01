import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";

import { AlertProfileForm, emptyProfileValues } from "@/components/alerts/AlertProfileForm";
import { PageHeader } from "@/components/app/states";
import { api } from "@/lib/api";
import { pluralize } from "@/lib/format";

export const Route = createFileRoute("/_app/alertas/nueva")({
  head: () => ({ meta: [{ title: "Nuevo perfil de alertas · Licita" }] }),
  component: NewProfile,
});

function NewProfile() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Nuevo perfil de alertas"
        description="Cuanto más concreta sea la descripción, mejores serán las coincidencias."
      />
      <AlertProfileForm
        initial={emptyProfileValues({ name: "" })}
        submitLabel="Crear perfil"
        onCancel={() => router.history.back()}
        onSubmit={async (values) => {
          const result = await api().alertProfiles.create(values);
          await queryClient.invalidateQueries();
          toast.success(
            result.matches != null
              ? `Perfil creado: ${pluralize(result.matches, "oportunidad abierta encontrada", "oportunidades abiertas encontradas")}`
              : "Perfil creado",
          );
          await router.navigate({ to: "/oportunidades", search: { profile: result.id } });
        }}
      />
    </div>
  );
}
