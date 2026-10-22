import { useForm } from "@tanstack/react-form";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, redirect, useRouter } from "@tanstack/react-router";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useState } from "react";
import { z } from "zod";

import { Logo } from "#/components/brand/Logo";
import LocaleSwitcher from "#/components/LocaleSwitcher";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { authClient } from "#/lib/auth-client";
import { authConfigQuery } from "#/lib/queries";
import { safeRedirect } from "#/lib/redirect";
import { m } from "#/paraglide/messages";
import { localizeHref } from "#/paraglide/runtime";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/login")({
  validateSearch: searchSchema,
  beforeLoad: ({ context, search }) => {
    if (context.user) {
      throw redirect({ href: safeRedirect(search.redirect) });
    }
  },
  loader: ({ context }) => context.queryClient.ensureQueryData(authConfigQuery),
  head: () => ({ meta: [{ title: `${m.nav_login()} · SpainFolio` }] }),
  component: LoginPage,
});

function LoginPage() {
  const search = Route.useSearch();
  const mode = search.mode ?? "signin";
  const isSignUp = mode === "signup";
  const target = safeRedirect(search.redirect);
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: authConfig } = useSuspenseQuery(authConfigQuery);
  const [error, setError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

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
      // Session-dependent data (e.g. locked opportunity details) must be refetched.
      queryClient.clear();
      await router.invalidate();
      await router.navigate({ href: target });
    },
  });

  const signInWithGoogle = async () => {
    setError(null);
    setGoogleLoading(true);
    const result = await authClient.signIn.social({
      provider: "google",
      callbackURL: localizeHref(target),
    });
    if (result.error) {
      setGoogleLoading(false);
      setError(authErrorMessage(result.error.code));
    }
  };

  return (
    <main className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <section className="flex flex-col px-6 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link to="/" aria-label="SpainFolio">
            <Logo />
          </Link>
          <LocaleSwitcher />
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-12">
          <Link
            to="/"
            className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {m.login_back_home()}
          </Link>
          <h1 className="text-3xl font-medium tracking-tight">
            {isSignUp ? m.login_signup_title() : m.login_title()}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {isSignUp ? m.login_signup_subtitle() : m.login_subtitle()}
          </p>

          <Button
            type="button"
            variant="outline"
            className="mt-8 h-11 w-full rounded-full bg-card"
            disabled={!authConfig.googleEnabled || googleLoading}
            onClick={() => void signInWithGoogle()}
          >
            {googleLoading ? <Loader2 className="animate-spin" /> : <GoogleIcon />}
            {m.login_google()}
          </Button>
          {!authConfig.googleEnabled ? (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {m.login_google_unavailable()}
            </p>
          ) : null}

          <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {m.login_or_email()}
            <span className="h-px flex-1 bg-border" />
          </div>

          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              void form.handleSubmit();
            }}
            className="space-y-4"
          >
            {isSignUp ? (
              <form.Field
                name="name"
                validators={{
                  onSubmit: ({ value }) => (value.trim() ? undefined : m.validation_required()),
                }}
              >
                {(field) => (
                  <FieldShell
                    id={field.name}
                    label={m.login_name()}
                    error={field.state.meta.errors[0]}
                  >
                    <Input
                      id={field.name}
                      autoComplete="name"
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      className="h-11 rounded-xl bg-card"
                    />
                  </FieldShell>
                )}
              </form.Field>
            ) : null}
            <form.Field
              name="email"
              validators={{
                onSubmit: ({ value }) =>
                  z.email().safeParse(value.trim()).success ? undefined : m.validation_email(),
              }}
            >
              {(field) => (
                <FieldShell
                  id={field.name}
                  label={m.login_email()}
                  error={field.state.meta.errors[0]}
                >
                  <Input
                    id={field.name}
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="h-11 rounded-xl bg-card"
                  />
                </FieldShell>
              )}
            </form.Field>
            <form.Field
              name="password"
              validators={{
                onSubmit: ({ value }) =>
                  value.length >= 8 ? undefined : m.validation_password_length(),
              }}
            >
              {(field) => (
                <FieldShell
                  id={field.name}
                  label={m.login_password()}
                  error={field.state.meta.errors[0]}
                >
                  <Input
                    id={field.name}
                    type="password"
                    autoComplete={isSignUp ? "new-password" : "current-password"}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(e) => field.handleChange(e.target.value)}
                    className="h-11 rounded-xl bg-card"
                  />
                </FieldShell>
              )}
            </form.Field>

            {error ? (
              <p
                role="alert"
                className="rounded-xl bg-negative-soft px-3 py-2 text-sm text-negative"
              >
                {error}
              </p>
            ) : null}

            <form.Subscribe selector={(s) => s.isSubmitting}>
              {(isSubmitting) => (
                <Button type="submit" className="h-11 w-full rounded-full" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin" /> : null}
                  {isSignUp ? m.login_create_account() : m.login_submit()}
                </Button>
              )}
            </form.Subscribe>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {isSignUp ? m.login_have_account() : m.login_no_account()}{" "}
            <Link
              to="/login"
              search={{ mode: isSignUp ? "signin" : "signup", redirect: search.redirect }}
              className="font-medium text-foreground underline-offset-4 hover:underline"
              onClick={() => setError(null)}
            >
              {isSignUp ? m.login_switch_signin() : m.login_switch_signup()}
            </Link>
          </p>
        </div>
      </section>

      <LoginShowcase />
    </main>
  );
}

function FieldShell({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: unknown;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {typeof error === "string" ? <p className="text-xs text-negative">{error}</p> : null}
    </div>
  );
}

function authErrorMessage(code: string | undefined): string {
  switch (code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return m.auth_error_invalid_credentials();
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return m.auth_error_user_exists();
    case "PASSWORD_TOO_SHORT":
      return m.validation_password_length();
    default:
      return m.auth_error_generic();
  }
}

function LoginShowcase() {
  return (
    <aside className="hero-gradient relative hidden overflow-hidden p-4 lg:block">
      <div className="hero-grain pointer-events-none absolute inset-0" />
      <div className="relative flex h-full flex-col justify-between rounded-[1.75rem] p-10 text-white">
        <p className="max-w-md text-[34px] leading-[1.1] font-medium tracking-tight">
          {m.login_showcase_quote_start()}{" "}
          <span className="font-serif font-normal italic">{m.login_showcase_quote_accent()}</span>
        </p>
        <div className="grid max-w-md gap-3">
          {[
            [m.login_showcase_point_1_title(), m.login_showcase_point_1_body()],
            [m.login_showcase_point_2_title(), m.login_showcase_point_2_body()],
            [m.login_showcase_point_3_title(), m.login_showcase_point_3_body()],
          ].map(([title, body]) => (
            <div
              key={title}
              className="rounded-2xl bg-white/12 p-4 ring-1 ring-white/20 backdrop-blur"
            >
              <p className="font-medium">{title}</p>
              <p className="mt-1 text-sm text-white/75">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.46a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.58-5.17 3.58-8.81z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.91l-3.88-3.01c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.11A12 12 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.29 14.28A7.2 7.2 0 0 1 4.91 12c0-.79.14-1.56.38-2.28V6.61H1.28A12 12 0 0 0 0 12c0 1.94.46 3.77 1.28 5.39l4.01-3.11z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.61l4.01 3.11C6.23 6.88 8.88 4.77 12 4.77z"
      />
    </svg>
  );
}
