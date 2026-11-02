import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "expo-router";
import { Text, View } from "react-native";
import { toast } from "sonner-native";

import { ORGANIZATION_KIND_LABELS } from "@felina/domain/felina";
import { formatDate } from "@felina/client/format";

import { Screen } from "@/components/app/screen";
import { ErrorState, Facts, LoadingState, SectionTitle } from "@/components/app/states";
import { OrganizationStatusBadge } from "@/components/felina/badges";
import { OrganizationForm } from "@/components/forms/organization-form";
import { Card } from "@/components/ui/card";
import { api } from "@/lib/api";
import { organizationQuery } from "@/lib/queries";

export default function Settings() {
  const query = useQuery(organizationQuery);
  const queryClient = useQueryClient();

  if (query.isPending) return <LoadingState />;
  if (query.isError) {
    return (
      <Screen>
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </Screen>
    );
  }
  const org = query.data.organization;
  const canManage = query.data.role === "admin";

  return (
    <Screen>
      <Text className="text-sm text-muted-foreground">
        Los datos de tu organización. Tu nombre y tu contraseña están en{" "}
        <Link href="/perfil" className="font-medium text-brand">
          Mi perfil
        </Link>
        .
      </Text>

      <Card className="gap-5 p-5">
        <View className="gap-1">
          <SectionTitle>{ORGANIZATION_KIND_LABELS[org.kind]}</SectionTitle>
          <Text className="text-sm text-muted-foreground">
            {canManage
              ? "Datos visibles para la plataforma."
              : "Solo los administradores pueden editarlos."}
          </Text>
        </View>
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
          }}
        />
      </Card>

      <Card className="gap-2 p-5">
        <SectionTitle>Privacidad</SectionTitle>
        <Text className="text-sm text-muted-foreground">
          Las ubicaciones exactas de colonias y gatos solo las ven tu organización y el ayuntamiento
          del municipio correspondiente. Las fotos se sirven únicamente a quien puede ver el gato.
          Para ejercer tus derechos de acceso, rectificación o supresión, escríbenos desde tu email
          de acceso.
        </Text>
      </Card>
    </Screen>
  );
}
