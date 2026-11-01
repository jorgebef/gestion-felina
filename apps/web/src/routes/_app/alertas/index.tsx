import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { BellRing, MapPin, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

import { EmptyState, PageHeader } from "@/components/app/states";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { provinceName } from "@licita/domain/provinces";
import {
  CONTRACT_TYPE_LABELS,
  EMAIL_FREQUENCY_LABELS,
  type ContractType,
} from "@licita/domain/tenders";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDate, pluralize } from "@/lib/format";
import { alertProfilesQuery } from "@/lib/queries";

export const Route = createFileRoute("/_app/alertas/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(alertProfilesQuery),
  head: () => ({ meta: [{ title: "Perfiles de alertas · Licita" }] }),
  component: AlertProfiles,
});

function AlertProfiles() {
  const { data } = useSuspenseQuery(alertProfilesQuery);
  const queryClient = useQueryClient();
  const toggle = useMutation({
    mutationFn: (v: { id: string; isActive: boolean }) =>
      api().alertProfiles.setActive(v.id, v.isActive),
    onSuccess: async (_r, v) => {
      toast.success(v.isActive ? "Perfil activado" : "Perfil desactivado");
      await queryClient.invalidateQueries();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <>
      <PageHeader
        title="Perfiles de alertas"
        description="Cada perfil describe un tipo de contrato que te interesa. Puedes tener varios, por ejemplo uno por línea de negocio."
        actions={
          <Button asChild>
            <Link to="/alertas/nueva">
              <Plus /> Nuevo perfil
            </Link>
          </Button>
        }
      />
      {data.length === 0 ? (
        <EmptyState
          icon={BellRing}
          title="No tienes perfiles de alertas"
          description="Crea uno para que busquemos licitaciones por ti."
          action={
            <Button asChild>
              <Link to="/alertas/nueva">Crear perfil</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {data.map((p) => (
            <li key={p.id} className="surface flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-semibold">{p.name}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {p.serviceDescription}
                  </p>
                </div>
                <Switch
                  checked={p.isActive}
                  disabled={toggle.isPending}
                  onCheckedChange={(on) => toggle.mutate({ id: p.id, isActive: on })}
                  aria-label={p.isActive ? "Desactivar perfil" : "Activar perfil"}
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5 text-xs">
                <Badge variant="outline" className="rounded-md">
                  <MapPin />
                  {p.nationwide
                    ? "Toda España"
                    : p.provinceCodes.length > 3
                      ? pluralize(p.provinceCodes.length, "provincia", "provincias")
                      : p.provinceCodes.map((c) => provinceName(c)).join(", ")}
                </Badge>
                {p.contractTypes.map((t) => (
                  <Badge key={t} variant="outline" className="rounded-md">
                    {CONTRACT_TYPE_LABELS[t as ContractType] ?? t}
                  </Badge>
                ))}
                {p.cpvCount ? (
                  <Badge variant="outline" className="rounded-md">
                    {pluralize(p.cpvCount, "CPV", "CPV")}
                  </Badge>
                ) : null}
                {p.keywordCount ? (
                  <Badge variant="outline" className="rounded-md">
                    {pluralize(p.keywordCount, "palabra clave", "palabras clave")}
                  </Badge>
                ) : null}
              </div>
              <div className="mt-auto flex items-center justify-between gap-3 pt-5 text-sm">
                <span className="text-muted-foreground">
                  {p.isActive ? (
                    <>
                      <Link
                        to="/oportunidades"
                        search={{ profile: p.id }}
                        className="font-medium text-brand hover:underline"
                      >
                        {pluralize(p.matchCount, "coincidencia", "coincidencias")}
                      </Link>{" "}
                      · {EMAIL_FREQUENCY_LABELS[p.emailFrequency]}
                    </>
                  ) : (
                    `Desactivado · editado ${formatDate(p.updatedAt)}`
                  )}
                </span>
                <Button asChild variant="outline" size="sm">
                  <Link to="/alertas/$profileId" params={{ profileId: p.id }}>
                    <Pencil /> Editar
                  </Link>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
