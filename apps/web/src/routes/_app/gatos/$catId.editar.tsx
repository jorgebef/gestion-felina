import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";

import { catDisplayName } from "@felina/domain/felina";

import { APP_NAME } from "@/components/brand/Logo";
import { ForbiddenState, PageHeader } from "@/components/app/states";
import { CatForm } from "@/components/forms/CatForm";
import { api } from "@/lib/api";
import { catQuery } from "@/lib/queries";

export const Route = createFileRoute("/_app/gatos/$catId/editar")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(catQuery(params.catId)),
  head: () => ({ meta: [{ title: `Editar gato · ${APP_NAME}` }] }),
  component: EditCat,
});

function EditCat() {
  const { catId } = Route.useParams();
  const { data } = useSuspenseQuery(catQuery(catId));
  const router = useRouter();
  const queryClient = useQueryClient();
  const cat = data.cat;
  if (!data.permissions.canEdit) {
    return <ForbiddenState message="Solo la asociación gestora puede editar este gato." />;
  }
  return (
    <>
      <PageHeader eyebrow="Editar gato" title={catDisplayName(cat)} />
      <div className="surface max-w-3xl p-5 sm:p-6">
        <CatForm
          currentPhotoUrl={api().cats.photoUrl(cat.id, cat.updatedAt)}
          initial={{
            photoKey: data.photoKey,
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
          onCancel={() => router.history.back()}
          onSubmit={async (values) => {
            await api().cats.update(catId, values);
            await queryClient.invalidateQueries({ queryKey: ["cats"] });
            await queryClient.invalidateQueries({ queryKey: ["colonies"] });
            await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
            toast.success("Gato actualizado");
            await router.navigate({ to: "/gatos/$catId", params: { catId } });
          }}
        />
      </div>
    </>
  );
}
