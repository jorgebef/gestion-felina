import { useForm } from "@tanstack/react-form";
import { Link, createFileRoute } from "@tanstack/react-router";
import { Loader2, MailCheck } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { APP_NAME } from "@/components/brand/Logo";
import { AuthLayout } from "@/components/app/AuthLayout";
import { Field } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";

export const Route = createFileRoute("/recuperar")({
  head: () => ({ meta: [{ title: `Recuperar contraseña · ${APP_NAME}` }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const form = useForm({
    defaultValues: { email: "" },
    onSubmit: async ({ value }) => {
      // The response is the same whether or not the account exists (no user enumeration).
      await authClient.requestPasswordReset({
        email: value.email.trim(),
        redirectTo: "/restablecer",
      });
      setSentTo(value.email.trim());
    },
  });

  return (
    <AuthLayout
      title="Recupera tu contraseña"
      subtitle="Te enviaremos un enlace para elegir una nueva."
    >
      {sentTo ? (
        <div className="rounded-xl border bg-card p-5 text-sm">
          <MailCheck className="mb-3 size-5 text-positive" />
          <p>
            Si existe una cuenta con <strong>{sentTo}</strong>, recibirás un correo con el enlace en
            unos minutos. Revisa también la carpeta de spam.
          </p>
        </div>
      ) : (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void form.handleSubmit();
          }}
          className="space-y-4"
        >
          <form.Field
            name="email"
            validators={{
              onSubmit: ({ value }) =>
                z.email().safeParse(value.trim()).success ? undefined : "Introduce un email válido",
            }}
          >
            {(field) => (
              <Field id="email" label="Email" error={field.state.meta.errors[0]}>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={field.state.value}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="h-10 bg-card"
                />
              </Field>
            )}
          </form.Field>
          <form.Subscribe selector={(s) => s.isSubmitting}>
            {(isSubmitting) => (
              <Button type="submit" className="h-10 w-full" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="animate-spin" /> : null}
                Enviar enlace
              </Button>
            )}
          </form.Subscribe>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link to="/login" className="text-muted-foreground hover:text-foreground">
          Volver a iniciar sesión
        </Link>
      </p>
    </AuthLayout>
  );
}
