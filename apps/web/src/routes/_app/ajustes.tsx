import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

import { ORGANIZATION_KIND_LABELS } from "@felina/domain/felina";

import { APP_NAME } from "@/components/brand/Logo";
import { Facts, PageHeader } from "@/components/app/states";
import { OrganizationStatusBadge } from "@/components/felina/badges";
import { Field } from "@/components/forms/Field";
import { OrganizationForm } from "@/components/forms/OrganizationForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { formatDate } from "@/lib/format";
import { organizationQuery, viewerQuery } from "@/lib/queries";

export const Route = createFileRoute("/_app/ajustes")({
  loader: ({ context }) => context.queryClient.ensureQueryData(organizationQuery),
  head: () => ({ meta: [{ title: `Ajustes · ${APP_NAME}` }] }),
  component: Settings,
});

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface grid gap-6 p-5 sm:p-6 lg:grid-cols-[240px_1fr]">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function Settings() {
  const { viewer } = Route.useRouteContext();
  const { data } = useSuspenseQuery(organizationQuery);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState(viewer.user.name);
  const org = data.organization;
  const canManage = data.role === "admin";

  const saveName = useMutation({
    mutationFn: () => api().me.update({ fullName }),
    onSuccess: async () => {
      toast.success("Nombre actualizado");
      await queryClient.invalidateQueries({ queryKey: viewerQuery.queryKey });
      await router.invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <>
      <PageHeader title="Ajustes" description="Tu cuenta y los datos de tu organización." />
      <div className="space-y-6">
        <Section
          title="Tu cuenta"
          description="El email se usa para iniciar sesión y recibir avisos."
        >
          <form
            className="max-w-md space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              saveName.mutate();
            }}
          >
            <Field id="email" label="Email">
              <Input id="email" value={viewer.user.email} disabled className="bg-muted" />
            </Field>
            <Field id="fullName" label="Nombre">
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="bg-card"
              />
            </Field>
            <Button
              type="submit"
              variant="outline"
              disabled={saveName.isPending || !fullName.trim()}
            >
              Guardar nombre
            </Button>
          </form>
        </Section>

        <Section
          title={ORGANIZATION_KIND_LABELS[org.kind]}
          description={
            canManage
              ? "Datos visibles para la plataforma."
              : "Solo los administradores pueden editarlos."
          }
        >
          <div className="mb-6">
            <Facts
              items={[
                { label: "Estado", value: <OrganizationStatusBadge status={org.status} /> },
                {
                  label: org.kind === "town_hall" ? "Municipio" : "Municipio de la sede",
                  value: org.municipalityName ?? "—",
                },
                { label: "Alta", value: formatDate(org.createdAt) },
                { label: "Aprobada", value: formatDate(org.reviewedAt) },
              ]}
            />
          </div>
          <OrganizationForm
            disabled={!canManage}
            initial={{
              name: org.name,
              taxId: org.taxId ?? "",
              description: org.description ?? "",
              contactEmail: org.contactEmail ?? "",
              contactPhone: org.contactPhone ?? "",
              municipality: null,
            }}
            submitLabel="Guardar datos"
            onSubmit={async (values) => {
              const { municipalityCode: _ignored, ...update } = values;
              await api().organizations.updateCurrent(update);
              toast.success("Datos guardados");
              await queryClient.invalidateQueries();
              await router.invalidate();
            }}
          />
        </Section>

        <Section title="Privacidad">
          <p className="text-sm text-muted-foreground">
            Las ubicaciones exactas de colonias y gatos solo las ven tu organización y el
            ayuntamiento del municipio correspondiente. Las fotos se sirven únicamente a quien puede
            ver el gato. Para ejercer tus derechos de acceso, rectificación o supresión, escríbenos
            desde tu email de acceso.
          </p>
        </Section>
      </div>
    </>
  );
}
