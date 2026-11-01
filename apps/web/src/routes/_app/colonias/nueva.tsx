import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";

import { APP_NAME } from "@/components/brand/Logo";
import { PageHeader } from "@/components/app/states";
import { ColonyForm, emptyColony } from "@/components/forms/ColonyForm";
import { api } from "@/lib/api";

export const Route = createFileRoute("/_app/colonias/nueva")({
  beforeLoad: ({ context }) => {
    const m = context.membership;
    if (m.organization.kind !== "association" || m.role !== "admin") {
      throw redirect({ to: "/colonias" });
    }
  },
  head: () => ({ meta: [{ title: `Nueva colonia · ${APP_NAME}` }] }),
  component: NewColony,
});

function NewColony() {
  const router = useRouter();
  const queryClient = useQueryClient();
  return (
    <>
      <PageHeader
        title="Nueva colonia"
        description="La verá también el ayuntamiento del municipio."
      />
      <div className="surface max-w-3xl p-5 sm:p-6">
        <ColonyForm
          initial={emptyColony}
          submitLabel="Registrar colonia"
          onCancel={() => router.history.back()}
          onSubmit={async (values) => {
            const { id } = await api().colonies.create(values);
            await queryClient.invalidateQueries({ queryKey: ["colonies"] });
            toast.success("Colonia registrada");
            await router.navigate({ to: "/colonias/$colonyId", params: { colonyId: id } });
          }}
        />
      </div>
    </>
  );
}
