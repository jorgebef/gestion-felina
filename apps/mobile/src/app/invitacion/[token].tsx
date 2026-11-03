import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, router, useLocalSearchParams } from "expo-router";
import { MailOpen } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";

import { MEMBER_ROLE_LABELS, ORGANIZATION_KIND_LABELS } from "@felina/domain/felina";
import { errorMessage } from "@felina/client/errors";

import { Screen } from "@/components/app/screen";
import { EntityAvatar } from "@/components/felina/entity-avatar";
import { ErrorState, LoadingState } from "@/components/app/states";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormError } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { api } from "@/lib/api";
import { invitationQuery } from "@/lib/queries";
import { homeHref, refreshViewer, useViewer } from "@/lib/session";

function Notice({ children }: { children: string }) {
  return (
    <Text className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">{children}</Text>
  );
}

/** Opened from an invitation link (gestionfelina://invitacion/TOKEN) or from onboarding. */
export default function Invitation() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const viewer = useViewer();
  const queryClient = useQueryClient();
  const query = useQuery(invitationQuery(token));
  const [accepted, setAccepted] = useState(false);
  const accept = useMutation({
    mutationFn: () => api().invitations.accept(token),
    onSuccess: async () => {
      await refreshViewer(queryClient);
      setAccepted(true);
    },
  });
  // Go home only once the root layout's `Stack.Protected` guards have switched to the new
  // membership and finished their own updates: this screen has re-rendered with it (effect)
  // and those updates have run (next frame). Navigating right after refreshing the viewer
  // races with the guards and loops on iOS ("Maximum update depth exceeded").
  useEffect(() => {
    if (!accepted || !viewer?.membership) return;
    const frame = requestAnimationFrame(() => router.replace(homeHref(viewer)));
    return () => cancelAnimationFrame(frame);
  }, [accepted, viewer]);

  if (query.isPending) return <LoadingState />;
  if (query.isError) {
    return (
      <Screen>
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </Screen>
    );
  }
  const invitation = query.data;
  const href = `/invitacion/${token}`;
  const wrongAccount = viewer && viewer.user.email.toLowerCase() !== invitation.email;
  const alreadyMember = viewer?.membership;

  return (
    <Screen>
      <Card className="gap-3 p-5">
        <View className="flex-row items-center gap-3">
          <EntityAvatar
            entity={{
              kind: invitation.organizationKind,
              id: invitation.organizationId,
              avatar: invitation.organizationAvatar,
            }}
            name={invitation.organizationName}
            size="lg"
          />
          <Icon icon={MailOpen} color="brand" size={22} />
        </View>
        <Text className="text-xl font-semibold tracking-tight text-foreground">
          Invitación a {invitation.organizationName}
        </Text>
        <Text className="text-sm text-muted-foreground">
          {ORGANIZATION_KIND_LABELS[invitation.organizationKind]} · rol{" "}
          {MEMBER_ROLE_LABELS[invitation.role].toLowerCase()} · para{" "}
          <Text className="font-semibold text-foreground">{invitation.email}</Text>
        </Text>

        <View className="mt-2 gap-2">
          {invitation.state !== "valid" ? (
            <Notice>
              {invitation.state === "accepted"
                ? "Esta invitación ya se ha usado."
                : invitation.state === "expired"
                  ? "La invitación ha caducado. Pide que te envíen una nueva."
                  : "La invitación ya no es válida. Pide que te envíen una nueva."}
            </Notice>
          ) : !viewer ? (
            <>
              <Link
                href={{ pathname: "/login", params: { mode: "signup", redirect: href } }}
                asChild
              >
                <Button>{`Crear cuenta con ${invitation.email}`}</Button>
              </Link>
              <Link href={{ pathname: "/login", params: { redirect: href } }} asChild>
                <Button variant="outline">Ya tengo cuenta</Button>
              </Link>
            </>
          ) : wrongAccount ? (
            <Notice>
              {`Has iniciado sesión como ${viewer.user.email}. Cierra sesión y entra con ${invitation.email} para aceptarla.`}
            </Notice>
          ) : alreadyMember ? (
            <Notice>
              {`Ya perteneces a ${alreadyMember.organization.name}. Cada persona solo puede estar en una organización.`}
            </Notice>
          ) : (
            <>
              <FormError message={accept.error ? errorMessage(accept.error) : null} />
              <Button loading={accept.isPending} onPress={() => accept.mutate()}>
                Aceptar y unirme
              </Button>
            </>
          )}
        </View>
      </Card>
    </Screen>
  );
}
