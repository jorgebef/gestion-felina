import { useQueryClient } from "@tanstack/react-query";
import { Link, router } from "expo-router";
import { Clock, LogOut, MailOpen, ShieldAlert, ShieldCheck, UserRound } from "lucide-react-native";
import { useState } from "react";
import { Text, View } from "react-native";

import { Screen } from "@/components/app/screen";
import { PageHeader } from "@/components/app/states";
import { OrganizationStatusBadge } from "@/components/felina/badges";
import { emptyOrganization, OrganizationForm } from "@/components/forms/organization-form";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { viewerQuery } from "@/lib/queries";
import { useSignOut, useViewer } from "@/lib/session";

/** Token of an invitation link (https://…/invitacion/TOKEN) or the token itself. */
function invitationToken(text: string): string | null {
  const match = /invitacion\/([^/?#\s]+)/.exec(text) ?? /^([A-Za-z0-9_-]{16,})$/.exec(text.trim());
  return match?.[1] ?? null;
}

/**
 * Signed-in people without an approved organization: register an association, or wait
 * for approval. Town halls only join through an invitation.
 */
export default function Onboarding() {
  const viewer = useViewer();
  const queryClient = useQueryClient();
  const signOut = useSignOut();
  const [link, setLink] = useState("");
  if (!viewer) return null;
  const membership = viewer.membership;
  const token = invitationToken(link);

  return (
    <Screen>
      <View className="flex-row flex-wrap gap-2">
        <Link href="/perfil" asChild>
          <Button variant="outline" size="sm" icon={UserRound}>
            Mi perfil
          </Button>
        </Link>
        <Button variant="ghost" size="sm" icon={LogOut} onPress={() => void signOut()}>
          Cerrar sesión
        </Button>
      </View>

      {viewer.isPlatformAdmin ? (
        <View className="gap-3 rounded-xl border border-brand/20 bg-brand-soft p-4">
          <View className="flex-row items-center gap-2">
            <Icon icon={ShieldCheck} color="brand-strong" size={16} />
            <Text className="flex-1 text-sm text-brand-strong">
              Eres superadministrador/a de la plataforma.
            </Text>
          </View>
          <Link href="/admin" asChild>
            <Button size="sm">Ir a la administración</Button>
          </Link>
        </View>
      ) : null}

      {membership ? (
        <Card className="gap-4 p-5">
          <View className="flex-row flex-wrap items-center gap-3">
            <Icon
              icon={membership.organization.status === "pending" ? Clock : ShieldAlert}
              color={membership.organization.status === "pending" ? "warning" : "negative"}
              size={22}
            />
            <Text className="text-xl font-semibold tracking-tight text-foreground">
              {membership.organization.name}
            </Text>
            <OrganizationStatusBadge status={membership.organization.status} />
          </View>
          <Text className="text-sm text-muted-foreground">
            {membership.organization.status === "pending"
              ? "Hemos recibido la solicitud. La revisamos manualmente y te avisaremos por email en cuanto esté aprobada."
              : membership.organization.status === "rejected"
                ? "La solicitud no se ha aprobado."
                : "La organización está suspendida. Mientras tanto no se puede acceder a sus datos."}
          </Text>
          {membership.organization.reviewNote ? (
            <Text className="rounded-lg bg-muted px-3 py-2 text-sm text-foreground">
              Nota del equipo: {membership.organization.reviewNote}
            </Text>
          ) : null}
          <Button
            variant="outline"
            onPress={() => void queryClient.invalidateQueries({ queryKey: viewerQuery.queryKey })}
          >
            Comprobar de nuevo
          </Button>
        </Card>
      ) : (
        <>
          <PageHeader
            eyebrow={`Hola, ${viewer.user.name || viewer.user.email}`}
            title="Registra tu asociación"
            description="Revisamos cada solicitud a mano. Cuando esté aprobada podrás registrar colonias, gatos y acciones e invitar a tu equipo."
          />
          <Card className="gap-3 p-4">
            <View className="flex-row gap-3">
              <Icon icon={MailOpen} color="brand" size={16} />
              <Text className="flex-1 text-sm text-muted-foreground">
                ¿Te han invitado a una asociación o eres de un ayuntamiento? No registres nada: abre
                el enlace de la invitación que te llegó por email (con este mismo email,{" "}
                <Text className="font-semibold text-foreground">{viewer.user.email}</Text>) o pégalo
                aquí.
              </Text>
            </View>
            <Field label="Enlace de la invitación">
              <Input
                value={link}
                onChangeText={setLink}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="https://…/invitacion/…"
                accessibilityLabel="Enlace de la invitación"
              />
            </Field>
            <Button
              variant="outline"
              disabled={!token}
              onPress={() => token && router.push(`/invitacion/${token}`)}
            >
              Abrir invitación
            </Button>
          </Card>
          <Card className="p-5">
            <OrganizationForm
              withMunicipality
              initial={emptyOrganization}
              submitLabel="Enviar solicitud"
              onSubmit={async (values) => {
                await api().organizations.register(values);
                await queryClient.invalidateQueries({ queryKey: viewerQuery.queryKey });
              }}
            />
          </Card>
        </>
      )}
    </Screen>
  );
}
