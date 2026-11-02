import { useForm } from "@tanstack/react-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { Text, View } from "react-native";
import { z } from "zod";

import { authErrorMessage } from "@felina/client/errors";

import { AuthLayout } from "@/components/app/auth-layout";
import { Button } from "@/components/ui/button";
import { Field, FormError } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { authConfigQuery } from "@/lib/queries";
import { refreshViewer } from "@/lib/session";

export default function Login() {
  const params = useLocalSearchParams<{ mode?: string; redirect?: string }>();
  const isSignUp = params.mode === "signup";
  // Only in-app paths (e.g. an invitation opened before signing in).
  const target = params.redirect?.startsWith("/") ? params.redirect : "/";
  const queryClient = useQueryClient();
  const authConfig = useQuery(authConfigQuery);
  const [error, setError] = useState<string | null>(null);

  // The root layout's guards leave the login screen once the viewer is known; only an
  // explicit destination (e.g. an invitation opened before signing in) needs navigating.
  const done = async () => {
    await refreshViewer(queryClient);
    if (target !== "/") router.replace(target as "/");
  };

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
      await done();
    },
  });

  return (
    <AuthLayout
      title={isSignUp ? "Crea tu cuenta" : "Inicia sesión"}
      subtitle={
        isSignUp
          ? "Después podrás registrar tu asociación o aceptar una invitación."
          : "Accede a las colonias, gatos y acciones de tu organización."
      }
    >
      <View className="gap-4">
        {isSignUp ? (
          <form.Field
            name="name"
            validators={{
              onSubmit: ({ value }) => (value.trim() ? undefined : "Indica tu nombre"),
            }}
          >
            {(field) => (
              <Field label="Tu nombre" error={field.state.meta.errors[0]}>
                <Input
                  autoComplete="name"
                  textContentType="name"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChangeText={field.handleChange}
                  accessibilityLabel="Tu nombre"
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
            <Field label="Email" error={field.state.meta.errors[0]}>
              <Input
                autoComplete="email"
                textContentType="emailAddress"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="nombre@asociacion.org"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChangeText={field.handleChange}
                accessibilityLabel="Email"
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
              label="Contraseña"
              hint={isSignUp ? "Mínimo 8 caracteres." : undefined}
              error={field.state.meta.errors[0]}
            >
              <Input
                secureTextEntry
                autoComplete={isSignUp ? "new-password" : "current-password"}
                textContentType={isSignUp ? "newPassword" : "password"}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChangeText={field.handleChange}
                onSubmitEditing={() => void form.handleSubmit()}
                accessibilityLabel="Contraseña"
              />
            </Field>
          )}
        </form.Field>
        {!isSignUp ? (
          <Link href="/recuperar" className="self-end text-sm text-brand">
            ¿Has olvidado la contraseña?
          </Link>
        ) : null}

        <FormError message={error} />

        <form.Subscribe selector={(s) => s.isSubmitting}>
          {(isSubmitting) => (
            <Button loading={isSubmitting} onPress={() => void form.handleSubmit()}>
              {isSignUp ? "Crear cuenta" : "Entrar"}
            </Button>
          )}
        </form.Subscribe>

        {authConfig.data?.googleEnabled ? (
          <Button
            variant="outline"
            onPress={async () => {
              setError(null);
              const result = await authClient.signIn.social({
                provider: "google",
                callbackURL: "/",
              });
              if (result.error) setError(authErrorMessage(result.error.code));
              else await done();
            }}
          >
            Continuar con Google
          </Button>
        ) : null}

        {isSignUp ? (
          <Text className="text-xs text-muted-foreground">
            Al crear la cuenta aceptas que tratemos tu nombre y email para prestarte el servicio y
            enviarte los avisos de tu organización.
          </Text>
        ) : null}

        <View className="mt-2 flex-row justify-center gap-1">
          <Text className="text-sm text-muted-foreground">
            {isSignUp ? "¿Ya tienes cuenta?" : "¿Aún no tienes cuenta?"}
          </Text>
          <Link
            href={{
              pathname: "/login",
              params: { mode: isSignUp ? "signin" : "signup", redirect: params.redirect },
            }}
            replace
            onPress={() => setError(null)}
            className="text-sm font-medium text-foreground"
          >
            {isSignUp ? "Inicia sesión" : "Crear cuenta"}
          </Link>
        </View>
      </View>
    </AuthLayout>
  );
}
