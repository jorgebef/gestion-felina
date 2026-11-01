import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import { ClipboardList, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { catDisplayName } from "@felina/domain/felina";

import { APP_NAME } from "@/components/brand/Logo";
import { Facts, PageHeader } from "@/components/app/states";
import { ActionRow } from "@/components/felina/ActionRow";
import { SexLabel, SterilizedBadge } from "@/components/felina/badges";
import { CatPhoto } from "@/components/felina/CatPhoto";
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
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatAge, formatDate, formatDateTime } from "@/lib/format";
import { catQuery, proposalsQuery } from "@/lib/queries";

export const Route = createFileRoute("/_app/gatos/$catId/")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(catQuery(params.catId)),
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData ? catDisplayName(loaderData.cat) : "Gato"} · ${APP_NAME}` }],
  }),
  component: CatDetail,
});

function CatDetail() {
  const { catId } = Route.useParams();
  const { membership } = Route.useRouteContext();
  const { data } = useSuspenseQuery(catQuery(catId));
  const proposals = useQuery(proposalsQuery({ catId }));
  const router = useRouter();
  const queryClient = useQueryClient();
  const { cat, permissions } = data;
  const name = catDisplayName(cat);

  const remove = useMutation({
    mutationFn: () => api().cats.delete(catId),
    onSuccess: async () => {
      toast.success("Gato eliminado");
      await queryClient.invalidateQueries();
      await router.navigate({ to: "/gatos" });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <>
      <PageHeader
        eyebrow="Gato"
        title={name}
        description={cat.colonyName ? `Colonia ${cat.colonyName}` : "Sin colonia"}
        actions={
          <>
            {permissions.canPropose ? (
              <ProposeChangeDialog
                target={{
                  type: "cat",
                  id: cat.id,
                  current: { ...cat, name: cat.name },
                }}
              />
            ) : null}
            {permissions.canEdit ? (
              <>
                <Button asChild variant="outline" className="bg-card">
                  <Link
                    to="/acciones/nueva"
                    search={{ catId, colonyId: cat.colonyId ?? undefined }}
                  >
                    <Plus /> Acción
                  </Link>
                </Button>
                <Button asChild variant="outline" className="bg-card">
                  <Link to="/gatos/$catId/editar" params={{ catId }}>
                    <Pencil /> Editar
                  </Link>
                </Button>
              </>
            ) : null}
            {permissions.canDelete ? (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" className="text-negative hover:text-negative">
                    <Trash2 /> Eliminar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar a {name}?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Se borrará su ficha y su foto, y dejará de aparecer en las acciones. No se
                      puede deshacer.
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

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <CatPhoto
            catId={cat.id}
            version={cat.updatedAt}
            alt={`Foto de ${name}`}
            className="aspect-square w-full rounded-xl border"
          />
          <LocationMap
            label="Ubicación del gato"
            className="h-56"
            picked={{ latitude: cat.latitude, longitude: cat.longitude }}
          />
        </div>

        <div className="space-y-6">
          <section className="surface p-5">
            <div className="mb-4 flex flex-wrap gap-2">
              <SterilizedBadge sterilized={cat.sterilized} />
            </div>
            <Facts
              items={[
                { label: "Sexo", value: <SexLabel sex={cat.sex} /> },
                {
                  label: "Fecha de nacimiento",
                  value: cat.birthDate
                    ? `${cat.birthDateApproximate ? "≈ " : ""}${formatDate(cat.birthDate)} (${formatAge(cat.birthDate, cat.birthDateApproximate)})`
                    : "Desconocida",
                },
                {
                  label: "Colonia",
                  value: cat.colonyId ? (
                    <Link
                      to="/colonias/$colonyId"
                      params={{ colonyId: cat.colonyId }}
                      className="text-brand hover:underline"
                    >
                      {cat.colonyName}
                    </Link>
                  ) : (
                    "Sin colonia"
                  ),
                },
                { label: "Asociación", value: cat.organizationName ?? "—" },
                { label: "Municipio", value: cat.municipalityName },
                { label: "Dirección", value: cat.address ?? "—" },
                {
                  label: "Coordenadas",
                  value: (
                    <span className="tabular">
                      {cat.latitude.toFixed(6)}, {cat.longitude.toFixed(6)}
                    </span>
                  ),
                },
                { label: "Actualizado", value: formatDateTime(cat.updatedAt) },
              ]}
            />
            {cat.description ? (
              <p className="mt-4 text-sm whitespace-pre-line">{cat.description}</p>
            ) : null}
          </section>

          <section className="surface">
            <h2 className="flex items-center gap-2 border-b px-4 py-3 font-semibold">
              <ClipboardList className="size-4 text-brand" /> Historial de acciones
            </h2>
            {data.actions.length ? (
              <ul className="divide-y">
                {data.actions.map((a) => (
                  <ActionRow key={a.id} action={a} />
                ))}
              </ul>
            ) : (
              <p className="px-4 py-6 text-sm text-muted-foreground">Sin acciones registradas.</p>
            )}
          </section>

          {proposals.data?.length ? (
            <section>
              <h2 className="mb-3 font-semibold">Propuestas de cambio</h2>
              <ProposalList
                proposals={proposals.data}
                canResolve={
                  membership.role === "admin" && membership.organization.kind === "association"
                }
              />
            </section>
          ) : null}
        </div>
      </div>
    </>
  );
}
