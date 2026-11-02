import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import { BadgeCheck, Cat, Loader2, Pencil, Undo2, Users } from "lucide-react";
import { toast } from "sonner";

import {
  ACTION_STATUSES,
  ACTION_STATUS_LABELS,
  ACTION_TYPE_LABELS,
  catDisplayName,
  type ActionStatus,
} from "@felina/domain/felina";

import { APP_NAME } from "@/components/brand/Logo";
import { Facts, PageHeader } from "@/components/app/states";
import { CatCardsSkeleton, RowsSkeleton } from "@/components/app/skeletons";
import {
  ActionStatusBadge,
  ActionTypeBadge,
  UrgentBadge,
  ValidationBadge,
} from "@/components/felina/badges";
import { CatPhoto } from "@/components/felina/CatPhoto";
import { DeleteOrRequestButton, PendingDeletionNotice } from "@/components/felina/Deletion";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDate, formatDateTime, formatRelativeDays } from "@/lib/format";
import { actionQuery } from "@/lib/queries";

export const Route = createFileRoute("/_app/acciones/$actionId/")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(actionQuery(params.actionId)),
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.action.name ?? "Acción"} · ${APP_NAME}` }],
  }),
  component: ActionDetail,
});

function ActionDetail() {
  const { actionId } = Route.useParams();
  const { data, isFetching } = useSuspenseQuery(actionQuery(actionId));
  const router = useRouter();
  const queryClient = useQueryClient();
  const { action, permissions } = data;
  const target = { type: "action" as const, id: action.id, name: action.name };
  const refresh = () => queryClient.invalidateQueries();

  const setStatus = useMutation({
    mutationFn: (status: ActionStatus) => api().actions.setStatus(actionId, status),
    onSuccess: async ({ sterilizedCats }) => {
      toast.success(
        "Estado actualizado",
        sterilizedCats
          ? {
              description:
                sterilizedCats === 1
                  ? "1 gato marcado como castrado."
                  : `${sterilizedCats} gatos marcados como castrados.`,
            }
          : undefined,
      );
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const validate = useMutation({
    mutationFn: (validated: boolean) => api().actions.setValidation(actionId, validated),
    onSuccess: async (_, validated) => {
      toast.success(validated ? "Acción validada" : "Validación retirada");
      await refresh();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => api().actions.delete(actionId),
    onSuccess: async () => {
      toast.success("Acción eliminada");
      await refresh();
      await router.navigate({ to: "/acciones" });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <>
      <PageHeader
        eyebrow={ACTION_TYPE_LABELS[action.actionType]}
        title={action.name}
        description={`${formatDateTime(action.scheduledAt)} · ${formatRelativeDays(action.scheduledAt)}`}
        actions={
          <>
            {permissions.canValidate ? (
              action.validatedAt ? (
                <Button
                  variant="outline"
                  className="bg-card"
                  onClick={() => validate.mutate(false)}
                  disabled={validate.isPending}
                >
                  {validate.isPending ? <Loader2 className="animate-spin" /> : <Undo2 />}
                  Dejar sin validar
                </Button>
              ) : (
                <Button onClick={() => validate.mutate(true)} disabled={validate.isPending}>
                  {validate.isPending ? <Loader2 className="animate-spin" /> : <BadgeCheck />}
                  Validar acción
                </Button>
              )
            ) : null}
            {permissions.canEdit ? (
              <>
                <Select
                  items={ACTION_STATUS_LABELS}
                  value={action.status}
                  onValueChange={(v) => v && setStatus.mutate(v)}
                  disabled={setStatus.isPending}
                >
                  <SelectTrigger className="w-40 bg-card" aria-label="Cambiar estado">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACTION_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {ACTION_STATUS_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Link
                  to="/acciones/$actionId/editar"
                  params={{ actionId }}
                  className={cn(buttonVariants({ variant: "outline" }), "bg-card")}
                >
                  <Pencil /> Editar
                </Link>
              </>
            ) : null}
            <DeleteOrRequestButton
              target={target}
              permissions={permissions}
              pendingDeletion={data.pendingDeletion}
              consequences="Desaparecerá del historial de los gatos y del feed del ayuntamiento. Si ya se realizó, es mejor marcarla como cancelada o realizada."
              onDelete={() => remove.mutate()}
            />
          </>
        }
      />

      <PendingDeletionNotice
        target={target}
        pending={data.pendingDeletion}
        canResolve={permissions.canResolveDeletion}
        onApproved={() => void router.navigate({ to: "/acciones" })}
      />

      <div className="mb-6 flex flex-wrap gap-1.5">
        {action.isUrgent ? <UrgentBadge /> : null}
        <ActionTypeBadge type={action.actionType} />
        <ActionStatusBadge status={action.status} />
        <ValidationBadge
          validatedAt={action.validatedAt}
          modifiedAfterValidation={action.modifiedAfterValidation}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className="surface p-5">
            <Facts
              items={[
                { label: "Asociación", value: action.organizationName ?? "—" },
                {
                  label: "Colonia",
                  value: action.colonyId ? (
                    <Link
                      to="/colonias/$colonyId"
                      params={{ colonyId: action.colonyId }}
                      className="text-brand hover:underline"
                    >
                      {action.colonyName}
                    </Link>
                  ) : (
                    "Sin colonia"
                  ),
                },
                { label: "Municipio", value: action.municipalityName },
                { label: "Fecha y hora", value: formatDateTime(action.scheduledAt) },
                {
                  label: "Validación del ayuntamiento",
                  value: action.validatedAt
                    ? `Validada el ${formatDate(action.validatedAt)}${action.modifiedAfterValidation ? " (modificada después)" : ""}`
                    : "Sin validar",
                },
                { label: "Última modificación", value: formatDateTime(action.updatedAt) },
              ]}
            />
            {action.description ? (
              <p className="mt-4 text-sm whitespace-pre-line">{action.description}</p>
            ) : null}
          </section>

          <section>
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              <Cat className="size-4 text-brand" /> Gatos
              {isFetching ? null : ` (${data.cats.length})`}
            </h2>
            {isFetching ? (
              <CatCardsSkeleton cards={4} className="grid grid-cols-2 gap-3 sm:grid-cols-4" />
            ) : data.cats.length ? (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {data.cats.map((cat) => (
                  <li key={cat.id}>
                    <Link
                      to="/gatos/$catId"
                      params={{ catId: cat.id }}
                      className="surface block overflow-hidden hover:border-brand/30"
                    >
                      <CatPhoto
                        catId={cat.id}
                        version={cat.updatedAt}
                        alt={catDisplayName(cat)}
                        className="aspect-square w-full"
                      />
                      <p className="truncate p-2 text-sm font-medium">{catDisplayName(cat)}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No hay gatos asociados a esta acción.</p>
            )}
          </section>
        </div>

        <aside className="surface h-fit p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <Users className="size-4 text-brand" /> Participantes
            {isFetching ? null : ` (${data.participantCount})`}
          </h2>
          {isFetching ? (
            <RowsSkeleton
              framed={false}
              rows={2}
              className="-mx-4 mt-1 divide-y-0"
              label="Cargando participantes…"
            />
          ) : data.participants.length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {data.participants.map((p) => (
                <li key={p.userId}>
                  <p className="font-medium">{p.name || p.email}</p>
                  {p.name ? <p className="text-xs text-muted-foreground">{p.email}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Las personas participantes solo son visibles para su asociación.
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
