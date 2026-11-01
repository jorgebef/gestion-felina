import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";

import { ORGANIZATION_KIND_LABELS } from "@felina/domain/felina";

import { APP_NAME } from "@/components/brand/Logo";
import { SettingsSection } from "@/components/app/SettingsSection";
import { Facts, PageHeader } from "@/components/app/states";
import { OrganizationStatusBadge } from "@/components/felina/badges";
import { OrganizationForm } from "@/components/forms/OrganizationForm";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { organizationQuery } from "@/lib/queries";

export const Route = createFileRoute("/_app/ajustes")({
  loader: ({ context }) => context.queryClient.ensureQueryData(organizationQuery),
  head: () => ({ meta: [{ title: `Ajustes · ${APP_NAME}` }] }),
  component: Settings,
});

function Settings() {
  const { data } = useSuspenseQuery(organizationQuery);
  const router = useRouter();
  const queryClient = useQueryClient();
  const org = data.organization;
  const canManage = data.role === "admin";

  return (
    <>
      <PageHeader
        title="Ajustes"
        description={
          <>
            Los datos de tu organización. Tu nombre y tu contraseña están en{" "}
            <Link
              to="/perfil"
              className="font-medium text-brand underline-offset-4 hover:underline"
            >
              Mi perfil
            </Link>
            .
          </>
        }
      />
      <div className="space-y-6">
        <SettingsSection
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
        </SettingsSection>

        <SettingsSection title="Privacidad">
          <p className="text-sm text-muted-foreground">
            Las ubicaciones exactas de colonias y gatos solo las ven tu organización y el
            ayuntamiento del municipio correspondiente. Las fotos se sirven únicamente a quien puede
            ver el gato. Para ejercer tus derechos de acceso, rectificación o supresión, escríbenos
            desde tu email de acceso.
          </p>
        </SettingsSection>
      </div>
    </>
  );
}
