import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { z } from "zod";

import { APP_NAME } from "@/components/brand/Logo";
import { PageHeader } from "@/components/app/states";
import { ActionForm, emptyAction } from "@/components/forms/ActionForm";
import { api } from "@/lib/api";

export const Route = createFileRoute("/_app/acciones/nueva")({
  validateSearch: z.object({
    colonyId: z.uuid().optional().catch(undefined),
    catId: z.uuid().optional().catch(undefined),
  }),
  beforeLoad: ({ context }) => {
    if (context.membership.organization.kind !== "association") throw redirect({ to: "/feed" });
  },
  head: () => ({ meta: [{ title: `Nueva acción · ${APP_NAME}` }] }),
  component: NewAction,
});

function NewAction() {
  const { colonyId, catId } = Route.useSearch();
  const { viewer } = Route.useRouteContext();
  const router = useRouter();
  const queryClient = useQueryClient();
  return (
    <>
      <PageHeader
        title="Nueva acción"
        description="Quedará en el historial de los gatos y llegará al feed del ayuntamiento."
      />
      <div className="surface max-w-4xl p-5 sm:p-6">
        <ActionForm
          initial={{
            ...emptyAction,
            colonyId: colonyId ?? null,
            catIds: catId ? [catId] : [],
            participantIds: [viewer.user.id],
          }}
          submitLabel="Guardar acción"
          onCancel={() => router.history.back()}
          onSubmit={async (values) => {
            const { id } = await api().actions.create(values);
            await queryClient.invalidateQueries();
            toast.success("Acción guardada");
            await router.navigate({ to: "/acciones/$actionId", params: { actionId: id } });
          }}
        />
      </div>
    </>
  );
}
