import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";

import { APP_NAME } from "@/components/brand/Logo";
import { ForbiddenState, PageHeader } from "@/components/app/states";
import { ActionForm } from "@/components/forms/ActionForm";
import { api } from "@/lib/api";
import { toDateTimeLocalValue } from "@/lib/format";
import { actionQuery } from "@/lib/queries";

export const Route = createFileRoute("/_app/acciones/$actionId/editar")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(actionQuery(params.actionId)),
  head: () => ({ meta: [{ title: `Editar acción · ${APP_NAME}` }] }),
  component: EditAction,
});

function EditAction() {
  const { actionId } = Route.useParams();
  const { data } = useSuspenseQuery(actionQuery(actionId));
  const router = useRouter();
  const queryClient = useQueryClient();
  const a = data.action;
  if (!data.permissions.canEdit) {
    return <ForbiddenState message="Solo la asociación que gestiona la acción puede editarla." />;
  }
  return (
    <>
      <PageHeader eyebrow="Editar acción" title={a.name} />
      <div className="surface max-w-4xl p-5 sm:p-6">
        <ActionForm
          initial={{
            actionType: a.actionType,
            name: a.name,
            description: a.description ?? "",
            scheduledAt: toDateTimeLocalValue(a.scheduledAt),
            isUrgent: a.isUrgent,
            status: a.status,
            colonyId: a.colonyId,
            municipality: a.colonyId
              ? null
              : { code: a.municipalityCode, name: a.municipalityName },
            catIds: data.cats.map((c) => c.id),
            participantIds: data.participants.map((p) => p.userId),
          }}
          submitLabel="Guardar cambios"
          onCancel={() => router.history.back()}
          onSubmit={async (values) => {
            await api().actions.update(actionId, values);
            await queryClient.invalidateQueries();
            toast.success("Acción actualizada");
            await router.navigate({ to: "/acciones/$actionId", params: { actionId } });
          }}
        />
      </div>
    </>
  );
}
