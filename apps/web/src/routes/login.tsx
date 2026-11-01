import { useForm } from "@tanstack/react-form";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { APP_NAME } from "@/components/brand/Logo";
import { AuthLayout } from "@/components/app/AuthLayout";
import { Field, FormError } from "@/components/forms/Field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { authConfigQuery } from "@/lib/queries";
import { safeRedirect } from "@/lib/redirect";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
  redirect: z.string().optional(),
  reset: z.literal("ok").optional(),
});

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  beforeLoad: ({ context, search }) => {
    if (context.viewer) throw redirect({ href: safeRedirect(search.redirect) });
  },
  loader: ({ context }) => context.queryClient.query(authConfigQuery),
  head: ({ match }) => ({
    meta: [
      {
        title: `${match.search.mode === "signup" ? "Crear cuenta" : "Iniciar sesión"} · ${APP_NAME}`,
      },
    ],
  }),
  component: LoginPage,
});

function authErrorMessage(code: string | undefined): string {
  switch (code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "Email o contraseña incorrectos.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "Ya existe una cuenta con este email. Inicia sesión.";
    case "PASSWORD_TOO_SHORT":
      return "La contraseña debe tener al menos 8 caracteres.";
    case "TOO_MANY_REQUESTS":
      return "Demasiados intentos. Espera un minuto.";
    default:
      return "No hemos podido completar la operación. Inténtalo de nuevo.";
  }
}

function LoginPage() {
  const search = Route.useSearch();
  const isSignUp = search.mode === "signup";
  const target = safeRedirect(search.redirect);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: authConfig } = useSuspenseQuery(authConfigQuery);
  const [error, setError] = useState<string | null>(null);

  const form = useForm({
    defaultValues: { name: "", email: "", password: "" },
    onSubmit: async ({ value }) => {
      setError(null);
      const result = isSignUp
        ? await authClient.signUp.email({
            name: value.name.trim(),
            email: value.email.trim(),
            password: value.password,
          })
        : await authClient.signIn.email({ email: value.email.trim(), password: value.password });
      if (result.error) {
        setError(authErrorMessage(result.error.code));
        return;
      }
      queryClient.clear();
      await router.invalidate();
      await router.navigate({ href: isSignUp ? "/onboarding" : target });
    },
  });

  return (
    <AuthLayout
      title={isSignUp ? "Crea tu cuenta" : "Inicia sesión"}
      subtitle={
        isSignUp
          ? "Gratis. Solo te pedimos lo imprescindible."
          : "Accede a tus oportunidades y licitaciones guardadas."
      }
    >
      {search.reset === "ok" ? (
        <p className="mb-4 rounded-lg bg-positive-soft px-3 py-2 text-sm text-positive">
          Contraseña actualizada. Ya puedes iniciar sesión.
        </p>
      ) : null}
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void form.handleSubmit();
        }}
        className="space-y-4"
      >
        {isSignUp ? (
          <form.Field
            name="name"
            validators={{
              onSubmit: ({ value }) => (value.trim() ? undefined : "Indica tu nombre"),
            }}
          >
            {(field) => (
              <Field id="name" label="Tu nombre" error={field.state.meta.errors[0]}>
                <Input
                  id="name"
                  autoComplete="name"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  className="h-10 bg-card"
                />
              </Field>
            )}
          </form.Field>
        ) : null}
        <form.Field
          name="email"
          validators={{
            onSubmit: ({ value }) =>
              z.email().safeParse(value.trim()).success ? undefined : "Introduce un email válido",
          }}
        >
          {(field) => (
            <Field id="email" label="Email profesional" error={field.state.meta.errors[0]}>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="nombre@empresa.es"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(e) => field.handleChange(e.target.value)}
                className="h-10 bg-card"
              />
            </Field>
          )}
        </form.Field>
        <form.Field
          name="password"
          validators={{
            onSubmit: ({ value }) => (value.length >= 8 ? undefined : "Mínimo 8 caracteres"),
          }}
        >
          {(field) => (
            <Field
              id="password"
              label={
                <span className="flex w-full items-center justify-between">
                  Contraseña
                  {!isSignUp ? (
                    <Link
                      to="/recuperar"
                      className="text-xs font-normal text-brand hover:underline"
                    >
                      ¿La has olvidado?
                    </Link>
                  ) : null}
                </span>
              }
              hint={isSignUp ? "Mínimo 8 caracteres." : undefined}
              error={field.state.meta.errors[0]}
            >
              <Input
                id="password"
                type="password"
                autoComplete={isSignUp ? "new-password" : "current-password"}
                value={field.state.value}
                onBlur={field.handleBlur}
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
              {isSignUp ? "Crear cuenta" : "Entrar"}
            </Button>
          )}
        </form.Subscribe>
      </form>

      {authConfig.googleEnabled ? (
        <Button
          type="button"
          variant="outline"
          className="mt-3 h-10 w-full bg-card"
          onClick={() =>
            void authClient.signIn.social({
              provider: "google",
              callbackURL: isSignUp ? "/onboarding" : target,
            })
          }
        >
          Continuar con Google
        </Button>
      ) : null}

      {isSignUp ? (
        <p className="mt-4 text-xs text-muted-foreground">
          Al crear la cuenta aceptas que tratemos tu email y nombre para prestarte el servicio y
          enviarte los avisos que configures. Puedes desactivarlos en cualquier momento.
        </p>
      ) : null}

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {isSignUp ? "¿Ya tienes cuenta?" : "¿Aún no tienes cuenta?"}{" "}
        <Link
          to="/login"
          search={{ mode: isSignUp ? "signin" : "signup", redirect: search.redirect }}
          className="font-medium text-foreground underline-offset-4 hover:underline"
          onClick={() => setError(null)}
        >
          {isSignUp ? "Inicia sesión" : "Regístrate gratis"}
        </Link>
      </p>
    </AuthLayout>
  );
}
