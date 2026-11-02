import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, router } from "expo-router";
import { Laptop, LogOut, Smartphone } from "lucide-react-native";
import { useState, type ReactNode } from "react";
import { Text, View } from "react-native";
import { toast } from "sonner-native";

import type { Viewer } from "@felina/client/api";
import { describeDevice } from "@felina/client/devices";
import { authErrorMessage, errorMessage } from "@felina/client/errors";
import { formatDate, formatDateTime } from "@felina/client/format";
import { MEMBER_ROLE_LABELS, ORGANIZATION_KIND_LABELS } from "@felina/domain/felina";
import { userProfileSchema } from "@felina/schemas/organization";

import { Screen } from "@/components/app/screen";
import { RowsSkeleton } from "@/components/app/skeletons";
import { ErrorState, Facts, LoadingState, SectionTitle } from "@/components/app/states";
import { OrganizationStatusBadge } from "@/components/felina/badges";
import { Pill } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/controls";
import { Field, FormError } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { confirm } from "@/lib/confirm";
import { profileQuery, viewerQuery } from "@/lib/queries";
import { homeHref, refreshViewer, useSignOut, useViewer } from "@/lib/session";
import { cn } from "@/lib/utils";

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card className="gap-4 p-5">
      <View className="gap-1">
        <SectionTitle>{title}</SectionTitle>
        {description ? <Text className="text-sm text-muted-foreground">{description}</Text> : null}
      </View>
      {children}
    </Card>
  );
}

/** The signed-in person's own account (reachable even without an approved organization). */
export default function Profile() {
  const viewer = useViewer();
  const profile = useQuery(profileQuery);
  const signOut = useSignOut();
  if (!viewer) return null;
  if (profile.isPending) return <LoadingState />;
  if (profile.isError) {
    return (
      <Screen>
        <ErrorState error={profile.error} onRetry={() => void profile.refetch()} />
      </Screen>
    );
  }
  return (
    <Screen>
      <Text className="text-sm text-muted-foreground">
        Tus datos personales, tu contraseña y los dispositivos con sesión abierta.
      </Text>
      <Section
        title="Datos personales"
        description="Tu nombre es visible para el resto de tu organización."
      >
        <Facts
          items={[
            { label: "Cuenta creada", value: formatDate(profile.data.createdAt) },
            {
              label: "Rol en la plataforma",
              value: viewer.isPlatformAdmin ? (
                <Pill tone="brand">Superadministrador</Pill>
              ) : (
                "Usuario"
              ),
            },
          ]}
        />
        <PersonalDataForm initialName={profile.data.fullName} email={profile.data.email} />
      </Section>
      <Section
        title="Contraseña"
        description="Usa al menos 8 caracteres. Al cambiarla puedes cerrar el resto de sesiones."
      >
        <PasswordSection email={profile.data.email} />
      </Section>
      <Section
        title="Sesiones abiertas"
        description="Dispositivos desde los que has iniciado sesión. Cierra los que no reconozcas."
      >
        <SessionsSection />
      </Section>
      <Section title="Organización" description="Cada persona pertenece a una sola organización.">
        <MembershipSection viewer={viewer} joinedAt={profile.data.joinedAt} />
      </Section>
      <Button
        variant="outline"
        tone="negative"
        icon={LogOut}
        onPress={async () => {
          if (await confirm({ title: "¿Cerrar sesión?", confirmLabel: "Cerrar sesión" })) {
            await signOut();
          }
        }}
      >
        Cerrar sesión
      </Button>
    </Screen>
  );
}

/* ------------------------------ Personal data ----------------------------- */

function PersonalDataForm({ initialName, email }: { initialName: string; email: string }) {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState(initialName);
  const parsed = userProfileSchema.safeParse({ fullName });
  const unchanged = fullName.trim() === initialName.trim();
  const save = useMutation({
    mutationFn: () => api().me.update({ fullName }),
    onSuccess: async () => {
      toast.success("Nombre actualizado");
      await queryClient.invalidateQueries({ queryKey: viewerQuery.queryKey });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
  return (
    <View className="gap-4">
      <Field
        label="Email"
        hint="Con él inicias sesión y recibes los avisos. Para cambiarlo, escribe al equipo de la plataforma."
      >
        <Input value={email} editable={false} className="bg-muted" accessibilityLabel="Email" />
      </Field>
      <Field
        label="Nombre"
        error={fullName && !parsed.success ? parsed.error.issues[0]?.message : undefined}
      >
        <Input
          autoComplete="name"
          value={fullName}
          onChangeText={setFullName}
          accessibilityLabel="Nombre"
        />
      </Field>
      <Button
        variant="outline"
        className="self-start"
        loading={save.isPending}
        disabled={!parsed.success || unchanged}
        onPress={() => save.mutate()}
      >
        Guardar nombre
      </Button>
    </View>
  );
}

/* ------------------------------ Password ---------------------------------- */

const accountsQueryKey = ["auth", "accounts"] as const;
const sessionsQueryKey = ["auth", "sessions"] as const;

function PasswordSection({ email }: { email: string }) {
  const accounts = useQuery({
    queryKey: accountsQueryKey,
    queryFn: async () => {
      const result = await authClient.listAccounts();
      if (result.error) throw new Error(authErrorMessage(result.error.code));
      return result.data;
    },
  });
  if (accounts.isPending) return <RowsSkeleton framed={false} rows={1} />;
  if (accounts.isError) {
    return <ErrorState error={accounts.error} onRetry={() => void accounts.refetch()} />;
  }
  const hasPassword = accounts.data.some((a) => a.providerId === "credential");
  const usesGoogle = accounts.data.some((a) => a.providerId === "google");
  return hasPassword ? (
    <ChangePasswordForm />
  ) : (
    <CreatePasswordByEmail email={email} usesGoogle={usesGoogle} />
  );
}

function ChangePasswordForm() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const [revokeOthers, setRevokeOthers] = useState(true);
  const form = useForm({
    defaultValues: { currentPassword: "", newPassword: "", confirm: "" },
    onSubmit: async ({ value, formApi }) => {
      setError(null);
      const result = await authClient.changePassword({
        currentPassword: value.currentPassword,
        newPassword: value.newPassword,
        revokeOtherSessions: revokeOthers,
      });
      if (result.error) {
        setError(authErrorMessage(result.error.code));
        return;
      }
      formApi.reset();
      toast.success(
        revokeOthers
          ? "Contraseña cambiada. Hemos cerrado tus otras sesiones."
          : "Contraseña cambiada",
      );
      await queryClient.invalidateQueries({ queryKey: sessionsQueryKey });
    },
  });

  const password = (
    name: "currentPassword" | "newPassword" | "confirm",
    label: string,
    validate: (value: string) => string | undefined,
  ) => (
    <form.Field name={name} validators={{ onSubmit: ({ value }) => validate(value) }}>
      {(field) => (
        <Field label={label} error={field.state.meta.errors[0]}>
          <Input
            secureTextEntry
            autoComplete={name === "currentPassword" ? "current-password" : "new-password"}
            value={field.state.value}
            onChangeText={field.handleChange}
            accessibilityLabel={label}
          />
        </Field>
      )}
    </form.Field>
  );

  return (
    <View className="gap-4">
      {password("currentPassword", "Contraseña actual", (v) =>
        v ? undefined : "Indica tu contraseña actual",
      )}
      {password("newPassword", "Nueva contraseña", (v) =>
        v.length < 8
          ? "Mínimo 8 caracteres"
          : v.length > 128
            ? "Máximo 128 caracteres"
            : v === form.getFieldValue("currentPassword")
              ? "Debe ser distinta de la actual"
              : undefined,
      )}
      {password("confirm", "Repite la nueva contraseña", (v) =>
        v === form.getFieldValue("newPassword") ? undefined : "Las contraseñas no coinciden",
      )}
      <Checkbox
        label="Cerrar sesión en los demás dispositivos"
        value={revokeOthers}
        onValueChange={setRevokeOthers}
      />
      <FormError message={error} />
      <form.Subscribe selector={(s) => s.isSubmitting}>
        {(isSubmitting) => (
          <Button
            variant="outline"
            className="self-start"
            loading={isSubmitting}
            onPress={() => void form.handleSubmit()}
          >
            Cambiar contraseña
          </Button>
        )}
      </form.Subscribe>
    </View>
  );
}

/** Accounts created with Google have no password; the reset link creates one. */
function CreatePasswordByEmail({ email, usesGoogle }: { email: string; usesGoogle: boolean }) {
  const send = useMutation({
    mutationFn: async () => {
      const result = await authClient.requestPasswordReset({ email, redirectTo: "/restablecer" });
      if (result.error) throw new Error(authErrorMessage(result.error.code));
    },
    onSuccess: () => toast.success(`Te hemos enviado un enlace a ${email}`),
    onError: (e) => toast.error(e.message),
  });
  return (
    <View className="gap-4">
      <Text className="text-sm text-muted-foreground">
        {usesGoogle
          ? "Entras con tu cuenta de Google, así que no tienes contraseña propia."
          : "Tu cuenta todavía no tiene contraseña."}{" "}
        Si quieres poder entrar también con email y contraseña, te enviamos un enlace para crearla.
      </Text>
      <Button
        variant="outline"
        className="self-start"
        loading={send.isPending}
        onPress={() => send.mutate()}
      >
        Enviarme el enlace
      </Button>
    </View>
  );
}

/* ------------------------------ Sessions ---------------------------------- */

function SessionsSection() {
  const queryClient = useQueryClient();
  const sessions = useQuery({
    queryKey: sessionsQueryKey,
    queryFn: async () => {
      const [list, current] = await Promise.all([
        authClient.listSessions(),
        authClient.getSession(),
      ]);
      if (list.error) throw new Error(authErrorMessage(list.error.code));
      const currentToken = current.data?.session.token;
      return [...list.data]
        .map((s) => ({ ...s, current: s.token === currentToken }))
        .sort(
          (a, b) =>
            Number(b.current) - Number(a.current) ||
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
        );
    },
  });
  const revoke = useMutation({
    mutationFn: async (token: string) => {
      const result = await authClient.revokeSession({ token });
      if (result.error) throw new Error(authErrorMessage(result.error.code));
    },
    onSuccess: async () => {
      toast.success("Sesión cerrada");
      await queryClient.invalidateQueries({ queryKey: sessionsQueryKey });
    },
    onError: (e) => toast.error(e.message),
  });
  const revokeOthers = useMutation({
    mutationFn: async () => {
      const result = await authClient.revokeOtherSessions();
      if (result.error) throw new Error(authErrorMessage(result.error.code));
    },
    onSuccess: async () => {
      toast.success("Hemos cerrado el resto de sesiones");
      await queryClient.invalidateQueries({ queryKey: sessionsQueryKey });
    },
    onError: (e) => toast.error(e.message),
  });

  if (sessions.isPending || sessions.isFetching) {
    return <RowsSkeleton rows={2} label="Cargando sesiones…" />;
  }
  if (sessions.isError) {
    return <ErrorState error={sessions.error} onRetry={() => void sessions.refetch()} />;
  }
  const others = sessions.data.filter((s) => !s.current);
  return (
    <View className="gap-4">
      <Card>
        {sessions.data.map((s, i) => {
          const device = describeDevice(s.userAgent);
          return (
            <View
              key={s.id}
              className={cn("flex-row items-center gap-3 p-3", i > 0 && "border-t border-border")}
            >
              <Icon icon={device.mobile ? Smartphone : Laptop} color="muted-foreground" size={20} />
              <View className="flex-1 gap-0.5">
                <View className="flex-row flex-wrap items-center gap-2">
                  <Text className="text-sm font-medium text-foreground">{device.label}</Text>
                  {s.current ? <Pill tone="positive">Este dispositivo</Pill> : null}
                </View>
                <Text numberOfLines={1} className="text-xs text-muted-foreground">
                  Desde {formatDateTime(s.createdAt)}
                  {s.ipAddress ? ` · IP ${s.ipAddress}` : ""}
                </Text>
              </View>
              {!s.current ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={revoke.isPending}
                  accessibilityLabel={`Cerrar sesión en ${device.label}`}
                  onPress={() => revoke.mutate(s.token)}
                >
                  Cerrar
                </Button>
              ) : null}
            </View>
          );
        })}
      </Card>
      {others.length > 1 ? (
        <Button
          variant="outline"
          icon={LogOut}
          className="self-start"
          loading={revokeOthers.isPending}
          onPress={() => revokeOthers.mutate()}
        >
          Cerrar las demás sesiones
        </Button>
      ) : null}
    </View>
  );
}

/* ------------------------------ Membership -------------------------------- */

function MembershipSection({ viewer, joinedAt }: { viewer: Viewer; joinedAt: string | null }) {
  const queryClient = useQueryClient();
  const membership = viewer.membership;
  const leave = useMutation({
    mutationFn: () => api().organizations.removeMember(viewer.user.id),
    onSuccess: async () => {
      toast.success("Has salido de la organización");
      router.replace(homeHref(await refreshViewer(queryClient)));
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!membership) {
    return (
      <View className="gap-4">
        <Text className="text-sm text-muted-foreground">
          {viewer.isPlatformAdmin
            ? "Como superadministrador no necesitas pertenecer a ninguna organización."
            : "Todavía no perteneces a ninguna organización. Registra tu asociación o pide una invitación."}
        </Text>
        {!viewer.isPlatformAdmin ? (
          <Link href="/onboarding" asChild>
            <Button variant="outline" className="self-start">
              Registrar asociación
            </Button>
          </Link>
        ) : null}
      </View>
    );
  }
  const org = membership.organization;
  const approved = org.status === "approved";
  return (
    <View className="gap-5">
      <Facts
        items={[
          { label: ORGANIZATION_KIND_LABELS[org.kind], value: org.name },
          { label: "Tu rol", value: MEMBER_ROLE_LABELS[membership.role] },
          { label: "Estado", value: <OrganizationStatusBadge status={org.status} /> },
          { label: "Miembro desde", value: formatDate(joinedAt) },
        ]}
      />
      <View className="flex-row flex-wrap gap-2">
        <Link href={approved ? "/ajustes" : "/onboarding"} asChild>
          <Button variant="outline">
            {approved ? "Ajustes de la organización" : "Ver estado de la solicitud"}
          </Button>
        </Link>
        {approved ? (
          <Button
            variant="ghost"
            tone="negative"
            icon={LogOut}
            loading={leave.isPending}
            onPress={async () => {
              const ok = await confirm({
                title: `¿Salir de ${org.name}?`,
                message:
                  "Dejarás de ver sus colonias, gatos y acciones. Lo que hayas registrado se conserva. Necesitarás una nueva invitación para volver.",
                confirmLabel: "Salir",
              });
              if (ok) leave.mutate();
            }}
          >
            Salir de la organización
          </Button>
        ) : null}
      </View>
    </View>
  );
}
