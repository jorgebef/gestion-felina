import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Building2, Landmark, Loader2, Plus, Search } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import {
  ORGANIZATION_KINDS,
  ORGANIZATION_KIND_LABELS,
  ORGANIZATION_STATUSES,
} from "@felina/domain/felina";
import { townHallCreateSchema } from "@felina/schemas/organization";

import { APP_NAME } from "@/components/brand/Logo";
import { EmptyState, ErrorState, PageHeader } from "@/components/app/states";
import { RowsSkeleton } from "@/components/app/skeletons";
import { OrganizationStatusBadge, Pill } from "@/components/felina/badges";
import { MunicipalityPicker, type MunicipalityValue } from "@/components/felina/MunicipalityPicker";
import { Field, FormError } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDate, pluralize } from "@/lib/format";
import { adminOrganizationsQuery } from "@/lib/queries";

export const Route = createFileRoute("/admin/")({
  validateSearch: z.object({
    status: z
      .enum([...ORGANIZATION_STATUSES, "all"])
      .optional()
      .catch(undefined),
    kind: z.enum(ORGANIZATION_KINDS).optional().catch(undefined),
    q: z.string().optional().catch(undefined),
  }),
  head: () => ({ meta: [{ title: `Superadmin · ${APP_NAME}` }] }),
  component: AdminHome,
});

function NewTownHallDialog() {
  const [open, setOpen] = useState(false);
  const [municipality, setMunicipality] = useState<MunicipalityValue | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const create = useMutation({
    mutationFn: () => {
      const parsed = townHallCreateSchema.safeParse({
        municipalityCode: municipality?.code ?? "",
        adminEmail,
        name,
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
      return api().admin.createTownHall(parsed.data);
    },
    onSuccess: async (result) => {
      toast.success(
        result.emailSent
          ? `Ayuntamiento creado e invitación enviada a ${adminEmail}`
          : "Ayuntamiento creado, pero el email no se pudo enviar",
      );
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["admin"] });
      await navigate({ to: "/admin/$orgId", params: { orgId: result.id } });
    },
    onError: (e) => setError(e instanceof Error && !("code" in e) ? e.message : errorMessage(e)),
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setMunicipality(null);
          setAdminEmail("");
          setName("");
          setError(null);
        }
      }}
    >
      <DialogTrigger render={<Button />}>
        <Plus /> Nuevo ayuntamiento
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dar de alta un ayuntamiento</DialogTitle>
          <DialogDescription>
            Queda aprobado desde el principio. Solo puede haber uno por municipio. La persona
            invitada será su primera administradora.
          </DialogDescription>
        </DialogHeader>
        <form
          noValidate
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            create.mutate();
          }}
        >
          <Field id="th-municipality" label="Municipio">
            <MunicipalityPicker
              id="th-municipality"
              value={municipality}
              onChange={setMunicipality}
            />
          </Field>
          <Field
            id="th-name"
            label="Nombre"
            optional
            hint={municipality ? `Por defecto: Ayuntamiento de ${municipality.name}` : undefined}
          >
            <Input
              id="th-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-card"
            />
          </Field>
          <Field id="th-email" label="Email de la persona responsable">
            <Input
              id="th-email"
              type="email"
              value={adminEmail}
              onChange={(e) => setAdminEmail(e.target.value)}
              className="bg-card"
            />
          </Field>
          <FormError message={error} />
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? <Loader2 className="animate-spin" /> : null}
              Crear e invitar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AdminHome() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const status = search.status ?? "pending";
  const [term, setTerm] = useState(search.q ?? "");
  const query = useQuery(
    adminOrganizationsQuery({
      status: status === "all" ? undefined : status,
      kind: search.kind,
      q: search.q,
    }),
  );

  return (
    <>
      <PageHeader
        eyebrow="Superadministración"
        title="Organizaciones"
        description="Aprueba las asociaciones que se registran y da de alta los ayuntamientos."
        actions={<NewTownHallDialog />}
      />
      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <Tabs
          value={status}
          onValueChange={(v) => navigate({ search: (s) => ({ ...s, status: v as typeof status }) })}
        >
          <TabsList>
            <TabsTrigger value="pending">Pendientes</TabsTrigger>
            <TabsTrigger value="approved">Aprobadas</TabsTrigger>
            <TabsTrigger value="rejected">Rechazadas</TabsTrigger>
            <TabsTrigger value="suspended">Suspendidas</TabsTrigger>
            <TabsTrigger value="all">Todas</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex gap-2">
          <form
            className="relative flex-1"
            onSubmit={(e) => {
              e.preventDefault();
              void navigate({ search: (s) => ({ ...s, q: term.trim() || undefined }) });
            }}
          >
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Nombre o municipio"
              aria-label="Buscar organizaciones"
              className="bg-card pl-9"
            />
          </form>
          <Select
            items={{ all: "Todos los tipos", ...ORGANIZATION_KIND_LABELS }}
            value={search.kind ?? "all"}
            onValueChange={(v) =>
              void navigate({
                search: (s) => ({
                  ...s,
                  kind: v === "all" ? undefined : (v as (typeof ORGANIZATION_KINDS)[number]),
                }),
              })
            }
          >
            <SelectTrigger className="w-40 bg-card" aria-label="Tipo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              {ORGANIZATION_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {ORGANIZATION_KIND_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {query.isPending || query.isFetching ? (
        <RowsSkeleton icon trailing rows={6} label="Cargando organizaciones…" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : query.data.items.length ? (
        <ul className="surface divide-y">
          {query.data.items.map((o) => (
            <li key={o.id}>
              <Link
                to="/admin/$orgId"
                params={{ orgId: o.id }}
                className="flex flex-col gap-2 px-4 py-3 hover:bg-accent/50 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  {o.kind === "town_hall" ? (
                    <Landmark className="size-5 shrink-0 text-muted-foreground" />
                  ) : (
                    <Building2 className="size-5 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate font-medium">{o.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {ORGANIZATION_KIND_LABELS[o.kind]}
                      {o.municipalityName ? ` · ${o.municipalityName}` : ""} · alta{" "}
                      {formatDate(o.createdAt)}
                      {o.contactEmail ? ` · ${o.contactEmail}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {pluralize(o.members, "miembro", "miembros")}
                  </span>
                  {o.openInvitations ? (
                    <Pill tone="brand">
                      {pluralize(o.openInvitations, "invitación", "invitaciones")}
                    </Pill>
                  ) : null}
                  <OrganizationStatusBadge status={o.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          icon={Building2}
          title={status === "pending" ? "No hay solicitudes pendientes" : "No hay organizaciones"}
        />
      )}
    </>
  );
}
