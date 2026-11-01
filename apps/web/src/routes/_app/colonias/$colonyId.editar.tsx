import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";

import { APP_NAME } from "@/components/brand/Logo";
import { ForbiddenState, PageHeader } from "@/components/app/states";
import { ColonyForm } from "@/components/forms/ColonyForm";
import { api } from "@/lib/api";
import { colonyQuery } from "@/lib/queries";

export const Route = createFileRoute("/_app/colonias/$colonyId/editar")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(colonyQuery(params.colonyId)),
  head: () => ({ meta: [{ title: `Editar colonia · ${APP_NAME}` }] }),
  component: EditColony,
});

function EditColony() {
  const { colonyId } = Route.useParams();
  const { data } = useSuspenseQuery(colonyQuery(colonyId));
  const router = useRouter();
  const queryClient = useQueryClient();
  const c = data.colony;
  if (!data.permissions.canEdit) {
    return (
      <ForbiddenState message="Solo los administradores de la asociación gestora pueden editar la colonia." />
    );
  }
  return (
    <>
      <PageHeader eyebrow="Editar colonia" title={c.name} />
      <div className="surface max-w-3xl p-5 sm:p-6">
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
          onCancel={() => router.history.back()}
          onSubmit={async (values) => {
            await api().colonies.update(colonyId, values);
            await queryClient.invalidateQueries({ queryKey: ["colonies"] });
            toast.success("Colonia actualizada");
            await router.navigate({ to: "/colonias/$colonyId", params: { colonyId } });
          }}
        />
      </div>
    </>
  );
}
