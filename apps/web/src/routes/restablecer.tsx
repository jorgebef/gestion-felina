import { useForm } from "@tanstack/react-form";
import { Link, createFileRoute, useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { APP_NAME } from "@/components/brand/Logo";
import { AuthLayout } from "@/components/app/AuthLayout";
import { Field, FormError } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/restablecer")({
  validateSearch: z.object({ token: z.string().optional(), error: z.string().optional() }),
  head: () => ({ meta: [{ title: `Nueva contraseña · ${APP_NAME}` }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token, error: linkError } = Route.useSearch();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const form = useForm({
    defaultValues: { password: "", confirm: "" },
    onSubmit: async ({ value }) => {
      setError(null);
      const result = await authClient.resetPassword({ newPassword: value.password, token: token! });
      if (result.error) {
        setError("El enlace no es válido o ha caducado. Solicita uno nuevo.");
        return;
      }
      await navigate({ to: "/login", search: { reset: "ok" } });
    },
  });

  if (!token || linkError) {
    return (
      <AuthLayout title="Enlace no válido" subtitle="El enlace ha caducado o ya se ha usado.">
        <Button asChild className="w-full">
          <Link to="/recuperar">Solicitar un enlace nuevo</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Elige una nueva contraseña">
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
        className="space-y-4"
      >
        <form.Field
          name="password"
          validators={{
            onSubmit: ({ value }) => (value.length >= 8 ? undefined : "Mínimo 8 caracteres"),
          }}
        >
          {(field) => (
            <Field id="password" label="Nueva contraseña" error={field.state.meta.errors[0]}>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                className="h-10 bg-card"
              />
            </Field>
          )}
        </form.Field>
        <form.Field
          name="confirm"
          validators={{
            onSubmit: ({ value, fieldApi }) =>
              value === fieldApi.form.getFieldValue("password")
                ? undefined
                : "Las contraseñas no coinciden",
          }}
        >
          {(field) => (
            <Field id="confirm" label="Repite la contraseña" error={field.state.meta.errors[0]}>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={field.state.value}
                onChange={(e) => field.handleChange(e.target.value)}
                className="h-10 bg-card"
              />
            </Field>
          )}
        </form.Field>
        <FormError message={error} />
        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(isSubmitting) => (
            <Button type="submit" className="h-10 w-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="animate-spin" /> : null}
              Guardar contraseña
            </Button>
          )}
        </form.Subscribe>
      </form>
    </AuthLayout>
  );
}
