import { useForm } from "@tanstack/react-form";
import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { Laptop, Loader2, LogOut, Smartphone } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { MEMBER_ROLE_LABELS, ORGANIZATION_KIND_LABELS } from "@felina/domain/felina";
import { userProfileSchema } from "@felina/schemas/organization";

import { APP_NAME } from "@/components/brand/Logo";
import { AppShell } from "@/components/app/AppShell";
import { SettingsSection } from "@/components/app/SettingsSection";
import { ErrorState, Facts, LoadingState, PageHeader } from "@/components/app/states";
import { RowsSkeleton } from "@/components/app/skeletons";
import { OrganizationStatusBadge, Pill } from "@/components/felina/badges";
import { Field, FormError } from "@/components/forms/Field";
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
import { Button, buttonVariants } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, type Viewer } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { authErrorMessage, errorMessage } from "@/lib/errors";
import { formatDate, formatDateTime } from "@/lib/format";
import { profileQuery, viewerQuery } from "@/lib/queries";

/**
 * The signed-in user's own account. Lives outside the `_app` guard so people whose
 * organization is still pending (or the super admin, who has none) can reach it too.
 */
export const Route = createFileRoute("/perfil")({
  beforeLoad: ({ context, location }) => {
    if (!context.viewer) throw redirect({ to: "/login", search: { redirect: location.href } });
    return { viewer: context.viewer };
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(profileQuery),
  head: () => ({ meta: [{ title: `Mi perfil · ${APP_NAME}` }] }),
  component: ProfileLayout,
});

function ProfileLayout() {
  const { viewer } = Route.useRouteContext();
  return (
    <AppShell viewer={viewer}>
      <ProfilePage viewer={viewer} />
    </AppShell>
  );
}

function ProfilePage({ viewer }: { viewer: Viewer }) {
  const { data: profile } = useSuspenseQuery(profileQuery);
  return (
    <>
      <PageHeader
        title="Mi perfil"
        description="Tus datos personales, tu contraseña y los dispositivos con sesión abierta."
      />
      <div className="space-y-6">
        <SettingsSection
          title="Datos personales"
          description="Tu nombre es visible para el resto de tu organización."
        >
          <div className="mb-6">
            <Facts
              items={[
                { label: "Cuenta creada", value: formatDate(profile.createdAt) },
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
          </div>
          <PersonalDataForm initialName={profile.fullName} email={profile.email} />
        </SettingsSection>

        <SettingsSection
          title="Contraseña"
          description="Usa al menos 8 caracteres. Al cambiarla puedes cerrar el resto de sesiones."
        >
          <PasswordSection email={profile.email} />
        </SettingsSection>

        <SettingsSection
          title="Sesiones abiertas"
          description="Dispositivos desde los que has iniciado sesión. Cierra los que no reconozcas."
        >
          <SessionsSection />
        </SettingsSection>

        <SettingsSection
          title="Organización"
          description="Cada persona pertenece a una sola organización."
        >
          <MembershipSection viewer={viewer} joinedAt={profile.joinedAt} />
        </SettingsSection>
      </div>
    </>
  );
}

/* ------------------------------ Personal data ----------------------------- */

function PersonalDataForm({ initialName, email }: { initialName: string; email: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState(initialName);
  const parsed = userProfileSchema.safeParse({ fullName });
  const unchanged = fullName.trim() === initialName.trim();

  const save = useMutation({
    mutationFn: () => api().me.update({ fullName }),
    onSuccess: async () => {
      toast.success("Nombre actualizado");
      await queryClient.invalidateQueries({ queryKey: viewerQuery.queryKey });
      await router.invalidate();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  return (
    <form
      className="max-w-md space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (parsed.success && !unchanged) save.mutate();
      }}
    >
      <Field
        id="profile-email"
        label="Email"
        hint="Con él inicias sesión y recibes los avisos. Para cambiarlo, escribe al equipo de la plataforma."
      >
        <Input id="profile-email" value={email} disabled className="bg-muted" />
      </Field>
      <Field
        id="profile-name"
        label="Nombre"
        error={fullName && !parsed.success ? parsed.error.issues[0]?.message : undefined}
      >
        <Input
          id="profile-name"
          autoComplete="name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="bg-card"
        />
      </Field>
      <Button
        type="submit"
        variant="outline"
        disabled={save.isPending || !parsed.success || unchanged}
      >
        {save.isPending ? <Loader2 className="animate-spin" /> : null}
        Guardar nombre
      </Button>
    </form>
  );
}

/* ------------------------------ Password ---------------------------------- */

const accountsQueryKey = ["auth", "accounts"] as const;

function PasswordSection({ email }: { email: string }) {
  const accounts = useQuery({
    queryKey: accountsQueryKey,
    queryFn: async () => {
      const result = await authClient.listAccounts();
      if (result.error) throw new Error(authErrorMessage(result.error.code));
      return result.data;
    },
  });

  if (accounts.isPending) return <LoadingState />;
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

  return (
    <form
      noValidate
      className="max-w-md space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void form.handleSubmit();
      }}
    >
      {/* Lets password managers pair the new password with the right account. */}
      <input type="text" autoComplete="username" hidden readOnly />
      <form.Field
        name="currentPassword"
        validators={{
          onSubmit: ({ value }) => (value ? undefined : "Indica tu contraseña actual"),
        }}
      >
        {(field) => (
          <Field id="current-password" label="Contraseña actual" error={field.state.meta.errors[0]}>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              className="bg-card"
            />
          </Field>
        )}
      </form.Field>
      <form.Field
        name="newPassword"
        validators={{
          onSubmit: ({ value, fieldApi }) =>
            value.length < 8
              ? "Mínimo 8 caracteres"
              : value.length > 128
                ? "Máximo 128 caracteres"
                : value === fieldApi.form.getFieldValue("currentPassword")
                  ? "Debe ser distinta de la actual"
                  : undefined,
        }}
      >
        {(field) => (
          <Field id="new-password" label="Nueva contraseña" error={field.state.meta.errors[0]}>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              className="bg-card"
            />
          </Field>
        )}
      </form.Field>
      <form.Field
        name="confirm"
        validators={{
          onSubmit: ({ value, fieldApi }) =>
            value === fieldApi.form.getFieldValue("newPassword")
              ? undefined
              : "Las contraseñas no coinciden",
        }}
      >
        {(field) => (
          <Field
            id="confirm-password"
            label="Repite la nueva contraseña"
            error={field.state.meta.errors[0]}
          >
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={field.state.value}
              onChange={(e) => field.handleChange(e.target.value)}
              className="bg-card"
            />
          </Field>
        )}
      </form.Field>
      <div className="flex items-center gap-2">
        <Checkbox
          id="revoke-others"
          checked={revokeOthers}
          onCheckedChange={(checked) => setRevokeOthers(checked === true)}
        />
        <Label htmlFor="revoke-others" className="font-normal">
          Cerrar sesión en los demás dispositivos
        </Label>
      </div>
      <FormError message={error} />
      <form.Subscribe selector={(s) => s.isSubmitting}>
        {(isSubmitting) => (
          <Button type="submit" variant="outline" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="animate-spin" /> : null}
            Cambiar contraseña
          </Button>
        )}
      </form.Subscribe>
    </form>
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
    <div className="max-w-md space-y-4">
      <p className="text-sm text-muted-foreground">
        {usesGoogle
          ? "Entras con tu cuenta de Google, así que no tienes contraseña propia."
          : "Tu cuenta todavía no tiene contraseña."}{" "}
        Si quieres poder entrar también con email y contraseña, te enviamos un enlace para crearla.
      </p>
      <Button variant="outline" disabled={send.isPending} onClick={() => send.mutate()}>
        {send.isPending ? <Loader2 className="animate-spin" /> : null}
        Enviarme el enlace
      </Button>
    </div>
  );
}

/* ------------------------------ Sessions ---------------------------------- */

const sessionsQueryKey = ["auth", "sessions"] as const;

/** "Chrome en macOS" from a user agent string (good enough to recognise a device). */
function describeDevice(userAgent: string | null | undefined): { label: string; mobile: boolean } {
  const ua = userAgent ?? "";
  if (!ua) return { label: "Dispositivo desconocido", mobile: false };
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\/|Opera/.test(ua)
      ? "Opera"
      : /Firefox\//.test(ua)
        ? "Firefox"
        : /Chrome\//.test(ua)
          ? "Chrome"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Navegador";
  const os = /iPhone|iPad|iPod/.test(ua)
    ? "iOS"
    : /Android/.test(ua)
      ? "Android"
      : /Mac OS X|Macintosh/.test(ua)
        ? "macOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Linux/.test(ua)
            ? "Linux"
            : null;
  return {
    label: os ? `${browser} en ${os}` : browser,
    mobile: /Mobi|iPhone|Android/.test(ua),
  };
}

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
    return (
      <RowsSkeleton
        framed={false}
        icon
        trailing
        rows={2}
        className="rounded-lg border bg-card"
        label="Cargando sesiones…"
      />
    );
  }
  if (sessions.isError) {
    return <ErrorState error={sessions.error} onRetry={() => void sessions.refetch()} />;
  }
  const others = sessions.data.filter((s) => !s.current);

  return (
    <div className="space-y-4">
      <ul className="divide-y rounded-lg border bg-card">
        {sessions.data.map((s) => {
          const device = describeDevice(s.userAgent);
          const Icon = device.mobile ? Smartphone : Laptop;
          return (
            <li key={s.id} className="flex items-center gap-3 p-3">
              <Icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {device.label}
                  {s.current ? <Pill tone="positive">Este dispositivo</Pill> : null}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  Desde {formatDateTime(s.createdAt)}
                  {s.ipAddress ? ` · IP ${s.ipAddress}` : ""}
                </p>
              </div>
              {!s.current ? (
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={revoke.isPending}
                  onClick={() => revoke.mutate(s.token)}
                  aria-label={`Cerrar sesión en ${device.label}`}
                >
                  Cerrar
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {others.length > 1 ? (
        <Button
          variant="outline"
          disabled={revokeOthers.isPending}
          onClick={() => revokeOthers.mutate()}
        >
          {revokeOthers.isPending ? <Loader2 className="animate-spin" /> : <LogOut />}
          Cerrar las demás sesiones
        </Button>
      ) : null}
    </div>
  );
}

/* ------------------------------ Membership -------------------------------- */

function MembershipSection({ viewer, joinedAt }: { viewer: Viewer; joinedAt: string | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const membership = viewer.membership;

  const leave = useMutation({
    mutationFn: () => api().organizations.removeMember(viewer.user.id),
    onSuccess: async () => {
      toast.success("Has salido de la organización");
      queryClient.clear();
      await router.invalidate();
      await router.navigate({ to: "/onboarding" });
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  if (!membership) {
    return (
      <div className="max-w-md space-y-4">
        <p className="text-sm text-muted-foreground">
          {viewer.isPlatformAdmin
            ? "Como superadministrador no necesitas pertenecer a ninguna organización."
            : "Todavía no perteneces a ninguna organización. Registra tu asociación o pide una invitación."}
        </p>
        {!viewer.isPlatformAdmin ? (
          <Link to="/onboarding" className={buttonVariants({ variant: "outline" })}>
            Registrar asociación
          </Link>
        ) : null}
      </div>
    );
  }

  const org = membership.organization;
  const approved = org.status === "approved";
  return (
    <div className="space-y-6">
      <Facts
        items={[
          { label: ORGANIZATION_KIND_LABELS[org.kind], value: org.name },
          { label: "Tu rol", value: MEMBER_ROLE_LABELS[membership.role] },
          { label: "Estado", value: <OrganizationStatusBadge status={org.status} /> },
          { label: "Miembro desde", value: formatDate(joinedAt) },
        ]}
      />
      <div className="flex flex-wrap gap-2">
        {approved ? (
          <Link to="/ajustes" className={buttonVariants({ variant: "outline" })}>
            Ajustes de la organización
          </Link>
        ) : (
          <Link to="/onboarding" className={buttonVariants({ variant: "outline" })}>
            Ver estado de la solicitud
          </Link>
        )}
        {approved ? (
          <AlertDialog>
            <AlertDialogTrigger
              render={<Button variant="ghost" className="text-negative hover:text-negative" />}
            >
              <LogOut />
              Salir de la organización
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Salir de {org.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Dejarás de ver sus colonias, gatos y acciones. Lo que hayas registrado se
                  conserva. Necesitarás una nueva invitación para volver.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={() => leave.mutate()}>Salir</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </div>
    </div>
  );
}
