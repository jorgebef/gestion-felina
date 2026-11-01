import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";

import { APP_NAME } from "@/components/brand/Logo";
import { PageHeader } from "@/components/app/states";
import { CatForm, emptyCat } from "@/components/forms/CatForm";
import { api } from "@/lib/api";
import { colonyOptionsQuery } from "@/lib/queries";

export const Route = createFileRoute("/_app/gatos/nuevo")({
  validateSearch: z.object({ colonyId: z.uuid().optional().catch(undefined) }),
  beforeLoad: ({ context }) => {
    if (context.membership.organization.kind !== "association") throw redirect({ to: "/gatos" });
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(colonyOptionsQuery),
  head: () => ({ meta: [{ title: `Nuevo gato · ${APP_NAME}` }] }),
  component: NewCat,
});

function NewCat() {
  const { colonyId } = Route.useSearch();
  const colonies = Route.useLoaderData();
  const router = useRouter();
  const queryClient = useQueryClient();
  const colony = colonies.find((c) => c.id === colonyId);
  return (
    <>
      <PageHeader title="Nuevo gato" description="Con su foto principal y su ubicación." />
      <div className="surface max-w-3xl p-5 sm:p-6">
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
          onCancel={() => router.history.back()}
          onSubmit={async (values) => {
            const { id } = await api().cats.create(values);
            await queryClient.invalidateQueries({ queryKey: ["cats"] });
            await queryClient.invalidateQueries({ queryKey: ["colonies"] });
            toast.success("Gato registrado");
            await router.navigate({ to: "/gatos/$catId", params: { catId: id } });
          }}
        />
      </div>
    </>
  );
}
