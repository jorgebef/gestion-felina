import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import { BadgeCheck, Cat, ClipboardList, Loader2, Pencil, Plus, Trash2, Undo2 } from "lucide-react";
import { toast } from "sonner";

import { APP_NAME } from "@/components/brand/Logo";
import { EmptyState, Facts, PageHeader } from "@/components/app/states";
import { CardsSkeleton, CatCardsSkeleton, RowsSkeleton } from "@/components/app/skeletons";
import { ActionRow } from "@/components/felina/ActionRow";
import { AuthorizationBadge } from "@/components/felina/badges";
import { CatCard } from "@/components/felina/CatCard";
import { LocationMap } from "@/components/felina/LocationMap";
import { ProposalList } from "@/components/felina/Proposals";
import { ProposeChangeDialog } from "@/components/felina/ProposeChangeDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDate, formatDateTime } from "@/lib/format";
import { colonyQuery, proposalsQuery } from "@/lib/queries";

export const Route = createFileRoute("/_app/colonias/$colonyId/")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(colonyQuery(params.colonyId)),
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.colony.name ?? "Colonia"} · ${APP_NAME}` }],
  }),
  component: ColonyDetail,
});

function ColonyDetail() {
  const { colonyId } = Route.useParams();
  const { membership } = Route.useRouteContext();
  const { data, isFetching } = useSuspenseQuery(colonyQuery(colonyId));
  const proposals = useQuery(proposalsQuery({ colonyId }));
  const router = useRouter();
  const queryClient = useQueryClient();
  const { colony, permissions } = data;

  const authorize = useMutation({
    mutationFn: (authorized: boolean) => api().colonies.setAuthorization(colonyId, authorized),
    onSuccess: async (_, authorized) => {
      toast.success(authorized ? "Colonia autorizada" : "Autorización retirada");
      await queryClient.invalidateQueries({ queryKey: ["colonies"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const remove = useMutation({
    mutationFn: () => api().colonies.delete(colonyId),
    onSuccess: async () => {
      toast.success("Colonia eliminada");
      await queryClient.invalidateQueries();
      await router.navigate({ to: "/colonias" });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <>
      <PageHeader
        eyebrow={
          <span className="flex items-center gap-2">
            Colonia <AuthorizationBadge authorizedAt={colony.authorizedAt} />
          </span>
        }
        title={colony.name}
        description={[colony.address, colony.municipalityName].filter(Boolean).join(" · ")}
        actions={
          <>
            {permissions.canAuthorize ? (
              colony.authorizedAt ? (
                <Button
                  variant="outline"
                  className="bg-card"
                  onClick={() => authorize.mutate(false)}
                  disabled={authorize.isPending}
                >
                  {authorize.isPending ? <Loader2 className="animate-spin" /> : <Undo2 />}
                  Retirar autorización
                </Button>
              ) : (
                <Button onClick={() => authorize.mutate(true)} disabled={authorize.isPending}>
                  {authorize.isPending ? <Loader2 className="animate-spin" /> : <BadgeCheck />}
                  Autorizar colonia
                </Button>
              )
            ) : null}
            {permissions.canPropose ? (
              <ProposeChangeDialog target={{ type: "colony", id: colony.id, current: colony }} />
            ) : null}
            {permissions.canEdit ? (
              <Link
                to="/colonias/$colonyId/editar"
                params={{ colonyId }}
                className={cn(buttonVariants({ variant: "outline" }), "bg-card")}
              >
                <Pencil /> Editar
              </Link>
            ) : null}
            {permissions.canDelete ? (
              <AlertDialog>
                <AlertDialogTrigger
                  render={<Button variant="ghost" className="text-negative hover:text-negative" />}
                >
                  <Trash2 /> Eliminar
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar «{colony.name}»?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Sus gatos seguirán en la asociación, sin colonia. Las acciones conservan su
                      historial. No se puede deshacer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => remove.mutate()}>Eliminar</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <section className="surface p-5">
            <Facts
              items={[
                { label: "Asociación gestora", value: colony.organizationName ?? "—" },
                { label: "Municipio", value: colony.municipalityName },
                { label: "Dirección", value: colony.address ?? "—" },
                {
                  label: "Coordenadas",
                  value: (
                    <span className="tabular">
                      {colony.latitude.toFixed(6)}, {colony.longitude.toFixed(6)}
                    </span>
                  ),
                },
                {
                  label: "Autorización del ayuntamiento",
                  value: colony.authorizedAt
                    ? `Autorizada el ${formatDate(colony.authorizedAt)}`
                    : "Sin autorizar",
                },
                { label: "Actualizada", value: formatDateTime(colony.updatedAt) },
              ]}
            />
            {colony.description ? (
              <p className="mt-4 text-sm whitespace-pre-line">{colony.description}</p>
            ) : null}
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 font-semibold">
                <Cat className="size-4 text-brand" /> Gatos
                {isFetching ? null : ` (${data.cats.length})`}
              </h2>
              {permissions.canAddCats ? (
                <Link
                  to="/gatos/nuevo"
                  search={{ colonyId }}
                  className={cn(buttonVariants({ size: "sm", variant: "outline" }), "bg-card")}
                >
                  <Plus /> Añadir gato
                </Link>
              ) : null}
            </div>
            {isFetching ? (
              <CatCardsSkeleton
                cards={4}
                className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4"
              />
            ) : data.cats.length ? (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {data.cats.map((cat) => (
                  <li key={cat.id}>
                    <CatCard cat={cat} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={Cat} title="Sin gatos registrados en esta colonia" />
            )}
          </section>

          <section className="surface">
            <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
              <h2 className="flex items-center gap-2 font-semibold">
                <ClipboardList className="size-4 text-brand" /> Acciones
              </h2>
              {permissions.canAddCats ? (
                <Link
                  to="/acciones/nueva"
                  search={{ colonyId }}
                  className={cn(buttonVariants({ size: "sm", variant: "outline" }), "bg-card")}
                >
                  <Plus /> Nueva acción
                </Link>
              ) : null}
            </div>
            {isFetching ? (
              <RowsSkeleton framed={false} badges rows={3} label="Cargando acciones…" />
            ) : data.actions.length ? (
              <ul className="divide-y">
                {data.actions.map((a) => (
                  <ActionRow key={a.id} action={a} />
                ))}
              </ul>
            ) : (
              <p className="px-4 py-6 text-sm text-muted-foreground">Sin acciones todavía.</p>
            )}
          </section>
        </div>

        <aside className="space-y-6">
          <LocationMap
            label="Ubicación de la colonia"
            picked={{ latitude: colony.latitude, longitude: colony.longitude }}
          />
          <section>
            <h2 className="mb-3 font-semibold">Propuestas de cambio</h2>
            {proposals.isPending || proposals.isFetching ? (
              <CardsSkeleton cards={1} className="space-y-3" label="Cargando propuestas…" />
            ) : proposals.data?.length ? (
              <ProposalList
                proposals={proposals.data}
                canResolve={
                  membership.role === "admin" && membership.organization.kind === "association"
                }
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {permissions.canPropose
                  ? "Si algún dato no es correcto, propón el cambio a la asociación gestora."
                  : "El ayuntamiento no ha propuesto cambios."}
              </p>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}
